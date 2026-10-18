/**
 * Adventure content — starter gear, shop catalog, gacha pool, starter categories.
 * Pure data, shared by server seeding and UI display.
 */

export interface ItemDef {
  id: string;
  name: string;
  slot: "WEAPON" | "ARMOR" | "ACCESSORY" | "CONSUMABLE";
  atk: number;
  def: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  description: string;
  unique: boolean;
  /**
   * Optional artwork, e.g. "/images/items/w-iron-sword.png".
   * See README → "Adding item images" for the full how-to.
   * When omitted, the UI falls back to SLOT_ICON.
   */
  image?: string;
}

/** Fallback icon per slot, used when an item has no `image`. */
export const SLOT_ICON: Record<ItemDef["slot"], string> = {
  WEAPON: "⚔️",
  ARMOR: "🛡️",
  ACCESSORY: "💍",
  CONSUMABLE: "🧪",
};

/** All items in the game. `price > 0` = buyable in shop; else gacha-only. */
export const ITEMS: ItemDef[] = [
  /* ---- starter gear (granted on account creation) ---- */
  { id: "w-wood-sword", name: "Wood Sword", slot: "WEAPON", atk: 10, def: 0, rarity: "COMMON", price: 0, description: "Every hero starts here. Deals 10 base damage.", unique: false },
  { id: "a-wood-armor", name: "Wood Armor", slot: "ARMOR", atk: 0, def: 1, rarity: "COMMON", price: 0, description: "Carved planks. Blocks 1 damage.", unique: false },

  /* ---- weapons ---- */
  { id: "w-iron-sword", name: "Iron Sword", slot: "WEAPON", atk: 4, def: 0, rarity: "COMMON", price: 120, description: "Reliable soldier steel.", unique: false },
  { id: "w-steel-saber", name: "Steel Saber", slot: "WEAPON", atk: 7, def: 0, rarity: "RARE", price: 280, description: "Quick, sharp, well-balanced.", unique: false },
  { id: "w-scholar-staff", name: "Scholar's Staff", slot: "WEAPON", atk: 9, def: 0, rarity: "RARE", price: 340, description: "Channels knowledge into force.", unique: false },
  { id: "w-runed-greatsword", name: "Runed Greatsword", slot: "WEAPON", atk: 12, def: 0, rarity: "EPIC", price: 0, description: "Runes glow with each correct answer.", unique: false },
  { id: "w-dragon-fang", name: "Dragon Fang", slot: "WEAPON", atk: 16, def: 0, rarity: "LEGENDARY", price: 0, description: "Cut from the Quiz Dragon itself. Unique.", unique: true },

  /* ---- armor ---- */
  { id: "a-leather-vest", name: "Leather Vest", slot: "ARMOR", atk: 0, def: 4, rarity: "COMMON", price: 100, description: "Light, flexible protection.", unique: false },
  { id: "a-chain-mail", name: "Chain Mail", slot: "ARMOR", atk: 0, def: 7, rarity: "RARE", price: 260, description: "Interlocked rings shrug off claws.", unique: false },
  { id: "a-warden-plate", name: "Warden Plate", slot: "ARMOR", atk: 0, def: 11, rarity: "EPIC", price: 0, description: "Heavy plate etched with ward sigils.", unique: false },
  { id: "a-aegis-robe", name: "Aegis Robe", slot: "ARMOR", atk: 0, def: 15, rarity: "LEGENDARY", price: 0, description: "Woven from cipher-threads. Unique.", unique: true },

  /* ---- accessories ---- */
  { id: "ac-lucky-coin", name: "Lucky Coin", slot: "ACCESSORY", atk: 1, def: 1, rarity: "COMMON", price: 80, description: "A bit of fortune in your pocket.", unique: false },
  { id: "ac-focus-charm", name: "Focus Charm", slot: "ACCESSORY", atk: 3, def: 0, rarity: "RARE", price: 200, description: "Sharpens the mind mid-battle.", unique: false },
  { id: "ac-guardian-band", name: "Guardian Band", slot: "ACCESSORY", atk: 0, def: 3, rarity: "RARE", price: 200, description: "A ring that softens blows.", unique: false },
  { id: "ac-sage-ring", name: "Sage Ring", slot: "ACCESSORY", atk: 5, def: 2, rarity: "EPIC", price: 0, description: "Wisdom of a hundred scholars. Unique.", unique: true },

  /* ---- consumables (shop) ---- */
  { id: "c-minor-potion", name: "Minor Potion", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "COMMON", price: 40, description: "Restores 30 HP during battle.", unique: false },
  { id: "c-great-potion", name: "Great Potion", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "COMMON", price: 90, description: "Restores 60 HP during battle.", unique: false },
  { id: "c-damage-boost", name: "Damage Boost", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "COMMON", price: 70, description: "Next hit deals +50% damage.", unique: false },
  { id: "c-stun-bomb", name: "Stun Bomb", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "COMMON", price: 60, description: "Stuns the enemy for 1 question.", unique: false },
  { id: "c-confusion-bomb", name: "Confusion Bomb", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "COMMON", price: 55, description: "If you miss, the enemy hits itself for 1 question.", unique: false },
  { id: "c-special-elixir", name: "Special Elixir", slot: "CONSUMABLE", atk: 0, def: 0, rarity: "RARE", price: 0, description: "Restores full HP. Gacha-only.", unique: false },
];

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}

/* ---------- gacha pool ---------- */

/** Rarities with their drop weights and gem cost per pull. */
export const GACHA_COST_GEMS = 3;

export const GACHA_POOL: { rarity: ItemDef["rarity"]; weight: number }[] = [
  { rarity: "COMMON", weight: 55 },
  { rarity: "RARE", weight: 30 },
  { rarity: "EPIC", weight: 12 },
  { rarity: "LEGENDARY", weight: 3 },
];

/** Gacha only drops non-starter, non-shop-exclusive equipment. */
export const GACHA_POOL_ITEMS = ITEMS.filter(
  (i) => i.slot !== "CONSUMABLE" && i.price === 0 && !["w-wood-sword", "a-wood-armor"].includes(i.id),
);

/* ---------- starter Adventure categories (official) ---------- */

export interface CategoryDef {
  name: string;
  description: string;
  subjects: string[];
  difficulties: ("EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER")[];
  enemy: { name: string; emoji: string; tier: number; baseHp: number; atkMin: number; atkMax: number };
}

export const STARTER_CATEGORIES: CategoryDef[] = [
  {
    name: "Mathematics",
    description: "Numbers, equations, and the monsters that love them.",
    subjects: ["Mathematics"],
    difficulties: ["EASY", "MEDIUM", "HARD"],
    enemy: { name: "Algebra Owl", emoji: "🦉", tier: 4, baseHp: 120, atkMin: 11, atkMax: 16 },
  },
  {
    name: "Science",
    description: "Biology, chemistry, physics — the Lab Lich awaits.",
    subjects: ["Science"],
    difficulties: ["EASY", "MEDIUM", "HARD"],
    enemy: { name: "Lab Lich", emoji: "🧪", tier: 6, baseHp: 180, atkMin: 15, atkMax: 20 },
  },
  {
    name: "History & English",
    description: "Words and wars across the ages.",
    subjects: ["History", "English"],
    difficulties: ["EASY", "MEDIUM", "HARD"],
    enemy: { name: "Grammar Goblin", emoji: "📕", tier: 2, baseHp: 80, atkMin: 8, atkMax: 11 },
  },
  {
    name: "Programming",
    description: "Code, logic, and the Rune Golem's riddles.",
    subjects: ["Programming"],
    difficulties: ["EASY", "MEDIUM", "HARD"],
    enemy: { name: "Rune Golem", emoji: "🗿", tier: 3, baseHp: 100, atkMin: 10, atkMax: 14 },
  },
];
