import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { generateOtp, otpExpiresAt, sendOtpEmail } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const purpose = String(body.purpose ?? "verify") as "verify" | "reset";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return NextResponse.json({ error: "No account with that email." }, { status: 404 });
    }

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