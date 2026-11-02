import { Schema, model, models, type FlattenMaps, type Types } from "mongoose";
import type { BattleModeId } from "@/lib/game";






export interface IEquipmentPiece {
  itemId: string;
  name: string;
  
  slot: "WEAPON" | "ARMOR" | "ACCESSORY";
  atk: number;
  def: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  
  maxDurability?: number;
  
  durability?: number;
}

export interface IUser extends Document {
  username: string;
  displayName: string;
   
  avatar: string;
  passwordHash: string;
  role: "ADMIN" | "SUPER_ADMIN" | "PLAYER";
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
   
  gold: number;
   
  gems: number;
  
  equipment: { WEAPON: IEquipmentPiece | null; ARMOR: IEquipmentPiece | null; ACCESSORY: IEquipmentPiece | null };
  
  loadout: (string | null)[];
  
  backpack: Record<string, { qty: number; piece?: IEquipmentPiece } | undefined>;
  
  tutorialSeen: boolean;
  
  lastAdventureAt: number | null;
  
  lastAdventureDifficulty: string | null;
  
  email: string;
  
  emailVerified: boolean;
  
  otpCode: string | null;
  
  otpExpires: number | null;
  


  resetToken: string | null;
  
  resetTokenExpires: number | null;
  
  twoFactorEnabled: boolean;
  
  twoFactorSecret: string | null;
  
  loginFailures: number;
  
  lockoutUntil: number | null;
  
  lockoutCount: number;
  
  lastDailyClaimAt: number | null;
  
  dailyStreak: number;
  
  questionsRight: number;
  
  questionsWrong: number;
  
  subjectStats: Record<string, { right: number; wrong: number } | undefined>;
  
  categoryStats: Record<string, { right: number; wrong: number } | undefined>;
  
  sessionId: string | null;
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
    
    loadout: { type: [String], default: [null, null, null] },
    tutorialSeen: { type: Boolean, default: false },
    lastAdventureAt: { type: Number, default: null },
    lastAdventureDifficulty: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true, maxlength: 254 },
    emailVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: null },
    otpExpires: { type: Number, default: null },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Number, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    loginFailures: { type: Number, default: 0, min: 0 },
    lockoutUntil: { type: Number, default: null },
    lockoutCount: { type: Number, default: 0, min: 0 },
    lastDailyClaimAt: { type: Number, default: null },
    dailyStreak: { type: Number, default: 0, min: 0 },
    questionsRight: { type: Number, default: 0, min: 0 },
    questionsWrong: { type: Number, default: 0, min: 0 },
    subjectStats: { type: Schema.Types.Mixed, default: {} },
    categoryStats: { type: Schema.Types.Mixed, default: {} },
    sessionId: { type: String, default: null },
  },
  { timestamps: true },
);



export interface IQuestion extends Document {
  
  subject: string;
  
  subjects: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  
  ownerId: string | null;
  
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  
  reviewNote: string;
  
  timerSeconds: number;
  
  approvalVotes: string[];
  
  rejectionVotes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    subject: { type: String, required: true, maxlength: 40 },
    subjects: { type: [String], default: [] },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"], required: true },
    text: { type: String, required: true, maxlength: 500 },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 9 },
    explanation: { type: String, default: "", maxlength: 500 },
    ownerId: { type: String, default: null },
    status: { type: String, enum: ["OFFICIAL", "CUSTOM", "PENDING", "REJECTED"], default: "CUSTOM" },
    reviewNote: { type: String, default: "", maxlength: 300 },
    timerSeconds: { type: Number, default: 30, min: 10, max: 300 },
    approvalVotes: { type: [String], default: [] },
    rejectionVotes: { type: [String], default: [] },
  },
  { timestamps: true },
);
QuestionSchema.index({ subject: 1, difficulty: 1 });
QuestionSchema.index({ subjects: 1 });
QuestionSchema.index({ ownerId: 1 });




export interface BattleMonster {
  name: string;
  emoji: string;
   
  image?: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  subjects: string[];
  
  modifiers?: { id: string; chance: number; amount: number }[];
}

export interface IBattle extends Document {
  userId: string;
  subject: string;
  tier: number;
  mode: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER" | "INFINITE";
  
  wave: number;
  
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
  
  questionsRight: number;
  
  questionsWrong: number;
  
  damageBoostPending: boolean;
  
  stunPending: boolean;
  
  confusionPending: boolean;
  
  gemBonus: number;
  
  goldBonus: number;
    
    questions: string[];
    cursor: number;
    status: "ONGOING" | "WON" | "LOST" | "FLED";
    
    questionDeadlineAt?: number;
    createdAt: Date;
    updatedAt: Date;
}

const BattleSchema = new Schema<IBattle>(
  {
    userId: { type: String, required: true },
    subject: { type: String, default: "ALL" },
    tier: { type: Number, required: true, min: 1, max: 8 },
    
    mode: { type: String, enum: ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER", "INFINITE"], default: "EASY" },
    
    wave: { type: Number, default: 1, min: 1 },
    
    categoryId: { type: String },
    enemySprite: { type: String },
    enemyAtkMin: { type: Number },
    enemyAtkMax: { type: Number },
    
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
    
    enemyName: { type: String, required: true },
    enemyMaxHp: { type: Number, required: true },
    enemyHp: { type: Number, required: true },
    playerMaxHp: { type: Number, required: true },
    playerHp: { type: Number, required: true },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    questionsRight: { type: Number, default: 0, min: 0 },
    questionsWrong: { type: Number, default: 0, min: 0 },
    damageBoostPending: { type: Boolean, default: false },
    stunPending: { type: Boolean, default: false },
    confusionPending: { type: Boolean, default: false },
    gemBonus: { type: Number, default: 0, min: 0 },
    goldBonus: { type: Number, default: 0, min: 0 },
    questions: { type: [String], default: [] },
    cursor: { type: Number, default: 0 },
    status: { type: String, enum: ["ONGOING", "WON", "LOST", "FLED"], default: "ONGOING" },
    
    questionDeadlineAt: { type: Number },
  },
  { timestamps: true },
);
BattleSchema.index({ userId: 1, status: 1 });



export interface IMonster {
  name: string;
  emoji: string;
   
  image?: string;
  hp: number;
  atkMin: number;
  atkMax: number;
  
  subjects: string[];
  
  modifiers?: { id: string; chance: number; amount: number }[];
}

export interface ICategory extends Document {
  
  name: string;
  
  description: string;
  
  subjects: string[];
  
  difficulties: ("EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER")[];
  
  icon?: string;
  
  enemy: { name: string; emoji: string; tier: number; baseHp: number; atkMin: number; atkMax: number };
  
  monsters: IMonster[];
  
  isOfficial: boolean;
  ownerId: string | null;
  
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  
  approvalVotes: string[];
  
  rejectionVotes: string[];
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
    
    modifiers: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            chance: { type: Number, default: 50, min: 0, max: 100 },
            amount: { type: Number, default: 0, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
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
    approvalVotes: { type: [String], default: [] },
    rejectionVotes: { type: [String], default: [] },
  },
  { timestamps: true },
);
CategorySchema.index({ status: 1, ownerId: 1 });



export interface IItem extends Document {
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



export const User = models.User ?? model<IUser>("User", UserSchema);
export const Question = models.Question ?? model<IQuestion>("Question", QuestionSchema);
export const Battle = models.Battle ?? model<IBattle>("Battle", BattleSchema);
export const Category = models.Category ?? model<ICategory>("Category", CategorySchema);
export const Item = models.Item ?? model<IItem>("Item", ItemSchema);




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
  email: string;
  emailVerified: boolean;
  role: string;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  gold: number;
  gems: number;
  equipment: { WEAPON: IEquipmentPiece | null; ARMOR: IEquipmentPiece | null; ACCESSORY: IEquipmentPiece | null };
  
  loadout: (string | null)[];
  backpack: Record<string, { qty: number; piece?: IEquipmentPiece } | undefined>;
  tutorialSeen: boolean;
  questionsRight: number;
  questionsWrong: number;
  subjectStats: Record<string, { right: number; wrong: number } | undefined>;
  categoryStats: Record<string, { right: number; wrong: number } | undefined>;
  twoFactorEnabled: boolean;
  
  lockoutUntil: number | null;
  
  lastDailyClaimAt: number | null;
  
  dailyStreak: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedQuestion {
  id: string;
  subject: string;
  
  subjects: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "MASTER";
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ownerId: string | null;
  status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED";
  reviewNote: string;
  
  timerSeconds: number;
  
  approvalVotes: string[];
  
  rejectionVotes: string[];
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
  questionsRight: number;
  questionsWrong: number;
  damageBoostPending?: boolean;
  stunPending?: boolean;
  confusionPending?: boolean;
  gemBonus?: number;
  goldBonus?: number;
  questions: string[];
  cursor: number;
  status: "ONGOING" | "WON" | "LOST" | "FLED";
  
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


export function normalizeUser(doc: UserLean): NormalizedUser {
  const { _id, __v, passwordHash, sessionId, ...rest } = doc as UserLean & {
    __v?: number;
    passwordHash?: string;
    sessionId?: string;
  };
  void __v;
  void passwordHash;
  void sessionId;
  return { id: toId(_id), ...(rest as Omit<NormalizedUser, "id">) };
}


export function normalizeCategory(doc: CategoryLean): NormalizedCategory {
  const { _id, __v, ...rest } = doc as CategoryLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedCategory, "id">) };
}


export function normalizeItem(doc: ItemLean): NormalizedItem {
  const { _id, __v, ...rest } = doc as ItemLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedItem, "id">) };
}


export function normalizeQuestion(doc: QuestionLean): NormalizedQuestion {
  const { _id, __v, ...rest } = doc as QuestionLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedQuestion, "id">) };
}


export function normalizeBattle(doc: BattleLean): NormalizedBattle {
  const { _id, __v, ...rest } = doc as BattleLean & { __v?: number };
  void __v;
  return { id: toId(_id), ...(rest as Omit<NormalizedBattle, "id">) };
}


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
