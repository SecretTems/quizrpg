import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, attachOwnerUsernames } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { validateQuestionInput } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const question = await Question.findById(id).lean();
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const isOwner = question.ownerId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "You do not own this question." }, { status: 403 });
  }

  const body = await req.json();
  const input = validateQuestionInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const updated = await Question.findByIdAndUpdate(
    id,
    {
      $set: {
        subject: input.subject,
        difficulty: input.difficulty,
        text: input.text,
        options: input.options,
        correctIndex: input.correctIndex,
        explanation: input.explanation,
      },
    },
    { new: true },
  ).lean();
  if (!updated) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const [withOwner] = await attachOwnerUsernames([normalizeQuestion(updated)]);
  return NextResponse.json({ question: withOwner });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const question = await Question.findById(id).lean();
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const isOwner = question.ownerId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "You do not own this question." }, { status: 403 });
  }

  await Question.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
