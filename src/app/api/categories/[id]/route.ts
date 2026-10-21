import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, normalizeCategory } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { Types } from "mongoose";
import { sanitizeImage, sanitizeMonsters } from "@/lib/category-input";

type Params = { params: Promise<{ id: string }> };

const isStaff = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await connectDB();
  const doc = await Category.findOne({ _id: id, $or: [{ isOfficial: true }, { ownerId: user.id }] }).lean();
  if (!doc) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  return NextResponse.json({ category: normalizeCategory(doc) });
}

const APPROVAL_VOTES_REQUIRED = 3;

export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await connectDB();
  const existing = await Category.findById(id).lean();
  if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const staff = isStaff(user.role);
  const ownerId = existing.ownerId ? String(existing.ownerId) : null;
  // official categories belong to the staff; everything else to its creator
  if (!staff && ownerId !== user.id) {
    return NextResponse.json({ error: "You can only edit your own categories." }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim().slice(0, 40);
  if (typeof body.description === "string") update.description = body.description.trim().slice(0, 200);
  if (Array.isArray(body.subjects)) {
    update.subjects = body.subjects
      .filter((s: unknown): s is string => typeof s === "string" && Boolean(s.trim()))
      .map((s: string) => s.trim().slice(0, 40));
  }
  if (body.difficulties) update.difficulties = body.difficulties;
  if ("icon" in body) update.icon = sanitizeImage(body.icon);

  if ("monsters" in body) {
    const monsters = sanitizeMonsters(body.monsters);
    update.monsters = monsters;
    // keep the category subject list in sync with the lineup when the caller
    // didn't send an explicit subject list
    if (!Array.isArray(body.subjects) && monsters.length) {
      const union = [...new Set(monsters.flatMap((m) => m.subjects))];
      if (union.length) update.subjects = union;
    }
  }

  if (body.enemy && typeof body.enemy === "object") {
    const e = body.enemy as Record<string, unknown>;
    const prev = existing.enemy as { tier?: number } | undefined;
    update.enemy = {
      name: String(e.name ?? existing.enemy.name).trim().slice(0, 40) || existing.enemy.name,
      emoji: String(e.emoji ?? existing.enemy.emoji).trim().slice(0, 8) || existing.enemy.emoji,
      // only staff may change the loot-scaling tier
      tier: staff ? Math.min(8, Math.max(1, Number(e.tier) || 1)) : Number(prev?.tier ?? 1),
      baseHp: Math.min(9999, Math.max(20, Number(e.baseHp) || existing.enemy.baseHp)),
      atkMin: Math.max(1, Number(e.atkMin) || existing.enemy.atkMin),
      atkMax: Math.max(1, Number(e.atkMax) || existing.enemy.atkMax),
    };
  }

  if (typeof body.status === "string") {
    if (body.status === "OFFICIAL" && !staff) {
      // players cannot self-promote - ignore the status change
    } else if (body.status === "OFFICIAL" && staff) {
      // admins vote - a category needs APPROVAL_VOTES_REQUIRED approvals to become official
      update.$addToSet = { approvalVotes: user.id };
      update.$pull = { rejectionVotes: user.id };
    } else if (body.status === "REJECTED" && staff) {
      update.$addToSet = { rejectionVotes: user.id };
      update.$pull = { approvalVotes: user.id };
    } else if (["CUSTOM", "PENDING", "REJECTED"].includes(body.status) && (staff || ownerId === user.id)) {
      update.status = body.status;
      if (staff) update.isOfficial = false;
      // a resubmission resets previous votes
      if (body.status === "PENDING") {
        update.approvalVotes = [];
        update.rejectionVotes = [];
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // apply the vote bookkeeping first, then decide whether the votes crossed the threshold
  const { $addToSet, $pull, ...rest } = update as Record<string, unknown> & {
    $addToSet?: Record<string, unknown>;
    $pull?: Record<string, unknown>;
  };
  let updated = await Category.findByIdAndUpdate(
    id,
    {
      ...(Object.keys(rest).length > 0 ? { $set: rest } : {}),
      ...($addToSet ? { $addToSet } : {}),
      ...($pull ? { $pull } : {}),
    },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  if (
    updated.status === "PENDING" &&
    updated.approvalVotes.length >= APPROVAL_VOTES_REQUIRED
  ) {
    updated = await Category.findByIdAndUpdate(
      id,
      { $set: { status: "OFFICIAL", isOfficial: true } },
      { new: true },
    ).lean();
  }
  return NextResponse.json({ category: normalizeCategory(updated) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await connectDB();
  const doc = await Category.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  const staff = isStaff(user.role);
  const ownerId = doc.ownerId ? String(doc.ownerId) : null;
  if (!staff && ownerId !== user.id) {
    return NextResponse.json({ error: "You can only delete your own categories." }, { status: 403 });
  }
  await Category.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}