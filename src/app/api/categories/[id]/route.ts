import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, normalizeCategory } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { Types } from "mongoose";

type Params = { params: Promise<{ id: string }> };

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

export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (Array.isArray(body.subjects)) update.subjects = body.subjects.filter((s: any) => typeof s === "string");
  if (body.difficulties) update.difficulties = body.difficulties;
  if (body.enemy) update.enemy = body.enemy;
  if (typeof body.status === "string") {
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    // Only admins may promote a category to OFFICIAL; keep isOfficial in sync.
    if (body.status === "OFFICIAL" && !isAdmin) {
      // players cannot self-promote — ignore the status change
    } else {
      update.status = body.status;
      if (isAdmin) update.isOfficial = body.status === "OFFICIAL";
    }
  }

  await connectDB();
  const doc = await Category.findOne({ _id: id, $or: [{ isOfficial: true }, { ownerId: user.id }] });
  if (!doc) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  // Only admins can flip isOfficial/approve.
  if (update.isOfficial !== undefined && (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    delete update.isOfficial;
  }
  const updated = await Category.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  return NextResponse.json({ category: normalizeCategory(updated) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await connectDB();
  const doc = await Category.findOne({ _id: id, $or: [{ isOfficial: true }, { ownerId: user.id }] });
  if (!doc) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  await Category.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}