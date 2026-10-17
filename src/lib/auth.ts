import crypto from "crypto";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, normalizeUser, type NormalizedUser } from "@/lib/models";

const SECRET = process.env.SESSION_SECRET || "quizrpg-dev-secret";
const COOKIE_NAME = "quizrpg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

/* ---------- password hashing (scrypt) ---------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/* ---------- session token (HMAC-signed, stateless) ---------- */

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function createToken(userId: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const payload = `${userId}.${expires}`;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  if (Number(expires) < Date.now()) return null;
  return userId;
}

/* ---------- cookie helpers (for route handlers) ---------- */

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Returns the authenticated user (sans password) or null. */
export async function getSessionUser(): Promise<NormalizedUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = parseToken(token);
  if (!userId || !Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return normalizeUser(user);
}

/** Throws a Response-friendly object pattern: returns user or null with role check. */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
