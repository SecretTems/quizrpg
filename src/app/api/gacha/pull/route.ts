import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { GACHA_COST_GEMS, GACHA_POOL, GACHA_POOL_ITEMS, itemById, type ItemDef } from "@/lib/adventure-data";

function rollRarity() {
  const total = GACHA_POOL.reduce((sum, { weight }) => sum + weight, 0);
  let r = Math.random() * total;
  for (const { rarity, weight } of GACHA_POOL) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return GACHA_POOL[GACHA_POOL.length - 1].rarity;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const doc = await User.findById(user.id).lean();
  if (!doc) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if ((doc.gems ?? 0) < GACHA_COST_GEMS) {
    return NextResponse.json({ error: "Not enough gems." }, { status: 400 });
  }

  const rarity = rollRarity();
  const pool = GACHA_POOL_ITEMS.filter((i) => i.rarity === rarity);
  let item: ItemDef | undefined = pool[Math.floor(Math.random() * pool.length)];
  // Unique items cannot be pulled twice if already owned/equipped.
  if (item && item.unique) {
    const backpack: Record<string, { qty: number }> = doc.backpack as Record<string, { qty: number }>;
    const equipped = Object.values(doc.equipment as Record<string, { itemId: string } | null>).filter(Boolean) as { itemId: string }[];
    const alreadyOwned = !!backpack[item!.id] || equipped.some((e) => e.itemId === item!.id);
    if (alreadyOwned) item = undefined;
  }

  const backpack: Record<string, { qty: number; piece?: unknown }> = { ...((doc.backpack as Record<string, { qty: number; piece?: unknown }>) || {}) };
  if (item) {
    const cur = backpack[item.id] ?? { qty: 0 };
    backpack[item.id] = { qty: cur.qty + 1, piece: item };
  }

  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: { gems: (doc.gems ?? 0) - GACHA_COST_GEMS, backpack } },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({
    gems: updated.gems,
    rarity,
    item: item ? itemById(item.id) : null,
    backpack: updated.backpack,
  });
}