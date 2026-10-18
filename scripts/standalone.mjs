/**
 * Copies the static assets into the standalone output after `next build`.
 * Cross-platform replacement for the Unix `cp -r` commands this used to shell out to,
 * so `npm run build` works on Windows as well as macOS/Linux.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");
const targetStatic = path.join(root, ".next", "standalone", ".next", "static");
const publicDir = path.join(root, "public");
const targetPublic = path.join(root, ".next", "standalone", "public");

function copy(from, to) {
  if (!fs.existsSync(from)) {
    console.warn(`[standalone] Skipping missing dir: ${from}`);
    return;
  }
  fs.cpSync(from, to, { recursive: true });
  console.log(`[standalone] Copied ${from} -> ${to}`);
}

copy(staticDir, targetStatic);
copy(publicDir, targetPublic);
console.log("[standalone] Done.");
