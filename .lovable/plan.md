## Goal

Turn the NFL Pick'em section into a true standalone module (like Rune Delve and Nexus Defense). When a user enters `/pickem/*`, the DH Club bottom nav, sidebar, and page chrome disappear. They land in a branded football "broadcast app" with its own boot intro, sticky HUD banner, exit dialog, and shell-only spacing rules. Plus a polished pass on mobile spacing and legibility.

This is a presentation-only change. Routes, data, hooks, picks, standings, scoring, admin — all preserved.

## What the user will experience

1. Tap "Pick'em" anywhere in the app → a brief "PICK CENTER" boot animation plays once per session (gold field-light reveal, "Connecting to broadcast feed…" sequence).
2. They land on the Pick'em hub with **no DH bottom tab bar, no sidebar** — just a stadium-themed app that fills the screen.
3. A sticky **Pick'em HUD banner** sits at top: gold shield emblem, "Pick Center" title, contextual subtitle ("Weekly Slate", "Standings Race", "Pick History", "Final Recap"), small Week chip, and back button.
4. Back button on the hub opens an "Exit Pick Center?" confirmation dialog (matches Nexus pattern). On any other Pick'em page, it returns to the hub.
5. Mobile spacing reviewed across every player-facing page — readable typography, comfortable touch targets, no clipped text, safe-area aware.

## File changes

### New files

```text
src/components/pickem/PickemLayout.tsx     — shell wrapper (skin + HUD + boot)
src/components/pickem/PickemHUD.tsx        — sticky top banner (back, emblem, title, week chip)
src/components/pickem/PickemBoot.tsx       — one-time stadium-light boot intro
src/components/pickem/PickemExitDialog.tsx — "Exit Pick Center?" confirmation
src/assets/pickem-emblem.png               — gold shield emblem (generated)
```

### Edited files

```text
src/App.tsx                          — wrap /pickem/* routes in <PickemLayout>
src/components/AppLayout.tsx         — add isPickem to isGameShell so chrome is hidden
src/index.css                        — add `.pk-mode` / `.pk-shell` skin tokens; tighten mobile spacing in pk-stadium
src/pages/PickemHomePage.tsx         — drop PickemShell wrapper (HUD owns the chrome now); spacing pass
src/pages/PickemWeekPage.tsx         — same: replace shell with HUD-driven layout
src/pages/PickemStandingsPage.tsx    — same
src/pages/PickemHistoryPage.tsx      — same
src/pages/PickemRulesPage.tsx        — same
src/pages/PickemWeekResultsPage.tsx  — same
src/components/pickem/PickemShell.tsx — keep for backwards compat but reduced to a thin pass-through (or removed if no other consumers)
```

## Implementation notes

### Layout pattern (mirrors Nexus / Rune Delve)

- `PickemLayout` wraps every `/pickem/*` route. Applies `.pk-mode .pk-shell` to a full-viewport div, mounts `PickemHUD` and `PickemBoot`, then renders children inside a `max-w-[640px] mx-auto px-3 sm:px-5 pt-3` container with `padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))`.
- `AppLayout` already has `isGameShell` logic — we add `const isPickem = location.pathname.startsWith('/pickem')` and include it in `isGameShell`. Hides bottom nav and desktop sidebar; removes the default page padding.

### HUD banner

- Sticky top, `z-40`, `safe-area-inset-top` aware.
- Left: 44×44 back button. On `/pickem` (hub) → opens `PickemExitDialog` → `navigate('/compete')`. On every other route → `navigate('/pickem')`.
- Center: gold shield emblem + "Pick Center" wordmark + contextual subtitle ("Weekly Slate", "Standings Race", "Pick History", "How to Play", "Final Recap", "Admin").
- Right: compact week chip (e.g. `WK 1` or `PRE`) and a quick-jump trophy icon to standings (hidden on standings page itself).

### Boot intro

- Plays once per browser session, gated by `sessionStorage['pk_boot_played_v1']`.
- ~1300ms total. Stages: "Tuning broadcast feed…" → "Loading season…" → "Pick Center online".
- Visuals: deep stadium gradient background, animated yard-line shimmer, gold shield emblem with rotating ring, "DH · NFL Pick Center" wordmark, gold progress bar with pulsing % counter.

### Skin tokens (`.pk-mode`)

Add a small token block scoped to `.pk-mode` so future styling can reference module-specific variables instead of hardcoded HSL:

```text
--pk-field:    160 50% 3%     (deep field)
--pk-edge:     152 30% 18%    (panel border)
--pk-gold:     45 95% 55%     (broadcast accent)
--pk-emerald:  152 72% 46%
--pk-white:    0 0% 100%
```

`.pk-mode` forces white foreground, overrides `text-muted-foreground` to a brighter neutral, and applies a global radial vignette + faint hash-mark layer so all child pages feel unified — replaces what `.pk-stadium` was doing per-page.

### Mobile spacing & legibility refinements

- Standardize page top padding to `pt-3` (HUD already provides visual separation) and bottom to `pb-6` (no nav bar to clear).
- Tighten hero spacing: `px-4 py-4` instead of `px-5 py-5`; H1 reduced from 28px → 24px on small phones to prevent wrap.
- Action tile grid: 2-column with `gap-2`; tile min-height bumped to 110px so labels never clip.
- Game card matchup buttons: ensure `min-h-[72px]`, abbr font-size 14px (up from 13), team name `text-[10.5px]` with `truncate`.
- WeekStatusPill: enforce `whitespace-nowrap` and `min-h-[24px]` so it never collides with title.
- Back button → 44×44 (touch target standard).
- Standings rows: row min-height `56px`, rank chip 32×32, no truncation on display name (uses `min-w-0` + `truncate` only when needed).
- All headings use `tracking-tight`; all stats use `tabular-nums`.
- Ensure every page wraps in `min-h-[calc(100dvh-4rem)]` so short pages still fill the screen and the dark stadium reads.

### Asset

A new `src/assets/pickem-emblem.png` (gold shield with stylized football), referenced by the HUD and Boot. Generated at 256×256 with transparent background.

### Backwards compatibility

`PickemShell` (introduced last loop) becomes unused once each page renders directly into `PickemLayout`. Either delete it or keep as a re-export from `PickemLayout` for safety. Plan: delete to avoid drift.

## What stays the same

- All routes (`/pickem`, `/pickem/week/:n`, `/pickem/week/:n/results`, `/pickem/standings`, `/pickem/history`, `/pickem/rules`, `/pickem/admin`).
- All hooks (`useActiveSeason`, `useCurrentWeek`, `useWeekGames`, `useMyWeekPicks`, `useSeasonStandings`, etc.).
- All Supabase calls (`savePick`, `saveTiebreaker`, scoring tables, RLS).
- Admin page is untouched apart from being inside the same shell so navigation remains accessible.
- `TurfBackdrop`, `GamePickCard`, `PickSlipBar`, `KickoffCountdown`, `WeekStatusPill`, `WeekNavigator`, `TiebreakerInput`, `TeamLogo` — all reused as-is.

## Out of scope

- Admin page redesign (kept inside the shell so admins can still reach it from the HUD trophy → standings → admin tile, but no visual rework).
- New gameplay features, scoring changes, or copy beyond the HUD/boot wording.
- Push notifications or sound effects (Pick'em audio is a separate future task).

## QA checklist (post-implementation)

- Boot plays once per session at `/pickem`, then never again until the tab is closed.
- Bottom DH nav and desktop sidebar disappear on all `/pickem/*` routes.
- HUD back button: from hub → exit dialog → `/compete`. From any sub-page → returns to `/pickem`.
- Week chip in HUD updates correctly (PRE, WK 1, WK 18, etc.).
- Safe-area insets respected on iPhone notch (HUD top, content bottom).
- All headings, week labels, team names render without clipping at 320px width.
- Standings podium, leaderboard, and history rows have ≥44px tap targets.
- Switching theme (light/dark in DH Club) does not affect Pick'em — it's always the dark stadium skin.
