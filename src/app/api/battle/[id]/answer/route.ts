import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Battle, Question, User, normalizeBattle, normalizeQuestion } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { getTier, computeAnswer, levelProgress, getMode, infiniteWaveBonus } from "@/lib/game";
import type { BattleModeId, EnemyTier } from "@/lib/game";
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

  // category opponents snapshot their own attack range on the battle — use it
  // instead of the static tier roster's stats
  const baseTier = getTier(battleDoc.tier);
  const tier: EnemyTier =
    battleDoc.enemyAtkMin != null && battleDoc.enemyAtkMax != null
      ? { ...baseTier, atkMin: battleDoc.enemyAtkMin, atkMax: battleDoc.enemyAtkMax }
      : baseTier;
  const wasCorrect = choiceIndex === question.correctIndex;

  // user-made (custom/pending) questions are practice-only: no damage, no XP,
  // no score and no stats — they don't affect the battle either way
  const isCustom = question.status !== "OFFICIAL";
  const outcome = isCustom
    ? {
        correct: wasCorrect,
        damageDealt: 0,
        damageTaken: 0,
        xpGained: 0,
        scoreGained: 0,
        streak: wasCorrect ? battleDoc.streak : 0,
        crit: false,
      }
    : computeAnswer(question.difficulty as Difficulty, wasCorrect, battleDoc.streak, tier);

  // --- apply combat result ---
  const enemyHp = Math.max(0, battleDoc.enemyHp - outcome.damageDealt);
  const playerHp = Math.max(0, battleDoc.playerHp - outcome.damageTaken);
  const streak = outcome.streak;
  const bestStreak = Math.max(battleDoc.bestStreak, streak);
  const score = battleDoc.score + outcome.scoreGained;
  const xpEarned = battleDoc.xpEarned + outcome.xpGained;

  const xpBefore = levelProgress(user.xp).level;
  // Custom-only battles are practice matches — no victory/loss rewards or stats.
  const noReward = battleDoc.mode === "customOnly";

  // XP accrues immediately so progress persists even mid-battle.
  // Custom (user-made) questions are practice-only — no XP and no streak stats.
  if (!isCustom && !noReward) {
    await User.updateOne({ _id: user.id }, { $inc: { xp: outcome.xpGained } });
    if (streak > user.bestStreak) {
      await User.updateOne({ _id: user.id }, { $set: { bestStreak: streak } });
    }
  }

  let status: "ONGOING" | "WON" | "LOST" = "ONGOING";
  let victoryBonus: { xp: number; score: number } | null = null;
  let waveCleared = false;
  let goldDrop = 0;
  let gemDrop = 0;
  const mode = getMode(battleDoc.mode as BattleModeId);

  if (mode.infinite) {
    // INFINITE: no single victory — each cleared wave pays a bonus, enemy HP
    // partially refills, and the next wave is harder
    const isWaveEnd = battleDoc.cursor + 1 >= ids.length;
    if (isWaveEnd && enemyHp > 0 && playerHp > 0) {
      waveCleared = true;
      const bonus = infiniteWaveBonus(battleDoc.wave);
      if (!noReward) {
        await User.updateOne(
          { _id: user.id },
          { $inc: { xp: bonus.xp } },
        );
      }
      victoryBonus = noReward ? { xp: 0, score: 0 } : bonus;
    }

  } else if (enemyHp <= 0) {
    status = "WON";
    victoryBonus = { xp: mode.rewardXp, score: mode.rewardScore + bestStreak * 10 };
    if (!noReward && !isCustom) {
      // Official enemies drop gold; harder enemies drop more and have a higher
      // chance to drop a gem for the gacha.
      goldDrop = Math.floor(8 + tier.tier * 6 + Math.random() * 10);
      const gemChance = Math.min(0.05 + tier.tier * 0.03, 0.6);
      if (Math.random() < gemChance) gemDrop = 1;
      await User.updateOne(
        { _id: user.id },
        {
          $inc: { xp: victoryBonus.xp, battlesWon: 1, gold: goldDrop, gems: gemDrop },
          $max: { bestScore: score + victoryBonus.score },
        },
      );
    } else if (!noReward) {
      await User.updateOne(
        { _id: user.id },
        {
          $inc: { xp: victoryBonus.xp, battlesWon: 1 },
          $max: { bestScore: score + victoryBonus.score },
        },
      );
    }
  } else if (playerHp <= 0) {
    status = "LOST";
    if (!noReward) {
      await User.updateOne(
        { _id: user.id },
        { $inc: { battlesLost: 1 }, $max: { bestScore: score } },
      );
    }
  }

  // --- advance to next question / next wave ---
  let cursor = battleDoc.cursor;
  let allIds = [...ids];
  let nextQuestion: BattleStateDTO["question"] = null;

  if (status === "ONGOING") {
    cursor += 1;
    if (cursor >= allIds.length) {
      // wave exhausted — INFINITE mode pulls a fresh, harder wave from the pool;
      // standard modes end the battle unless the pool had leftover questions
      const nextWave = battleDoc.wave + 1;
      const wave = await drawWave(
        // category battles keep drawing from the category's own subjects
        battleDoc.battleSubjects && battleDoc.battleSubjects.length > 0
          ? battleDoc.battleSubjects
          : battleDoc.subject,
        user.id,
        battleDoc.tier,
        battleDoc.mode as BattleModeId,
        nextWave,
        allIds,
      );
      if (wave.length > 0) {
        allIds = [...allIds, ...wave.map((q) => q.id)];
        battleDoc.set("wave", nextWave);
        if (mode.infinite) {
          // fresh enemy for the next wave: partial HP refill so the fight continues
          const refill = Math.ceil(battleDoc.enemyMaxHp * 0.35);
          battleDoc.set("enemyHp", refill);
        }
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
    waveCleared,
    waveNumber: updatedBattle.wave,
  };

  return NextResponse.json(result);
}
