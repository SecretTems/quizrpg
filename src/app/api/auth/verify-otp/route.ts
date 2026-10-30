import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { setSessionCookie, createResetTicket, resetTicketExpiresAt } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "");
    const purpose = String(body.purpose ?? "verify") as "verify" | "reset";

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid OTP code." }, { status: 400 });
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

    if (purpose === "verify") {
      user.emailVerified = true;
      user.otpCode = null;
      user.otpExpires = null;
      await user.save();

      await setSessionCookie(user._id.toString());
      return NextResponse.json({ ok: true, emailVerified: true });
    }

    // password reset - the OTP is single-use, so it is consumed here and a
    // short-lived ticket authorizes the actual password change
    const resetToken = createResetTicket();
    user.otpCode = null;
    user.otpExpires = null;
    user.resetToken = resetToken;
    user.resetTokenExpires = resetTicketExpiresAt();
    await user.save();

    return NextResponse.json({ ok: true, resetToken });
  } catch (err) {
    return NextResponse.json({ error: "OTP verification failed." }, { status: 500 });
  }
}