import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, type NormalizedQuestion } from "@/lib/models";
import {
  getTier,
  playerMaxHp,
  levelProgress,
  getMode,
  pickDifficulty,
  ENEMY_TIERS,
  cryptoInt,
  cryptoShuffle,
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
  
  timerSeconds: number;
}



export async function drawWave(
  subject: string | string[],
  userId: string,
  tier: number,
  mode: BattleModeId,
  wave = 1,
  excludeIds: string[] = [],
  
  extraOwnerIds: string[] = [],
): Promise<BattleQuestion[]> {
  await connectDB();
  
  
  const difficulty = pickDifficulty(mode, wave);

  
  
  
  const poolDocs = await Question.find(
    extraOwnerIds.length > 0
      ? { $or: [{ status: "OFFICIAL" }, { status: "CUSTOM", ownerId: { $in: extraOwnerIds } }] }
      : { status: "OFFICIAL" },
  ).lean();
  if (poolDocs.length === 0) return [];
  const pool = poolDocs.map(normalizeQuestion);

  
  
  const subjectList = Array.isArray(subject)
    ? subject.filter((s) => s && s !== "ALL")
    : subject === "ALL"
      ? []
      : [subject];

  let subjectPool =
    subjectList.length === 0 ? pool : pool.filter((q) => (q.subjects?.length ? q.subjects : [q.subject]).some((s) => subjectList.includes(s)));
  const wanted = subjectPool.filter((q) => q.difficulty === difficulty).length;
  if (subjectPool.length < wanted) {
    
    subjectPool = [
      ...subjectPool,
      ...pool.filter((q) => q.status === "OFFICIAL" && !subjectList.includes(q.subject)),
    ];
  }

  const picked: NormalizedQuestion[] = [];
  const used = new Set<string>(excludeIds);
  let allowRepeats = false;

  for (let i = 0; i < wanted; i++) {
    
    let candidates = subjectPool.filter((q) => q.difficulty === difficulty && !used.has(q.id));
    if (candidates.length === 0 && allowRepeats) {
      
      candidates = subjectPool.filter((q) => q.difficulty === difficulty);
    }
    if (candidates.length === 0 && !allowRepeats) {
      allowRepeats = true;
      used.clear();
      candidates = subjectPool.filter((q) => q.difficulty === difficulty);
    }
    if (candidates.length === 0) break; 
    const choice = candidates[cryptoInt(candidates.length)];
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
    timerSeconds: q.timerSeconds ?? 30,
  };
}


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
    
    questionDeadlineAt?: number;
    
    loadout?: (string | null)[];
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
    loadout: battle.loadout,
  };
}

export function loadBattleQuestions(battle: { questions: string[] }): BattleQuestion[] {
  return battle.questions.map((id) => ({ id })) as BattleQuestion[];
}


export function newlyUnlockedTier(level: number): EnemyTier | null {
  const t = ENEMY_TIERS.find((tier) => tier.unlockLevel === level);
  return t ?? null;
}

export { getTier, playerMaxHp, levelProgress, getMode };
