"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, Play, Swords, RotateCcw, Trophy, Skull, ArrowUpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/store";
import { ENEMY_TIERS, BATTLE_MODES, levelProgress, getMode, type BattleModeId } from "@/lib/game";
import { subjectIcon } from "@/components/quizrpg/bits";
import { BattleScreen } from "@/components/quizrpg/battle-screen";
import { cn } from "@/lib/utils";
import type { BattleStateDTO, AnswerResultDTO } from "@/lib/types";

interface ArenaViewProps {
  onStatsChanged: () => void;
}

export function ArenaView({ onStatsChanged }: ArenaViewProps) {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("ALL");
  const [customOnly, setCustomOnly] = useState(false);
  const [tier, setTier] = useState<number>(1);
  const [mode, setMode] = useState<BattleModeId>("EASY");
  const [battle, setBattle] = useState<BattleStateDTO | null>(null);
  const [resumable, setResumable] = useState<BattleStateDTO | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<AnswerResultDTO | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ subject: string; tier: number; mode: BattleModeId; customOnly: boolean; enemyName: string } | null>(null);

  const level = user ? levelProgress(user.xp).level : 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, b] = await Promise.all([
          api<{ subjects: string[] }>("/api/subjects"),
          api<{ battle: BattleStateDTO | null }>("/api/battle"),
        ]);
        if (cancelled) return;
        setSubjects(d.subjects);
        setResumable(b.battle);
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
    async (subj: string, t: number, m: BattleModeId, useCustomOnly = customOnly) => {
      setStarting(true);
      try {
        const data = await api<{ battle: BattleStateDTO }>("/api/battle", {
          method: "POST",
          body: JSON.stringify({ subject: subj, tier: t, mode: m, customOnly: useCustomOnly }),
        });
        setBattle(data.battle);
        setResumable(null);
        setLastMeta({ subject: subj, tier: t, mode: m, customOnly: useCustomOnly, enemyName: data.battle.enemyName });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not start battle.";
        if (message.toLowerCase().includes("ongoing")) {
          // resume instead
          try {
            const d = await api<{ battle: BattleStateDTO | null }>("/api/battle");
            if (d.battle) {
              setBattle(d.battle);
              setResumable(null);
              setLastMeta({ subject: d.battle.subject, tier: d.battle.tier, mode: d.battle.mode, customOnly: false, enemyName: d.battle.enemyName });
              return;
            }
          } catch { /* fall through */ }
        }
        toast({ title: "Cannot start battle", description: message, variant: "destructive" });
      } finally {
        setStarting(false);
      }
    },
    [toast, customOnly],
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
    void refreshUser();
    onStatsChanged();
  }

  async function handleFleeEnd() {
    setBattle(null);
    void refreshUser();
    onStatsChanged();
    toast({ title: "You fled the battle", description: "Sometimes living to study another day is the winning move." });
  }

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
                  {resumable.enemySprite} {resumable.enemyName} — your HP {resumable.playerHp}/{resumable.playerMaxHp}, enemy HP {resumable.enemyHp}/{resumable.enemyMaxHp}
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
        <h2 className="font-display text-lg">⚔️ Battle Arena</h2>
        <p className="text-sm text-muted-foreground">
          Pick a subject and an opponent. Every correct answer strikes the enemy — wrong answers let it strike you.
        </p>
      </div>

      {/* step 1 — subject */}
      <Card className="panel-frame">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1 · Choose your study subject</CardTitle>
          <CardDescription>Battles draw from the official bank plus your own custom questions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubject("ALL")}
            aria-pressed={subject === "ALL"}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all",
              subject === "ALL" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent",
            )}
          >
            <span aria-hidden="true">🎲</span> All Subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              aria-pressed={subject === s}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all",
                subject === s ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent",
              )}
            >
              <span aria-hidden="true">{subjectIcon(s)}</span> {s}
            </button>
          ))}
          {subjects.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No subjects available yet — add questions in the Question Bank, or use All Subjects once the admin seeds the bank.
            </p>
          )}
        </CardContent>
      </Card>

      {/* step 2 — difficulty / battle mode */}
      <Card className="panel-frame">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2 · Choose your difficulty</CardTitle>
          <CardDescription>
            Harder modes ask more questions with bigger rewards. New modes unlock as you level up.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BATTLE_MODES.map((m) => {
            const locked = level < m.unlockLevel;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                disabled={locked}
                onClick={() => setMode(m.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all",
                  active && !locked
                    ? "border-primary bg-primary/10 shadow-[0_0_18px_-6px_var(--primary)]"
                    : "border-border hover:border-primary/50 hover:bg-accent",
                  locked && "cursor-not-allowed opacity-60",
                )}
              >
                {locked && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Lock className="h-3 w-3" /> Lv {m.unlockLevel}
                  </span>
                )}
                <span className="block font-display text-xs">{m.label}</span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{m.description}</span>
                <span className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                  <span className="rounded bg-sky-600/15 px-1.5 py-0.5 text-sky-600 dark:text-sky-400">{m.questionCount} Qs</span>
                  <span className="rounded bg-[color-mix(in_oklab,var(--xp)_18%,transparent)] px-1.5 py-0.5 text-[var(--xp)]">+{m.rewardXp} XP</span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* step 3 — opponent, grouped by category */}
      <Card className="panel-frame">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">3 · Choose your opponent</CardTitle>
          <CardDescription>
            Opponents are grouped by category — grade level or subject focus. New tiers unlock as you level up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from(new Set(ENEMY_TIERS.map((t) => t.category))).map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">📂 {cat}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ENEMY_TIERS.filter((t) => t.category === cat).map((t) => {
                  const locked = level < t.unlockLevel;
                  const active = tier === t.tier;
                  return (
                    <button
                      key={t.tier}
                      disabled={locked}
                      onClick={() => setTier(t.tier)}
                      aria-pressed={active}
                      className={cn(
                        "relative rounded-xl border-2 p-4 text-left transition-all",
                        active && !locked
                          ? "border-primary bg-primary/10 shadow-[0_0_18px_-6px_var(--primary)]"
                          : "border-border hover:border-primary/50 hover:bg-accent",
                        locked && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {locked && (
                        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          <Lock className="h-3 w-3" /> Lv {t.unlockLevel}
                        </span>
                      )}
                      <span className={cn("block text-4xl", active && !locked && "animate-floaty")} aria-hidden="true">
                        {t.sprite}
                      </span>
                      <span className="mt-2 block font-display text-xs">{t.name}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{t.blurb}</span>
                      <span className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
                        <span className="rounded bg-red-600/15 px-1.5 py-0.5 text-red-600 dark:text-red-400">HP {t.maxHp}</span>
                        <span className="rounded bg-orange-600/15 px-1.5 py-0.5 text-orange-600 dark:text-orange-400">ATK {t.atkMin}–{t.atkMax}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--primary)]"
            checked={customOnly}
            onChange={(e) => setCustomOnly(e.target.checked)}
          />
          🧩 Custom bank only
          <span className="font-normal text-muted-foreground">(practice — no rewards)</span>
        </label>
        <Button size="lg" className="gap-2 px-10" disabled={starting} onClick={() => void startBattle(subject, tier, mode)}>
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
          {starting ? "Entering…" : "Start Battle"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {lp.current}/{lp.needed} XP into level {lp.level} · {getMode(mode).questionCount} questions ({getMode(mode).label}) · 30s each
        </p>
      </div>

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
                  Back to Arena
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={() => {
                    setShowResult(false);
                    void startBattle(lastMeta?.subject ?? subject, lastMeta?.tier ?? tier, lastMeta?.mode ?? mode, lastMeta?.customOnly ?? customOnly);
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Battle Again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
