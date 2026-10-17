import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Question, normalizeQuestion, attachOwnerUsernames } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";

const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

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
  if (options.length !== 4 || options.some((o) => !o)) {
    return { error: "Exactly 4 non-empty options are required." } as const;
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    return { error: "Correct answer must be one of the 4 options." } as const;
  }
  return { subject, difficulty, text, options, correctIndex, explanation } as const;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const subject = url.searchParams.get("subject") ?? "";
  const difficulty = url.searchParams.get("difficulty") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();

  const isAdmin = user.role === "ADMIN";
  const effectiveScope = isAdmin && scope === "all" ? "all" : "mine";

  const filter: Record<string, unknown> = {};
  if (effectiveScope === "mine") filter.ownerId = user.id;
  else filter.ownerId = null; // admin "all" = global bank
  if (subject) filter.subject = subject;
  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
  if (search) filter.text = { $regex: escapeRegex(search), $options: "i" };

  const docs = await Question.find(filter)
    .sort({ subject: 1, difficulty: 1, createdAt: -1 })
    .lean();

  const questions = await attachOwnerUsernames(docs.map(normalizeQuestion));
  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const input = validateQuestionInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const created = await Question.create({
    subject: input.subject,
    difficulty: input.difficulty,
    text: input.text,
    options: input.options,
    correctIndex: input.correctIndex,
    explanation: input.explanation,
    // admin-created questions go to the global bank; players own theirs
    ownerId: user.role === "ADMIN" ? (body.personal === true ? user.id : null) : user.id,
  });

  const question = normalizeQuestion(created.toObject());
  const [withOwner] = await attachOwnerUsernames([question]);
  return NextResponse.json({ question: withOwner }, { status: 201 });
}
