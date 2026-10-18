/** Shared input sanitizers for category payloads (create + update routes). */

export interface MonsterInput {
  name: string;
  emoji: string;
  image: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  subjects: string[];
}

const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,/;
/** base64 data URL cap — matches /api/upload (200 KB binary ≈ 267 K chars + overhead) */
const MAX_IMAGE_CHARS = 400_000;
export const MAX_MONSTERS = 20;

/** Accept only small base64 image data URLs; anything else becomes "". */
export function sanitizeImage(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return IMAGE_RE.test(s) && s.length <= MAX_IMAGE_CHARS ? s : "";
}

/** Coerce an arbitrary monster array into well-formed lineup entries (max 20). */
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
    });
    if (out.length >= MAX_MONSTERS) break;
  }
  return out;
}