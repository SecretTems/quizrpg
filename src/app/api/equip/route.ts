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
  const action = body.action as "equip" | "unequip" | "discard" | "setLoadout" | undefined;

  if (action !== "equip" && action !== "unequip" && action !== "discard" && action !== "setLoadout") {
    return NextResponse.json({ error: "action must be equip, unequip, discard or setLoadout." }, { status: 400 });
  }

  await connectDB();

  if (action === "setLoadout") {
    // 3 consumable slots; each holds ONE item (duplicates allowed, stack untouched)
    const requested = Array.isArray(body.loadout) ? body.loadout : [];
    if (requested.length > 3) {
      return NextResponse.json({ error: "Loadout can hold at most 3 items." }, { status: 400 });
    }
    const normalized: (string | null)[] = [null, null, null];
    const doc = await User.findById(user.id).lean();
    const backpack = (doc?.backpack ?? {}) as Record<string, { qty?: number } | undefined>;
    const needed = new Map<string, number>();
    for (let i = 0; i < requested.length; i++) {
      const id = String(requested[i] ?? "");
      if (!id) continue;
      const def = itemById(id);
      if (!def || def.slot !== "CONSUMABLE") {
        return NextResponse.json({ error: `"${def?.name ?? id}" is not a consumable.` }, { status: 400 });
      }
      if (!backpack[id]) {
        return NextResponse.json({ error: `You don't own "${def.name}".` }, { status: 400 });
      }
      // a slot holds ONE unit - the loadout can never reserve more than the stack
      const count = (needed.get(id) ?? 0) + 1;
      if (count > (backpack[id]?.qty ?? 0)) {
        return NextResponse.json(
          { error: `Only ${backpack[id]?.qty}× "${def.name}" in storage - you can't fill ${count} slots with it.` },
          { status: 400 },
        );
      }
      needed.set(id, count);
      normalized[i] = id;
    }
    const updated = await User.findByIdAndUpdate(
      user.id,
      { $set: { loadout: normalized } },
      { new: true },
    ).lean();
    if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ loadout: updated.loadout });
  }

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