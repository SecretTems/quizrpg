import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, User, normalizeCategory, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { levelFromXp } from "@/lib/game";
import type { LeaderboardEntry } from "@/lib/types";

/**
 * A leaderboard scope. Rankings go overall → category → subject, and subject is
 * the deepest level. Every scope carries the same three metrics (score, XP and
 * accuracy) so the UI can switch between them at any depth.
 */
type Scope = { type: "overall" } | { type: "category"; id: string } | { type: "subject"; name: string };

/** Per-scope tallies for one player: score, xp and right/wrong answer counts. */
interface ScopedStats {
  bestScore: number;
  xp: number;
  right: number;
  wrong: number;
  answered: number;
}

function emptyStats(): ScopedStats {
  return { bestScore: 0, xp: 0, right: 0, wrong: 0, answered: 0 };
}

/**
 * Folds the per-player scoped numbers into one `ScopedStats`.
 *
 * Overall uses the lifetime counters. Category and subject boards use the
 * per-scope accuracy ledgers; because those ledgers do not store score/XP per
 * scope, score and XP fall back to the player's lifetime values (marked in the
 * UI as "overall" numbers) while accuracy is strictly scoped.
 */
function statsFor(
  u: ReturnType<typeof normalizeUser>,
  scope: Scope,
): ScopedStats {
  const s = emptyStats();
  s.bestScore = u.bestScore ?? 0;
  s.xp = u.xp ?? 0;
  if (scope.type === "overall") {
    s.right = u.questionsRight ?? 0;
    s.wrong = u.questionsWrong ?? 0;
  } else if (scope.type === "subject") {
    const entry = u.subjectStats?.[scope.name];
    s.right = entry?.right ?? 0;
    s.wrong = entry?.wrong ?? 0;
  } else {
    const entry = u.categoryStats?.[scope.id];
    s.right = entry?.right ?? 0;
    s.wrong = entry?.wrong ?? 0;
  }
  s.answered = s.right + s.wrong;
  return s;
}

function accuracyOf(s: ScopedStats): number | null {
  return s.answered > 0 ? Math.round((s.right / s.answered) * 100) : null;
}

type Metric = "score" | "xp" | "accuracy";

interface Ranked {
  u: ReturnType<typeof normalizeUser>;
  s: ScopedStats;
  acc: number | null;
}

function sortBy(list: Ranked[], metric: Metric): Ranked[] {
  return [...list].sort((a, b) => {
    if (metric === "score") return b.s.bestScore - a.s.bestScore;
    if (metric === "xp") return b.s.xp - a.s.xp;
    // accuracy: highest % first, then the player with more correct answers
    return (b.acc ?? -1) - (a.acc ?? -1) || b.s.right - a.s.right;
  });
}

function toEntry(r: Ranked, rank: number, metric: Metric): LeaderboardEntry {
  const hasAnswers = r.s.answered > 0 || metric !== "accuracy";
  return {
    rank,
    userId: r.u.id,
    username: r.u.username,
    displayName: r.u.displayName,
    avatar: r.u.avatar || "",
    level: levelFromXp(r.u.xp),
    xp: r.s.xp,
    bestScore: r.s.bestScore,
    battlesWon: r.u.battlesWon,
    bestStreak: r.u.bestStreak,
    accuracy: hasAnswers ? r.acc : null,
    questionsRight: r.s.right,
    questionsWrong: r.s.wrong,
  };
}

const PLAYER_FILTER = { role: "PLAYER", emailVerified: true } as const;
const BOARD_SIZE = 15;

/** One scope, all three metrics. */
function boardsFor(scope: Scope, players: ReturnType<typeof normalizeUser>[]) {
  const ranked = players
    .map((u) => ({ u, s: statsFor(u, scope), acc: null as number | null }))
    .map((r) => ({ ...r, acc: accuracyOf(r.s) }))
    // a player with no answers in this scope is not a competitor here
    .filter((r) => r.s.answered > 0);
  const board = (metric: Metric) =>
    sortBy(ranked, metric).slice(0, BOARD_SIZE).map((r, i) => toEntry(r, i + 1, metric));
  return { byScore: board("score"), byXp: board("xp"), byAccuracy: board("accuracy") };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const [playerDocs, officialCategories, totalPlayers] = await Promise.all([
    // (super)admins are staff, not competitors, and unverified accounts are
    // not yet real players - neither appears on any board
    User.find(PLAYER_FILTER)
      .select(
        "username displayName avatar xp bestScore battlesWon bestStreak questionsRight questionsWrong subjectStats categoryStats",
      )
      .limit(500)
      .lean(),
    // the leaderboard adapts itself to whatever official categories exist
    Category.find({ status: "OFFICIAL" }).select("name subjects").lean(),
    User.countDocuments(PLAYER_FILTER),
  ]);

  const players = playerDocs.map(normalizeUser);

  const { subjects: subjectNames, categories: categoryDefs } = (() => {
    const subjectNames = [
      ...new Set(officialCategories.flatMap((c) => normalizeCategory(c).subjects)),
    ].sort((a, b) => a.localeCompare(b));
    const categories = officialCategories.map((c) => {
      const cat = normalizeCategory(c);
      return { id: cat.id, name: cat.name, subjects: cat.subjects };
    });
    return { subjects: subjectNames, categories };
  })();

  return NextResponse.json({
    overall: boardsFor({ type: "overall" }, players),
    categories: categoryDefs.map((c) => ({
      id: c.id,
      name: c.name,
      ...boardsFor({ type: "category", id: c.id }, players),
    })),
    subjects: subjectNames.map((name) => ({
      name,
      ...boardsFor({ type: "subject", name }, players),
    })),
    totalPlayers,
  });
}
