import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { generateOtp, otpExpiresAt, sendOtpEmail } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      // Don't reveal whether the email exists
      return NextResponse.json({ ok: true, email });
    }

    const code = generateOtp();
    const expires = otpExpiresAt();

    await User.findByIdAndUpdate(user._id, {
      otpCode: code,
      otpExpires: expires,
    });

    await sendOtpEmail(email, code, "reset");

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    return NextResponse.json({ error: "Failed to send reset OTP." }, { status: 500 });
  }
}