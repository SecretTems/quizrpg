# ⚔️ QUIZRPG — Learn, Battle, Level Up

An interactive, gamified quiz system that turns passive revision into active, game-based learning. Students answer subject questions to attack monsters, build streaks, land critical hits, earn XP, level up, and unlock progressively harder enemies — with all progress persisted in **MongoDB**.

Built with **Next.js (App Router) + React + TypeScript + Tailwind CSS + MongoDB (Mongoose)**.

---

## Features

- ⚔️ **Battle system** — server-authoritative combat: damage scales with question difficulty and answer streaks, with critical hits on 3+ streaks. Animated HP bars, floating damage numbers, screen shake, 30s question timer.
- 🧠 **Question bank manager** — create / edit / delete questions per subject & difficulty. Players manage their own bank; admins also manage the global bank used by everyone.
- 📈 **Level system** — earn XP per correct answer and victory bonus; level-ups unlock higher enemy tiers (Slime Scholar → Rune Golem → Cipher Wraith → Quiz Dragon).
- 🏆 **Leaderboard** — Top Scores and Top XP boards, persisted across sessions.
- 💾 **Save / resume** — an unfinished battle is stored server-side; log back in and continue exactly where you left off. Lifetime stats (wins, losses, best score, best streak) persist too.
- 👥 **Accounts** — player and admin roles. Admins get global bank management, user management (promote / demote / delete with cascade) and platform stats.
- 🌗 **Light & dark mode** — parchment (light) and dungeon (dark) themes, pixel-retro UI with smooth animations.

## Quick start

### Option A — zero config (in-memory MongoDB)

No MongoDB installation needed. Data is **ephemeral** (wiped on stop) — great for a quick look:

```bash
npm install        # or: bun install
npm run dev:memory
# open http://localhost:3000 — demo accounts are seeded automatically
```

### Option B — real local MongoDB (persistent)

Requires Node.js **20.6+** and a running MongoDB instance (default port 27017).

```bash
npm install
npm run seed       # creates demo accounts + 45 starter questions
npm run dev        # open http://localhost:3000
```

### Option C — MongoDB Atlas (free cloud database)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) and get your connection string.
2. Put it in `.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/quizrpg
SESSION_SECRET=any-long-random-string
```

3. `npm run seed && npm run dev`

## Demo accounts (after seeding)

| Account | Password | Role |
| ------- | -------- | ---- |
| `admin` | `admin123` | Admin (global bank + user management) |
| `hero`  | `hero123`  | Player |

## Environment variables (`.env`)

```env
# MongoDB connection string (local or Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/quizrpg

# Secret used to sign session cookies — set your own random value in production
SESSION_SECRET=change-me-to-a-long-random-string
```

The project ships with a working `.env`. Change `SESSION_SECRET` before deploying.

## Game math (server-authoritative)

All combat outcomes are computed on the server (`src/lib/game.ts`) — the client only renders state.

| Mechanic | Rule |
| -------- | ---- |
| Damage (correct answer) | EASY 14 / MEDIUM 20 / HARD 28, **+3 per consecutive correct** (max +15) |
| Critical hit | 25% chance at streak ≥ 3 → damage × 1.5 |
| Wrong answer / timeout | Enemy counterattacks for its ATK range |
| XP | 10 / 20 / 30 by difficulty (+5 bonus on crit); victory bonus per tier |
| Score | Equals damage dealt; victory adds tier score + bestStreak × 10 |
| Player max HP | 90 + 10 × level |
| Level-up | 100 + 50 × (n − 1) XP to go from level n to n+1 |

### Enemy tiers

| Tier | Enemy | Unlock | HP | ATK | Victory reward |
| ---- | ----- | ------ | -- | --- | -------------- |
| 1 | Slime Scholar | Lv 1 | 60 | 6–9 | 40 XP / 100 pts |
| 2 | Rune Golem | Lv 3 | 100 | 10–14 | 90 XP / 220 pts |
| 3 | Cipher Wraith | Lv 5 | 150 | 13–18 | 150 XP / 360 pts |
| 4 | Quiz Dragon | Lv 8 | 220 | 17–23 | 240 XP / 550 pts |

Each battle is a 10-question wave (plus follow-up waves if the enemy survives). Difficulty mix scales with tier — from 60% EASY at Tier 1 to 50% HARD at Tier 4.

## Project structure

```
src/
  app/
    page.tsx              # single-page game shell
    api/                  # 12 REST routes (auth, questions, battle, leaderboard, admin, subjects)
  components/quizrpg/     # game UI (arena, battle, bank, ranks, profile, admin)
  components/ui/          # shadcn/ui primitives
  lib/
    game.ts               # combat math, enemy tiers, XP curve (pure functions)
    models.ts             # Mongoose models: User, Question, Battle
    db.ts                 # MongoDB connection (cached on globalThis)
    auth.ts               # scrypt password hashing + signed session cookie
    battle.ts             # wave drawing / battle serialization
scripts/
  seed.mjs                # demo accounts + 45 starter questions (idempotent)
  dev-memory.mjs          # zero-config launcher with ephemeral MongoDB
```

## Data model (MongoDB)

| Collection | Purpose |
| ---------- | ------- |
| `users` | account, role, xp, battlesWon/Lost, bestScore, bestStreak |
| `questions` | subject, difficulty, 4 options, correctIndex, explanation, ownerId (null = global bank) |
| `battles` | full save/resume state: HP, streak, score, xpEarned, question ids, cursor, status |

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server on <http://localhost:3000> (uses your `MONGODB_URI`) |
| `npm run dev:memory` | Dev server + temporary in-memory MongoDB (no setup, ephemeral) |
| `npm run seed` | Seed demo accounts + 45 questions into your database (safe to re-run) |
| `npm run build` | Production build (standalone output) |
| `npm start` | Run the production build |

## Deployment notes

This app has **server-side logic** (auth cookies, server-authoritative combat, MongoDB access), so it needs a Node.js host — e.g. **Vercel**, Render, Railway, Fly.io, or any VPS:

1. Provision MongoDB (Atlas free tier works great) and set `MONGODB_URI` + a strong `SESSION_SECRET` in the host's environment variables.
2. `npm run build && npm start` (or let the platform run the build).
3. Run `npm run seed` once against the production database.

> **Why not GitHub Pages?** GitHub Pages serves static files only — it cannot run the API routes, authentication, or MongoDB access this game relies on. The front end alone (static export) would have no server to validate answers or persist progress. If you specifically need static hosting, you'd have to split the project: static front end + a separately hosted API (e.g. Vercel serverless) + Atlas — the data layer here (Mongoose models + REST routes) is already structured to support that split.

## Customizing

- **Tuning combat**: edit constants in `src/lib/game.ts` (damage, crit chance, tiers, XP curve).
- **Adding questions**: use the in-game Question Bank (admins can add to the global bank) or extend `SEED_QUESTIONS` in `scripts/seed.mjs` and re-run `npm run seed`.
- **Theming**: palettes live in `src/app/globals.css` (`.parchment` / `.dungeon` CSS variable sets).
