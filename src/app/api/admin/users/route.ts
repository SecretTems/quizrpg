import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Question, Battle, normalizeUser } from "@/lib/models";
import { requireAdmin } from "@/lib/auth";
import { levelFromXp } from "@/lib/game";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  await connectDB();
  const docs = await User.find().sort({ createdAt: 1 }).lean();
  const users = docs.map(normalizeUser);

  // count questions per owner (ownerId stored as user id string)
  const qCounts = await Question.aggregate<{ _id: string | null; count: number }>([
    { $match: { ownerId: { $ne: null } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ]);
  const countByOwner = new Map(qCounts.map((r) => [r._id as string, r.count]));

  const [totalQuestions, globalQuestions, totalBattles] = await Promise.all([
    Question.countDocuments(),
    Question.countDocuments({ ownerId: null }),
    Battle.countDocuments(),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      level: levelFromXp(u.xp),
      questionCount: countByOwner.get(u.id) ?? 0,
    })),
    stats: { totalQuestions, globalQuestions, totalBattles, totalUsers: users.length },
  });
}
