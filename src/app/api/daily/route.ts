import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

/** Local calendar day key (e.g. 2026-10-21). Claiming once per key. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_MS = 86_400_000;
const BASE_GEMS = 1; // every day
const WEEK_BONUS = 5; // every 7-day streak milestone
const MONTH_BONUS = 50; // full month without a miss (30+ consecutive days)

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return NextResponse.json({
    lastDailyClaimAt: user.lastDailyClaimAt ?? null,
    dailyStreak: user.dailyStreak ?? 0,
    claimedToday: user.lastDailyClaimAt ? dayKey(user.lastDailyClaimAt) === dayKey(Date.now()) : false,
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const doc = await User.findById(user.id);
  if (!doc) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const now = Date.now();
  if (doc.lastDailyClaimAt && dayKey(doc.lastDailyClaimAt) === dayKey(now)) {
    return NextResponse.json({ error: "Already claimed today. Come back tomorrow!" }, { status: 409 });
  }

  // streak: continues if the last claim was yesterday, otherwise resets
  const claimedYesterday = doc.lastDailyClaimAt
    ? dayKey(doc.lastDailyClaimAt) === dayKey(now - DAY_MS)
    : false;
  const streak = claimedYesterday ? (doc.dailyStreak ?? 0) + 1 : 1;

  let gems = BASE_GEMS;
  const rewards: string[] = [`+${BASE_GEMS} gem (daily)`];
  if (streak > 0 && streak % 7 === 0) {
    gems += WEEK_BONUS;
    rewards.push(`+${WEEK_BONUS} gems (weekly streak!)`);
  }
  if (streak >= 30) {
    gems += MONTH_BONUS;
    rewards.push(`+${MONTH_BONUS} gems (full month, no misses!!)`);
  }

  doc.lastDailyClaimAt = now;
  doc.dailyStreak = streak;
  doc.gems += gems;
  await doc.save();

  return NextResponse.json({
    ok: true,
    gemsEarned: gems,
    rewards,
    dailyStreak: streak,
    user: normalizeUser(doc.toObject()),
  });
}
