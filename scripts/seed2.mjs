// seed2.mjs - creates ONLY the demo accounts (superadmin / admin / hero),
// with emails + verified flags per the new signup rules. Skips seeding questions.
// Run with: npm run seed2   (or: node --env-file=.env scripts/seed2.mjs)
import mongoose from "mongoose";
import crypto from "crypto";

/* ---------- password hashing (matches src/lib/auth.ts) ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const ACCOUNTS = [
  { username: "superadmin", displayName: "Archmage", email: "renzonben@gmail.com", password: "Admin-123", role: "SUPER_ADMIN" },
  { username: "admin", displayName: "Game Master", email: "chma.bautista.au@phinmaed.com", password: "Master-123", role: "ADMIN" },
  { username: "hero", displayName: "Test Hero", email: "harxygames@gmail.com", password: "Hero-123", role: "PLAYER" },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env or pass it inline.");
  await mongoose.connect(uri);
  console.log(`Seeding accounts at ${uri.replace(/\/\/.*@/, "//***@")}...`);

  const users = mongoose.connection.collection("users");
  for (const a of ACCOUNTS) {
    const existing = await users.findOne({ username: a.username });
    if (existing) {
      // Repair: ensure email fields + role + password are up to date even if the doc predates the email requirement
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            displayName: a.displayName,
            email: a.email,
            emailVerified: true,
            passwordHash: hashPassword(a.password),
            role: a.role,
          },
        },
      );
      console.log(`${a.username} - updated (${a.role})`);
    } else {
      await users.insertOne({
        username: a.username,
        displayName: a.displayName,
        avatar: "",
        email: a.email,
        emailVerified: true,
        passwordHash: hashPassword(a.password),
        role: a.role,
        xp: 0,
        battlesWon: 0,
        battlesLost: 0,
        bestScore: 0,
        bestStreak: 0,
        gold: 0,
        gems: 0,
        equipment: { WEAPON: null, ARMOR: null, ACCESSORY: null },
        backpack: {},
        tutorialSeen: false,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        otpCode: null,
        otpExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`${a.username} - created (${a.role})`);
    }
  }

  console.log("Done. Accounts:");
  for (const a of ACCOUNTS) console.log(`  ${a.username} / ${a.password} (${a.role})`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
