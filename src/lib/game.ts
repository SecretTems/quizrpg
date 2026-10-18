/**
 * QUIZRPG game engine — enemy tiers, combat math, XP curve, question drawing.
 * Shared by API routes (server-authoritative) and UI (display only).
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";

export interface EnemyTier {
  tier: number;
  name: string;
  sprite: string;
  /** opponent category, e.g. "Grade 8", "Grade 9", "Subject Champion" */
  category: string;
  maxHp: number;
  atkMin: number;
  atkMax: number;
  unlockLevel: number;
  victoryXp: number;
  victoryScore: number;
  blurb: string;
}

export const ENEMY_TIERS: EnemyTier[] = [
  {
    tier: 1,
    name: "Slime Scholar",
    sprite: "🟢",
    category: "Grade 8",
    maxHp: 60,
    atkMin: 6,
    atkMax: 9,
    unlockLevel: 1,
    victoryXp: 40,
    victoryScore: 100,
    blurb: "A squishy beginner monster. Perfect warm-up.",
  },
  {
    tier: 2,
    name: "Grammar Goblin",
    sprite: "📕",
    category: "Grade 8",
    maxHp: 80,
    atkMin: 8,
    atkMax: 11,
    unlockLevel: 1,
    victoryXp: 55,
    victoryScore: 130,
    blurb: "Lurks in vocabulary and parts of speech.",
  },
  {
    tier: 3,
    name: "Rune Golem",
    sprite: "🗿",
    category: "Grade 9",
    maxHp: 100,
    atkMin: 10,
    atkMax: 14,
    unlockLevel: 3,
    victoryXp: 90,
    victoryScore: 220,
    blurb: "Ancient stone guarded by trickier questions.",
  },
  {
    tier: 4,
    name: "Algebra Owl",
    sprite: "🦉",
    category: "Grade 9",
    maxHp: 120,
    atkMin: 11,
    atkMax: 16,
    unlockLevel: 4,
    victoryXp: 110,
    victoryScore: 270,
    blurb: "Wise in equations, merciless in timed drills.",
  },
  {
    tier: 5,
    name: "Cipher Wraith",
    sprite: "👻",
    category: "Grade 10",
    maxHp: 150,
    atkMin: 13,
    atkMax: 18,
    unlockLevel: 5,
    victoryXp: 150,
    victoryScore: 360,
    blurb: "A spectral puzzle-master that punishes wrong answers.",
  },
  {
    tier: 6,
    name: "Lab Lich",
    sprite: "🧪",
    category: "Grade 10",
    maxHp: 180,
    atkMin: 15,
    atkMax: 20,
    unlockLevel: 6,
    victoryXp: 190,
    victoryScore: 430,
    blurb: "Rules the laboratory with chemistry and physics riddles.",
  },
  {
    tier: 7,
    name: "Quiz Dragon",
    sprite: "🐉",
    category: "Subject Champion",
    maxHp: 220,
    atkMin: 17,
    atkMax: 23,
    unlockLevel: 8,
    victoryXp: 240,
    victoryScore: 550,
    blurb: "The final exam incarnate. Only true champions prevail.",
  },
  {
    tier: 8,
    name: "Grandmaster Sphinx",
    sprite: "🦁",
    category: "Subject Champion",
    maxHp: 280,
    atkMin: 20,
    atkMax: 27,
    unlockLevel: 12,
    victoryXp: 320,
    victoryScore: 780,
    blurb: "Master of every subject. Answers wrongly and beware.",
  },
];

export function getTier(tier: number): EnemyTier {
  return ENEMY_TIERS.find((t) => t.tier === tier) ?? ENEMY_TIERS[0];
}

/* ---------- combat math ---------- */

export const PLAYER_BASE_HP = 90;

export function playerMaxHp(level: number): number {
  return PLAYER_BASE_HP + level * 10;
}

const DIFFICULTY_DAMAGE: Record<Difficulty, number> = {
  EASY: 14,
  MEDIUM: 20,
  HARD: 28,
  EXPERT: 34,
  MASTER: 42,
};

const DIFFICULTY_XP: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
  EXPERT: 40,
  MASTER: 55,
};

export function streakBonus(streak: number): number {
  // streak counts the just-answered question; consecutive answers 2..6 give +3..+15
  return Math.max(0, Math.min(streak - 1, 5)) * 3;
}

export interface AnswerOutcome {
  correct: boolean;
  damageDealt: number;
  damageTaken: number;
  xpGained: number;
  scoreGained: number;
  streak: number;
  crit: boolean;
}

/** Compute the outcome of answering `question` with streak BEFORE this answer. */
export function computeAnswer(
  difficulty: Difficulty,
  wasCorrect: boolean,
  streakBefore: number,
  tier: EnemyTier,
): AnswerOutcome {
  if (!wasCorrect) {
    const damageTaken = tier.atkMin + Math.floor(Math.random() * (tier.atkMax - tier.atkMin + 1));
    return {
      correct: false,
      damageDealt: 0,
      damageTaken,
      xpGained: 0,
      scoreGained: 0,
      streak: 0,
      crit: false,
    };
  }
  const streak = streakBefore + 1;
  let damage = DIFFICULTY_DAMAGE[difficulty] + streakBonus(streak);
  const crit = streak >= 3 && Math.random() < 0.25;
  if (crit) damage = Math.round(damage * 1.5);
  const xpGained = DIFFICULTY_XP[difficulty] + streakBonus(streak) + (crit ? 5 : 0);
  return {
    correct: true,
    damageDealt: damage,
    damageTaken: 0,
    xpGained,
    scoreGained: damage,
    streak,
    crit,
  };
}

/* ---------- leveling ---------- */

/** XP required to advance FROM level n to n+1 — steeper curve for a longer grind. */
export function xpToNextLevel(level: number): number {
  return 200 + (level - 1) * 120;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpToNextLevel(level) && level < 99) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return level;
}

export function levelProgress(xp: number): { level: number; current: number; needed: number } {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpToNextLevel(level) && level < 99) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return { level, current: remaining, needed: xpToNextLevel(level) };
}

export function tiersUnlocked(level: number): EnemyTier[] {
  return ENEMY_TIERS.filter((t) => t.unlockLevel <= level);
}

/* ---------- battle composition ---------- */

/** Standard battle modes are pinned to a difficulty; INFINITE escalates wave by wave. */
export type BattleModeId = Difficulty | "INFINITE";

/**
 * Progressive battle modes. Each standard mode draws ONLY its own difficulty
 * and has a fixed question count with a scaling victory reward. INFINITE is
 * endless: waves get progressively harder until the player falls.
 */
export interface BattleMode {
  id: BattleModeId;
  label: string;
  description: string;
  /** questions per wave (INFINITE draws this many each wave, endlessly) */
  questionCount: number;
  rewardXp: number;
  rewardScore: number;
  unlockLevel: number;
  infinite?: boolean;
}

export const INFINITE_WAVE_SIZE = 5;

/**
 * Difficulty ladder for INFINITE mode. Each wave uses one difficulty band:
 * wave 1–2 EASY, 3–4 MEDIUM, 5–6 HARD, 7–8 EXPERT, 9+ MASTER.
 * Within a band the questions are that difficulty, so the mode "progressively
 * gets harder" the longer you survive.
 */
export function infiniteDifficulty(wave: number): Difficulty {
  if (wave <= 2) return "EASY";
  if (wave <= 4) return "MEDIUM";
  if (wave <= 6) return "HARD";
  if (wave <= 8) return "EXPERT";
  return "MASTER";
}

/** Per-wave clear bonus for INFINITE mode (scales with wave number). */
export function infiniteWaveBonus(wave: number): { xp: number; score: number } {
  return { xp: 20 + wave * 10, score: 40 + wave * 25 };
}

export const BATTLE_MODES: BattleMode[] = [
  {
    id: "EASY",
    label: "Easy Grind",
    description: "5 easy questions. Low stakes, gentle rewards.",
    questionCount: 5,
    rewardXp: 30,
    rewardScore: 60,
    unlockLevel: 1,
  },
  {
    id: "MEDIUM",
    label: "Medium Trial",
    description: "10 medium questions. Fair challenge, decent rewards.",
    questionCount: 10,
    rewardXp: 70,
    rewardScore: 160,
    unlockLevel: 2,
  },
  {
    id: "HARD",
    label: "Hard Gauntlet",
    description: "20 hard questions. High risk, high reward.",
    questionCount: 20,
    rewardXp: 140,
    rewardScore: 340,
    unlockLevel: 3,
  },
  {
    id: "EXPERT",
    label: "Expert Abyss",
    description: "30 expert questions. For seasoned veterans only.",
    questionCount: 30,
    rewardXp: 240,
    rewardScore: 600,
    unlockLevel: 6,
  },
  {
    id: "MASTER",
    label: "Master Trial",
    description: "50 master questions. The ultimate test of mastery.",
    questionCount: 50,
    rewardXp: 400,
    rewardScore: 1000,
    unlockLevel: 10,
  },
  {
    id: "INFINITE",
    label: "Infinite Gauntlet",
    description: "Endless waves that keep getting harder. Survive as long as you can.",
    questionCount: INFINITE_WAVE_SIZE,
    rewardXp: 0,
    rewardScore: 0,
    unlockLevel: 5,
    infinite: true,
  },
];

export function getMode(id: BattleModeId): BattleMode {
  return BATTLE_MODES.find((m) => m.id === id) ?? BATTLE_MODES[0];
}

export function isBattleModeId(id: string): id is BattleModeId {
  return BATTLE_MODES.some((m) => m.id === id);
}

export function modesUnlocked(level: number): BattleMode[] {
  return BATTLE_MODES.filter((m) => m.unlockLevel <= level);
}

/**
 * Question difficulty for a battle. Standard modes pin one difficulty; the
 * INFINITE mode escalates based on the current wave number.
 */
export function pickDifficulty(mode: BattleModeId, wave = 1): Difficulty {
  if (mode === "INFINITE") return infiniteDifficulty(wave);
  return mode;
}
