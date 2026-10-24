import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import {
  verifyPassword,
  setSessionCookie,
  verifyTotpCode,
  isLockedOut,
  lockoutUntil,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MS,
} from "@/lib/auth";

/** A short-lived server-side pending-login record for the 2FA step. */
const PENDING_TTL_MS = 1000 * 60 * 5; // 5 minutes to finish 2FA
const MAX_PENDING = 500;

/** Unverified accounts are swept away this long after registration. */
const UNVERIFIED_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const SWEEP_INTERVAL_MS = 1000 * 60 * 10; // sweep at most every 10 minutes

// module-level stores survive warm invocations
const globalForPending = globalThis as unknown as {
  quizrpgPendingLogins?: Map<string, { userId: string; expires: number }>;
  quizrpgLastSweep?: number;
};
const pendingLogins = (globalForPending.quizrpgPendingLogins ??= new Map());

/**
 * Lazy janitor: deletes unverified accounts older than 24h. Runs at most once
 * per SWEEP_INTERVAL_MS, piggybacking on login traffic - no cron needed and
 * nothing is stored. Never blocks the request that triggered it.
 */
async function sweepUnverifiedAccounts() {
  const now = Date.now();
  if (now - (globalForPending.quizrpgLastSweep ?? 0) < SWEEP_INTERVAL_MS) return;
  globalForPending.quizrpgLastSweep = now;
  try {
    await connectDB();

    const cutoff = now - UNVERIFIED_TTL_MS;
    const stale = await User.find({ emailVerified: false, createdAt: { $lt: new Date(cutoff) } })
      .limit(50)
      .lean();
    if (stale.length > 0) {
      const ids = stale.map((u) => u._id);
      await User.deleteMany({ _id: { $in: ids } });
      console.log(`[sweep] removed ${stale.length} unverified account(s) older than 24h`);
    }
  } catch (err) {
    console.error("[sweep] failed:", err);
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    void sweepUnverifiedAccounts();
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const pendingToken = String(body.pendingToken ?? "");
    const totpCode = String(body.totpCode ?? "");

    /* ---------- step 2: finish a pending admin login with the TOTP code ---------- */
    if (pendingToken) {
      const pending = pendingLogins.get(pendingToken);
      if (!pending || pending.expires < Date.now()) {
        pendingLogins.delete(pendingToken);
        return NextResponse.json(
          { error: "Your 2FA session expired - log in again.", requiresLogin: true },
          { status: 403 },
        );
      }
      pendingLogins.delete(pendingToken);
      const user = await User.findById(pending.userId).lean();
      if (!user) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }
      const doc = await User.findById(user._id);
      if (!doc?.twoFactorSecret || !totpCode || !verifyTotpCode(doc.twoFactorSecret, totpCode)) {
        return NextResponse.json({ error: "Invalid 2FA code.", requires2FA: true }, { status: 401 });
      }
      await User.updateOne({ _id: user._id }, { $set: { loginFailures: 0, lockoutUntil: null, lockoutCount: 0 } });
      await setSessionCookie(user._id.toString());
      return NextResponse.json({ user: normalizeUser(user) });
    }

    /* ---------- step 1: username + password ---------- */
    const user = await User.findOne({ username }).lean();

    if (!user || !verifyPassword(password, user.passwordHash)) {
      // Only count failures against real accounts (avoids locking a nonexistent
      // username, but also does not reveal which usernames exist any faster).
      if (user) {
        const failures = (user.loginFailures ?? 0) + 1;
        // escalating cooldown: each lockout lasts longer than the previous one
        const count = (user.lockoutCount ?? 0) + 1;
        const multiplier = Math.min(2 ** Math.max(0, count - 1), 16); // 1x, 2x, 4x, 8x... capped at 16x
        const duration = LOCKOUT_MS * multiplier;
        const lockout = failures >= MAX_LOGIN_ATTEMPTS ? Date.now() + duration : null;
        await User.updateOne(
          { _id: user._id },
          { $set: { loginFailures: failures, lockoutCount: count, ...(lockout ? { lockoutUntil: lockout } : {}) } },
        );
        if (lockout) {
          return NextResponse.json(
            {
              error: `Too many failed attempts. This account is locked for ${Math.ceil(duration / 60000)} minutes.`,
              lockedUntil: lockout,
            },
            { status: 429 },
          );
        }
        return NextResponse.json(
          {
            error:
              MAX_LOGIN_ATTEMPTS - failures <= 2
                ? `Invalid username or password. ${MAX_LOGIN_ATTEMPTS - failures} attempts left before lockout.`
                : "Invalid username or password.",
          },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    if (isLockedOut(user)) {
      const until = lockoutUntil(user);
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${Math.ceil((until - Date.now()) / 60000)} minutes.`,
          lockedUntil: until,
        },
        { status: 429 },
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Email not verified. Please verify your email before logging in.", requiresEmailVerification: true },
        { status: 403 },
      );
    }

    // 2FA is required for admins and super admins - normal users sign straight in
    if ((user.role === "ADMIN" || user.role === "SUPER_ADMIN") && user.twoFactorEnabled) {
      const doc = await User.findById(user._id);
      if (doc?.twoFactorSecret) {
        // hand out a single-use pending token instead of trusting the client
        // to re-send the password in step 2
        const token = crypto.randomBytes(24).toString("hex");
        if (pendingLogins.size > MAX_PENDING) pendingLogins.clear();
        pendingLogins.set(token, { userId: user._id.toString(), expires: Date.now() + PENDING_TTL_MS });
        return NextResponse.json({ requires2FA: true, pendingToken: token });
      }
    }

    await User.updateOne({ _id: user._id }, { $set: { loginFailures: 0, lockoutUntil: null, lockoutCount: 0 } });
    await setSessionCookie(user._id.toString());
    return NextResponse.json({ user: normalizeUser(user) });
  } catch (err) {
    console.error("[login] failed:", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
