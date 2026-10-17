import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, normalizeUser } from "@/lib/models";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");

    const user = await User.findOne({ username }).lean();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    await setSessionCookie(user._id.toString());
    return NextResponse.json({ user: normalizeUser(user) });
  } catch (err) {
    console.error("[login] failed:", err);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
