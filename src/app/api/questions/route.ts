import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, attachOwnerUsernames } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"];
export const isStaff = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";

/** Escape user search input before using it as a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateQuestionInput(body: Record<string, unknown>) {
  const subject = String(body.subject ?? "").trim().slice(0, 40);
  const difficulty = String(body.difficulty ?? "").toUpperCase();
  const text = String(body.text ?? "").trim().slice(0, 500);
  const optionsRaw = Array.isArray(body.options) ? body.options : [];
  const options = optionsRaw.map((o) => String(o ?? "").trim().slice(0, 200));
  const correctIndex = Number(body.correctIndex);
  const explanation = String(body.explanation ?? "").trim().slice(0, 500);

  if (!subject) return { error: "Subject is required." } as const;
  if (!VALID_DIFFICULTIES.includes(difficulty)) return { error: "Invalid difficulty." } as const;
  if (!text) return { error: "Question text is required." } as const;
  if (options.length < 2 || options.length > 10) {
    return { error: "A question needs between 2 and 10 answer options." } as const;
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return { error: "Correct answer must be one of the options." } as const;
  }
  return { subject, difficulty, text, options, correctIndex, explanation } as const;
}

/**
 * GET questions.
 * scope=official → the approved global bank (view-only for everyone).
 * scope=mine     → the caller's own custom questions (any role).
 * scope=pending  → staff only: submitted questions awaiting approval.
 * scope=review   → staff only: everything non-official (pending + rejected + custom of others).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "official";
  const subject = url.searchParams.get("subject") ?? "";
  const difficulty = url.searchParams.get("difficulty") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();

  const filter: Record<string, unknown> = {};
  if (scope === "official") filter.status = "OFFICIAL";
  else if (scope === "mine") filter.ownerId = user.id;
  else if (scope === "pending") {
    if (!isStaff(user.role)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    filter.status = "PENDING";
  } else if (scope === "review") {
    if (!isStaff(user.role)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    filter.status = { $in: ["PENDING", "REJECTED", "CUSTOM"] };
  } else {
    filter.ownerId = user.id;
  }
  if (subject) filter.subject = subject;
  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
  if (search) filter.text = { $regex: escapeRegex(search), $options: "i" };

  const docs = await Question.find(filter)
    .sort({ subject: 1, difficulty: 1, createdAt: -1 })
    .lean();

  const questions = await attachOwnerUsernames(docs.map(normalizeQuestion));
  return NextResponse.json({ questions });
}

/**
 * POST a question.
 * Staff: creates OFFICIAL bank content directly (no approval) — or a personal
 * custom question if `personal: true`.
 * Players: creates their own CUSTOM question, or submits it for approval
 * (`submitForReview: true`) so an admin can make it OFFICIAL.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const input = validateQuestionInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const staff = isStaff(user.role);
  const personal = body.personal === true;
  const submitForReview = body.submitForReview === true;

  let status: "OFFICIAL" | "CUSTOM" | "PENDING";
  let ownerId: string | null;
  if (staff && !personal) {
    status = "OFFICIAL";
    ownerId = null;
  } else if (staff && personal) {
    status = "CUSTOM";
    ownerId = user.id;
  } else if (submitForReview) {
    status = "PENDING";
    ownerId = user.id;
  } else {
    status = "CUSTOM";
    ownerId = user.id;
  }

  const created = await Question.create({
    ...input,
    ownerId,
    status,
  });

  const question = normalizeQuestion(created.toObject());
  const [withOwner] = await attachOwnerUsernames([question]);
  return NextResponse.json({ question: withOwner }, { status: 201 });
}
