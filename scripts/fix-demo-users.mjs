// One-off repair: give the seeded demo accounts the email fields required after the
// email-update migration, and reset their passwords. Safe to re-run.
import mongoose from "mongoose";
import crypto from "crypto";

const hash = (pw) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
};

const accounts = [
  { username: "superadmin", email: "superadmin@quizrpg.local", password: "Super!Admin1", role: "SUPER_ADMIN" },
  { username: "admin", email: "admin@quizrpg.local", password: "Game!Master1", role: "ADMIN" },
  { username: "hero", email: "hero@quizrpg.local", password: "Test!Hero1", role: "PLAYER" },
];

await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.collection("users");
for (const a of accounts) {
  const r = await users.updateOne(
    { username: a.username },
    {
      $set: {
        displayName: a.username === "superadmin" ? "Archmage" : a.username === "admin" ? "Game Master" : "Test Hero",
        email: a.email,
        emailVerified: true,
        passwordHash: hash(a.password),
        role: a.role,
      },
      $unset: { otpCode: "", otpExpires: "" },
    },
  );
  console.log(`${a.username}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}
await mongoose.disconnect();
console.log("Done.");
