# QUIZRPG — User Requests Audit & Implementation Plan

## Goal
Address the user's reported bugs and feature requests:
- Equip/unequip shows "itemId, slot and action are required" error
- Enemies don't drop gems/gold
- Battle timer resets when switching tabs mid-battle (unfair extra time)
- Players create categories, visible only to them until approved
- Category creation belongs in the Bank tab (not Admin); admin "Categories" → rename to "All"
- Bank UI rework: Category / Monster / Question Maker buttons
- Players can edit categories (name, monster order, monster questions, delete)
- Add category & monster filters
- Equipment modal: select item then click Equip (no drag-and-drop duplication/deletion)
- Custom images for profile picture / category icons / monster icons, size-limited, unified upload route
- README tutorial for adding item images
- Adventure tab: 4 center buttons, Play biggest
- Remove "[number] [difficulty] description" from difficulty selection text
- Delete account button in Profile under Sign out
- Remove "Custom bank only"
- Check whether "that prompt" is done; finish if not

## Current-state audit (most requests already implemented)

The user's screenshots appear to reflect an older build. An audit of this repo found most features already present:

| User request | Status | Evidence |
|---|---|---|
| Equip/unequip works | Present; unequip needs only `action`+`slot` (no itemId) | `src/app/api/equip/route.ts:22-33`; frontend `equipment-view.tsx:139-141` |
| Exact "itemId, slot and action are required" message | NOT present in code | grep found no such string |
| Enemies drop gold & gems | Present on official victory | `src/app/api/battle/[id]/answer/route.ts:119-131` |
| Battle timer survives app-tab switch | Present via in-memory deadline map | `src/components/quizrpg/battle-screen.tsx:37-52, 62-110` |
| Players create categories (CUSTOM→PENDING→OFFICIAL) | Present | `src/components/quizrpg/category-maker.tsx`; GET filter `src/app/api/categories/route.ts:17-23` |
| Category creation in Bank tab | Present | `src/components/quizrpg/question-bank-view.tsx:248-291` |
| Admin user sections labelled Players/Admins/All | Present | `src/components/quizrpg/admin-view.tsx:270-278` |
| Category & monster filters | Present | `question-bank-view.tsx:352-381` |
| Edit category name/monster order/delete | Present | `category-maker.tsx`, `monster-maker.tsx` |
| Equipment: select item then click Equip (no drag-drop) | Present | `equipment-view.tsx` |
| Custom images: avatar/category/monster, 128 px / 200 KB, unified `/api/upload` | Present | `src/lib/images.ts`; `src/app/api/upload/route.ts` |
| Delete account button in Profile (under Sign out) | Present | `profile-view.tsx:250-285`; `DELETE src/app/api/auth/me/route.ts:54-66` |
| Adventure 4 center buttons, Play largest | Present | `arena-view.tsx:431-494` |
| "[number] [difficulty] description" removed | Not present | n/a |
| "Custom bank only" removed | Not present | n/a |
| README item-image tutorial | Present | `README.md:155-180` |

## Decisions & assumptions

- "That prompt" (item 15) is ambiguous — most likely the onboarding/how-to-play tutorial. It auto-shows for new users via `tutorialSeen` (`app-shell.tsx:35-37`, `how-to-play.tsx`). Left as an open question rather than blocking.
- The in-memory battle timer survives app-tab switches but is lost on hard refresh / new browser tab. This is the one genuine fairness gap worth fixing server-side.
- No test suite exists; validation is lint + typecheck + manual repro.

## Remaining tasks

### 1. Harden battle timer against refresh / new tab (substantive change)
Problem: `TIMER_DEADLINES` is a client-only `Map` in `battle-screen.tsx`. It survives switching app tabs within a session but is lost on hard refresh, resetting the question timer to a fresh 30 s (unfair extra time).
Fix:
- Add `questionDeadlineAt?: number` (epoch ms) to `IBattle` in `src/lib/models.ts`.
- Set it when a battle starts in `POST src/app/api/battle/route.ts`, and refresh it on each answer in `src/app/api/battle/[id]/answer/route.ts`.
- In `BattleScreen`/`QuestionTimer` (`battle-screen.tsx`), read the deadline from the initial battle state and prefer it over `Date.now() + QUESTION_TIME*1000`; keep the in-memory map as a fallback.
Files: `src/lib/models.ts`, `src/app/api/battle/route.ts`, `src/app/api/battle/[id]/answer/route.ts`, `src/components/quizrpg/battle-screen.tsx`.

### 2. Verify & clarify equip/unequip validation
Confirm unequip sends only `{action, slot}` (no itemId required) and the route accepts it; ensure field-specific error messages. Expected: no code change unless repro shows otherwise.
Files: `src/app/api/equip/route.ts`, `src/components/quizrpg/equipment-view.tsx`.

### 3. Verify gold/gem drops on official win
Confirm drops are awarded (`$inc gold/gems`) and displayed in the BattleScreen explanation strip and result dialog. Already implemented; validate manually.
Files: `src/app/api/battle/[id]/answer/route.ts:119-131`, `battle-screen.tsx:402-407`.

### 4. Confirm Bank UI / admin labels
Confirm maker buttons present in Bank tab; admin sections labelled Players/Admins/All; "Category approvals" lists pending categories from all players. No change expected.
Files: `question-bank-view.tsx`, `admin-view.tsx`.

### 5. Minor polish (optional)
- Equipment modal layout to match the select-then-click-equip mockup (already close).
- README tweaks (already has item-image section).

## Data flow / failure modes (timer change)
- New `questionDeadlineAt` is optional for backward compatibility with existing battle docs.
- Client falls back to `Date.now() + 30s` if the field is absent (old battles).
- Deadline is set once at battle start and not extended by answering (each question keeps its own deadline keyed by `battleId:questionNumber:questionId`).
- On answer, the server writes the new battle doc; the client receives the next question and continues from the stored deadline.

## Rollout / migration
- No data migration needed (field is optional).
- Deploy backend + frontend together; old clients ignore the new field.

## Validation
- `npm run lint` (eslint) — must pass
- `npx tsc --noEmit` — must pass
- Manual repro steps:
  1. Register a new account, equip starter gear, unequip a slot → succeeds, no required-fields error.
  2. Start an official battle and win → gold/gems increase; shown in UI.
  3. Start a battle, switch app tabs, resume → timer continues (not reset to 30 s).
  4. As a player, create a category → visible only to you; submit for approval → admin can approve to OFFICIAL.

## Open questions
- Which "prompt" should be checked/finished (item 15)? Likely the how-to-play onboarding tutorial, which already auto-shows via `tutorialSeen`. Clarify if a different prompt is meant.
- Whether server-stored battle deadline (task 1) is in scope, or if client-side persistence is acceptable.
