import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Battle, Category, Question, User, normalizeBattle, normalizeQuestion, type BattleMonster } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { getTier, computeAnswer, levelProgress, getMode, infiniteWaveBonus, cryptoIntInclusive, cryptoRandom } from "@/lib/game";
import type { BattleModeId, EnemyTier } from "@/lib/game";
import { drawWave, newlyUnlockedTier, toBattleQuestion } from "@/lib/battle";
import { applyBattleWear } from "@/lib/durability";
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

  // category opponents snapshot their own attack range on the battle - use it
  // instead of the static tier roster's stats
  const baseTier = getTier(battleDoc.tier);
  const tier: EnemyTier =
    battleDoc.enemyAtkMin != null && battleDoc.enemyAtkMax != null
      ? { ...baseTier, atkMin: battleDoc.enemyAtkMin, atkMax: battleDoc.enemyAtkMax }
      : baseTier;
  // category battles carry a monster lineup - track where we are in it
  const monsters: BattleMonster[] = (battleDoc.monsters ?? []) as BattleMonster[];
  const currentMonsterIndex = battleDoc.monsterIndex ?? 0;
  let nextMonsterIndex: number | null = null;
  const wasCorrect = choiceIndex === question.correctIndex;

  // user-made (custom/pending) questions are practice-only in classic battles —
  // BUT in a player-created category fight, the category owner's own custom
  // questions are the intended content and deal full damage.
  const ownerIds = battleDoc.categoryId
    ? await (async () => {
        const cat = await Category.findById(battleDoc.categoryId).select("ownerId").lean();
        return cat?.ownerId ? [String(cat.ownerId)] : [];
      })()
    : [];
  const countsForBattle = question.status === "OFFICIAL" ||
    (question.status === "CUSTOM" && ownerIds.length > 0 && question.ownerId === ownerIds[0]);
  const isCustom = !countsForBattle;
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
  let enemyHp = Math.max(0, battleDoc.enemyHp - outcome.damageDealt);
  const playerHp = Math.max(0, battleDoc.playerHp - outcome.damageTaken);
  const streak = outcome.streak;
  const bestStreak = Math.max(battleDoc.bestStreak, streak);
  const score = battleDoc.score + outcome.scoreGained;
  const xpEarned = battleDoc.xpEarned + outcome.xpGained;

  const xpBefore = levelProgress(user.xp).level;

  // XP accrues immediately so progress persists even mid-battle.
  // Custom (user-made) questions are practice-only outside custom-category battles.
  if (!isCustom) {
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
     // INFINITE: no single victory - each cleared wave pays a bonus, enemy HP
    // partially refills, and the next wave is harder
    const isWaveEnd = battleDoc.cursor + 1 >= ids.length;
    if (isWaveEnd && enemyHp > 0 && playerHp > 0) {
      waveCleared = true;
      const bonus = infiniteWaveBonus(battleDoc.wave);
      await User.updateOne(
        { _id: user.id },
        { $inc: { xp: bonus.xp } },
      );
      victoryBonus = bonus;
    }

  } else if (enemyHp <= 0) {
    if (monsters.length > 0 && currentMonsterIndex < monsters.length - 1) {
      // this monster fell - the next one in the category's lineup steps in
      const nextIndex = currentMonsterIndex + 1;
      nextMonsterIndex = nextIndex;
      enemyHp = monsters[nextIndex].hp;
    } else {
      status = "WON";
      victoryBonus = { xp: mode.rewardXp, score: mode.rewardScore + bestStreak * 10 };
      if (!isCustom) {
        // Official enemies drop gold; harder enemies drop more and have a higher
        // chance to drop a gem for the gacha.
        goldDrop = cryptoIntInclusive(8 + tier.tier * 6, 18 + tier.tier * 6);
        const gemChance = Math.min(0.05 + tier.tier * 0.03, 0.6);
        if (cryptoRandom() < gemChance) gemDrop = 1;
        await User.updateOne(
          { _id: user.id },
          {
            $inc: { xp: victoryBonus.xp, battlesWon: 1, gold: goldDrop, gems: gemDrop },
            $max: { bestScore: score + victoryBonus.score },
          },
        );
      } else {
        await User.updateOne(
          { _id: user.id },
          {
            $inc: { xp: victoryBonus.xp, battlesWon: 1 },
            $max: { bestScore: score + victoryBonus.score },
          },
        );
      }
    }
  } else if (playerHp <= 0) {
    status = "LOST";
    await User.updateOne(
      { _id: user.id },
      { $inc: { battlesLost: 1 }, $max: { bestScore: score } },
    );
  }

  // --- swap in the next monster of the lineup, if this one just fell ---
  const nextMonster = nextMonsterIndex !== null ? monsters[nextMonsterIndex] : null;
  if (nextMonster && nextMonsterIndex !== null) {
    battleDoc.set({
      monsterIndex: nextMonsterIndex,
      enemyName: nextMonster.name,
      enemySprite: nextMonster.emoji,
      enemyImage: nextMonster.image ?? "",
      enemyAtkMin: nextMonster.atkMin,
      enemyAtkMax: nextMonster.atkMax,
      enemyMaxHp: nextMonster.hp,
      battleSubjects:
        nextMonster.subjects.length > 0 ? nextMonster.subjects : battleDoc.battleSubjects,
    });
  }

  // --- monster modifiers on the current monster ---
  const currentMonster = monsters[currentMonsterIndex];
  if (currentMonster?.modifiers?.length) {
    for (const mod of currentMonster.modifiers) {
      if (cryptoRandom() * 100 >= mod.chance) continue;
      switch (mod.id) {
        case "RESTING":
          // the monster heals if the player got the question wrong
          if (!wasCorrect && mod.amount > 0 && enemyHp > 0) {
            enemyHp = Math.min(battleDoc.enemyMaxHp, enemyHp + mod.amount);
          }
          break;
        case "TAX_COLLECTING":
          if (!wasCorrect && mod.amount > 0) {
            await User.updateOne({ _id: user.id }, { $inc: { gold: -mod.amount } });
          }
          break;
        // SHUFFLER / RESTRAINT / DISABLER are client-side; consumed in battle-screen
        default:
          break;
      }
    }
  }

  // --- advance to next question / next wave ---
  let cursor = battleDoc.cursor;
  let allIds = [...ids];
  let nextQuestion: BattleStateDTO["question"] = null;

  if (status === "ONGOING") {
    cursor += 1;
    if (nextMonster) {
      // questions pre-drawn for the fallen monster are swapped for the new
      // monster's own subject pool (falls back to the old remaining questions
      // when its pool has nothing available)
      const fresh = await drawWave(
        nextMonster.subjects.length > 0
          ? nextMonster.subjects
          : (battleDoc.battleSubjects ?? battleDoc.subject),
        user.id,
        battleDoc.tier,
        battleDoc.mode as BattleModeId,
        battleDoc.wave,
        allIds.slice(0, cursor),
        ownerIds,
      );
      if (fresh.length > 0) {
        allIds = [...allIds.slice(0, cursor), ...fresh.map((q) => q.id)];
      }
    }
    if (cursor >= allIds.length) {
      // wave exhausted - INFINITE mode pulls a fresh, harder wave from the pool;
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
        ownerIds,
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
    questionDeadlineAt: Date.now() + (nextQuestion?.timerSeconds ?? 30) * 1000,
  });
  await battleDoc.save();
  const updatedBattle = normalizeBattle(battleDoc.toObject());

  // --- durability: weapon wears on landed hits, armor on hits taken ---
  const durability = await applyBattleWear(
    User,
    user.id,
    outcome.damageDealt > 0,
    outcome.damageTaken > 0,
  );
  if (durability.weaponBroken) {
    console.log(`[durability] weapon broke for user ${user.id}`);
  }

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
    questionDeadlineAt: updatedBattle.questionDeadlineAt,
    victoryBonus,
    waveCleared,
    waveNumber: updatedBattle.wave,
    goldDrop,
    gemDrop,
    monsterDefeated: nextMonster !== null,
    ...(nextMonster
      ? {
          enemyName: nextMonster.name,
          enemySprite: nextMonster.emoji,
          enemyImage: nextMonster.image ?? null,
          enemyMaxHp: nextMonster.hp,
          monsterIndex: nextMonsterIndex ?? currentMonsterIndex,
          totalMonsters: monsters.length,
        }
      : monsters.length > 0
        ? { monsterIndex: currentMonsterIndex, totalMonsters: monsters.length }
        : {}),
  };

  return NextResponse.json(result);
}
