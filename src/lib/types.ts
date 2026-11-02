import type { EnemyTier } from "@/lib/game";



export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  
  avatar?: string;
  email: string;
  emailVerified: boolean;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  
  questionsRight: number;
  
  questionsWrong: number;
  
  subjectStats: Record<string, { right: number; wrong: number } | undefined>;
  
  tutorialSeen: boolean;
  
  loadout: (string | null)[];
  
  twoFactorEnabled: boolean;
  
  lockoutUntil: number | null;
  
  lastDailyClaimAt: number | null;
  
  dailyStreak: number;
  createdAt: string;
}

export interface QuestionDTO {
  id: string;
  subject: string;
  
  subjects: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ownerId: string | null;
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  reviewNote: string;
  
  timerSeconds: number;
  approvalVotes: string[];
  rejectionVotes: string[];
  ownerUsername?: string | null;
  createdAt: string;
}

export interface BattleStateDTO {
  id: string;
  subject: string;
  
  categoryId: string | null;
  tier: number;
  mode: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER" | "INFINITE";
  wave: number;
  enemyName: string;
  enemySprite: string;
  
  enemyImage?: string | null;
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
    subject: string;
    text: string;
    options: string[];
    difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
    status: "OFFICIAL" | "PENDING" | "REJECTED" | "CUSTOM";
    
    timerSeconds: number;
  } | null;
  questionNumber: number;
  totalSeen: number;
  waveNumber: number;
  
  monsterIndex?: number;
  
  totalMonsters?: number;
  
  questionDeadlineAt?: number;
  
  loadout?: (string | null)[];
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
  waveCleared: boolean;
  waveNumber: number;
  
  goldDrop: number;
  
  gemDrop: number;
  
  questionsRight: number;
  
  questionsWrong: number;
  
  accuracy: number | null;
  
  monsterDefeated: boolean;
  
  enemyName?: string;
  enemySprite?: string;
  enemyImage?: string | null;
  enemyMaxHp?: number;
  monsterIndex?: number;
  totalMonsters?: number;
  
  questionDeadlineAt?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  
  avatar?: string;
  level: number;
  xp: number;
  bestScore: number;
  battlesWon: number;
  bestStreak: number;
  
  accuracy: number | null;
  
  questionsRight: number;
  
  questionsWrong: number;
}
