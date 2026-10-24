"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, Swords, RotateCcw, Trophy, Skull, ArrowUpCircle, Sparkles, Shield, ShoppingBag, Users, Crown, Gift, Search, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api, useAuth } from "@/lib/store";
import { BATTLE_MODES, levelProgress, type BattleModeId } from "@/lib/game";
import { BattleScreen } from "@/components/quizrpg/battle-screen";
import { EquipmentView } from "@/components/quizrpg/equipment-view";
import { ShopView } from "@/components/quizrpg/shop-view";
import { GachaView } from "@/components/quizrpg/gacha-view";
import { DailyBonusView } from "@/components/quizrpg/daily-bonus-view";
import { cn } from "@/lib/utils";
import type { BattleStateDTO, AnswerResultDTO } from "@/lib/types";
import type { NormalizedCategory, NormalizedUser } from "@/lib/models";

interface ArenaViewProps {
  onStatsChanged: () => void;
}

export function ArenaView({ onStatsChanged }: ArenaViewProps) {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<string[]>([]);
  void subjects; void setSubjects; // kept for the battle-start payload shape; subject grid now comes from the category
  const [subject, setSubject] = useState<string>("ALL");
  const [tier, setTier] = useState<number>(1);
  const [mode, setMode] = useState<BattleModeId>("EASY");
  const [categories, setCategories] = useState<NormalizedCategory[]>([]);
  /** search text for the category picker in the Play modal */
  const [categorySearch, setCategorySearch] = useState("");
  /** Play modal category filter: official vs player-made */
  const [categoryFilter, setCategoryFilter] = useState<"OFFICIAL" | "CUSTOM">("OFFICIAL");
  /** selected DB Adventure category opponent - overrides the static tier roster */
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleStateDTO | null>(null);
  const [resumable, setResumable] = useState<BattleStateDTO | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<AnswerResultDTO | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ subject: string; tier: number; mode: BattleModeId; categoryId: string | null; enemyName: string } | null>(null);

  /* Play modal + side feature dialogs */
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showGacha, setShowGacha] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [profile, setProfile] = useState<NormalizedUser | null>(null);

  const level = user ? levelProgress(user.xp).level : 1;

  /** categories shown in the Play modal after the Official/Custom filter + search */
  const visibleCategories = categories.filter((c) => {
    if (categoryFilter === "OFFICIAL" && c.status !== "OFFICIAL") return false;
    if (categoryFilter === "CUSTOM" && c.status === "OFFICIAL") return false;
    const q = categorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.subjects.some((s) => s.toLowerCase().includes(q)) ||
      (c.monsters ?? []).some((m) => m.name.toLowerCase().includes(q))
    );
  });
  /** first category (or the selected one) starts expanded */
  const openCategoryKey = categoryId ?? visibleCategories[0]?.id ?? "";
  /** the currently picked category object (drives the "subjects in this category" panel) */
  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  /**
   * Re-fetch the full profile snapshot (gold/gems/backpack/equipment) that the
   * Shop, Gacha and Equipment dialogs render - the auth store copy doesn't
   * carry those fields, so the dialogs need this after every wallet change.
   */
  const refreshProfile = useCallback(async () => {
    try {
      const p = await api<{ user: NormalizedUser }>("/api/auth/me");
      setProfile(p.user);
    } catch {
      /* keep the previous snapshot */
    }
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, b, p, c] = await Promise.all([
          api<{ subjects: string[] }>("/api/subjects"),
          api<{ battle: BattleStateDTO | null }>("/api/battle"),
          api<{ user: NormalizedUser }>("/api/auth/me"),
          api<{ categories: NormalizedCategory[] }>("/api/categories").catch(() => ({ categories: [] as NormalizedCategory[] })),
        ]);
        if (cancelled) return;
        setSubjects(d.subjects);
        setResumable(b.battle);
        setProfile(p.user);
        // GET already scopes: official categories + your own (private/pending) ones
        setCategories(c.categories);
      } catch {
        if (!cancelled) {
          setSubjects([]);
          setResumable(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startBattle = useCallback(
    async (subj: string, t: number, m: BattleModeId, catId: string | null = null) => {
      setStarting(true);
      try {
        const data = await api<{ battle: BattleStateDTO }>("/api/battle", {
          method: "POST",
          body: JSON.stringify({ subject: subj, tier: t, mode: m, categoryId: catId ?? undefined }),
        });
        setBattle(data.battle);
        setResumable(null);
        setShowPlayModal(false);
        setLastMeta({ subject: subj, tier: t, mode: m, categoryId: data.battle.categoryId, enemyName: data.battle.enemyName });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not start battle.";
        if (message.toLowerCase().includes("ongoing")) {
          // resume instead
          try {
            const d = await api<{ battle: BattleStateDTO | null }>("/api/battle");
            if (d.battle) {
              setBattle(d.battle);
              setResumable(null);
              setShowPlayModal(false);
              setLastMeta({ subject: d.battle.subject, tier: d.battle.tier, mode: d.battle.mode, categoryId: d.battle.categoryId, enemyName: d.battle.enemyName });
              return;
            }
          } catch { /* fall through */ }
        }
        toast({ title: "Cannot start battle", description: message, variant: "destructive" });
      } finally {
        setStarting(false);
      }
    },
    [toast],
  );

  function handleBattleEnd(r: AnswerResultDTO | null) {
    setBattle(null);
    if (r) {
      setResult(r);
      setShowResult(true);
      if (r.leveledUp) {
        toast({ title: `⬆️ Level Up!`, description: `You reached level ${r.newLevel}.` });
      }
      if (r.unlockedTier) {
        toast({ title: "🗝️ New challenger unlocked!", description: `${r.unlockedTier.sprite} ${r.unlockedTier.name} awaits at Tier ${r.unlockedTier.tier}.` });
      }
    }
    void refreshProfile();
    onStatsChanged();
  }

  async function handleFleeEnd() {
    setBattle(null);
    void refreshUser();
    onStatsChanged();
    toast({ title: "You fled the battle", description: "Sometimes living to study another day is the winning move." });
  }
  void handleFleeEnd;

  /* ---------- in-battle ---------- */
  if (battle && user) {
    return (
      <BattleScreen
        battle={battle}
        playerName={user.displayName}
        onBattleEnd={handleBattleEnd}
      />
    );
  }

  const lp = levelProgress(user?.xp ?? 0);

  /* ---------- setup ---------- */
  return (
    <div className="space-y-6">
      {resumable && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Swords className="h-5 w-5 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">An unfinished battle awaits</p>
                <p className="text-xs text-muted-foreground">
                  {resumable.enemySprite} {resumable.enemyName} - your HP {resumable.playerHp}/{resumable.playerMaxHp}, enemy HP {resumable.enemyHp}/{resumable.enemyMaxHp}
                </p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => { setBattle(resumable); setResumable(null); }}>
                <Play className="h-3.5 w-3.5" /> Resume
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={async () => {
                  await api(`/api/battle/${resumable.id}/flee`, { method: "POST" }).catch(() => undefined);
                  setResumable(null);
                }}
              >
                Abandon
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div>
        <h2 className="font-display text-lg">⚔️ Adventure</h2>
        <p className="text-sm text-muted-foreground">
          Pick a subject and an opponent. Every correct answer strikes the enemy - wrong answers let it strike you.
        </p>
      </div>

      {/* step 1 - subject */}
      <Dialog open={showPlayModal} onOpenChange={setShowPlayModal}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-4 sm:max-w-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="font-display text-xl">Categories</DialogTitle>
          </DialogHeader>

          {/* top bar: Official / Custom filter + category search */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "OFFICIAL", label: "Official" },
                { id: "CUSTOM", label: "Custom" },
              ] as const
            ).map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={categoryFilter === f.id ? "secondary" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => setCategoryFilter(f.id)}
              >
                {f.label}
              </Button>
            ))}
            <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {/* scrollable category list with expandable monster lineups */}
          <div className="max-h-[38vh] min-h-[180px] space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-2">
            {visibleCategories.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No {categoryFilter === "CUSTOM" ? "custom " : ""}categories match "{categorySearch || "your filter"}".
              </p>
            ) : (
              <Accordion type="multiple" defaultValue={[openCategoryKey]} className="space-y-1">
                {visibleCategories.map((c) => {
                  const key = c.id;
                  const active = categoryId === c.id;
                  return (
                    <AccordionItem key={key} value={key} className="rounded-lg border-none">
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                          active ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-accent/50",
                        )}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
                          onClick={() => {
                            setCategoryId(c.id);
                            setTier(1);
                          }}
                          aria-pressed={active}
                        >
                          <span className="shrink-0 text-xl" aria-hidden="true">
                            {c.icon ? <img src={c.icon} alt="" className="h-7 w-7 rounded object-cover" /> : c.monsters?.[0]?.emoji || c.enemy.emoji}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={c.description || c.name}>
                            {c.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              c.status === "OFFICIAL"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {c.status === "OFFICIAL" ? "Official" : "Custom"}
                          </span>
                        </button>
                        <AccordionTrigger className="h-8 w-8 shrink-0 justify-center rounded-md p-0 hover:no-underline [&>svg]:h-4 [&>svg]:w-4" />
                      </div>
                      <AccordionContent className="px-1 pb-2">
                        {c.description && (
                          <p className="mb-2 px-2 text-[11px] text-muted-foreground">{c.description}</p>
                        )}
                        {(c.monsters?.length ?? 0) > 0 && (
                          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                            {c.monsters!.map((m, mi) => (
                              <div
                                key={mi}
                                className="flex w-28 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-card p-2 text-center"
                              >
                                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-3xl" aria-hidden="true">
                                  {m.image ? <img src={m.image} alt="" className="h-full w-full object-cover" /> : m.emoji}
                                </span>
                                <span className="w-full truncate text-[10px] font-bold" title={m.name}>{m.name}</span>
                                <span className="flex w-full flex-wrap justify-center gap-1 text-[9px] font-bold">
                                  <span className="rounded bg-red-600/15 px-1 py-0.5 text-red-600 dark:text-red-400">HP {m.hp}</span>
                                  <span className="rounded bg-orange-600/15 px-1 py-0.5 text-orange-600 dark:text-orange-400">ATK {m.atkMin}-{m.atkMax}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 px-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Subjects:</span>
                          {c.subjects.map((s) => (
                            <span key={s} className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold">
                              {s}
                            </span>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>

          {/* bottom panel: category subjects | separator | difficulty selector */}
          <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <h4 className="mb-1.5 text-sm font-bold">Subjects in this category</h4>
              {selectedCategory ? (
                selectedCategory.subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCategory.subjects.map((s) => (
                      <span key={s} className="rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-1 text-xs font-semibold">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No subjects listed - questions from every pool may appear.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Select a category above to see its subjects.</p>
              )}
            </div>

            <div className="hidden w-px shrink-0 bg-border sm:block" aria-hidden="true" />
            <div className="h-px w-full shrink-0 bg-border sm:hidden" aria-hidden="true" />

            <div className="w-full sm:w-64">
              <h4 className="mb-1.5 text-sm font-bold">Difficulty</h4>
              {(() => {
                // browse ALL modes; locked ones show their unlock level and block Start
                const idx = Math.max(0, BATTLE_MODES.findIndex((m) => m.id === mode));
                const current = BATTLE_MODES[idx] ?? BATTLE_MODES[0];
                const locked = level < current.unlockLevel;
                const total = BATTLE_MODES.length;
                const cycle = (dir: 1 | -1) => {
                  const next = BATTLE_MODES[(idx + dir + total) % total];
                  if (next) setMode(next.id);
                };
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-11 w-9 shrink-0"
                        disabled={starting}
                        aria-label="Previous difficulty"
                        onClick={() => cycle(-1)}
                      >
                        ◀
                      </Button>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Difficulty ${current.label}, click to cycle`}
                        onClick={() => cycle(1)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") cycle(1);
                        }}
                        className={cn(
                          "flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 px-2 py-1 text-center font-display leading-tight",
                          locked ? "border-border bg-muted/40 text-muted-foreground" : "border-primary bg-primary/10",
                        )}
                      >
                        <span className="text-sm">{current.label}</span>
                        {locked && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <Lock className="h-3 w-3" /> Unlocks at Lv {current.unlockLevel}
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-11 w-9 shrink-0"
                        disabled={starting}
                        aria-label="Next difficulty"
                        onClick={() => cycle(1)}
                      >
                        ▶
                      </Button>
                    </div>
                    <p className="text-center text-[11px] text-muted-foreground">{current.description}</p>
                    <p className="text-center text-xs font-bold text-[var(--xp)]">+{current.rewardXp} XP bonus</p>
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 pt-3 sm:justify-between">
            <Button variant="outline" onClick={() => setShowPlayModal(false)}>Cancel</Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={starting}
                onClick={() => void startBattle("ALL", tier, "INFINITE", categoryId)}
                title="Endless waves that keep getting harder"
              >
                ♾️ Infinite Mode
              </Button>
              <Button
                className="gap-2"
                disabled={starting || level < (BATTLE_MODES.find((m) => m.id === mode)?.unlockLevel ?? 1)}
                onClick={() => void startBattle(subject, tier, mode, categoryId)}
              >
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {starting ? "Entering…" : "Start Adventure"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* main action buttons - 2 columns */}
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {/* left column - battles */}
        <div className="flex flex-col gap-3">
          <Button
            className="h-auto w-full items-start gap-4 px-5 py-5 text-left shadow-lg"
            onClick={() => setShowPlayModal(true)}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/20" aria-hidden="true">
              <Play className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl leading-tight">Play</span>
              <span className="mt-1 block break-words text-sm font-normal opacity-90">
                Pick a subject, difficulty, and opponent.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            disabled
            title="Coming soon"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <Users className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Multiplayer</span>
              <span className="block text-xs font-normal text-muted-foreground">Battle other players - coming soon.</span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            disabled
            title="Coming soon"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <Crown className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Quiz Boss</span>
              <span className="block text-xs font-normal text-muted-foreground">Face the ultimate quiz gauntlet - coming soon.</span>
            </span>
          </Button>
        </div>

        {/* right column - progression */}
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            onClick={() => setShowEquipment(true)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <Shield className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Equipment</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Equip weapons, armor, and accessories you&apos;ve earned.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            onClick={() => setShowShop(true)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Shop</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Spend gold on potions, boosts, and bombs.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            onClick={() => setShowGacha(true)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Gacha</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Spend gems for a chance at rare and legendary gear.
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
            onClick={() => setShowDaily(true)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <Gift className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Daily</span>
              <span className="block text-xs font-normal text-muted-foreground">Claim your daily login bonus.</span>
            </span>
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {lp.current}/{lp.needed} XP into level {lp.level}
      </p>

      {/* result dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md">
          {result && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-center justify-center text-xl">
                  {result.status === "WON" ? (
                    <><Trophy className="h-6 w-6 text-[var(--xp)]" /> Victory!</>
                  ) : (
                    <><Skull className="h-6 w-6 text-destructive" /> Defeated…</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {result.status === "WON"
                    ? `You vanquished the ${lastMeta?.enemyName ?? "enemy"}! Your study grind is paying off.`
                    : `The ${lastMeta?.enemyName ?? "enemy"} was too strong this time. Review the explanations and come back stronger!`}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
                  <p className="text-lg font-bold tabular-nums">{result.score}{result.victoryBonus ? ` +${result.victoryBonus.score}` : ""}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">XP earned</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--xp)]">
                    {result.xpEarned}{result.victoryBonus ? ` +${result.victoryBonus.xp}` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Best streak</p>
                  <p className="text-lg font-bold tabular-nums">🔥 {result.streak}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining HP</p>
                  <p className="text-lg font-bold tabular-nums">{result.status === "WON" ? "Enemy: 0" : `You: ${result.playerHp}`}</p>
                </div>
              </div>

              {((result.goldDrop ?? 0) > 0 || (result.gemDrop ?? 0) > 0) && (
                <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-center text-sm font-bold">
                  {result.goldDrop > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">💰 +{result.goldDrop} gold</span>
                  )}
                  {result.goldDrop > 0 && result.gemDrop > 0 && (
                    <span className="mx-2 text-muted-foreground">·</span>
                  )}
                  {result.gemDrop > 0 && (
                    <span className="text-sky-600 dark:text-sky-400">
                      💎 +{result.gemDrop} {result.gemDrop === 1 ? "gem" : "gems"}
                    </span>
                  )}
                </div>
              )}

              {result.leveledUp && (
                <div className="flex items-center gap-2 rounded-lg border border-[var(--xp)]/40 bg-[color-mix(in_oklab,var(--xp)_12%,transparent)] px-3 py-2 text-sm font-bold">
                  <ArrowUpCircle className="h-4 w-4 text-[var(--xp)]" /> Level up! You are now level {result.newLevel}.
                </div>
              )}
              {result.unlockedTier && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-bold">
                  <Sparkles className="h-4 w-4 text-primary" /> New opponent unlocked: {result.unlockedTier.sprite} {result.unlockedTier.name}!
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowResult(false)}>
                  Back to Adventure
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={() => {
                    setShowResult(false);
                    void startBattle(lastMeta?.subject ?? subject, lastMeta?.tier ?? tier, lastMeta?.mode ?? mode, lastMeta?.categoryId ?? null);
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Battle Again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EquipmentView
        open={showEquipment}
        onOpenChange={setShowEquipment}
        user={profile}
        onRefresh={() => void refreshProfile()}
      />
      <ShopView
        open={showShop}
        onOpenChange={setShowShop}
        user={profile}
        onRefresh={() => void refreshProfile()}
      />
      <GachaView
        open={showGacha}
        onOpenChange={setShowGacha}
        user={profile}
        onRefresh={() => void refreshProfile()}
      />
      <DailyBonusView
        open={showDaily}
        onOpenChange={setShowDaily}
        user={profile}
        onRefresh={() => void refreshProfile()}
      />
    </div>
  );
}
