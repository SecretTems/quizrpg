import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, User, normalizeCategory, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { levelFromXp } from "@/lib/game";
import type { LeaderboardEntry } from "@/lib/types";

/** Ranked accuracy scope used to pull the right tally out of a user's ledgers. */
type AccuracyScope =
  | { type: "overall" }
  | { type: "subject"; name: string }
  | { type: "category"; id: string };

function accuracyOf(u: {
  questionsRight?: number;
  questionsWrong?: number;
  subjectStats?: Record<string, { right: number; wrong: number } | undefined>;
  categoryStats?: Record<string, { right: number; wrong: number } | undefined>;
}, scope: AccuracyScope): number | null {
  let right = 0;
  let wrong = 0;
  if (scope.type === "overall") {
    right = u.questionsRight ?? 0;
    wrong = u.questionsWrong ?? 0;
  } else if (scope.type === "subject") {
    const s = u.subjectStats?.[scope.name];
    right = s?.right ?? 0;
    wrong = s?.wrong ?? 0;
  } else {
    const c = u.categoryStats?.[scope.id];
    right = c?.right ?? 0;
    wrong = c?.wrong ?? 0;
  }
  const total = right + wrong;
  return total > 0 ? Math.round((right / total) * 100) : null;
}

function toEntry(
  u: ReturnType<typeof normalizeUser>,
  rank: number,
  scope: AccuracyScope,
): LeaderboardEntry {
  return {
    rank,
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || "",
    level: levelFromXp(u.xp),
    xp: u.xp,
    bestScore: u.bestScore,
    battlesWon: u.battlesWon,
    bestStreak: u.bestStreak,
    accuracy: accuracyOf(u, scope),
  };
}

const PLAYER_FILTER = { role: "PLAYER", emailVerified: true } as const;

/**
 * Builds one ranked board for a scope. Players who never answered anything in
 * that scope are excluded so category/subject boards only show real competitors.
 */
function boardFor(
  scope: AccuracyScope,
  docs: ReturnType<typeof normalizeUser>[],
): LeaderboardEntry[] {
  const ranked = docs
    .map((u) => ({ u, acc: accuracyOf(u, scope) }))
    .filter((x) => x.acc !== null)
    .sort((a, b) => (b.acc! - a.acc!) || (b.u.questionsRight ?? 0) - (a.u.questionsRight ?? 0))
    .slice(0, 15);
  return ranked.map((x, i) => toEntry(x.u, i + 1, scope));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const [byScoreDocs, byXpDocs, playerDocs, officialCategories, totalPlayers] = await Promise.all([
    // (super)admins are staff, not competitors, and unverified accounts are
    // not yet real players — neither appears on any board
    User.find(PLAYER_FILTER).sort({ bestScore: -1, xp: -1 }).limit(15).lean(),
    User.find(PLAYER_FILTER).sort({ xp: -1, bestScore: -1 }).limit(15).lean(),
    // full accuracy ledgers needed for the per-subject / per-category boards
    User.find(PLAYER_FILTER)
      .select("username displayName avatar xp bestScore battlesWon bestStreak questionsRight questionsWrong subjectStats categoryStats")
      .limit(500)
      .lean(),
    Category.find({ status: "OFFICIAL" }).select("name subjects").lean(),
    User.countDocuments(PLAYER_FILTER),
  ]);

  const players = playerDocs.map(normalizeUser);

  // subjects actually used by official categories (adapts automatically as
  // categories/subjects come and go)
  const subjectNames = [...new Set(officialCategories.flatMap((c) => normalizeCategory(c).subjects))].sort((a, b) =>
    a.localeCompare(b),
  );

  const subjectBoards = subjectNames.map((name) => ({
    name,
    entries: boardFor({ type: "subject", name }, players),
  }));

  const categoryBoards = officialCategories.map((c) => {
    const cat = normalizeCategory(c);
    return {
      id: cat.id,
      name: cat.name,
      entries: boardFor({ type: "category", id: cat.id }, players),
    };
  });

  return NextResponse.json({
    byScore: byScoreDocs.map((u, i) => toEntry(normalizeUser(u), i + 1, { type: "overall" })),
    byXp: byXpDocs.map((u, i) => toEntry(normalizeUser(u), i + 1, { type: "overall" })),
    byAccuracy: boardFor({ type: "overall" }, players),
    subjects: subjectBoards,
    categories: categoryBoards,
    totalPlayers,
  });
}
