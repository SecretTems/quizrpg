



import crypto from "node:crypto";

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";

export interface EnemyTier {
  tier: number;
  name: string;
  sprite: string;
  
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
  
  return Math.max(0, Math.min(streak - 1, 5)) * 3;
}



export interface EquipmentStats {
  atkBonus: number;
  defBonus: number;
}


export function equipmentStats(equipment: {
  WEAPON: { atk: number; def: number } | null;
  ARMOR: { atk: number; def: number } | null;
  ACCESSORY: { atk: number; def: number } | null;
} | null | undefined): EquipmentStats {
  const stats: EquipmentStats = { atkBonus: 0, defBonus: 0 };
  if (!equipment) return stats;
  for (const slot of ["WEAPON", "ARMOR", "ACCESSORY"] as const) {
    const piece = equipment[slot];
    if (piece) {
      stats.atkBonus += piece.atk ?? 0;
      stats.defBonus += piece.def ?? 0;
    }
  }
  return stats;
}


export function goldReward(tier: number, wave = 1): number {
  return Math.round((25 + tier * 15) * Math.sqrt(wave));
}


export function gemReward(tier: number, wave = 1): number {
  const chance = Math.min(0.1 + tier * 0.02, 0.35) * Math.min(wave, 4);
  return cryptoRandom() < chance ? 1 + cryptoInt(Math.ceil(tier / 3)) : 0;
}




export function cryptoRandom(): number {
  return crypto.randomBytes(4).readUInt32BE(0) / 0x1_0000_0000;
}


export function cryptoInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  let x = 0;
  do {
    x = crypto.randomBytes(4).readUInt32BE(0);
  } while (x >= limit);
  return x % maxExclusive;
}


export function cryptoIntInclusive(min: number, max: number): number {
  return min + cryptoInt(max - min + 1);
}


export function cryptoShuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}


export const STARTER_GEAR = ["w-wood-sword", "a-wood-armor"];

export interface AnswerOutcomeWithGear extends AnswerOutcome {
  
  blocked: number;
}



export function computeAdventureAnswer(
  difficulty: Difficulty,
  wasCorrect: boolean,
  streakBefore: number,
  tier: EnemyTier,
  defBonus: number,
): AnswerOutcomeWithGear {
  const base = computeAnswer(difficulty, wasCorrect, streakBefore, tier);
  if (base.correct) return { ...base, blocked: 0 };
  const raw = base.damageTaken;
  const blocked = Math.min(Math.round((defBonus / 100) * raw), Math.round(raw * 0.7));
  return { ...base, damageTaken: raw - blocked, blocked };
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


export function computeAnswer(
  difficulty: Difficulty,
  wasCorrect: boolean,
  streakBefore: number,
  tier: EnemyTier,
): AnswerOutcome {
  if (!wasCorrect) {
    const damageTaken = cryptoIntInclusive(tier.atkMin, tier.atkMax);
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
  const crit = streak >= 3 && cryptoRandom() < 0.25;
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




export function xpToNextLevel(level: number): number {
  return 200 + (level - 1) * 200;
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




export type BattleModeId = Difficulty | "INFINITE";



export interface BattleMode {
  id: BattleModeId;
  label: string;
  description: string;
  
  questionCount: number;
  rewardXp: number;
  rewardScore: number;
  unlockLevel: number;
  infinite?: boolean;
}

export const INFINITE_WAVE_SIZE = 5;



export function infiniteDifficulty(wave: number): Difficulty {
  if (wave <= 2) return "EASY";
  if (wave <= 4) return "MEDIUM";
  if (wave <= 6) return "HARD";
  if (wave <= 8) return "EXPERT";
  return "MASTER";
}


export function infiniteWaveBonus(wave: number): { xp: number; score: number } {
  return { xp: 20 + wave * 10, score: 40 + wave * 25 };
}

export const BATTLE_MODES: BattleMode[] = [
  {
    id: "EASY",
    label: "Easy Grind",
    description: "Gentle warm-up battles. Low stakes, steady rewards.",
    questionCount: 5,
    rewardXp: 30,
    rewardScore: 60,
    unlockLevel: 1,
  },
  {
    id: "MEDIUM",
    label: "Medium Trial",
    description: "A fair challenge with decent rewards.",
    questionCount: 10,
    rewardXp: 70,
    rewardScore: 160,
    unlockLevel: 2,
  },
  {
    id: "HARD",
    label: "Hard Gauntlet",
    description: "High risk, high reward.",
    questionCount: 20,
    rewardXp: 140,
    rewardScore: 340,
    unlockLevel: 3,
  },
  {
    id: "EXPERT",
    label: "Expert Abyss",
    description: "For seasoned veterans only.",
    questionCount: 30,
    rewardXp: 240,
    rewardScore: 600,
    unlockLevel: 12,
  },
  {
    id: "MASTER",
    label: "Master Trial",
    description: "The ultimate test of mastery.",
    questionCount: 50,
    rewardXp: 400,
    rewardScore: 1000,
    unlockLevel: 20,
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



export function pickDifficulty(mode: BattleModeId, wave = 1): Difficulty {
  if (mode === "INFINITE") return infiniteDifficulty(wave);
  return mode;
}
