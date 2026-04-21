

# Rune Delve — Full-Screen Game Shell

Transform Rune Delve from a regular page inside the Compete tab into an immersive, full-screen mobile game mode — with a polished entry transition, hidden app chrome, dedicated in-game HUD, and an explicit exit flow.

## What you'll get

1. **A "Launch Game" entry transition** when tapping Rune Delve from Compete — a short fantasy-themed loading screen (logo, arcane glow, animated rune progress bar, chapter subtitle) before the game shell appears.
2. **Hidden bottom nav + sidebar nav** while inside Rune Delve, so the phone screen feels like a contained game.
3. **A dedicated in-game HUD** at the top of every Rune Delve screen: hero name + class crest, current chapter, Rune Shards balance, and a back/exit control.
4. **A stronger fantasy palette** scoped only to Rune Delve (deeper obsidian background, jewel-tone accents, subtle arcane vignette already present in `.rd-mode`, now extended to the full viewport).
5. **An explicit exit flow** — a back arrow in the HUD that returns the player to `/compete` and restores the normal app chrome. During an active run, exit shows a small "Leave run? Progress this turn will be lost" confirmation; everywhere else exit is one tap.

## Screens touched

All Rune Delve routes (`/rune-delve`, `/levels`, `/play/:n`, `/results/:n`, `/hero`, `/history`, `/leaderboard`, `/shop`, `/armory`) get the same shell treatment so the experience is cohesive — no screen feels like a generic app panel.

## Technical approach

- **`AppLayout.tsx`**: detect `location.pathname.startsWith('/rune-delve')`. When true, hide mobile bottom nav and desktop sidebar, render children edge-to-edge (no `max-w-[640px]` wrapper, no bottom padding for nav).
- **`RuneDelveLayout.tsx`** (existing wrapper): extend to render the full-screen shell — a sticky `RuneDelveHUD` at the top (back button, hero+class crest, chapter pill, shard balance) and a full-bleed scroll container with safe-area padding. Already applies `.rd-mode` skin; we'll deepen the background to a stronger dungeon vignette scoped only here.
- **New `RuneDelveBoot.tsx`**: a one-time boot/loading overlay shown when the user first enters `/rune-delve/*` from outside. Plays for ~1.2s with logo, animated rune progress bar (0→100%), chapter name flavor text. Tracked via a `sessionStorage` flag so it doesn't replay between in-game route changes — only on a real entry from outside Rune Delve.
- **New `RuneDelveHUD.tsx`**: compact 48px-tall sticky bar with back arrow (left), hero name + class emoji + chapter pill (center), `ShardBalance` pill (right). On the active play screen (`/play/:n`), the HUD compresses further and the back button triggers an exit-confirmation sheet.
- **Page cleanup**: remove the per-page "← Back to Compete" links from `RuneDelveHomePage` and other Rune Delve pages (the HUD owns navigation now). Remove the in-page `ShardBalance` from the Home header (HUD owns it).
- **Palette deepening**: extend `.rd-mode` in `index.css` with a stronger full-viewport background (deeper obsidian + faint arcane sigil radial), and a `.rd-shell` class for the full-bleed game container.
- **Exit confirmation**: small `AlertDialog` triggered only when leaving from `/play/:n` mid-run. Other screens exit immediately.
- **State preservation**: no changes to data — React Query cache + Supabase persistence already handle this. Re-entering Rune Delve lands on `/rune-delve` (campaign home), which already shows the "Continue · Level N" CTA.

## Entry / exit flow

```text
Compete tab
   │ tap Rune Delve
   ▼
[Boot overlay: 1.2s — logo, rune progress bar, "Chapter N · Subtitle"]
   │ (sessionStorage flag set)
   ▼
Rune Delve shell — bottom nav HIDDEN, HUD visible
   │ navigate freely between /rune-delve/* (no boot replay)
   │ tap ← in HUD
   ▼
(if /play/:n mid-run → confirm sheet)
   ▼
/compete — bottom nav + sidebar RESTORED
```

## Files

**New**
- `src/components/runedelve/RuneDelveHUD.tsx` — sticky in-game header
- `src/components/runedelve/RuneDelveBoot.tsx` — entry loading overlay
- `src/components/runedelve/ExitRunDialog.tsx` — mid-run exit confirmation

**Edited**
- `src/components/AppLayout.tsx` — hide chrome + remove page padding for `/rune-delve/*`
- `src/components/runedelve/RuneDelveLayout.tsx` — mount HUD + Boot, full-bleed container
- `src/index.css` — deepen `.rd-mode` background, add `.rd-shell` full-bleed utility
- `src/pages/RuneDelveHomePage.tsx` — remove redundant back link + shard pill (HUD owns them)
- `src/pages/RuneDelvePlayPage.tsx` — wire exit confirmation when leaving mid-run
- Light cleanup of redundant back links in `RuneDelveLevelMapPage`, `RuneDelveHeroPage`, `RuneDelveResultsPage`, `RuneDelveLeaderboardPage`, `RuneDelveHistoryPage`, `RuneDelveShopPage`, `RuneDelveArmoryPage`

## Out of scope

- No changes to gameplay, combat, scoring, relics, hero/class progression, or campaign data.
- No changes to other DH Club modules — the chrome-hiding is scoped strictly to `/rune-delve/*`.
- Boot overlay stays under 1.5s — no fake long loading.

