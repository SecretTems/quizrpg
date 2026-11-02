import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Question } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  
  const subjects = await Question.distinct("subject", {
    $or: [{ status: "OFFICIAL" }, { ownerId: user.id }],
  });

  return NextResponse.json({ subjects: (subjects as string[]).sort() });
}
