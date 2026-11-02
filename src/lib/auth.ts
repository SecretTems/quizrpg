import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, normalizeUser, type NormalizedUser } from "@/lib/models";

const SECRET = process.env.SESSION_SECRET || "quizrpg-dev-secret";
const COOKIE_NAME = "quizrpg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; 
const OTP_TTL_MS = 1000 * 60 * 10; 



export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MS = 1000 * 60 * 15; 


export function loginFailures(user: { loginFailures?: number; lastLoginFailureAt?: number | null }): number {
  return user.loginFailures ?? 0;
}


export function lockoutUntil(user: { loginFailures?: number; lockoutUntil?: number | null }): number {
  const fails = loginFailures(user);
  const until = user.lockoutUntil ?? 0;
  
  return fails >= MAX_LOGIN_ATTEMPTS && until > Date.now() ? until : 0;
}

export function isLockedOut(user: { loginFailures?: number; lockoutUntil?: number | null }): boolean {
  return lockoutUntil(user) > 0;
}



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



function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}



function createSessionId(): string {
  return crypto.randomBytes(24).toString("hex");
}

function createToken(userId: string, sessionId: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${sessionId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): { userId: string; sessionId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionId, expires, signature] = parts;
  const payload = `${userId}.${sessionId}.${expires}`;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  if (Number(expires) < Date.now()) return null;
  return { userId, sessionId };
}



export async function setSessionCookie(userId: string) {
  const store = await cookies();
  
  const sessionId = createSessionId();
  await connectDB();
  await User.updateOne({ _id: userId }, { $set: { sessionId } });
  store.set(COOKIE_NAME, createToken(userId, sessionId), {
    httpOnly: true,
    sameSite: "lax",
    
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}


export async function getSessionUser(): Promise<NormalizedUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parsed = parseToken(token);
  if (!parsed || !Types.ObjectId.isValid(parsed.userId)) return null;
  await connectDB();
  const user = await User.findById(parsed.userId).lean();
  if (!user) return null;
  
  if ((user.sessionId ?? null) !== parsed.sessionId) return null;
  return normalizeUser(user);
}


export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return null;
  return user;
}



export function generateOtp(): string {
  
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpExpiresAt(): number {
  return Date.now() + OTP_TTL_MS;
}




export const RESET_TICKET_TTL_MS = 1000 * 60 * 15; 



export function createResetTicket(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function resetTicketExpiresAt(): number {
  return Date.now() + RESET_TICKET_TTL_MS;
}


export async function sendOtpEmail(email: string, code: string, purpose: "verify" | "reset") {
  const purposeLabel = purpose === "verify" ? "email verification" : "password reset";

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    
    console.log(`[OTP] (SMTP not configured) ${purposeLabel} code for ${email}: ${code}`);
    return { ok: true };
  }

  const subject = purpose === "verify" ? "QUIZRPG - verify your email" : "QUIZRPG - password reset code";
  const text =
    purpose === "verify"
      ? `Your QUIZRPG verification code is ${code}. It expires in 10 minutes.`
      : `Your QUIZRPG password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `QUIZRPG <${user}>`,
    to: email,
    subject,
    text,
  });

  return { ok: true };
}



export function generateTwoFactorSecret(): string {
  
  const bytes = crypto.randomBytes(20);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      secret += chars[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return secret;
}


function base32ToBuffer(input: string): Buffer {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let buffer = 0;
  let bitsLeft = 0;
  const bytes: number[] = [];
  for (const ch of input.toUpperCase()) {
    const val = ALPHABET.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, epochSeconds: number = Math.floor(Date.now() / 1000 / 30)): string {
  
  const key = base32ToBuffer(secret);
  const counter = Buffer.alloc(8);
  let epoch = epochSeconds;
  for (let i = 7; i >= 0; i--) {
    counter[i] = epoch & 0xff;
    epoch = Math.floor(epoch / 256);
  }
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[19] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (generateTotpCode(secret, now + i) === code) return true;
  }
  return false;
}
