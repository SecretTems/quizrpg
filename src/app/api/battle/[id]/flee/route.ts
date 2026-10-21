import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Battle } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Retreat from an ongoing battle - keeps XP earned so far, no victory bonus. */
export async function POST(_req: Request, { params }: Params) {
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

  battle.status = "FLED";
  await battle.save();

  return NextResponse.json({ ok: true, xpEarned: battle.xpEarned, score: battle.score });
}
