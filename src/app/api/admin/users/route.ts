import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Question, Battle, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { levelFromXp } from "@/lib/game";

const isStaff = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || !isStaff(admin.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await connectDB();
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim();
  const section = url.searchParams.get("section") ?? "all"; // players | admins | all

  const roleFilter: Record<string, unknown> =
    section === "players"
      ? { role: "PLAYER" }
      : section === "admins"
        ? { role: { $in: ["ADMIN", "SUPER_ADMIN"] } }
        : {};
  const userFilter = search
    ? {
        ...roleFilter,
        $or: [
          { username: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          { displayName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        ],
      }
    : roleFilter;

  const docs = await User.find(userFilter).sort({ createdAt: 1 }).lean();
  const users = docs.map(normalizeUser);

  // count questions per owner (ownerId stored as user id string)
  const qCounts = await Question.aggregate<{ _id: string | null; count: number }>([
    { $match: { ownerId: { $ne: null } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
  ]);
  const countByOwner = new Map(qCounts.map((r) => [r._id as string, r.count]));

  const [totalQuestions, globalQuestions, totalBattles, pendingQuestions] = await Promise.all([
    Question.countDocuments(),
    Question.countDocuments({ status: "OFFICIAL" }),
    Battle.countDocuments(),
    Question.countDocuments({ status: "PENDING" }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      level: levelFromXp(u.xp),
      questionCount: countByOwner.get(u.id) ?? 0,
    })),
    stats: { totalQuestions, globalQuestions, totalBattles, totalUsers: users.length, pendingQuestions },
    viewerRole: admin.role,
  });
}
