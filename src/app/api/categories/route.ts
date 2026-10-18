import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, normalizeCategory } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const categories = await Category.find({
    $or: [{ isOfficial: true }, { ownerId: user.id }],
  })
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
  const subjects = Array.isArray(body.subjects) ? body.subjects.filter((s: any) => typeof s === "string") : [];
  const difficulties = body.difficulties;
  const enemy = body.enemy;
  const isOfficial = Boolean(body.isOfficial) && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!subjects.length) return NextResponse.json({ error: "At least one subject is required." }, { status: 400 });

  await connectDB();
  const created = await Category.create({
    name,
    description,
    subjects,
    difficulties: difficulties ?? ["EASY"],
    enemy: {
      name: enemy?.name ?? `${name} Guardian`,
      emoji: enemy?.emoji ?? "👾",
      tier: Number(enemy?.tier ?? 1),
      baseHp: Number(enemy?.baseHp ?? 60),
      atkMin: Number(enemy?.atkMin ?? 6),
      atkMax: Number(enemy?.atkMax ?? 9),
    },
    isOfficial,
    ownerId: isOfficial ? null : user.id,
    status: isOfficial ? "OFFICIAL" : "PENDING",
  });
  return NextResponse.json({ category: normalizeCategory(created.toObject()) }, { status: 201 });
}