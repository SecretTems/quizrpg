import { Schema, model, models, type FlattenMaps, type Types } from "mongoose";
import type { BattleModeId } from "@/lib/game";

/* =========================================================
   QUIZRPG — MongoDB models (Mongoose)

   Collections:
   - users     : accounts (ADMIN / PLAYER) + lifetime stats
   - questions : question bank (ownerId null = global bank)
   - battles   : one document per battle, incl. save/resume state
   ========================================================= */

/* ---------- User ---------- */

export interface IUser extends Document {
  username: string;
  displayName: string;
  passwordHash: string;
  role: "ADMIN" | "SUPER_ADMIN" | "PLAYER";
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
    },
    displayName: { type: String, default: "", maxlength: 30 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "SUPER_ADMIN", "PLAYER"], default: "PLAYER" },
    xp: { type: Number, default: 0, min: 0 },
    battlesWon: { type: Number, default: 0, min: 0 },
    battlesLost: { type: Number, default: 0, min: 0 },
    bestScore: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/* ---------- Question ---------- */

export interface IQuestion extends Document {
  subject: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** null = official/global bank (admin / seeded); otherwise the author's user id */
  ownerId: string | null;
  /** OFFICIAL = approved content everyone can play; CUSTOM = user's personal content */
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  /** admin-only notes when a submission is rejected */
  reviewNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    subject: { type: String, required: true, maxlength: 40 },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"], required: true },
    text: { type: String, required: true, maxlength: 500 },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 9 },
    explanation: { type: String, default: "", maxlength: 500 },
    ownerId: { type: String, default: null },
    status: { type: String, enum: ["OFFICIAL", "CUSTOM", "PENDING", "REJECTED"], default: "CUSTOM" },
    reviewNote: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);
QuestionSchema.index({ subject: 1, difficulty: 1 });
QuestionSchema.index({ ownerId: 1 });

/* ---------- Battle ---------- */

export interface IBattle extends Document {
  userId: string;
  subject: string;
  tier: number;
  mode: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER" | "INFINITE";
  /** current wave number (1 for standard battles; increments in INFINITE mode) */
  wave: number;
  enemyName: string;
  enemyMaxHp: number;
  enemyHp: number;
  playerMaxHp: number;
  playerHp: number;
  streak: number;
  bestStreak: number;
  score: number;
  xpEarned: number;
  /** question ids for this battle, in order; cursor points at the active one */
  questions: string[];
  cursor: number;
  status: "ONGOING" | "WON" | "LOST" | "FLED";
  createdAt: Date;
  updatedAt: Date;
}

const BattleSchema = new Schema<IBattle>(
  {
    userId: { type: String, required: true },
    subject: { type: String, default: "ALL" },
    tier: { type: Number, required: true, min: 1, max: 8 },
    /** battle mode difficulty this battle was started with */
    mode: { type: String, enum: ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER", "INFINITE"], default: "EASY" },
    /** current wave number (1 for standard battles; increments in INFINITE mode) */
    wave: { type: Number, default: 1, min: 1 },
    /** display name of the enemy fought */
    enemyName: { type: String, required: true },
    enemyMaxHp: { type: Number, required: true },
    enemyHp: { type: Number, required: true },
    playerMaxHp: { type: Number, required: true },
    playerHp: { type: Number, required: true },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    questions: { type: [String], default: [] },
    cursor: { type: Number, default: 0 },
    status: { type: String, enum: ["ONGOING", "WON", "LOST", "FLED"], default: "ONGOING" },
  },
  { timestamps: true },
);
BattleSchema.index({ userId: 1, status: 1 });

/* ---------- models (guarded for Next.js hot reload) ---------- */

export const User = models.User ?? model<IUser>("User", UserSchema);
export const Question = models.Question ?? model<IQuestion>("Question", QuestionSchema);
export const Battle = models.Battle ?? model<IBattle>("Battle", BattleSchema);

/* =========================================================
   Lean-doc normalizers: Mongo `_id` (ObjectId) → string `id`
   so API payloads keep the exact same shape as before.
   ========================================================= */

type UserLean = FlattenMaps<IUser> & { _id: Types.ObjectId };
type QuestionLean = FlattenMaps<IQuestion> & { _id: Types.ObjectId };
type BattleLean = FlattenMaps<IBattle> & { _id: Types.ObjectId };

export interface NormalizedUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedQuestion {
  id: string;
  subject: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ownerId: string | null;
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  reviewNote: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedBattle {
  id: string;
  userId: string;
  subject: string;
  tier: number;
  mode: BattleModeId;
  wave: number;
  enemyName: string;
  enemyMaxHp: number;
  enemyHp: number;
  playerMaxHp: number;
  playerHp: number;
  streak: number;
  bestStreak: number;
  score: number;
  xpEarned: number;
  questions: string[];
  cursor: number;
  status: "ONGOING" | "WON" | "LOST" | "FLED";
  createdAt: Date;
  updatedAt: Date;
}

export type BattleModeRecord = Pick<IBattle, "mode" | "wave">;

function toId(id: Types.ObjectId | string): string {
  return typeof id === "string" ? id : id.toString();
}

/** User lean doc → API-safe object (passwordHash stripped, id as string). */
export function normalizeUser(doc: UserLean): NormalizedUser {
  const { _id, __v, passwordHash, ...rest } = doc as UserLean & { __v?: number; passwordHash?: string };
  void __v;
  void passwordHash;
  return { id: toId(_id), ...(rest as Omit<NormalizedUser, "id">) };
}

/** Question lean doc → plain object with string id. */
export function normalizeQuestion(doc: QuestionLean): NormalizedQuestion {
  const { _id, __v, ...rest } = doc as QuestionLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedQuestion, "id">) };
}

/** Battle lean doc → plain object with string id. */
export function normalizeBattle(doc: BattleLean): NormalizedBattle {
  const { _id, __v, ...rest } = doc as BattleLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedBattle, "id">) };
}

/** Attach display usernames for question owners (null for global bank). */
export async function attachOwnerUsernames<T extends { ownerId: string | null }>(
  questions: T[],
): Promise<(T & { ownerUsername: string | null })[]> {
  const ownerIds = [...new Set(questions.map((q) => q.ownerId).filter((v): v is string => Boolean(v)))];
  if (ownerIds.length === 0) {
    return questions.map((q) => ({ ...q, ownerUsername: null }));
  }
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("username")
    .lean();
  const names = new Map(owners.map((o) => [toId(o._id), o.username as string]));
  return questions.map((q) => ({
    ...q,
    ownerUsername: q.ownerId ? (names.get(q.ownerId) ?? null) : null,
  }));
}
