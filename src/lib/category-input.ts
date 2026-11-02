

export interface MonsterInput {
  name: string;
  emoji: string;
  image: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  subjects: string[];
  modifiers: { id: string; chance: number; amount: number }[];
}

const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,/;

const MAX_IMAGE_CHARS = 400_000;
export const MAX_MONSTERS = 20;


export function sanitizeImage(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return IMAGE_RE.test(s) && s.length <= MAX_IMAGE_CHARS ? s : "";
}


export function sanitizeMonsters(v: unknown): MonsterInput[] {
  if (!Array.isArray(v)) return [];
  const out: MonsterInput[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = String(r.name ?? "").trim().slice(0, 40);
    if (!name) continue;
    const atkMin = Math.max(1, Math.round(Number(r.atkMin) || 1));
    const atkMax = Math.max(atkMin, Math.round(Number(r.atkMax) || atkMin));
    const hp = Math.min(9999, Math.max(10, Math.round(Number(r.hp) || 60)));
    const subjects = Array.isArray(r.subjects)
      ? r.subjects
          .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
          .map((s) => s.trim().slice(0, 40))
      : [];
    out.push({
      name,
      emoji: String(r.emoji ?? "").trim().slice(0, 8) || "👾",
      image: sanitizeImage(r.image),
      hp,
      atkMin,
      atkMax,
      subjects,
      modifiers: sanitizeModifiers(r.modifiers),
    });
    if (out.length >= MAX_MONSTERS) break;
  }
  return out;
}

const VALID_MONSTER_MODIFIER_IDS = new Set([
  "TAX_COLLECTING",
  "SHUFFLER",
  "RESTING",
  "RESTRAINT",
  "DISABLER",
]);


function sanitizeModifiers(v: unknown): { id: string; chance: number; amount: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { id: string; chance: number; amount: number }[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!VALID_MONSTER_MODIFIER_IDS.has(id)) continue;
    out.push({
      id,
      chance: Math.min(100, Math.max(0, Math.round(Number(r.chance) || 0))),
      amount: Math.max(0, Math.min(9999, Math.round(Number(r.amount) || 0))),
    });
    if (out.length >= 5) break;
  }
  return out;
}