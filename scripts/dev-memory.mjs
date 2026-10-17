/**
 * QUIZRPG — zero-config dev launcher with a temporary in-memory MongoDB.
 *
 *   npm run dev:memory
 *
 * Boots a local in-memory MongoDB, seeds demo data, then starts the Next.js
 * dev server on port 3000. Perfect for trying the game without installing
 * MongoDB. NOTE: data is EPHEMERAL — it disappears when you stop the server.
 * For real persistence, install MongoDB or use Atlas (see README) and run
 * `npm run dev` + `npm run seed` instead.
 */
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seed } from "./seed.mjs";

const mongod = await MongoMemoryServer.create({ instance: { dbName: "quizrpg" } });
process.env.MONGODB_URI = mongod.getUri("quizrpg");
console.log(`[dev:memory] temporary MongoDB ready at ${process.env.MONGODB_URI}`);

try {
  await seed();
} catch (err) {
  console.error("[dev:memory] seeding failed:", err);
  await mongod.stop();
  process.exit(1);
}

console.log("[dev:memory] starting Next.js dev server on http://localhost:3000 ...");
const child = spawn("npx", ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

async function shutdown() {
  child.kill("SIGTERM");
  await mongod.stop();
  process.exit(0);
}
child.on("exit", (code) => {
  console.log(`[dev:memory] Next.js exited (${code}), stopping MongoDB...`);
  mongod.stop().then(() => process.exit(code ?? 0));
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
