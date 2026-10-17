import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, Question, Battle } from "@/lib/models";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Promote / demote a user. Admins cannot change their own role. */
export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  await connectDB();
  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = await req.json();
  const role = String(body.role ?? "").toUpperCase();
  if (!["ADMIN", "PLAYER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const target = await User.findById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await User.updateOne({ _id: id }, { $set: { role } });
  return NextResponse.json({ ok: true, role });
}

/** Delete a user and all of their questions/battles. Cannot delete self. */
export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  await connectDB();
  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const target = await User.findById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // manual cascade (MongoDB has no cross-collection FK enforcement)
  await Question.deleteMany({ ownerId: id });
  await Battle.deleteMany({ userId: id });
  await User.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
