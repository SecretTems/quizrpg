import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, Question, Battle } from "@/lib/models";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const AVATAR_IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,/;

/**
 * Staff actions on a user account. Supports both:
 * - moderation: { displayName?, avatar? } — edit a player's public profile
 *   (admins and super admins can moderate players and admins; super admins
 *   themselves cannot be moderated by anyone else)
 * - role change: { role: "ADMIN" | "PLAYER" } — super admins only
 */
export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const target = await User.findById(id);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super admins cannot be moderated." }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};

  // ----- moderation: display name / avatar -----
  if (typeof body.displayName === "string") {
    const displayName = body.displayName.trim().slice(0, 30);
    if (!displayName) {
      return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
    }
    update.displayName = displayName;
  }

  if (typeof body.avatar === "string") {
    const avatar = body.avatar.trim();
    if (avatar === "") {
      update.avatar = ""; // explicit clear → back to the default emoji
    } else if (!AVATAR_IMAGE_RE.test(avatar) || avatar.length > 400_000) {
      return NextResponse.json({ error: "Avatar image is invalid or too large." }, { status: 400 });
    } else {
      update.avatar = avatar;
    }
  }

  // ----- role change (super admins only) -----
  const role = String(body.role ?? "").toUpperCase();
  if (role) {
    if (admin.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only super admins can change roles." }, { status: 403 });
    }
    if (id === admin.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }
    if (!["ADMIN", "PLAYER"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    update.role = role;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Delete a user and all of their questions/battles. Only super admins may delete; cannot delete self or another super admin. */
export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (admin.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only super admins can delete accounts." }, { status: 403 });
  }

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
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Super admins cannot be deleted." }, { status: 403 });
  }

  // manual cascade (MongoDB has no cross-collection FK enforcement)
  await Question.deleteMany({ ownerId: id });
  await Battle.deleteMany({ userId: id });
  await User.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
