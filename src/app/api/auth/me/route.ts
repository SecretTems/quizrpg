import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Question, Battle, Category, normalizeUser } from "@/lib/models";
import { getSessionUser, clearSessionCookie } from "@/lib/auth";

const IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,/;
const MAX_IMAGE_CHARS = 400_000;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

/** Update display name, avatar and/or tutorialSeen flag. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await req.json();
  const update: Record<string, unknown> = {};
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
    } else if (!IMAGE_RE.test(avatar) || avatar.length > MAX_IMAGE_CHARS) {
      return NextResponse.json(
        { error: "Avatar image is invalid or too large - upload it through /api/upload." },
        { status: 400 },
      );
    } else {
      update.avatar = avatar;
    }
  }
  if (typeof body.tutorialSeen === "boolean") {
    update.tutorialSeen = body.tutorialSeen;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  await connectDB();
  const updated = await User.findByIdAndUpdate(user.id, { $set: update }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ user: normalizeUser(updated) });
}

/** Permanently delete the caller's account and everything they own. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  await Promise.all([
    Question.deleteMany({ ownerId: user.id }),
    Battle.deleteMany({ userId: user.id }),
    Category.deleteMany({ ownerId: user.id }),
    User.deleteOne({ _id: user.id }),
  ]);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
