import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, attachOwnerUsernames } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { validateQuestionInput, isStaff } from "../route";

const APPROVAL_VOTES_REQUIRED = 3;

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
  const staff = isStaff(user.role);

  const body = await req.json();

  // --- moderation actions (staff only) ---
  const action = String(body.action ?? "");
  if (action === "approve" || action === "reject") {
    if (!staff) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    if (action === "reject") {
      // a single rejection sends it back with the note
      await Question.findByIdAndUpdate(id, {
        $set: {
          status: "REJECTED",
          reviewNote: String(body.reviewNote ?? "").trim().slice(0, 300),
          approvalVotes: [],
          rejectionVotes: [],
        },
      });
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    // approve = a vote; reaching APPROVAL_VOTES_REQUIRED votes makes it official
    const updated = await Question.findByIdAndUpdate(
      id,
      {
        $addToSet: { approvalVotes: user.id },
        $pull: { rejectionVotes: user.id },
      },
      { new: true },
    ).lean();
    if (!updated) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    if (updated.approvalVotes.length >= APPROVAL_VOTES_REQUIRED) {
      await Question.findByIdAndUpdate(id, { $set: { status: "OFFICIAL", reviewNote: "" } });
      return NextResponse.json({ ok: true, status: "OFFICIAL" });
    }
    return NextResponse.json({ ok: true, status: "PENDING", votes: updated.approvalVotes.length, needed: APPROVAL_VOTES_REQUIRED });
  }

  // --- content edit ---
  // Official bank questions are staff-managed; players may only edit their own custom questions.
  if (question.status === "OFFICIAL" && !staff) {
    return NextResponse.json(
      { error: "Official questions can only be edited by admins." },
      { status: 403 },
    );
  }
  if (!isOwner && !staff) {
    return NextResponse.json({ error: "You do not own this question." }, { status: 403 });
  }
  const input = validateQuestionInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  // Staff editing official content keeps it official. A player resubmitting a
  // rejected question sends it back to the approval queue.
  const newStatus = staff
    ? question.status === "OFFICIAL"
      ? "OFFICIAL"
      : question.status === "PENDING"
        ? "PENDING"
        : "CUSTOM"
    : question.status === "REJECTED"
      ? "PENDING"
      : question.status;

  const updated = await Question.findByIdAndUpdate(
    id,
    {
      $set: {
        ...input,
        status: newStatus,
        reviewNote: newStatus === "PENDING" ? "" : question.reviewNote,
        // a fresh submission starts with no votes
        ...(newStatus === "PENDING" ? { approvalVotes: [], rejectionVotes: [] } : {}),
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
  const staff = isStaff(user.role);

  // Official bank questions are staff-managed; players may only delete their own custom questions.
  if (question.status === "OFFICIAL" && !staff) {
    return NextResponse.json(
      { error: "Official questions can only be deleted by admins." },
      { status: 403 },
    );
  }
  if (!isOwner && !staff) {
    return NextResponse.json({ error: "You do not own this question." }, { status: 403 });
  }

  await Question.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
