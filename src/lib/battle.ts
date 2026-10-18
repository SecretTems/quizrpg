import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, type NormalizedQuestion } from "@/lib/models";
import {
  getTier,
  playerMaxHp,
  levelProgress,
  getMode,
  pickDifficulty,
  ENEMY_TIERS,
  type Difficulty,
  type EnemyTier,
} from "@/lib/game";
import type { BattleModeId } from "@/lib/game";
import type { BattleStateDTO } from "@/lib/types";

export interface BattleQuestion {
  id: string;
  subject: string;
  text: string;
  options: string[];
  difficulty: Difficulty;
  status: "OFFICIAL" | "PENDING" | "REJECTED" | "CUSTOM";
}

/**
 * Draw `wanted` questions for a battle mode.
 *
 * Rules:
 * - players draw from the OFFICIAL bank plus their own CUSTOM questions;
 * - questions never repeat inside one battle unless the eligible pool is
 *   smaller than the question count;
 * - falls back to the official pool of other subjects when the chosen subject
 *   is too small.
 */
export async function drawWave(
  subject: string | string[],
  userId: string,
  tier: number,
  mode: BattleModeId,
  wave = 1,
  excludeIds: string[] = [],
): Promise<BattleQuestion[]> {
  await connectDB();
  // Question limits per difficulty are removed: draw every available question
  // of the selected difficulty instead of a fixed per-mode cap.
  const difficulty = pickDifficulty(mode, wave);

  // battles always draw from the OFFICIAL bank (custom questions are
  // practice-only and never enter the battle pool)
  const poolDocs = await Question.find({ status: "OFFICIAL" }).lean();
  if (poolDocs.length === 0) return [];
  const pool = poolDocs.map(normalizeQuestion);

  // normalize the filter: "ALL" → no filter; a category may list several
  // subjects, so accept string[] too ("ALL" inside the list means no filter)
  const subjectList = Array.isArray(subject)
    ? subject.filter((s) => s && s !== "ALL")
    : subject === "ALL"
      ? []
      : [subject];

  let subjectPool =
    subjectList.length === 0 ? pool : pool.filter((q) => subjectList.includes(q.subject));
  const wanted = subjectPool.filter((q) => q.difficulty === difficulty).length;
  if (subjectPool.length < wanted) {
    // not enough in this subject — mix in official questions from other subjects
    subjectPool = [
      ...subjectPool,
      ...pool.filter((q) => q.status === "OFFICIAL" && !subjectList.includes(q.subject)),
    ];
  }

  const picked: NormalizedQuestion[] = [];
  const used = new Set<string>(excludeIds);
  let allowRepeats = false;

  for (let i = 0; i < wanted; i++) {
    // draw ONLY from the requested difficulty — never fall back to another
    let candidates = subjectPool.filter((q) => q.difficulty === difficulty && !used.has(q.id));
    if (candidates.length === 0 && allowRepeats) {
      // bank exhausted of fresh questions — allow repeats within this difficulty
      candidates = subjectPool.filter((q) => q.difficulty === difficulty);
    }
    if (candidates.length === 0 && !allowRepeats) {
      allowRepeats = true;
      used.clear();
      candidates = subjectPool.filter((q) => q.difficulty === difficulty);
    }
    if (candidates.length === 0) break; // nothing at this difficulty at all
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(choice.id);
    picked.push(choice);
  }

  return picked.map(toBattleQuestion);
}

export function toBattleQuestion(q: NormalizedQuestion): BattleQuestion {
  return {
    id: q.id,
    subject: q.subject,
    text: q.text,
    options: q.options,
    difficulty: q.difficulty,
    status: q.status,
  };
}

/** Serialize a battle document + its current question into the client-safe state. */
export function toBattleState(
  battle: {
    id: string;
    subject: string;
    categoryId?: string;
    tier: number;
    mode?: BattleModeId;
    wave?: number;
    enemyName: string;
    enemySprite?: string;
    enemyImage?: string;
    monsters?: unknown[];
    monsterIndex?: number;
    enemyMaxHp: number;
    enemyHp: number;
    playerMaxHp: number;
    playerHp: number;
    streak: number;
    bestStreak: number;
    score: number;
    xpEarned: number;
    status: string;
    questions: string[];
    cursor: number;
    /** epoch ms deadline for the current question (survives tab/window switches) */
    questionDeadlineAt?: number;
  },
  currentQuestion: BattleQuestion | null,
): BattleStateDTO {
  const tier = getTier(battle.tier);
  const mode = (battle.mode ?? "EASY") as BattleModeId;
  const ids = battle.questions;
  return {
    id: battle.id,
    subject: battle.subject,
    categoryId: battle.categoryId ?? null,
    tier: battle.tier,
    mode,
    wave: battle.wave ?? 1,
    enemyName: battle.enemyName,
    enemySprite: battle.enemySprite ?? tier.sprite,
    enemyImage: battle.enemyImage || null,
    monsterIndex: battle.monsterIndex ?? 0,
    totalMonsters: Array.isArray(battle.monsters) ? battle.monsters.length : 0,
    enemyMaxHp: battle.enemyMaxHp,
    enemyHp: battle.enemyHp,
    playerMaxHp: battle.playerMaxHp,
    playerHp: battle.playerHp,
    streak: battle.streak,
    bestStreak: battle.bestStreak,
    score: battle.score,
    xpEarned: battle.xpEarned,
    status: battle.status as BattleStateDTO["status"],
    question: currentQuestion,
    questionNumber: Math.min(battle.cursor + 1, ids.length),
    totalSeen: ids.length,
    waveNumber: battle.wave ?? 1,
    questionDeadlineAt: battle.questionDeadlineAt ?? undefined,
  };
}

export function loadBattleQuestions(battle: { questions: string[] }): BattleQuestion[] {
  return battle.questions.map((id) => ({ id })) as BattleQuestion[];
}

/** Which tier (if any) was newly unlocked by reaching this level? */
export function newlyUnlockedTier(level: number): EnemyTier | null {
  const t = ENEMY_TIERS.find((tier) => tier.unlockLevel === level);
  return t ?? null;
}

export { getTier, playerMaxHp, levelProgress, getMode };
