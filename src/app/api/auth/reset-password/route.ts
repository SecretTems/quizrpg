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
    const resetToken = String(body.resetToken ?? "");
    const newPassword = String(body.password ?? "");

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

    // Preferred path: the ticket minted by /api/auth/verify-otp once the OTP was
    // checked. Single use - it is cleared below.
    let authorized = false;
    if (resetToken && user.resetToken) {
      if (user.resetTokenExpires && Date.now() > user.resetTokenExpires) {
        return NextResponse.json(
          { error: "Your reset session expired. Request a new code." },
          { status: 410 },
        );
      }
      authorized = user.resetToken === resetToken;
    } else if (code) {
      // Fallback for callers that skip the verify step: validate the OTP directly
      if (!user.otpCode || !user.otpExpires) {
        return NextResponse.json({ error: "No OTP code pending. Request a new one." }, { status: 400 });
      }
      if (Date.now() > user.otpExpires) {
        return NextResponse.json({ error: "OTP code has expired. Request a new one." }, { status: 410 });
      }
      authorized = user.otpCode === code;
    }

    if (!authorized) {
      return NextResponse.json({ error: "Invalid reset request. Verify the code again." }, { status: 400 });
    }

    user.passwordHash = hashPassword(newPassword);
    user.otpCode = null;
    user.otpExpires = null;
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }
}