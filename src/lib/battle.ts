import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, type NormalizedQuestion } from "@/lib/models";
import {
  getTier,
  playerMaxHp,
  pickDifficulty,
  levelProgress,
  QUESTIONS_PER_WAVE,
  ENEMY_TIERS,
  type EnemyTier,
} from "@/lib/game";
import type { BattleStateDTO } from "@/lib/types";

export interface BattleQuestion {
  id: string;
  text: string;
  options: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

/**
 * Draw a wave of questions: prefers the chosen subject (global + player-owned);
 * falls back to the global pool (any subject) when the pool is too small.
 */
export async function drawWave(
  subject: string,
  userId: string,
  tier: number,
  excludeIds: string[] = [],
): Promise<BattleQuestion[]> {
  await connectDB();
  const wanted = QUESTIONS_PER_WAVE;

  const poolDocs = await Question.find({ $or: [{ ownerId: null }, { ownerId: userId }] }).lean();
  if (poolDocs.length === 0) return [];
  const pool = poolDocs.map(normalizeQuestion);

  let subjectPool = subject === "ALL" ? pool : pool.filter((q) => q.subject === subject);
  if (subjectPool.length < 5) {
    // not enough in this subject — mix in global questions from other subjects
    subjectPool = [...subjectPool, ...pool.filter((q) => q.ownerId === null && !subjectPool.includes(q))];
  }
  if (subjectPool.length === 0) return [];

  const picked: NormalizedQuestion[] = [];
  const used = new Set<string>(excludeIds);
  for (let i = 0; i < wanted; i++) {
    const difficulty = pickDifficulty(tier);
    let candidates = subjectPool.filter((q) => q.difficulty === difficulty && !used.has(q.id));
    if (candidates.length === 0) candidates = subjectPool.filter((q) => !used.has(q.id));
    if (candidates.length === 0) {
      // everything used — allow repeats
      used.clear();
      candidates = subjectPool.filter((q) => q.difficulty === difficulty);
      if (candidates.length === 0) candidates = subjectPool;
    }
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
  };
}

/** Serialize a battle document + its current question into the client-safe state. */
export function toBattleState(
  battle: {
    id: string;
    subject: string;
    tier: number;
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
  const ids = battle.questions;
  return {
    id: battle.id,
    subject: battle.subject,
    tier: battle.tier,
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

export { getTier, playerMaxHp, levelProgress };
