import { Schema, model, models, type FlattenMaps, type Types } from "mongoose";
import type { BattleModeId } from "@/lib/game";

/* =========================================================
   QUIZRPG — MongoDB models (Mongoose)

   Collections:
   - users     : accounts (ADMIN / PLAYER) + lifetime stats + wallet/equipment
   - questions : question bank (ownerId null = global bank)
   - battles   : one document per battle, incl. save/resume state
   - categories: Adventure categories (subjects, difficulties, enemy, owner)
   - items     : equipment & consumables (weapons, armor, accessories, potions)
   ========================================================= */

/* ---------- User ---------- */

export interface IEquipmentPiece {
  itemId: string;
  name: string;
  /** WEAPON adds atk, ARMOR adds def, ACCESSORY adds bonus stats */
  slot: "WEAPON" | "ARMOR" | "ACCESSORY";
  atk: number;
  def: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
}

export interface IUser extends Document {
  username: string;
  displayName: string;
  /** custom profile picture (data URL) — empty falls back to the default emoji */
  avatar: string;
  passwordHash: string;
  role: "ADMIN" | "SUPER_ADMIN" | "PLAYER";
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  /** Adventure currency — earned from victories in official categories */
  gold: number;
  /** Premium currency — rare drops from official enemies, spent on gacha */
  gems: number;
  /** equipped gear; keys are slots, values snapshot the item's stats */
  equipment: { WEAPON: IEquipmentPiece | null; ARMOR: IEquipmentPiece | null; ACCESSORY: IEquipmentPiece | null };
  /** owned items, keyed by item id (each entry stores qty for stackables) */
  backpack: Record<string, { qty: number; piece?: IEquipmentPiece } | undefined>;
  /** true once the onboarding tutorial has been completed */
  tutorialSeen: boolean;
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
    avatar: { type: String, default: "", maxlength: 400_000 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "SUPER_ADMIN", "PLAYER"], default: "PLAYER" },
    xp: { type: Number, default: 0, min: 0 },
    battlesWon: { type: Number, default: 0, min: 0 },
    battlesLost: { type: Number, default: 0, min: 0 },
    bestScore: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    gold: { type: Number, default: 0, min: 0 },
    gems: { type: Number, default: 0, min: 0 },
    equipment: {
      type: new Schema(
        {
          WEAPON: { type: Schema.Types.Mixed, default: null },
          ARMOR: { type: Schema.Types.Mixed, default: null },
          ACCESSORY: { type: Schema.Types.Mixed, default: null },
        },
        { _id: false },
      ),
      default: () => ({ WEAPON: null, ARMOR: null, ACCESSORY: null }),
    },
    backpack: { type: Schema.Types.Mixed, default: {} },
    tutorialSeen: { type: Boolean, default: false },
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

/** One monster in a category's battle lineup (snapshot copy stored on battles). */
export interface BattleMonster {
  name: string;
  emoji: string;
  /** custom monster art (data URL) — empty falls back to the emoji */
  image?: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  subjects: string[];
}

export interface IBattle extends Document {
  userId: string;
  subject: string;
  tier: number;
  mode: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER" | "INFINITE";
  /** current wave number (1 for standard battles; increments in INFINITE mode) */
  wave: number;
  /** set when the opponent comes from an admin-created Adventure category */
  categoryId?: string;
  /** snapshot of the category enemy (undefined for the static ENEMY_TIERS roster) */
  enemySprite?: string;
  enemyAtkMin?: number;
  enemyAtkMax?: number;
  /** subject list for category battles (undefined = single subject / ALL) */
  battleSubjects?: string[];
  /** snapshot of the category's monster lineup (empty/undefined = classic single enemy) */
  monsters?: BattleMonster[];
  /** index of the monster currently being fought in `monsters` */
  monsterIndex?: number;
  /** custom image (data URL) of the monster currently being fought */
  enemyImage?: string;
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
    /** epoch ms deadline for the current question (survives tab/window switches) */
    questionDeadlineAt?: number;
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
    /** category opponent id (set when fighting an Adventure category monster) */
    categoryId: { type: String },
    enemySprite: { type: String },
    enemyAtkMin: { type: Number },
    enemyAtkMax: { type: Number },
    /** subject list for category battles (undefined = single subject / ALL) */
    battleSubjects: { type: [String] },
    monsters: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, maxlength: 40 },
            emoji: { type: String, default: "👾", maxlength: 8 },
            image: { type: String, default: "", maxlength: 400_000 },
            hp: { type: Number, required: true, min: 10 },
            atkMin: { type: Number, required: true, min: 1 },
            atkMax: { type: Number, required: true, min: 1 },
            subjects: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    monsterIndex: { type: Number, default: 0, min: 0 },
    enemyImage: { type: String, default: "" },
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
    /** epoch ms deadline for the current question (survives tab/window switches) */
    questionDeadlineAt: { type: Number },
  },
  { timestamps: true },
);
BattleSchema.index({ userId: 1, status: 1 });

/* ---------- Category (Adventure) ---------- */

export interface IMonster {
  name: string;
  emoji: string;
  /** custom monster art (data URL) — empty falls back to the emoji */
  image?: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  /** which subjects' question pools this monster draws from */
  subjects: string[];
}

export interface ICategory extends Document {
  /** display name, e.g. "Mathematics" */
  name: string;
  /** short flavor line shown on the category card */
  description: string;
  /** which subjects' question pools this category draws from */
  subjects: string[];
  /** which difficulties are playable inside this category */
  difficulties: ("EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER")[];
  /** custom category art (data URL) — empty falls back to the first monster's emoji */
  icon?: string;
  /** the legacy single monster guarding this category (kept for old data) */
  enemy: { name: string; emoji: string; tier: number; baseHp: number; atkMin: number; atkMax: number };
  /** ordered monster lineup fought one after another in a category battle */
  monsters: IMonster[];
  /** OFFICIAL = admin-created, playable by everyone; CUSTOM = player's own */
  isOfficial: boolean;
  ownerId: string | null;
  /** player-created categories awaiting admin approval to become official */
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}

const MonsterSchema = new Schema<IMonster>(
  {
    name: { type: String, required: true, maxlength: 40 },
    emoji: { type: String, default: "👾", maxlength: 8 },
    image: { type: String, default: "", maxlength: 400_000 },
    hp: { type: Number, required: true, min: 10 },
    atkMin: { type: Number, required: true, min: 1 },
    atkMax: { type: Number, required: true, min: 1 },
    subjects: { type: [String], default: [] },
  },
  { _id: false },
);

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 200 },
    subjects: { type: [String], required: true },
    difficulties: { type: [String], required: true },
    icon: { type: String, default: "", maxlength: 400_000 },
    enemy: {
      name: { type: String, required: true, maxlength: 40 },
      emoji: { type: String, default: "👾", maxlength: 8 },
      tier: { type: Number, required: true, min: 1, max: 8 },
      baseHp: { type: Number, required: true, min: 20 },
      atkMin: { type: Number, required: true, min: 1 },
      atkMax: { type: Number, required: true, min: 1 },
    },
    monsters: { type: [MonsterSchema], default: [] },
    isOfficial: { type: Boolean, default: false },
    ownerId: { type: String, default: null },
    status: { type: String, enum: ["OFFICIAL", "CUSTOM", "PENDING", "REJECTED"], default: "CUSTOM" },
  },
  { timestamps: true },
);
CategorySchema.index({ status: 1, ownerId: 1 });

/* ---------- Item (shop / gacha / equipment) ---------- */

export interface IItem extends Document {
  name: string;
  slot: "WEAPON" | "ARMOR" | "ACCESSORY" | "CONSUMABLE";
  atk: number;
  def: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  /** price in gold; 0 = not sold in shop (gacha-only) */
  price: number;
  /** short flavor/effect text */
  description: string;
  /** unique gacha items cannot be pulled twice */
  unique: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true, maxlength: 40 },
    slot: { type: String, enum: ["WEAPON", "ARMOR", "ACCESSORY", "CONSUMABLE"], required: true },
    atk: { type: Number, default: 0, min: 0 },
    def: { type: Number, default: 0, min: 0 },
    rarity: { type: String, enum: ["COMMON", "RARE", "EPIC", "LEGENDARY"], default: "COMMON" },
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "", maxlength: 200 },
    unique: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/* ---------- models (guarded for Next.js hot reload) ---------- */

export const User = models.User ?? model<IUser>("User", UserSchema);
export const Question = models.Question ?? model<IQuestion>("Question", QuestionSchema);
export const Battle = models.Battle ?? model<IBattle>("Battle", BattleSchema);
export const Category = models.Category ?? model<ICategory>("Category", CategorySchema);
export const Item = models.Item ?? model<IItem>("Item", ItemSchema);

/* =========================================================
   Lean-doc normalizers: Mongo `_id` (ObjectId) → string `id`
   so API payloads keep the exact same shape as before.
   ========================================================= */

type UserLean = FlattenMaps<IUser> & { _id: Types.ObjectId };
type QuestionLean = FlattenMaps<IQuestion> & { _id: Types.ObjectId };
type BattleLean = FlattenMaps<IBattle> & { _id: Types.ObjectId };
type CategoryLean = FlattenMaps<ICategory> & { _id: Types.ObjectId };
type ItemLean = FlattenMaps<IItem> & { _id: Types.ObjectId };

export interface NormalizedUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  gold: number;
  gems: number;
  equipment: { WEAPON: IEquipmentPiece | null; ARMOR: IEquipmentPiece | null; ACCESSORY: IEquipmentPiece | null };
  backpack: Record<string, { qty: number; piece?: IEquipmentPiece } | undefined>;
  tutorialSeen: boolean;
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
  /** category opponent id (set when fighting an Adventure category monster) */
  categoryId?: string;
  enemySprite?: string;
  enemyAtkMin?: number;
  enemyAtkMax?: number;
  battleSubjects?: string[];
  monsters?: BattleMonster[];
  monsterIndex?: number;
  enemyImage?: string;
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
  /** epoch ms deadline for the current question (survives tab/window switches) */
  questionDeadlineAt?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedCategory {
  id: string;
  name: string;
  description: string;
  subjects: string[];
  difficulties: ( "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER")[];
  icon: string;
  enemy: { name: string; emoji: string; tier: number; baseHp: number; atkMin: number; atkMax: number };
  monsters: IMonster[];
  isOfficial: boolean;
  ownerId: string | null;
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedItem {
  id: string;
  name: string;
  slot: "WEAPON" | "ARMOR" | "ACCESSORY" | "CONSUMABLE";
  atk: number;
  def: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  description: string;
  unique: boolean;
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

/** Category lean doc → plain object with string id. */
export function normalizeCategory(doc: CategoryLean): NormalizedCategory {
  const { _id, __v, ...rest } = doc as CategoryLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedCategory, "id">) };
}

/** Item lean doc → plain object with string id. */
export function normalizeItem(doc: ItemLean): NormalizedItem {
  const { _id, __v, ...rest } = doc as ItemLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedItem, "id">) };
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
