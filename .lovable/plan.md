## Goal

Cleanly close out **Season 1** (verify podium + stats render correctly) and provide a polished, commissioner-only flow to **package it up and start Season 2**.

---

## Current state (verified from DB)

Season 1 (`Season 1 / 2026 spring`) is marked `complete` and has all 6 playoff matches finished:

- **Champion**: `af6cbf3c…` (won Finals 2-0 as #1 seed)
- **Runner-up**: `4fba7a48…` (#3 seed, lost Finals 0-2)
- **3rd Place**: `743babc8…` (won 3rd-place match)
- **Reg-season Champ**: `af6cbf3c…` (rank #1, 76 pts)

**But** the `champion_user_id`, `runner_up_user_id`, `third_place_user_id`, `regular_season_champion_user_id`, `archived_at`, and `summary` columns are all `NULL` — so the podium component renders blank and the Seasons Archive list doesn't show a champion.

There is also **no UI anywhere** to create a new season; `createSeason()` exists in code but is never called.

---

## Plan

### 1. Backfill Season 1 trophy data

Run a one-time data update setting:
- `champion_user_id`, `runner_up_user_id`, `third_place_user_id`, `regular_season_champion_user_id`
- `archived_at = now()`
- `summary` = `{ finalized_at, series_score: { championId: 2, runnerUpId: 0 }, finals: [...g1, g2], third_place_match_id }`

This makes the existing Season 1 archive page light up: podium displays the three players, archive card shows the champion line, and the "Archived" pill appears.

### 2. Verify display surfaces (no code changes needed if data is correct)

Spot-check after backfill:
- **/drafts/seasons** → Season 1 card shows trophy + champion name, "Complete" pill
- **/drafts/seasons/:id** → Podium with 3 players, full standings, playoff bracket, all 12 regular drafts list
- **/compete (League tab)** → Season 1 still surfaces with "Season Complete" cta linking to archive

### 3. Add the "Start Next Season" commissioner flow

Today there is no way to advance the league. Add:

**a. New season-launch sheet** (`src/components/draft/StartNextSeasonSheet.tsx`)
- Bottom sheet form with: Season name (default "Season 2"), year, season label (winter / spring / summer / fall), starts-at, ends-at, regular-season drafts (default 12), best-of (default 10).
- Pre-fills sensible defaults based on the previous season.
- Calls existing `createSeason()`, then sets `commissioner_user_id` to the same user as Season 1's commissioner (or current user if commissioner is null), and toasts success.

**b. "Start Next Season" CTA on the CompetePage League tab**
- Visible **only when**:
  - The latest/current season's `status === 'complete'`, AND
  - Current user is an app admin OR was the previous season's commissioner.
- Renders directly under the "Season Complete" card as a gold-bordered glass-card with `Sparkles` icon and a "Start Season 2" button that opens the sheet.

**c. Refresh on creation**
- After successful create, refetch `useCurrentSeason` (re-mount or expose a refetch). The new active season takes over the League tab automatically because `useCurrentSeason` already prefers `regular_season` / `playoffs` rows over completed ones.

### 4. Small polish on the archive page

- Add a subtle "Final Results" banner above the podium showing `Champion · Runner-up · 3rd Place` names in one line, mirroring the trophy colors. Helps when scrolling on mobile.
- (No schema changes.)

---

## Technical details

- **Files created**: `src/components/draft/StartNextSeasonSheet.tsx`
- **Files edited**: `src/pages/CompetePage.tsx` (CTA + sheet wiring), `src/pages/SeasonArchiveDetailPage.tsx` (final-results banner), `src/hooks/useDraftSeasons.ts` (export a `refetch` from `useCurrentSeason`, helper `setSeasonCommissioner`).
- **Database**: one-time `UPDATE` on `draft_seasons` for Season 1 (no schema migration; uses insert/update tool). No new tables, no RLS changes — `draft_seasons` already has commissioner-write policies.
- **Permission gating**: reuse existing `isAppAdmin` (from `user_roles`) + `commissioner_user_id` check. No new role infrastructure.
- **Idempotency**: backfill uses fixed user IDs derived from playoff results so re-running is safe.

---

## Out of scope

- No changes to playoff scoring, advance-playoffs edge function, or standings recalc.
- No automatic "auto-create next season" — staying explicit/commissioner-driven.
- No bulk season-import or cross-season leaderboards beyond the existing `LifetimeStatsCard`.
