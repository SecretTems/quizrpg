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
  const choiceIndex = Number(body.choiceIndex); 

  const ids = battleDoc.questions; 
  const currentId = ids[battleDoc.cursor];
  const qDoc = currentId ? await Question.findById(currentId).lean() : null;
  if (!qDoc) {
    return NextResponse.json({ error: "Question data missing." }, { status: 500 });
  }
  const question = normalizeQuestion(qDoc);

  
  
  const baseTier = getTier(battleDoc.tier);
  const tier: EnemyTier =
    battleDoc.enemyAtkMin != null && battleDoc.enemyAtkMax != null
      ? { ...baseTier, atkMin: battleDoc.enemyAtkMin, atkMax: battleDoc.enemyAtkMax }
      : baseTier;
  
  const monsters: BattleMonster[] = (battleDoc.monsters ?? []) as BattleMonster[];
  const currentMonsterIndex = battleDoc.monsterIndex ?? 0;
  let nextMonsterIndex: number | null = null;
  const wasCorrect = choiceIndex === question.correctIndex;
  

  
  
  
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

  
  let damage = outcome.damageDealt;
  let taken = outcome.damageTaken;
  let usedBoost = false;
  let usedStun = false;
  let usedConfusion = false;
  if (wasCorrect && battleDoc.damageBoostPending && damage > 0) {
    damage = Math.round(damage * 1.5);
    usedBoost = true;
  }
  if (!wasCorrect && battleDoc.stunPending) {
    
    taken = 0;
    usedStun = true;
  }
  if (!wasCorrect && battleDoc.confusionPending) {
    
    damage += Math.max(1, Math.round(tier.atkMin));
    taken = 0;
    usedConfusion = true;
  }

  
  let enemyHp = Math.max(0, battleDoc.enemyHp - damage);
  const playerHp = Math.max(0, battleDoc.playerHp - taken);
  const streak = outcome.streak;
  const bestStreak = Math.max(battleDoc.bestStreak, streak);
  const score = battleDoc.score + outcome.scoreGained;
  const xpEarned = battleDoc.xpEarned + outcome.xpGained;

  const xpBefore = levelProgress(user.xp).level;

  
  
  if (!isCustom) {
    await User.updateOne({ _id: user.id }, { $inc: { xp: outcome.xpGained } });
    if (streak > user.bestStreak) {
      await User.updateOne({ _id: user.id }, { $set: { bestStreak: streak } });
    }
  }

  
  {
    const inc: Record<string, number> = {
      [wasCorrect ? "questionsRight" : "questionsWrong"]: 1,
    };
    const subjects = qDoc.subjects?.length ? qDoc.subjects : [question.subject];
    for (const s of subjects) {
      inc[`subjectStats.${s}.${wasCorrect ? "right" : "wrong"}`] = 1;
    }
    if (battleDoc.categoryId) {
      inc[`categoryStats.${battleDoc.categoryId}.${wasCorrect ? "right" : "wrong"}`] = 1;
    }
    await User.updateOne({ _id: user.id }, { $inc: inc });
  }

  let status: "ONGOING" | "WON" | "LOST" = "ONGOING";
  let victoryBonus: { xp: number; score: number } | null = null;
  let waveCleared = false;
  let goldDrop = 0;
  let gemDrop = 0;
  const mode = getMode(battleDoc.mode as BattleModeId);

  if (mode.infinite) {
     
    
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
      
      const nextIndex = currentMonsterIndex + 1;
      nextMonsterIndex = nextIndex;
      enemyHp = monsters[nextIndex].hp;
    } else {
      status = "WON";
      victoryBonus = { xp: mode.rewardXp, score: mode.rewardScore + bestStreak * 10 };
      if (!isCustom) {
        
        
        goldDrop = cryptoIntInclusive(8 + tier.tier * 6, 18 + tier.tier * 6);
        
        if (battleDoc.goldBonus > 0) goldDrop = Math.round(goldDrop * (1 + battleDoc.goldBonus));
        const gemChance = Math.min(0.05 + tier.tier * 0.03 + (battleDoc.gemBonus ?? 0), 0.95);
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

  
  const currentMonster = monsters[currentMonsterIndex];
  if (currentMonster?.modifiers?.length) {
    for (const mod of currentMonster.modifiers) {
      if (cryptoRandom() * 100 >= mod.chance) continue;
      switch (mod.id) {
        case "RESTING":
          
          if (!wasCorrect && mod.amount > 0 && enemyHp > 0) {
            enemyHp = Math.min(battleDoc.enemyMaxHp, enemyHp + mod.amount);
          }
          break;
        case "TAX_COLLECTING":
          if (!wasCorrect && mod.amount > 0) {
            await User.updateOne({ _id: user.id }, { $inc: { gold: -mod.amount } });
          }
          break;
        
        default:
          break;
      }
    }
  }

  
  let cursor = battleDoc.cursor;
  let allIds = [...ids];
  let nextQuestion: BattleStateDTO["question"] = null;

  if (status === "ONGOING") {
    cursor += 1;
    if (nextMonster) {
      
      
      
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
      
      
      const nextWave = battleDoc.wave + 1;
      const wave = await drawWave(
        
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
    questionsRight: battleDoc.questionsRight + (wasCorrect ? 1 : 0),
    questionsWrong: battleDoc.questionsWrong + (wasCorrect ? 0 : 1),
    damageBoostPending: battleDoc.damageBoostPending && !usedBoost,
    stunPending: battleDoc.stunPending && !usedStun,
    confusionPending: battleDoc.confusionPending && !usedConfusion,
    questionDeadlineAt: Date.now() + (nextQuestion?.timerSeconds ?? 30) * 1000,
  });
  await battleDoc.save();
  const updatedBattle = normalizeBattle(battleDoc.toObject());

  
  const durability = await applyBattleWear(
    User,
    user.id,
    damage > 0,
    taken > 0,
  );
  if (durability.weaponBroken) {
    console.log(`[durability] weapon broke for user ${user.id}`);
  }

  
  const afterUser = await User.findById(user.id).lean();
  const xpAfter = levelProgress(afterUser ? afterUser.xp : 0).level;
  const leveledUp = xpAfter > xpBefore;
  const unlockedTier = leveledUp ? newlyUnlockedTier(xpAfter) : null;

  const result: AnswerResultDTO = {
    correct: wasCorrect,
    correctIndex: question.correctIndex,
    damageDealt: damage,
    damageTaken: taken,
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
    accuracy: updatedBattle.questionsRight + updatedBattle.questionsWrong > 0
      ? Math.round((updatedBattle.questionsRight / (updatedBattle.questionsRight + updatedBattle.questionsWrong)) * 100)
      : null,
    questionsRight: updatedBattle.questionsRight,
    questionsWrong: updatedBattle.questionsWrong,
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
