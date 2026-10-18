import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Question } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

/** Distinct subjects available to the current user (global + own). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  // official subjects (approved content) + the caller's own custom subjects
  const subjects = await Question.distinct("subject", {
    $or: [{ status: "OFFICIAL" }, { ownerId: user.id }],
  });

  return NextResponse.json({ subjects: (subjects as string[]).sort() });
}
