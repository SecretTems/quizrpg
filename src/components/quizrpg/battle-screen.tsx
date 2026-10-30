"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, LogOut, Hourglass, ShieldQuestion, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatBar, DifficultyBadge, subjectIcon } from "@/components/quizrpg/bits";
import { cn } from "@/lib/utils";
import { api } from "@/lib/store";
import { cryptoShuffle } from "@/lib/game";
import { itemById } from "@/lib/adventure-data";
import { useToast } from "@/hooks/use-toast";
import type { BattleStateDTO, AnswerResultDTO } from "@/lib/types";

interface BattleScreenProps {
  battle: BattleStateDTO;
  playerName: string;
  /** the player's custom profile picture (data URL); empty falls back to 🧙 */
  playerAvatar?: string;
  onBattleEnd: (result: AnswerResultDTO | null) => void;
}

const QUESTION_TIME = 30;

/**
 * Per-question deadlines survive component unmounts - switching tabs during a
 * battle and coming back must NOT hand the player a fresh 30 seconds. Keyed by
 * `battleId:questionNumber:questionId`; cleared when a battle ends.
 */
const TIMER_DEADLINES = new Map<string, number>();

function deadlineFor(key: string): number {
  const existing = TIMER_DEADLINES.get(key);
  if (existing !== undefined) return existing;
  if (TIMER_DEADLINES.size > 400) TIMER_DEADLINES.clear(); // safety valve
  const deadline = Date.now() + QUESTION_TIME * 1000;
  TIMER_DEADLINES.set(key, deadline);
  return deadline;
}

function clearDeadlinesFor(battleId: string) {
  for (const key of [...TIMER_DEADLINES.keys()]) {
    if (key.startsWith(`${battleId}:`)) TIMER_DEADLINES.delete(key);
  }
}

interface Floaty {
  id: number;
  text: string;
  side: "enemy" | "player";
  kind: "damage" | "crit" | "miss";
}

/** Countdown clock that resumes from the stored deadline when remounted. */
function QuestionTimer({
  timerKey,
  active,
  onTimeout,
  storedDeadline,
}: {
  timerKey: string;
  active: boolean;
  onTimeout: () => void;
  /** epoch ms deadline persisted on the battle doc (survives tab/window switches) */
  storedDeadline?: number;
}) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const deadline = storedDeadline ?? deadlineFor(timerKey);
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  });
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(
      () => {
        const deadline = storedDeadline ?? deadlineFor(timerKey);
        setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      },
      500,
    );
    return () => clearInterval(t);
  }, [active, timerKey, storedDeadline]);

  useEffect(() => {
    if (active && timeLeft === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeout();
    }
  }, [active, timeLeft, onTimeout]);

  const urgent = timeLeft <= 5;
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn("flex items-center gap-1.5 text-sm font-bold tabular-nums", urgent ? "text-destructive" : "text-muted-foreground")}
        aria-live="polite"
      >
        <Hourglass className={cn("h-4 w-4", urgent && "animate-pulse")} />
        {timeLeft}s
      </div>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/20" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-destructive" : "bg-[var(--xp)]")}
          style={{ width: `${(timeLeft / QUESTION_TIME) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function BattleScreen({ battle: initialBattle, playerName, playerAvatar, onBattleEnd }: BattleScreenProps) {
  const [battle, setBattle] = useState<BattleStateDTO>(initialBattle);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<AnswerResultDTO | null>(null);
  /** ref mirror of the current display order, used by submitAnswer */
  const displayOrderRef = useRef<number[]>([]);
  /** display position of the correct answer for the currently revealed question */
  const [correctDisplayIndex, setCorrectDisplayIndex] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [floaties, setFloaties] = useState<Floaty[]>([]);
  const [shake, setShake] = useState<"enemy" | "player" | null>(null);
  const floatyId = useRef(0);
  const busyRef = useRef(false);
  const { toast } = useToast();
  /** local loadout mirror - emptied as items are used */
  const [loadout, setLoadout] = useState<(string | null)[]>(() => {
    const raw = (initialBattle.loadout ?? []).slice(0, 3);
    // always render exactly three slots
    return [...raw, null, null, null].slice(0, 3) as (string | null)[];
  });
  const [usingSlot, setUsingSlot] = useState<number | null>(null);
  /** extra seconds added by consumables (Focus Elixir), keyed by the question they apply to */
  const [deadlineBonus, setDeadlineBonus] = useState<{ questionId: string; ms: number } | null>(null);
  /**
   * The active deadline always comes from the current battle question - never a
   * stale copy of the first one. A consumable bonus adds on top only while the
   * question it was bought for is still up.
   */
  const deadline =
    (battle.questionDeadlineAt ?? Date.now()) +
    (deadlineBonus && deadlineBonus.questionId === battle.question?.id ? deadlineBonus.ms : 0);
  /** the timer remounts per question, so a new one always starts from a fresh deadline */
  const timerKey = `${battle.id}:${battle.questionNumber}:${battle.question?.id ?? "none"}`;

  const q = battle.question;
  const phase = revealed ? "reveal" : "asking";
  const streak = revealed ? revealed.streak : battle.streak;

  function pushFloaty(text: string, side: "enemy" | "player", kind: Floaty["kind"]) {
    const id = ++floatyId.current;
    setFloaties((f) => [...f, { id, text, side, kind }]);
    setTimeout(() => setFloaties((f) => f.filter((x) => x.id !== id)), 1150);
  }

  function applyResult(result: AnswerResultDTO) {
    if (result.damageDealt > 0) {
      pushFloaty(result.crit ? `CRIT −${result.damageDealt}!` : `−${result.damageDealt}`, "enemy", result.crit ? "crit" : "damage");
      setShake("enemy");
      setTimeout(() => setShake(null), 500);
    }
    if (result.damageTaken > 0) {
      pushFloaty(`−${result.damageTaken}`, "player", "damage");
      setShake("player");
      setTimeout(() => setShake(null), 500);
    } else if (!result.correct) {
      pushFloaty("MISS", "player", "miss");
    }
    setRevealed(result);
    // the server reports the correct answer by its DATABASE index, but the UI
    // shuffles options — map it to the shuffled display position so the green
    // highlight lands on the right answer the player actually sees
    setCorrectDisplayIndex(
      result.correctIndex >= 0 ? (displayOrderRef.current.indexOf(result.correctIndex)) : -1,
    );
    if (result.monsterDefeated) {
      pushFloaty("💥 DEFEATED!", "enemy", "crit");
    }
    setBattle((b) => ({
      ...b,
      enemyHp: result.enemyHp,
      playerHp: result.playerHp,
      score: result.score,
      xpEarned: result.xpEarned,
      streak: result.streak,
      status: result.status,
      ...(result.enemyName ? { enemyName: result.enemyName } : {}),
      ...(result.enemySprite ? { enemySprite: result.enemySprite } : {}),
      ...(result.enemyImage !== undefined ? { enemyImage: result.enemyImage } : {}),
      ...(result.enemyMaxHp !== undefined ? { enemyMaxHp: result.enemyMaxHp } : {}),
      ...(result.monsterIndex !== undefined ? { monsterIndex: result.monsterIndex } : {}),
      ...(result.totalMonsters !== undefined ? { totalMonsters: result.totalMonsters } : {}),
      ...(result.questionDeadlineAt !== undefined
        ? { questionDeadlineAt: result.questionDeadlineAt }
        : {}),
    }));

    /* auto-advance after reveal */
    setTimeout(() => {
      setRevealed(null);
      setSelected(null);
      setCorrectDisplayIndex(null);
      if (result.status !== "ONGOING") {
        clearDeadlinesFor(battle.id);
        onBattleEnd(result);
      } else if (result.nextQuestion) {
        setBattle((b) => ({
          ...b,
          question: result.nextQuestion,
          questionNumber: result.questionNumber,
        }));
      }
    }, 2300);
  }

  async function submitAnswer(displayIndex: number) {
    if (busyRef.current) return;
    if (displayIndex >= 0 && phase === "reveal") return;
    busyRef.current = true;
    setPending(true);
    // map the shuffled display position back to the question's original index
    const originalIndex = displayIndex >= 0 ? (displayOrderRef.current[displayIndex] ?? displayIndex) : -1;
    if (displayIndex >= 0) setSelected(displayIndex);
    try {
      const result = await api<AnswerResultDTO>(`/api/battle/${battle.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ choiceIndex: originalIndex }),
      });
      applyResult(result);
    } catch {
      busyRef.current = false;
      setPending(false);
      return;
    }
    busyRef.current = false;
    setPending(false);
  }

  async function consumeItem(slot: number) {
    if (busyRef.current || phase === "reveal") return;
    if (!loadout[slot]) return;
    busyRef.current = true;
    setUsingSlot(slot);
    try {
      const res = await api<{
        itemId: string;
        playerHp: number;
        playerMaxHp: number;
        extraSeconds: number;
        loadout: (string | null)[];
        message: string;
      }>(`/api/battle/${battle.id}/item`, { method: "POST", body: JSON.stringify({ slot }) });
      setLoadout(res.loadout);
      setBattle((b) => ({ ...b, playerHp: res.playerHp, playerMaxHp: res.playerMaxHp }));
      if (res.extraSeconds > 0 && battle.question) {
        setDeadlineBonus({ questionId: battle.question.id, ms: res.extraSeconds * 1000 });
      }
      if (res.playerHp > battle.playerHp) {
        pushFloaty(`+${res.playerHp - battle.playerHp}`, "player", "miss");
      }
      toast({ title: `${itemById(res.itemId)?.name ?? "Item"} used`, description: res.message });
    } catch (err) {
      toast({
        title: "Could not use item",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      busyRef.current = false;
      setUsingSlot(null);
    }
  }

  async function flee() {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await api(`/api/battle/${battle.id}/flee`, { method: "POST" });
    } catch {
      /* battle may already be over - still leave the screen */
    }
    busyRef.current = false;
    clearDeadlinesFor(battle.id);
    onBattleEnd(null);
  }

  /* shuffle the answer positions per question encounter (stable while this question is up) */
  const displayOrder = useMemo(() => {
    const options = battle.question?.options ?? [];
    return cryptoShuffle(options.map((_, i) => i));
  }, [battle.question?.id, battle.question?.options.length]);
  useEffect(() => {
    displayOrderRef.current = displayOrder;
  }, [displayOrder]);



  if (!q) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldQuestion className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">No question could be loaded for this battle.</p>
        <Button variant="outline" onClick={() => void flee()}>Return to Arena</Button>
      </div>
    );
  }

  const displayOptions = displayOrder.map((origIdx) => q.options[origIdx]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* top bar: flee + streak + score */}
      <div className="flex items-center justify-between gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Flee
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retreat from battle?</AlertDialogTitle>
              <AlertDialogDescription>
                You will keep the XP you have earned so far, but you forfeit the victory bonus and your score record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Fighting</AlertDialogCancel>
              <AlertDialogAction onClick={() => void flee()}>Flee</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {streak >= 2 && (
              <motion.span
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm font-bold text-orange-600 dark:text-orange-400"
              >
                <Flame className="h-4 w-4 animate-pulse" /> {streak} streak!
              </motion.span>
            )}
          </AnimatePresence>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-bold tabular-nums">
            ⭐ {revealed ? revealed.score : battle.score}
          </span>
        </div>
      </div>

      {/* enemy zone */}
      <motion.div animate={shake === "enemy" ? { x: [0, -8, 7, -4, 2, 0] } : { x: 0 }} transition={{ duration: 0.45 }}>
        <Card className="panel-frame relative overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50 text-5xl animate-floaty sm:h-24 sm:w-24 sm:text-6xl" aria-hidden="true">
              {battle.enemyImage ? (
                <img src={battle.enemyImage} alt="" className="h-full w-full object-cover" />
              ) : (
                battle.enemySprite
              )}
              <AnimatePresence>
                {floaties.filter((f) => f.side === "enemy").map((f) => (
                  <motion.span
                    key={f.id}
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1.25 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                    className={cn(
                      "absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap font-display text-[10px] sm:text-sm",
                      f.kind === "crit" ? "text-orange-500 dark:text-orange-400" : "text-destructive",
                    )}
                  >
                    {f.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xs sm:text-base">{battle.enemyName}</h3>
                <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {(battle.totalMonsters ?? 0) > 1
                    ? `Monster ${(battle.monsterIndex ?? 0) + 1}/${battle.totalMonsters}`
                    : `Tier ${battle.tier}`}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                  {battle.subject === "ALL" ? "Mixed subjects" : battle.subject}
                </span>
              </div>
              <StatBar value={revealed ? revealed.enemyHp : battle.enemyHp} max={battle.enemyMaxHp} kind="enemy" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* question card */}
      <Card className="panel-frame relative">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold">
                {subjectIcon(q.subject)} {q.subject}
              </span>
              <DifficultyBadge difficulty={q.difficulty} />
              {q.status !== "OFFICIAL" && (
                <span className="rounded-md border border-amber-600/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Practice - no rewards
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Question {revealed ? revealed.questionNumber : battle.questionNumber}
              </span>
            </div>
            <QuestionTimer
              key={timerKey}
              timerKey={timerKey}
              active={phase === "asking"}
              onTimeout={() => void submitAnswer(-1)}
              storedDeadline={deadline}
            />
          </div>

          {/* battle loadout - consumables brought from the backpack */}
          {loadout.some(Boolean) && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Battle items">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Items</span>
              {loadout.map((itemId, i) => {
                const def = itemId ? itemById(itemId) : undefined;
                return (
                  <motion.button
                    key={`${i}-${itemId ?? "empty"}`}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    disabled={!def || pending || phase === "reveal" || usingSlot !== null}
                    onClick={() => void consumeItem(i)}
                    title={def ? `${def.name} - ${def.description}` : "Empty slot"}
                    aria-label={def ? `Use ${def.name}` : `Empty item slot ${i + 1}`}
                    className={cn(
                      "flex h-9 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors",
                      def
                        ? "border-primary/50 bg-primary/10 hover:bg-primary/20"
                        : "border-dashed border-border/60 text-muted-foreground opacity-50",
                    )}
                  >
                    {usingSlot === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span aria-hidden="true">🧪</span>}
                    <span className="max-w-24 truncate">{def ? def.name : "—"}</span>
                  </motion.button>
                );
              })}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.p
              key={q.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-base font-semibold leading-relaxed sm:text-lg"
            >
              {q.text}
            </motion.p>
          </AnimatePresence>

          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer choices">
            {displayOptions.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = revealed ? correctDisplayIndex === i : false;
              const isWrongPick = revealed ? isSelected && !revealed.correct : false;
              const disabled = phase === "reveal" || pending;
              return (
                <motion.button
                  key={`${q.id}-${i}`}
                  whileTap={!disabled ? { scale: 0.98 } : undefined}
                  disabled={disabled}
                  onClick={() => void submitAnswer(i)}
                  className={cn(
                    "min-h-11 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-all",
                    "hover:border-primary/60 hover:bg-accent disabled:cursor-default",
                    isCorrect && "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                    isWrongPick && "border-destructive bg-destructive/10",
                    !revealed && isSelected && "border-primary bg-primary/10",
                    !revealed && !isSelected && "border-border bg-card",
                    revealed && !isCorrect && !isWrongPick && "border-border bg-card opacity-50",
                  )}
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted/60 text-[11px] font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {isCorrect && <span className="ml-2" aria-hidden="true">✔</span>}
                  {isWrongPick && <span className="ml-2" aria-hidden="true">✘</span>}
                  {isSelected && pending && !revealed && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                </motion.button>
              );
            })}
          </div>

          {/* explanation strip */}
          <AnimatePresence>
            {revealed && revealed.explanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "overflow-hidden rounded-md border px-3 py-2 text-xs leading-relaxed",
                  revealed.correct ? "border-emerald-600/30 bg-emerald-500/10" : "border-amber-600/30 bg-amber-500/10",
                )}
              >
                <span className="font-bold">
                  {revealed.correct ? "Nice hit! " : revealed.damageTaken > 0 ? "Ouch! " : "Time's up! "}
                </span>
                {revealed.explanation}
                {revealed.xpGained > 0 && <span className="ml-1 font-bold text-[var(--xp)]">+{revealed.xpGained} XP</span>}
                {(revealed.goldDrop ?? 0) > 0 && (
                  <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">💰 +{revealed.goldDrop} gold</span>
                )}
                {(revealed.gemDrop ?? 0) > 0 && (
                  <span className="ml-2 font-bold text-sky-600 dark:text-sky-400">💎 +{revealed.gemDrop} {revealed.gemDrop === 1 ? "gem" : "gems"}</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* player zone */}
      <motion.div animate={shake === "player" ? { x: [0, -8, 7, -4, 2, 0] } : { x: 0 }} transition={{ duration: 0.45 }}>
        <Card className="panel-frame">
          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50 text-4xl" aria-hidden="true">
              {playerAvatar ? <img src={playerAvatar} alt="" className="h-full w-full object-cover" /> : "🧙"}
              <AnimatePresence>
                {floaties.filter((f) => f.side === "player").map((f) => (
                  <motion.span
                    key={f.id}
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -50, scale: 1.2 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                    className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap font-display text-[10px] text-destructive"
                  >
                    {f.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xs sm:text-sm">{playerName}</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                  +{revealed ? revealed.xpEarned : battle.xpEarned} XP this battle
                </span>
              </div>
              <StatBar value={revealed ? revealed.playerHp : battle.playerHp} max={battle.playerMaxHp} kind="hp" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
