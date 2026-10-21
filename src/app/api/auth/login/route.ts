import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { verifyPassword, setSessionCookie, verifyTotpCode } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const totpCode = String(body.totpCode ?? "");

    const user = await User.findOne({ username }).lean();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Email not verified. Please verify your email before logging in.", requiresEmailVerification: true },
        { status: 403 },
      );
    }

    // 2FA required for admins and super admins
    if ((user.role === "ADMIN" || user.role === "SUPER_ADMIN") && user.twoFactorEnabled) {
      if (!totpCode || totpCode.length !== 6 || !/^\d{6}$/.test(totpCode)) {
        return NextResponse.json({ error: "2FA code required.", requires2FA: true }, { status: 403 });
      }
      const doc = await User.findById(user._id);
      if (!doc || !doc.twoFactorSecret || !verifyTotpCode(doc.twoFactorSecret, totpCode)) {
        return NextResponse.json({ error: "Invalid 2FA code." }, { status: 401 });
      }
    }

    await setSessionCookie(user._id.toString());
    return NextResponse.json({ user: normalizeUser(user) });
  } catch (err) {
    console.error("[login] failed:", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
