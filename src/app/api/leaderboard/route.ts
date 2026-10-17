import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { levelFromXp } from "@/lib/game";
import type { LeaderboardEntry } from "@/lib/types";

function toEntry(u: ReturnType<typeof normalizeUser>, rank: number): LeaderboardEntry {
  return {
    rank,
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    level: levelFromXp(u.xp),
    xp: u.xp,
    bestScore: u.bestScore,
    battlesWon: u.battlesWon,
    bestStreak: u.bestStreak,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const [byScoreDocs, byXpDocs, totalPlayers] = await Promise.all([
    User.find().sort({ bestScore: -1, xp: -1 }).limit(15).lean(),
    User.find().sort({ xp: -1, bestScore: -1 }).limit(15).lean(),
    User.countDocuments(),
  ]);

  return NextResponse.json({
    byScore: byScoreDocs.map((u, i) => toEntry(normalizeUser(u), i + 1)),
    byXp: byXpDocs.map((u, i) => toEntry(normalizeUser(u), i + 1)),
    totalPlayers,
  });
}
