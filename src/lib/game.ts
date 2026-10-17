/**
 * QUIZRPG game engine — enemy tiers, combat math, XP curve, question drawing.
 * Shared by API routes (server-authoritative) and UI (display only).
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface EnemyTier {
  tier: number;
  name: string;
  sprite: string;
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
    name: "Rune Golem",
    sprite: "🗿",
    maxHp: 100,
    atkMin: 10,
    atkMax: 14,
    unlockLevel: 3,
    victoryXp: 90,
    victoryScore: 220,
    blurb: "Ancient stone guarded by trickier questions.",
  },
  {
    tier: 3,
    name: "Cipher Wraith",
    sprite: "👻",
    maxHp: 150,
    atkMin: 13,
    atkMax: 18,
    unlockLevel: 5,
    victoryXp: 150,
    victoryScore: 360,
    blurb: "A spectral puzzle-master that punishes wrong answers.",
  },
  {
    tier: 4,
    name: "Quiz Dragon",
    sprite: "🐉",
    maxHp: 220,
    atkMin: 17,
    atkMax: 23,
    unlockLevel: 8,
    victoryXp: 240,
    victoryScore: 550,
    blurb: "The final exam incarnate. Only true champions prevail.",
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
};

const DIFFICULTY_XP: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
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

/** XP required to advance FROM level n to n+1. */
export function xpToNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
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

export const QUESTIONS_PER_WAVE = 10;

/** Difficulty mix per enemy tier — harder tiers pull harder questions. */
export function tierDifficultyWeights(tier: number): Record<Difficulty, number> {
  switch (tier) {
    case 1:
      return { EASY: 0.6, MEDIUM: 0.4, HARD: 0 };
    case 2:
      return { EASY: 0.4, MEDIUM: 0.4, HARD: 0.2 };
    case 3:
      return { EASY: 0.2, MEDIUM: 0.5, HARD: 0.3 };
    default:
      return { EASY: 0.1, MEDIUM: 0.4, HARD: 0.5 };
  }
}

export function pickDifficulty(tier: number): Difficulty {
  const w = tierDifficultyWeights(tier);
  const r = Math.random();
  if (r < w.EASY) return "EASY";
  if (r < w.EASY + w.MEDIUM) return "MEDIUM";
  return "HARD";
}
