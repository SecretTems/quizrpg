import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import {
  Battle,
  Category,
  Question,
  normalizeBattle,
  normalizeCategory,
  normalizeQuestion,
  type NormalizedCategory,
} from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { getTier, playerMaxHp, levelProgress, ENEMY_TIERS, BATTLE_MODES, getMode, isBattleModeId } from "@/lib/game";
import { drawWave, toBattleState, toBattleQuestion } from "@/lib/battle";
import type { BattleModeId } from "@/lib/game";

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
  const mode = String(body.mode ?? "EASY").toUpperCase() as BattleModeId;
  const battleMode = getMode(mode);
  const customOnly = Boolean(body.customOnly);
  const categoryId = body.categoryId ? String(body.categoryId) : null;
  const { level } = levelProgress(user.xp);

  if (!isBattleModeId(mode)) {
    return NextResponse.json({ error: "Unknown battle mode." }, { status: 400 });
  }

  // --- resolve the opponent: an Adventure category monster or the static roster ---
  let category: NormalizedCategory | null = null;
  if (categoryId !== null) {
    if (!Types.ObjectId.isValid(categoryId)) {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }
    const catDoc = await Category.findById(categoryId).lean();
    if (!catDoc) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    category = normalizeCategory(catDoc);
    // players may fight OFFICIAL categories or their own unapproved CUSTOM ones;
    // PENDING/REJECTED categories (including other players') are not playable
    const playable =
      category.status === "OFFICIAL" ||
      (category.status === "CUSTOM" && category.ownerId === user.id);
    if (!playable) {
      return NextResponse.json(
        { error: "This category is not available to play." },
        { status: 403 },
      );
    }
  }

  const tier = getTier(category ? category.enemy.tier : tierNum);

  if (!category) {
    if (!ENEMY_TIERS.some((t) => t.tier === tier.tier)) {
      return NextResponse.json({ error: "Unknown enemy tier." }, { status: 400 });
    }
    if (level < tier.unlockLevel) {
      return NextResponse.json(
        { error: `${tier.name} unlocks at level ${tier.unlockLevel}.` },
        { status: 403 },
      );
    }
  }
  if (level < battleMode.unlockLevel) {
    return NextResponse.json(
      { error: `${battleMode.label} unlocks at level ${battleMode.unlockLevel}.` },
      { status: 403 },
    );
  }

  // category battles draw only from the category's own subject list
  const questions = await drawWave(
    category ? category.subjects : subject,
    user.id,
    tier.tier,
    battleMode.id,
    1,
    [],
    customOnly,
  );
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No questions available yet. Add some in the Question Bank first." },
      { status: 400 },
    );
  }

  const enemyMaxHp = category ? category.enemy.baseHp : tier.maxHp;
  const created = await Battle.create({
    userId: user.id,
    subject: category ? category.subjects.join(", ") || "ALL" : subject,
    tier: tier.tier,
    mode: battleMode.id,
    ...(category
      ? {
          categoryId: category.id,
          enemyName: category.enemy.name,
          enemySprite: category.enemy.emoji,
          enemyAtkMin: category.enemy.atkMin,
          enemyAtkMax: category.enemy.atkMax,
          battleSubjects: category.subjects,
        }
      : { enemyName: tier.name }),
    enemyMaxHp,
    enemyHp: enemyMaxHp,
    playerMaxHp: playerMaxHp(level),
    playerHp: playerMaxHp(level),
    questions: questions.map((q) => q.id),
  });

  return NextResponse.json(
    { battle: toBattleState(normalizeBattle(created.toObject()), questions[0]) },
    { status: 201 },
  );
}
