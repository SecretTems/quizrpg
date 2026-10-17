import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Battle, Question, User, normalizeBattle, normalizeQuestion } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { getTier, computeAnswer, levelProgress } from "@/lib/game";
import { drawWave, newlyUnlockedTier, toBattleQuestion } from "@/lib/battle";
import type { AnswerResultDTO, BattleStateDTO } from "@/lib/types";
import type { Difficulty } from "@/lib/game";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }
  const battleDoc = await Battle.findById(id);
  if (!battleDoc || battleDoc.userId !== user.id) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }
  if (battleDoc.status !== "ONGOING") {
    return NextResponse.json({ error: "This battle is already over." }, { status: 409 });
  }

  const body = await req.json();
  const choiceIndex = Number(body.choiceIndex); // -1 = timeout

  const ids = battleDoc.questions; // string[] of question ids
  const currentId = ids[battleDoc.cursor];
  const qDoc = currentId ? await Question.findById(currentId).lean() : null;
  if (!qDoc) {
    return NextResponse.json({ error: "Question data missing." }, { status: 500 });
  }
  const question = normalizeQuestion(qDoc);

  const tier = getTier(battleDoc.tier);
  const wasCorrect = choiceIndex === question.correctIndex;
  const outcome = computeAnswer(question.difficulty as Difficulty, wasCorrect, battleDoc.streak, tier);

  // --- apply combat result ---
  const enemyHp = Math.max(0, battleDoc.enemyHp - outcome.damageDealt);
  const playerHp = Math.max(0, battleDoc.playerHp - outcome.damageTaken);
  const streak = outcome.streak;
  const bestStreak = Math.max(battleDoc.bestStreak, streak);
  const score = battleDoc.score + outcome.scoreGained;
  const xpEarned = battleDoc.xpEarned + outcome.xpGained;

  const xpBefore = levelProgress(user.xp).level;

  // XP accrues immediately so progress persists even mid-battle
  await User.updateOne({ _id: user.id }, { $inc: { xp: outcome.xpGained } });
  if (streak > user.bestStreak) {
    await User.updateOne({ _id: user.id }, { $set: { bestStreak: streak } });
  }

  let status: "ONGOING" | "WON" | "LOST" = "ONGOING";
  let victoryBonus: { xp: number; score: number } | null = null;

  if (enemyHp <= 0) {
    status = "WON";
    victoryBonus = { xp: tier.victoryXp, score: tier.victoryScore + bestStreak * 10 };
    await User.updateOne(
      { _id: user.id },
      {
        $inc: { xp: victoryBonus.xp, battlesWon: 1 },
        $max: { bestScore: score + victoryBonus.score },
      },
    );
  } else if (playerHp <= 0) {
    status = "LOST";
    await User.updateOne(
      { _id: user.id },
      { $inc: { battlesLost: 1 }, $max: { bestScore: score } },
    );
  }

  // --- advance to next question / next wave ---
  let cursor = battleDoc.cursor;
  let allIds = [...ids];
  let nextQuestion: BattleStateDTO["question"] = null;

  if (status === "ONGOING") {
    cursor += 1;
    if (cursor >= allIds.length) {
      const wave = await drawWave(battleDoc.subject, user.id, battleDoc.tier, allIds);
      if (wave.length > 0) {
        allIds = [...allIds, ...wave.map((q) => q.id)];
      }
    }
    if (cursor < allIds.length) {
      const nextDoc = await Question.findById(allIds[cursor]).lean();
      if (nextDoc) {
        nextQuestion = toBattleQuestion(normalizeQuestion(nextDoc));
      }
    }
  }

  battleDoc.set({
    enemyHp,
    playerHp,
    streak,
    bestStreak,
    score,
    xpEarned,
    cursor,
    status,
    questions: allIds,
  });
  await battleDoc.save();
  const updatedBattle = normalizeBattle(battleDoc.toObject());

  // --- level-up detection ---
  const afterUser = await User.findById(user.id).lean();
  const xpAfter = levelProgress(afterUser ? afterUser.xp : 0).level;
  const leveledUp = xpAfter > xpBefore;
  const unlockedTier = leveledUp ? newlyUnlockedTier(xpAfter) : null;

  const result: AnswerResultDTO = {
    correct: wasCorrect,
    correctIndex: question.correctIndex,
    damageDealt: outcome.damageDealt,
    damageTaken: outcome.damageTaken,
    xpGained: outcome.xpGained,
    scoreGained: outcome.scoreGained,
    streak,
    crit: outcome.crit,
    enemyHp: updatedBattle.enemyHp,
    playerHp: updatedBattle.playerHp,
    score: updatedBattle.score,
    xpEarned: updatedBattle.xpEarned,
    status,
    nextQuestion,
    questionNumber: Math.min(cursor + 1, allIds.length),
    explanation: question.explanation,
    leveledUp,
    newLevel: xpAfter,
    unlockedTier,
    victoryBonus,
  };

  return NextResponse.json(result);
}
