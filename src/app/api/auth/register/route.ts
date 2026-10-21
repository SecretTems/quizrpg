import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { generateOtp, otpExpiresAt, sendOtpEmail } from "@/lib/auth";
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
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters (letters, numbers, underscore)." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (password.length < 8 || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters with at least 1 number and 1 special character." },
        { status: 400 },
      );
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (existing) {
      return NextResponse.json({ error: "That username or email is already taken." }, { status: 409 });
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
      email,
      passwordHash: hashPassword(password),
      role: "PLAYER",
      emailVerified: false,
      equipment,
    });

    // send OTP for email verification but do not auto-login yet
    const code = generateOtp();
    const expires = otpExpiresAt();
    await User.findByIdAndUpdate(created._id, { otpCode: code, otpExpires: expires });
    await sendOtpEmail(email, code, "verify");

    return NextResponse.json(
      { user: normalizeUser(created.toObject()), requiresEmailVerification: true },
      { status: 201 },
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "That username or email is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
