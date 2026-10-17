import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Battle, Question, normalizeBattle, normalizeQuestion } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { getTier, playerMaxHp, levelProgress, ENEMY_TIERS } from "@/lib/game";
import { drawWave, toBattleState, toBattleQuestion } from "@/lib/battle";

/** Resume: return the player's ongoing battle, if any. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const doc = await Battle.findOne({ userId: user.id, status: "ONGOING" })
    .sort({ createdAt: -1 })
    .lean();
  if (!doc) return NextResponse.json({ battle: null });

  const battle = normalizeBattle(doc);
  const ids = battle.questions;
  const currentId = ids[battle.cursor];
  const qDoc = currentId ? await Question.findById(currentId).lean() : null;
  const current = qDoc ? toBattleQuestion(normalizeQuestion(qDoc)) : null;
  return NextResponse.json({ battle: toBattleState(battle, current) });
}

/** Start a new battle. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const existing = await Battle.findOne({ userId: user.id, status: "ONGOING" })
    .sort({ createdAt: -1 })
    .lean();
  if (existing) {
    const ongoing = normalizeBattle(existing);
    return NextResponse.json(
      { error: "You already have an ongoing battle.", battleId: ongoing.id },
      { status: 409 },
    );
  }

  const body = await req.json();
  const subject = String(body.subject ?? "ALL").trim() || "ALL";
  const tierNum = Number(body.tier ?? 1);
  const tier = getTier(tierNum);
  const { level } = levelProgress(user.xp);

  if (!ENEMY_TIERS.some((t) => t.tier === tier.tier)) {
    return NextResponse.json({ error: "Unknown enemy tier." }, { status: 400 });
  }
  if (level < tier.unlockLevel) {
    return NextResponse.json(
      { error: `${tier.name} unlocks at level ${tier.unlockLevel}.` },
      { status: 403 },
    );
  }

  const questions = await drawWave(subject, user.id, tier.tier);
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No questions available yet. Add some in the Question Bank first." },
      { status: 400 },
    );
  }

  const created = await Battle.create({
    userId: user.id,
    subject,
    tier: tier.tier,
    enemyName: tier.name,
    enemyMaxHp: tier.maxHp,
    enemyHp: tier.maxHp,
    playerMaxHp: playerMaxHp(level),
    playerHp: playerMaxHp(level),
    questions: questions.map((q) => q.id),
  });

  return NextResponse.json(
    { battle: toBattleState(normalizeBattle(created.toObject()), questions[0]) },
    { status: 201 },
  );
}
