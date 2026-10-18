import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { itemById } from "@/lib/adventure-data";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json();
  const itemId = String(body.itemId ?? "");
  const item = itemById(itemId);
  if (!item || item.slot !== "CONSUMABLE" || item.price <= 0) {
    return NextResponse.json({ error: "Item not purchasable." }, { status: 400 });
  }

  await connectDB();
  const doc = await User.findById(user.id).lean();
  if (!doc) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if ((doc.gold ?? 0) < item.price) {
    return NextResponse.json({ error: "Not enough gold." }, { status: 400 });
  }

  const backpack: Record<string, { qty: number }> = { ...((doc.backpack as Record<string, { qty: number }>) || {}) };
  const cur = backpack[itemId] ?? { qty: 0 };
  backpack[itemId] = { qty: cur.qty + 1 };

  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: { gold: (doc.gold ?? 0) - item.price, backpack } },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ gold: updated.gold, backpack: updated.backpack });
}