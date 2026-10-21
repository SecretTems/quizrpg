import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import {
  GACHA_POOL,
  GACHA_POOL_ITEMS,
  GACHA_CATEGORIES,
  GACHA_COST_RANDOM,
  GACHA_COST_FOCUSED,
  GACHA_FOCUS_WEIGHT_BONUS,
  GACHA_MAX_COPIES,
  itemById,
  type ItemDef,
  type GachaCategory,
} from "@/lib/adventure-data";

function rollRarity() {
  const total = GACHA_POOL.reduce((sum, { weight }) => sum + weight, 0);
  let r = Math.random() * total;
  for (const { rarity, weight } of GACHA_POOL) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return GACHA_POOL[GACHA_POOL.length - 1].rarity;
}

function rollItem(rarity: string, focus: GachaCategory | null, owned: Record<string, { qty: number }>): ItemDef | undefined {
  let pool = GACHA_POOL_ITEMS.filter((i) => i.rarity === rarity);
  if (pool.length === 0) return undefined;

  if (focus) {
    const matching = pool.filter((i) => i.slot === focus);
    const others = pool.filter((i) => i.slot !== focus);
    if (matching.length > 0) {
      // focused items are more likely, but others can still appear
      const matchWeight = matching.length * GACHA_FOCUS_WEIGHT_BONUS;
      const otherWeight = others.length;
      const total = matchWeight + otherWeight;
      pool = Math.random() * total < matchWeight || others.length === 0 ? matching : others;
    }
  }

  // filter out items that hit their copy cap already
  const eligible = pool.filter((i) => (owned[i.id]?.qty ?? 0) < (GACHA_MAX_COPIES[i.rarity] ?? 999));
  if (eligible.length === 0) return undefined;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const focusRaw = String(body.focus ?? "");
  const focus: GachaCategory | null =
    focusRaw && (GACHA_CATEGORIES as readonly string[]).includes(focusRaw) ? (focusRaw as GachaCategory) : null;
  const cost = focus ? GACHA_COST_FOCUSED : GACHA_COST_RANDOM;

  await connectDB();
  const doc = await User.findById(user.id).lean();
  if (!doc) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if ((doc.gems ?? 0) < cost) {
    return NextResponse.json({ error: `Not enough gems (need ${cost}).` }, { status: 400 });
  }

  const rarity = rollRarity();
  const owned = (doc.backpack ?? {}) as Record<string, { qty: number }>;
  const item = rollItem(rarity, focus, owned);
  let destroyed = false;

  const backpack: Record<string, { qty: number; piece?: unknown }> = {
    ...((doc.backpack as Record<string, { qty: number; piece?: unknown }>) || {}),
  };
  if (item) {
    const cur = backpack[item.id] ?? { qty: 0 };
    const max = GACHA_MAX_COPIES[item.rarity] ?? 999;
    if (cur.qty + 1 > max) {
      // over the copy cap - the extra copy is destroyed (gems still spent)
      destroyed = true;
    } else {
      backpack[item.id] = { qty: cur.qty + 1, piece: item };
    }
  }

  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: { gems: (doc.gems ?? 0) - cost, backpack } },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({
    gems: updated.gems,
    rarity,
    item: item && !destroyed ? itemById(item.id) : null,
    destroyed,
    cost,
    backpack: updated.backpack,
  });
}