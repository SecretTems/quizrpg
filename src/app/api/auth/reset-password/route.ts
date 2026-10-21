import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "");
    const newPassword = String(body.password ?? "");

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 });
    }

    if (newPassword.length < 8 || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters with at least 1 number and 1 special character." },
        { status: 400 },
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "No account with that email." }, { status: 404 });
    }

    if (!user.otpCode || !user.otpExpires) {
      return NextResponse.json({ error: "No OTP code pending. Request a new one." }, { status: 400 });
    }

    if (Date.now() > user.otpExpires) {
      return NextResponse.json({ error: "OTP code has expired. Request a new one." }, { status: 410 });
    }

    if (user.otpCode !== code) {
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 });
    }

    user.passwordHash = hashPassword(newPassword);
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }
}