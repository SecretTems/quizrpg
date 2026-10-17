import type { EnemyTier } from "@/lib/game";

/* ---------- shared API payload types ---------- */

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  createdAt: string;
}

export interface QuestionDTO {
  id: string;
  subject: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ownerId: string | null;
  ownerUsername?: string | null;
  createdAt: string;
}

export interface BattleStateDTO {
  id: string;
  subject: string;
  tier: number;
  enemyName: string;
  enemySprite: string;
  enemyMaxHp: number;
  enemyHp: number;
  playerMaxHp: number;
  playerHp: number;
  streak: number;
  bestStreak: number;
  score: number;
  xpEarned: number;
  status: "ONGOING" | "WON" | "LOST" | "FLED";
  question: {
    id: string;
    text: string;
    options: string[];
    difficulty: "EASY" | "MEDIUM" | "HARD";
  } | null;
  questionNumber: number;
  totalSeen: number;
}

export interface AnswerResultDTO {
  correct: boolean;
  correctIndex: number;
  damageDealt: number;
  damageTaken: number;
  xpGained: number;
  scoreGained: number;
  streak: number;
  crit: boolean;
  enemyHp: number;
  playerHp: number;
  score: number;
  xpEarned: number;
  status: "ONGOING" | "WON" | "LOST";
  nextQuestion: BattleStateDTO["question"];
  questionNumber: number;
  explanation: string;
  leveledUp: boolean;
  newLevel: number;
  unlockedTier: EnemyTier | null;
  victoryBonus: { xp: number; score: number } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  level: number;
  xp: number;
  bestScore: number;
  battlesWon: number;
  bestStreak: number;
}
