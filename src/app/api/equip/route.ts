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
  const action = body.action as "equip" | "unequip" | "discard" | undefined;

  if (action !== "equip" && action !== "unequip" && action !== "discard") {
    return NextResponse.json({ error: "action must be equip, unequip or discard." }, { status: 400 });
  }

  await connectDB();

  if (action === "unequip") {
    if (slot !== "WEAPON" && slot !== "ARMOR" && slot !== "ACCESSORY") {
      return NextResponse.json({ error: "slot is required to unequip." }, { status: 400 });
    }
    const updated = await User.findByIdAndUpdate(
      user.id,
      { $set: { [`equipment.${slot}`]: null } },
      { new: true },
    ).lean();
    if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ equipment: updated.equipment });
  }

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  if (action === "discard") {
    // drop one unit of the item from the backpack (stackables lose one, gear is removed)
    const updated = await User.findOneAndUpdate(
      { _id: user.id, [`backpack.${itemId}`]: { $exists: true } },
      { $inc: { [`backpack.${itemId}.qty`]: -1 } },
      { new: true },
    ).lean();
    if (!updated) {
      return NextResponse.json({ error: "That item is not in your backpack." }, { status: 404 });
    }
    // remove the entry entirely once the stack is spent
    const remaining = (updated.backpack as Record<string, { qty: number } | undefined>)[itemId]?.qty ?? 0;
    if (remaining <= 0) {
      await User.updateOne({ _id: user.id }, { $unset: { [`backpack.${itemId}`]: "" } });
    }
    const fresh = await User.findById(user.id).lean();
    return NextResponse.json({ backpack: fresh?.backpack ?? {}, equipment: fresh?.equipment ?? null });
  }

  const item = itemById(itemId);
  if (!item || item.slot !== slot) {
    return NextResponse.json({ error: "Invalid item for that slot." }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    [`equipment.${slot}`]: {
      itemId: item.id,
      name: item.name,
      slot: item.slot,
      atk: item.atk,
      def: item.def,
      rarity: item.rarity,
    },
  };

  const updated = await User.findByIdAndUpdate(user.id, { $set: update }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ equipment: updated.equipment });
}