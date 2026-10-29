import type { EnemyTier } from "@/lib/game";

/* ---------- shared API payload types ---------- */

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  /** custom profile picture (data URL) when set */
  avatar?: string;
  email: string;
  emailVerified: boolean;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  /** lifetime correct answers */
  questionsRight: number;
  /** lifetime wrong answers / timeouts */
  questionsWrong: number;
  /** per-subject accuracy ledger, keyed by subject name */
  subjectStats: Record<string, { right: number; wrong: number } | undefined>;
  /** true once the onboarding tutorial has been completed */
  tutorialSeen: boolean;
  /** battle loadout: 3 consumable slots, each holding ONE item (duplicates allowed) */
  loadout: (string | null)[];
  /** 2FA is enabled for this account (admins/super admins) */
  twoFactorEnabled: boolean;
  /** epoch ms until the account is locked from failed logins (0/past = unlocked) */
  lockoutUntil: number | null;
  /** epoch ms of the last daily-bonus claim (null = never claimed) */
  lastDailyClaimAt: number | null;
  /** current consecutive daily-claim streak */
  dailyStreak: number;
  createdAt: string;
}

export interface QuestionDTO {
  id: string;
  subject: string;
  /** all subjects this question belongs to (1+) */
  subjects: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ownerId: string | null;
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  reviewNote: string;
  /** per-question time limit in seconds (10-300) */
  timerSeconds: number;
  approvalVotes: string[];
  rejectionVotes: string[];
  ownerUsername?: string | null;
  createdAt: string;
}

export interface BattleStateDTO {
  id: string;
  subject: string;
  /** set when the opponent is an Adventure category monster */
  categoryId: string | null;
  tier: number;
  mode: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER" | "INFINITE";
  wave: number;
  enemyName: string;
  enemySprite: string;
  /** custom monster image (data URL) when the monster has one */
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
    /** per-question time limit in seconds (10-300) */
    timerSeconds: number;
  } | null;
  questionNumber: number;
  totalSeen: number;
  waveNumber: number;
  /** 0-based index of the current monster in a category battle's lineup */
  monsterIndex?: number;
  /** total monsters in a category lineup (undefined/0 = classic single enemy) */
  totalMonsters?: number;
  /** epoch ms deadline for the current question (survives tab/window switches) */
  questionDeadlineAt?: number;
  /** the player's battle loadout: 3 consumable slots (null = empty) */
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
  /** gold earned from the victory loot drop (0 otherwise) */
  goldDrop: number;
  /** gems earned from the victory loot drop (0 otherwise) */
  gemDrop: number;
  /** questions answered correctly this adventure */
  questionsRight: number;
  /** questions answered wrong or timed out this adventure */
  questionsWrong: number;
  /** accuracy rating % for this adventure (right / answered so far); null = no answers yet */
  accuracy: number | null;
  /** true when a category monster fell and the next one in the lineup stepped in */
  monsterDefeated: boolean;
  /** updated enemy info - present when the lineup advanced mid-battle */
  enemyName?: string;
  enemySprite?: string;
  enemyImage?: string | null;
  enemyMaxHp?: number;
  monsterIndex?: number;
  totalMonsters?: number;
  /** epoch ms deadline for the next question (carried over from the server) */
  questionDeadlineAt?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  /** data-URL profile picture when set */
  avatar?: string;
  level: number;
  xp: number;
  bestScore: number;
  battlesWon: number;
  bestStreak: number;
  /** accuracy % across answered questions (null = nothing answered) */
  accuracy: number | null;
  /** correct answers in the board's scope */
  questionsRight: number;
  /** wrong answers in the board's scope */
  questionsWrong: number;
}
