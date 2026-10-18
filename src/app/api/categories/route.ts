import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, normalizeCategory } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { sanitizeImage, sanitizeMonsters } from "@/lib/category-input";

const isStaff = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  // staff review every submitted category (needed for approvals); players see the
  // official bank plus their own private/pending creations. Other players'
  // private (CUSTOM) categories stay hidden even from staff until submitted.
  const categories = await Category.find(
    isStaff(user.role)
      ? { $or: [{ isOfficial: true }, { ownerId: user.id }, { status: { $in: ["PENDING", "REJECTED"] } }] }
      : { $or: [{ isOfficial: true }, { ownerId: user.id }] },
  )
    .sort({ isOfficial: -1, createdAt: -1 })
    .lean();
  return NextResponse.json({ categories: categories.map(normalizeCategory) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const staff = isStaff(user.role);
  const isOfficial = Boolean(body.isOfficial) && staff;
  const monsters = sanitizeMonsters(body.monsters);

  let subjects = Array.isArray(body.subjects)
    ? body.subjects.filter((s: unknown): s is string => typeof s === "string" && Boolean(s.trim())).map((s: string) => s.trim())
    : [];
  if (!subjects.length) subjects = [...new Set(monsters.flatMap((m) => m.subjects))];
  const difficulties = body.difficulties;
  const icon = sanitizeImage(body.icon);

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!subjects.length) {
    return NextResponse.json({ error: "At least one subject is required." }, { status: 400 });
  }

  // legacy single-enemy snapshot: derived from the first monster when present,
  // kept so old API consumers (and old battle docs) still work
  const first = monsters[0];
  const rawEnemy = (body.enemy ?? {}) as Record<string, unknown>;
  const tierNum = staff
    ? Math.min(8, Math.max(1, Number(rawEnemy.tier) || 1))
    : 1; // players always get tier-1 loot scaling until a category is approved
  const enemy = first
    ? {
        name: first.name,
        emoji: first.emoji,
        tier: tierNum,
        baseHp: Math.max(20, first.hp),
        atkMin: first.atkMin,
        atkMax: first.atkMax,
      }
    : {
        name: String(rawEnemy.name ?? "").trim() || `${name} Guardian`,
        emoji: String(rawEnemy.emoji ?? "").trim() || "👾",
        tier: tierNum,
        baseHp: Math.min(9999, Math.max(20, Number(rawEnemy.baseHp) || 60)),
        atkMin: Math.max(1, Number(rawEnemy.atkMin) || 6),
        atkMax: Math.max(1, Number(rawEnemy.atkMax) || 9),
      };

  await connectDB();
  const created = await Category.create({
    name,
    description,
    subjects,
    difficulties: difficulties ?? ["EASY"],
    icon,
    enemy,
    monsters,
    isOfficial,
    ownerId: isOfficial ? null : user.id,
    // player-created categories start private (visible only to their creator)
    // until they are submitted and approved to become official
    status: isOfficial ? "OFFICIAL" : "CUSTOM",
  });
  return NextResponse.json({ category: normalizeCategory(created.toObject()) }, { status: 201 });
}