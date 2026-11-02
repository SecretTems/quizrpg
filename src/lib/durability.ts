import type { IEquipmentPiece } from "@/lib/models";

const BASE_DURABILITY: Record<IEquipmentPiece["rarity"], number> = {
  COMMON: 40,
  RARE: 70,
  EPIC: 110,
  LEGENDARY: 180,
};

export function maxDurabilityFor(rarity: IEquipmentPiece["rarity"]): number {
  return BASE_DURABILITY[rarity] ?? 40;
}

export function withDurability(piece: Omit<IEquipmentPiece, "maxDurability" | "durability">): IEquipmentPiece {
  return { ...piece, maxDurability: maxDurabilityFor(piece.rarity), durability: 0 };
}

export function isBroken(piece: IEquipmentPiece | null | undefined): boolean {
  if (!piece || piece.maxDurability == null) return false;
  return (piece.durability ?? 0) >= piece.maxDurability;
}

export function addWear(piece: IEquipmentPiece | null | undefined, amount = 1): void {
  if (!piece || piece.maxDurability == null) return;
  piece.durability = Math.min(piece.maxDurability, (piece.durability ?? 0) + amount);
}

export function accessoryWearForDifficulty(mode: string): number {
  switch (mode) {
    case "MASTER": return 4;
    case "EXPERT": return 3;
    case "HARD": return 2;
    case "MEDIUM": return 2;
    case "INFINITE": return 3;
    default: return 1; 
  }
}

export interface DurabilitySummary {
  weaponBroken: boolean;
  armorBroken: boolean;
  accessoryBroken: boolean;
}

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

export function effectiveStats(piece: IEquipmentPiece | null | undefined): { atk: number; def: number } {
  if (!piece || isBroken(piece)) return { atk: 0, def: 0 };
  return { atk: piece.atk ?? 0, def: piece.def ?? 0 };
}
