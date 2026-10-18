import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { itemById, type ItemDef } from "@/lib/adventure-data";

const STARTER_EQUIPMENT: { slot: "WEAPON" | "ARMOR" | "ACCESSORY"; itemId: string }[] = [
  { slot: "WEAPON", itemId: "w-wood-sword" },
  { slot: "ARMOR", itemId: "a-wood-armor" },
];

function toEquipmentPiece(item: ItemDef | undefined) {
  if (!item) return null;
  return {
    itemId: item.id,
    name: item.name,
    slot: item.slot,
    atk: item.atk,
    def: item.def,
    rarity: item.rarity,
  };
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters (letters, numbers, underscore)." },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const equipment: { WEAPON: ReturnType<typeof toEquipmentPiece> | null; ARMOR: ReturnType<typeof toEquipmentPiece> | null; ACCESSORY: ReturnType<typeof toEquipmentPiece> | null } = {
      WEAPON: null,
      ARMOR: null,
      ACCESSORY: null,
    };
    for (const { slot, itemId } of STARTER_EQUIPMENT) {
      const piece = toEquipmentPiece(itemById(itemId));
      if (piece) equipment[slot as keyof typeof equipment] = piece;
    }

    const created = await User.create({
      username,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      role: "PLAYER",
      equipment,
    });

    await setSessionCookie(created.id);
    return NextResponse.json({ user: normalizeUser(created.toObject()) }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
