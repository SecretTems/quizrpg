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
  const slot = body.slot as "WEAPON" | "ARMOR" | "ACCESSORY" | undefined;
  const action = body.action as "equip" | "unequip" | undefined;

  if (!itemId || !slot || !action) {
    return NextResponse.json({ error: "itemId, slot and action are required." }, { status: 400 });
  }

  const item = itemById(itemId);
  if (!item || item.slot !== slot) {
    return NextResponse.json({ error: "Invalid item for slot." }, { status: 400 });
  }

  await connectDB();
  const update: Record<string, unknown> = {};
  if (action === "equip") {
    update[`equipment.${slot}`] = {
      itemId: item.id,
      name: item.name,
      slot: item.slot,
      atk: item.atk,
      def: item.def,
      rarity: item.rarity,
    };
  } else {
    update[`equipment.${slot}`] = null;
  }

  const updated = await User.findByIdAndUpdate(user.id, { $set: update }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ equipment: updated.equipment });
}