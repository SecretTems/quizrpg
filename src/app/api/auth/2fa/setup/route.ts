import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { getSessionUser } from "@/lib/auth";
import { generateTwoFactorSecret } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "2FA is only available for admin accounts." }, { status: 403 });
    }

    await connectDB();
    const secret = generateTwoFactorSecret();
    await User.findByIdAndUpdate(user.id, { twoFactorSecret: secret });

    return NextResponse.json({ ok: true, secret });
  } catch (err) {
    return NextResponse.json({ error: "2FA setup failed." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const code = String(body.code ?? "");

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid 2FA code." }, { status: 400 });
    }

    const doc = await User.findById(user.id);
    if (!doc || !doc.twoFactorSecret) {
      return NextResponse.json({ error: "2FA not set up." }, { status: 400 });
    }

    const { verifyTotpCode } = await import("@/lib/auth");
    if (!verifyTotpCode(doc.twoFactorSecret, code)) {
      return NextResponse.json({ error: "Invalid 2FA code." }, { status: 400 });
    }

    doc.twoFactorEnabled = true;
    await doc.save();

    return NextResponse.json({ ok: true, twoFactorEnabled: true });
  } catch (err) {
    return NextResponse.json({ error: "2FA verification failed." }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    await connectDB();
    await User.findByIdAndUpdate(user.id, { twoFactorEnabled: false, twoFactorSecret: null });

    return NextResponse.json({ ok: true, twoFactorEnabled: false });
  } catch (err) {
    return NextResponse.json({ error: "Failed to disable 2FA." }, { status: 500 });
  }
}
