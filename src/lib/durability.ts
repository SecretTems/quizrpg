import type { IEquipmentPiece } from "@/lib/models";

/**
 * Durability rules:
 * - WEAPON degrades 1 per attack the player lands (correct answer that deals damage)
 * - ARMOR degrades 1 per hit the player takes (wrong answer / timeout damage)
 * - ACCESSORY degrades per adventure, based on difficulty
 * A piece at `maxDurability` is broken: its stats stop applying.
 */

/** Durability by slot (hits it can take). Rarer = sturdier. */
const BASE_DURABILITY: Record<IEquipmentPiece["rarity"], number> = {
  COMMON: 40,
  RARE: 70,
  EPIC: 110,
  LEGENDARY: 180,
};

export function maxDurabilityFor(rarity: IEquipmentPiece["rarity"]): number {
  return BASE_DURABILITY[rarity] ?? 40;
}

/** Give a piece its initial durability (call when creating equipment pieces). */
export function withDurability(piece: Omit<IEquipmentPiece, "maxDurability" | "durability">): IEquipmentPiece {
  return { ...piece, maxDurability: maxDurabilityFor(piece.rarity), durability: 0 };
}

/** True when the piece is broken (all its durability used up). */
export function isBroken(piece: IEquipmentPiece | null | undefined): boolean {
  if (!piece || piece.maxDurability == null) return false;
  return (piece.durability ?? 0) >= piece.maxDurability;
}

/** Increment durability. Returns the same piece object for chaining. */
export function addWear(piece: IEquipmentPiece | null | undefined, amount = 1): void {
  if (!piece || piece.maxDurability == null) return;
  piece.durability = Math.min(piece.maxDurability, (piece.durability ?? 0) + amount);
}

/** Accessory wear per adventure by battle mode difficulty. */
export function accessoryWearForDifficulty(mode: string): number {
  switch (mode) {
    case "MASTER": return 4;
    case "EXPERT": return 3;
    case "HARD": return 2;
    case "MEDIUM": return 2;
    case "INFINITE": return 3;
    default: return 1; // EASY
  }
}

export interface DurabilitySummary {
  weaponBroken: boolean;
  armorBroken: boolean;
  accessoryBroken: boolean;
}

/** Apply one round of battle wear to the user's equipped gear. */
export async function applyBattleWear(
  User: any,
  userId: string,
  dealtDamage: boolean,
  tookDamage: boolean,
): Promise<DurabilitySummary> {
  const doc = await User.findById(userId);
  if (!doc) return { weaponBroken: false, armorBroken: false, accessoryBroken: false };

  const eq = doc.equipment ?? {};
  const weapon = eq.WEAPON as IEquipmentPiece | null;
  const armor = eq.ARMOR as IEquipmentPiece | null;
  const accessory = eq.ACCESSORY as IEquipmentPiece | null;

  const weaponWasBroken = isBroken(weapon);
  const armorWasBroken = isBroken(armor);

  if (dealtDamage) addWear(weapon);
  if (tookDamage) addWear(armor);

  if (doc.markModified) doc.markModified("equipment");
  await doc.save();

  return {
    weaponBroken: !weaponWasBroken && isBroken(weapon),
    armorBroken: !armorWasBroken && isBroken(armor),
    accessoryBroken: false,
  };
}

/** Apply per-adventure accessory wear at battle start. */
export async function applyAccessoryWear(User: any, userId: string, mode: string): Promise<boolean> {
  const doc = await User.findById(userId);
  if (!doc) return false;
  const accessory = (doc.equipment ?? {}).ACCESSORY as IEquipmentPiece | null;
  const wasBroken = isBroken(accessory);
  addWear(accessory, accessoryWearForDifficulty(mode));
  if (doc.markModified) doc.markModified("equipment");
  await doc.save();
  return !wasBroken && isBroken(accessory);
}

/** Effective stats of an equipped piece - zeroed when broken. */
export function effectiveStats(piece: IEquipmentPiece | null | undefined): { atk: number; def: number } {
  if (!piece || isBroken(piece)) return { atk: 0, def: 0 };
  return { atk: piece.atk ?? 0, def: piece.def ?? 0 };
}
