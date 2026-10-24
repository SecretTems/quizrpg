import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { generateOtp, otpExpiresAt, sendOtpEmail } from "@/lib/auth";

/** Simple per-email resend throttle - bots can't spam the mail pipeline. */
const RESEND_COOLDOWN_MS = 60_000; // 1 minute between codes
const globalForThrottle = globalThis as unknown as { quizrpgOtpSentAt?: Map<string, number> };
const otpSentAt = (globalForThrottle.quizrpgOtpSentAt ??= new Map());

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const purpose = String(body.purpose ?? "verify") as "verify" | "reset";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const last = otpSentAt.get(email) ?? 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${wait}s before requesting another code.` },
        { status: 429 },
      );
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return NextResponse.json({ error: "No account with that email." }, { status: 404 });
    }

    otpSentAt.set(email, Date.now());
    if (otpSentAt.size > 1000) otpSentAt.clear();

    const code = generateOtp();
    const expires = otpExpiresAt();

    await User.findByIdAndUpdate(user._id, {
      otpCode: code,
      otpExpires: expires,
    });

    await sendOtpEmail(email, code, purpose);

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return NextResponse.json({ error: "Failed to send OTP." }, { status: 500 });
  }
}
