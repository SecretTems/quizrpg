# QUIZRPG — System Guide

A practical explanation of how the front end talks to the back end, what features the game has, and which security mechanisms protect it. Written for someone with basic coding knowledge (knows what an API and a database are; doesn't need to be a security engineer).

---

## 1. The big picture

```
Browser (React / Next.js client components)
   │  JSON over fetch()
   ▼
Next.js API routes (src/app/api/**)   ← the server is the referee
   │  Mongoose ODM
   ▼
MongoDB (src/lib/models.ts)
```

The architecture rule is simple: **the browser never decides anything that matters.** The client renders what the server tells it, but damage, XP, loot, question pools and money are all computed in API routes. If a player edits the page and fakes a request, the server still recomputes the truth from its own data.

### Key folders

| Path | What lives there |
|---|---|
| `src/app/api/**/route.ts` | The backend. Every HTTP endpoint, one file per resource. |
| `src/lib/game.ts` | The "rules of the game" as pure functions: combat math, XP curve, battle modes, crypto randomness. Shared by the server (authoritative use) and the client (display only). |
| `src/lib/models.ts` | Mongoose schemas: `User`, `Question`, `Battle`, `Category`, `Item`. |
| `src/lib/auth.ts` | Password hashing, session cookies, lockout helpers, OTP, TOTP 2FA. |
| `src/lib/battle.ts` | Question pool drawing and battle serialization. |
| `src/components/quizrpg/*` | The front end: login screen, arena, battle screen, profile, admin console. |
| `src/lib/store.ts` | Zustand auth store + the shared `api()` fetch helper. |

---

## 2. How a request flows (example: answering a question)

1. The battle screen shows the current question. The player clicks an option.
2. The client maps its shuffled display position back to the original option index and calls `POST /api/battle/:id/answer` with `{ choiceIndex }`.
3. The route:
   - identifies the caller from the session cookie,
   - loads the battle doc and verifies `battle.userId === user.id` (you can't answer someone else's battle),
   - loads the question and compares `choiceIndex` to `question.correctIndex`,
   - computes the outcome with `computeAnswer()` (difficulty damage + streak bonus + crit chance, all server-side),
   - mutates the battle doc (HP, score, streak, cursor) and the user doc (XP, gold, gems) in MongoDB,
   - draws the next question from the pool,
   - returns a full `AnswerResultDTO` including the new HP values.
4. The client renders the result. It can't invent a crit or a loot drop — the numbers come from the database.

The same pattern applies to starting battles, equipping items, gacha pulls, admin actions, and so on: **client sends intent, server validates and executes.**

---

## 3. Features

### Accounts and identity
- Register with username, email, display name, password.
- **Email verification:** registration creates an unverified account and emails a 6-digit OTP. Login is blocked until the account is verified. Re-sends are throttled to one code per minute per address. Unverified accounts do not appear on the leaderboard.
- Password reset via emailed OTP.
- Profile: display name, data-URL avatar, 2FA setup, logout confirmation, account deletion.

### The quiz-RPG loop
- **Adventure categories:** themed folders (created in the Category Maker) that hold a monster lineup and a set of subjects. Staff-approved categories become *official* and playable by everyone; a creator can also battle their own private category.
- **Battle:** turn-based. Answer a question correctly to strike the monster; answer wrong or run out of time and it strikes you. Reduce its HP to zero and the next monster in the lineup steps in. Categories can hold up to 20 monsters.
- **Battle modes:** Easy/Medium/Hard/Expert/Master with rising rewards, plus **Infinite mode** — endless waves that escalate in difficulty, with per-wave bonuses.
- **Monster modifiers:** creators can give monsters quirks — Tax Collecting (steals gold when you fail), Resting (heals when you fail), Shuffler, Restraint, Disabler.
- **Question bank:** players write their own questions (subject, difficulty, options, explanation, per-question timer) and can submit them for staff approval. Official questions pay full rewards; your own questions are practice-only outside your own categories.
- **Progression:** XP → levels → higher max HP and unlocks. Leaderboards rank verified players by best single-battle score and by total XP.

### Economy
- **Gold** from official victories; **gems** as rare drops.
- **Shop** (gold) and **Gacha** (gems) with rarity tiers and per-rarity copy caps.
- **Equipment:** one weapon, armor and accessory slot; gear has rarity and wears down with use.
- **Battle loadout:** three consumable slots. Each slot holds *one* item (the stock stays in storage); the same item can fill several slots but you can never load out more units than you own — enforced on both client and server.

### Convenience and safety
- **Auto-save/resume:** a battle is a database document, so closing the tab mid-fight doesn't lose it — the arena offers "resume" when you come back. Per-question deadlines are stored on the battle so you can't refresh for a fresh timer.
- **Idle logout:** after 15 minutes without input, the player is logged out; one minute before, a "Still there?" countdown dialog offers to stay.

---

## 4. Security features

### Passwords
- Hashed with **scrypt** plus a random per-user salt. Plaintext passwords never touch the database or logs, and comparison is constant-time to prevent timing attacks.

### Sessions
- The session is an HMAC-SHA256-signed token stored in a cookie that is `HttpOnly` (invisible to page JavaScript), `SameSite=Lax` (blocks most CSRF vectors) and `Secure` in production (sent only over HTTPS).
- Tokens expire after 14 days; every request re-loads the user so deleted accounts lose access immediately.

### Login hardening
- **Account lockout:** 5 failed attempts on one account locks it, and the lock duration **escalates** — first lock is 15 minutes, the next 30, then 60, 120, and so on (doubling, capped at 16×). The counter resets after a successful login, so honest users who mistype a password aren't punished forever.
- **Email verification gates login,** which is what stops "bot" registrations from ever becoming usable accounts.
- **2FA for staff:** admins and super admins sign in in two steps — after the password step the server issues a single-use, 5-minute pending token, and the TOTP code is checked in a second call. Regular players never see the extra step. Staff who log in without 2FA set up get a "security risk" warning telling them where to enable it (Profile → Two-factor authentication).
- TOTP secrets are 160-bit random values; login error messages don't reveal which part was wrong.

### Request safety
- **Server-side authorization everywhere:** every API route identifies the caller from the signed cookie, not from data sent by the client. Battles, loadouts and profiles are checked for ownership before mutation.
- **RBAC (role-based access control):** `PLAYER` / `ADMIN` / `SUPER_ADMIN`. Only staff reach admin routes (`requireAdmin`); only super admins change roles, delete accounts, or promote. Client-side tabs are cosmetic — the server is the gate.
- **Input sanitizing:** every route re-parses and bounds-checks what the client sends (monster stats clamped, images validated as small `data:image/*` URLs, whitelisted modifier IDs, search input escaped before it reaches MongoDB regex).
- **Least-privilege hints:** the MongoDB connection string should use a database user scoped to the game's database only (no `admin` db), and Atlas should have encryption at rest enabled. OTP codes are crypto-random, expire in 10 minutes, and unverified accounts can't log in or appear on leaderboards.

### Randomness
- All gameplay randomness (damage rolls, crits, loot drops, gacha, question draws, answer shuffling, OTP generation) uses **Node's cryptographic RNG** (`crypto.randomInt`/`crypto.randomBytes`) rather than `Math.random`, which is predictable.

---

## 5. Where to look in the code

| Want to change… | Look at… |
|---|---|
| Combat/damage math | `src/lib/game.ts` → `computeAnswer`, `streakBonus` |
| What questions a battle draws | `src/lib/battle.ts` → `drawWave` |
| Answering/rewards/loot | `src/app/api/battle/[id]/answer/route.ts` |
| Login/lockout/2FA steps | `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` |
| Battle loadout rules | `src/app/api/equip/route.ts` → `setLoadout` |
| Category creation/sanitizing | `src/app/api/categories/route.ts`, `src/lib/category-input.ts` |
| Admin powers | `src/app/api/admin/users/**`, `src/components/quizrpg/admin-view.tsx` |
| Idle logout | `src/components/quizrpg/idle-logout.tsx` |

---

## 6. Deployment checklist

1. Set real environment values: `SESSION_SECRET` (long random string), `MONGODB_URI`, SMTP settings.
2. Serve the app over **HTTPS** so the `Secure` cookie flag takes effect.
3. Point `MONGODB_URI` at a cluster with **encryption at rest**, and use a MongoDB user scoped to the game's database only.
4. Confirm SMTP works — email verification is the gate against bot accounts.
