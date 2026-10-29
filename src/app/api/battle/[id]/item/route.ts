import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Battle, User } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { itemById } from "@/lib/adventure-data";

type Params = { params: Promise<{ id: string }> };

/** How much HP each healing consumable restores. */
const HEAL_AMOUNT: Record<string, number> = {
  "c-minor-potion": 30,
  "c-great-potion": 60,
  "c-special-elixir": Infinity, // full heal
};

/** Give the current question extra seconds (client applies it to its timer). */
const FREEZE_SECONDS: Record<string, number> = {
  "c-focus-elixir": 15,
};

export interface UseItemResult {
  itemId: string;
  playerHp: number;
  playerMaxHp: number;
  /** seconds added to the current question's deadline (0 = none) */
  extraSeconds: number;
  /** the boost is queued and consumed by the next correct answer */
  damageBoostActive: boolean;
  loadout: (string | null)[];
  message: string;
}

/**
 * Use one consumable from the battle loadout.
 *
 * Consumables are split into two kinds:
 *  - instant (heal / freeze) -> applied here, consumes one unit from the backpack
 *  - queued (damage boost / bombs) -> the effect is stored on the battle and the
 *    answer route consumes it on the next question
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }
  const battle = await Battle.findById(id);
  if (!battle || battle.userId !== user.id) {
    return NextResponse.json({ error: "Battle not found." }, { status: 404 });
  }
  if (battle.status !== "ONGOING") {
    return NextResponse.json({ error: "This battle is already over." }, { status: 409 });
  }

  const body = await req.json();
  const slot = Number(body.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) {
    return NextResponse.json({ error: "Invalid loadout slot." }, { status: 400 });
  }

  // the loadout lives on the user, not the battle - read it fresh
  const userDoc = await User.findById(user.id).lean();
  if (!userDoc) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const loadout = ([...(userDoc.loadout ?? [null, null, null])] as (string | null)[]).slice(0, 3);
  while (loadout.length < 3) loadout.push(null);

  const itemId = loadout[slot];
  if (!itemId) {
    return NextResponse.json({ error: "That loadout slot is empty." }, { status: 400 });
  }
  const def = itemById(itemId);
  if (!def || def.slot !== "CONSUMABLE") {
    return NextResponse.json({ error: "That item cannot be used in battle." }, { status: 400 });
  }

  // must actually own a unit to spend
  const backpack = (userDoc.backpack ?? {}) as Record<string, { qty?: number } | undefined>;
  const owned = backpack[itemId]?.qty ?? 0;
  if (owned <= 0) {
    return NextResponse.json({ error: `You have no ${def.name} left.` }, { status: 400 });
  }

  // --- apply the effect ---
  let playerHp = battle.playerHp;
  let extraSeconds = 0;
  let message = "";

  const heal = HEAL_AMOUNT[itemId];
  if (heal !== undefined) {
    const before = playerHp;
    playerHp = heal === Infinity ? battle.playerMaxHp : Math.min(battle.playerMaxHp, playerHp + heal);
    battle.set("playerHp", playerHp);
    message = `Restored ${playerHp - before} HP.`;
  } else if (FREEZE_SECONDS[itemId]) {
    extraSeconds = FREEZE_SECONDS[itemId];
    battle.set("questionDeadlineAt", (battle.questionDeadlineAt ?? Date.now()) + extraSeconds * 1000);
    message = `Timer extended by ${extraSeconds}s.`;
  } else {
    // queued effects - stored on the battle for the answer route to pick up
    if (itemId === "c-damage-boost" || itemId === "c-caffeine-draught") {
      battle.set("damageBoostPending", true);
      message =
        itemId === "c-damage-boost"
          ? "Your next correct answer deals +50% damage."
          : "Double damage on correct answers for the next 3 questions.";
    } else if (itemId === "c-stun-bomb") {
      battle.set("stunPending", true);
      message = "The enemy is stunned - it can't hit you on the next wrong answer.";
    } else if (itemId === "c-confusion-bomb") {
      battle.set("confusionPending", true);
      message = "Confusion planted - a miss will make it hit itself.";
    } else if (itemId === "c-lucky-clover") {
      battle.set("gemBonus", (battle.get("gemBonus") ?? 0) + 0.25);
      message = "+25% gem drop chance for this adventure.";
    } else if (itemId === "c-midas-potion") {
      battle.set("goldBonus", (battle.get("goldBonus") ?? 0) + 0.3);
      message = "+30% gold drop for this adventure.";
    } else {
      // c-tome-retribution (passive) and anything unknown: refuse instead of
      // silently eating the item
      return NextResponse.json({ error: "That item has no battle effect yet." }, { status: 400 });
    }
  }

  await battle.save();

  // clear the slot (the unit leaves the loadout) and spend one from the stack
  const nextLoadout = [...loadout];
  nextLoadout[slot] = null;
  await User.updateOne(
    { _id: user.id },
    {
      $set: { loadout: nextLoadout },
      $inc: { [`backpack.${itemId}.qty`]: -1 },
    },
  );
  // remove the stack entry once it is empty
  if (owned - 1 <= 0) {
    await User.updateOne({ _id: user.id }, { $unset: { [`backpack.${itemId}`]: "" } });
  }

  const result: UseItemResult = {
    itemId,
    playerHp,
    playerMaxHp: battle.playerMaxHp,
    extraSeconds,
    damageBoostActive:
      itemId === "c-damage-boost" || itemId === "c-caffeine-draught",
    loadout: nextLoadout,
    message,
  };
  return NextResponse.json(result);
}
