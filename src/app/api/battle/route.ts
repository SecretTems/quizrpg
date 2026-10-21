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
  type BattleMonster,
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
    // everyone may fight official categories; creators may also fight their own
     // private (CUSTOM) or pending ones - never anyone else's unapproved content
    const playable =
      category.status === "OFFICIAL" || category.ownerId === user.id;
    if (!playable) {
      return NextResponse.json(
        { error: "This category is not available to play." },
        { status: 403 },
      );
    }
  }

  // --- build the enemy lineup: a category's monster team, fought in order ---
  const categoryMonsters: BattleMonster[] = category
    ? category.monsters && category.monsters.length > 0
      ? category.monsters
      : [
          {
            // legacy categories have no lineup - fall back to their single enemy
            name: category.enemy.name,
            emoji: category.enemy.emoji,
            hp: category.enemy.baseHp,
            atkMin: category.enemy.atkMin,
            atkMax: category.enemy.atkMax,
            subjects: category.subjects,
          },
        ]
    : [];
  const firstMonster = categoryMonsters[0];
  // the first monster decides which questions open the fight
  const categorySubjects =
    firstMonster && firstMonster.subjects.length > 0
      ? firstMonster.subjects
      : category
        ? category.subjects
        : [];

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

  // category battles draw from the first monster's own subject list
  const questions = await drawWave(
    category ? categorySubjects : subject,
    user.id,
    tier.tier,
    battleMode.id,
    1,
    [],
  );
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No questions available yet. Add some in the Question Bank first." },
      { status: 400 },
    );
  }

  const enemyMaxHp = category ? firstMonster.hp : tier.maxHp;
  const created = await Battle.create({
    userId: user.id,
    subject: category ? category.subjects.join(", ") || "ALL" : subject,
    tier: tier.tier,
    mode: battleMode.id,
    ...(category
      ? {
          categoryId: category.id,
          enemyName: firstMonster.name,
          enemySprite: firstMonster.emoji,
          enemyImage: firstMonster.image ?? "",
          enemyAtkMin: firstMonster.atkMin,
          enemyAtkMax: firstMonster.atkMax,
          battleSubjects: categorySubjects.length > 0 ? categorySubjects : category.subjects,
          monsters: categoryMonsters,
          monsterIndex: 0,
        }
      : { enemyName: tier.name }),
    enemyMaxHp,
    enemyHp: enemyMaxHp,
    playerMaxHp: playerMaxHp(level),
    playerHp: playerMaxHp(level),
    questions: questions.map((q) => q.id),
    questionDeadlineAt: Date.now() + 30_000,
  });

  return NextResponse.json(
    { battle: toBattleState(normalizeBattle(created.toObject()), questions[0]) },
    { status: 201 },
  );
}
