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
  subject: string,
  userId: string,
  tier: number,
  mode: BattleModeId,
  wave = 1,
  excludeIds: string[] = [],
  customOnly = false,
): Promise<BattleQuestion[]> {
  await connectDB();
  const wanted = getMode(mode).questionCount;
  const difficulty = pickDifficulty(mode, wave);

  // official bank + the player's own custom questions (user-made questions are
  // only visible to their creator unless made official)
  const poolDocs = await Question.find(
    customOnly
      ? { status: "CUSTOM", ownerId: userId }
      : { $or: [{ status: "OFFICIAL" }, { status: "CUSTOM", ownerId: userId }] },
  ).lean();
  if (poolDocs.length === 0) return [];
  const pool = poolDocs.map(normalizeQuestion);

  let subjectPool = subject === "ALL" ? pool : pool.filter((q) => q.subject === subject);
  if (subjectPool.length < wanted && !customOnly) {
    // not enough in this subject — mix in official questions from other subjects
    subjectPool = [
      ...subjectPool,
      ...pool.filter((q) => q.status === "OFFICIAL" && q.subject !== subject),
    ];
  }

  const picked: NormalizedQuestion[] = [];
  const used = new Set<string>(excludeIds);
  let allowRepeats = false;

  for (let i = 0; i < wanted; i++) {
    let candidates = subjectPool.filter((q) => q.difficulty === difficulty && !used.has(q.id));
    if (candidates.length === 0) candidates = subjectPool.filter((q) => !used.has(q.id));
    if (candidates.length === 0) {
      // official bank is insufficient — only then allow repeats
      if (allowRepeats) {
        candidates = subjectPool.filter((q) => q.difficulty === difficulty);
        if (candidates.length === 0) candidates = subjectPool;
      } else {
        allowRepeats = true;
        used.clear();
        candidates = subjectPool.filter((q) => q.difficulty === difficulty);
        if (candidates.length === 0) candidates = subjectPool;
      }
    }
    if (candidates.length === 0) break;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(choice.id);
    picked.push(choice);
  }

  return picked.map(toBattleQuestion);
}

export function toBattleQuestion(q: NormalizedQuestion): BattleQuestion {
  return {
    id: q.id,
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
    tier: number;
    mode?: BattleModeId;
    wave?: number;
    enemyName: string;
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
  },
  currentQuestion: BattleQuestion | null,
): BattleStateDTO {
  const tier = getTier(battle.tier);
  const mode = (battle.mode ?? "EASY") as BattleModeId;
  const ids = battle.questions;
  return {
    id: battle.id,
    subject: battle.subject,
    tier: battle.tier,
    mode,
    wave: battle.wave ?? 1,
    enemyName: battle.enemyName,
    enemySprite: tier.sprite,
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
