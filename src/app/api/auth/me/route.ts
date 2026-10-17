import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

/** Update display name. */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await req.json();
  const displayName = String(body.displayName ?? "").trim().slice(0, 30);
  if (!displayName) {
    return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
  }
  await connectDB();
  const updated = await User.findByIdAndUpdate(user.id, { $set: { displayName } }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ user: normalizeUser(updated) });
}
