/**
 * Modifier system - epic and legendary equipment get battle modifiers, and
 * monsters can carry question modifiers with tunable chance values.
 * Pure data + pure helpers; battle logic reads these at runtime.
 */

export type EquipmentModifierId =
  | "EXTRA_TIME"
  | "HINT_CHANCE"
  | "HEAL_ON_CORRECT"
  | "CRIT_BOOST"
  | "GOLD_MAGNET";

export interface EquipmentModifier {
  id: EquipmentModifierId;
  label: string;
  description: string;
  /** numeric value, meaning depends on the id */
  value: number;
  /** unit for display */
  unit: "seconds" | "percent" | "hp";
}

export const EQUIPMENT_MODIFIERS: Record<EquipmentModifierId, EquipmentModifier> = {
  EXTRA_TIME: {
    id: "EXTRA_TIME",
    label: "Extra Time",
    description: "+5 seconds to the question timer.",
    value: 5,
    unit: "seconds",
  },
  HINT_CHANCE: {
    id: "HINT_CHANCE",
    label: "Hint Chance",
    description: "Chance of revealing one wrong answer (not on 2-answer questions).",
    value: 25,
    unit: "percent",
  },
  HEAL_ON_CORRECT: {
    id: "HEAL_ON_CORRECT",
    label: "Second Wind",
    description: "Heal 10 HP when you answer correctly.",
    value: 10,
    unit: "hp",
  },
  CRIT_BOOST: {
    id: "CRIT_BOOST",
    label: "Keen Edge",
    description: "+10% chance of a critical strike.",
    value: 10,
    unit: "percent",
  },
  GOLD_MAGNET: {
    id: "GOLD_MAGNET",
    label: "Gold Magnet",
    description: "+25% gold dropped by defeated enemies.",
    value: 25,
    unit: "percent",
  },
};

export type MonsterModifierId = "TAX_COLLECTING" | "SHUFFLER" | "RESTING" | "RESTRAINT" | "DISABLER";

export interface MonsterModifier {
  id: MonsterModifierId;
  label: string;
  emoji: string;
  description: string;
  /** default trigger chance, percent (the maker can tune this) */
  defaultChance: number;
  /** extra tunable amount (gold lost per 5s, heal amount, etc.) */
  amount: number;
}

export const MONSTER_MODIFIERS: Record<MonsterModifierId, MonsterModifier> = {
  TAX_COLLECTING: {
    id: "TAX_COLLECTING",
    label: "Tax Collecting",
    emoji: "💰",
    description: "Every 5 seconds spent on the question, the player loses 10 gold.",
    defaultChance: 50,
    amount: 10,
  },
  SHUFFLER: {
    id: "SHUFFLER",
    label: "Shuffler",
    emoji: "🔀",
    description: "Shuffles the answer positions when you reach the halfway point.",
    defaultChance: 40,
    amount: 0,
  },
  RESTING: {
    id: "RESTING",
    label: "Resting",
    emoji: "😴",
    description: "Heals 8 HP whenever you answer wrong.",
    defaultChance: 50,
    amount: 8,
  },
  RESTRAINT: {
    id: "RESTRAINT",
    label: "Restraint",
    emoji: "⛓️",
    description: "Players are unable to use items this question.",
    defaultChance: 30,
    amount: 0,
  },
  DISABLER: {
    id: "DISABLER",
    label: "Disabler",
    emoji: "🚫",
    description: "Disables the stats of 2 equipment pieces this question.",
    defaultChance: 25,
    amount: 2,
  },
};

export const ALL_MONSTER_MODIFIERS = Object.values(MONSTER_MODIFIERS);
export const ALL_EQUIPMENT_MODIFIERS = Object.values(EQUIPMENT_MODIFIERS);

/** Deterministic default modifiers by rarity (applied at grant time). */
export function defaultEquipmentModifiers(rarity: string): EquipmentModifierId[] {
  if (rarity === "LEGENDARY") return ["EXTRA_TIME", "HEAL_ON_CORRECT"];
  if (rarity === "EPIC") return ["HINT_CHANCE"];
  return [];
}

/** Roll whether a chance-percent event happens. */
export function chanceHit(percent: number): boolean {
  return Math.random() * 100 < percent;
}
