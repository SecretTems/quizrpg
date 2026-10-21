import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { levelProgress } from "@/lib/game";

type Params = { params: Promise<{ id: string }> };

/** Public-safe profile snapshot (no email, wallet, or 2FA details). */
export async function GET(_req: Request, { params }: Params) {
  const viewer = await getSessionUser();
  if (!viewer) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await connectDB();
  const doc = await User.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const u = normalizeUser(doc);
  const lp = levelProgress(u.xp);
  return NextResponse.json({
    profile: {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar || "",
      role: u.role,
      level: lp.level,
      xp: u.xp,
      battlesWon: u.battlesWon,
      battlesLost: u.battlesLost,
      bestScore: u.bestScore,
      bestStreak: u.bestStreak,
      createdAt: u.createdAt,
    },
  });
}
