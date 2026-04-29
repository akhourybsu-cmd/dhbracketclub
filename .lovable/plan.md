# Surface Co-op Operation Navigation Across Nexus

## Problem

The new async co-op **Operation** mode is essentially hidden:

- The Nexus Home card linking to `/nexus/operation` only renders when an operation is **already active**. If none exists, there's no way to reach the page (so admins can't start one, and players can't see the "next op coming" state).
- The Home nav grid only has 3 tiles: Sector Map / Leaderboard / Codex.
- The Sector Map (`NexusMissionsPage`) doesn't surface Endless or Co-op at all.
- The HUD has no quick link.
- There's no solo entry to Endless mode either — the only route into `ENDLESS_MISSION_ID` is the operation card, creating a chicken-and-egg loop.
- The Admin Hub has shortcuts for Calibration and Balance, but not for Operations management.

## Goal

Make the Co-op Operation hub reachable from every natural Nexus surface, in both "active op" and "no active op" states, on mobile-first layouts, without disturbing the existing solo campaign flow.

## Changes

### 1. `src/pages/NexusHomePage.tsx` — always-visible Co-op tile

- Keep the rich "active operation" card when `operation` exists (unchanged).
- When `operation` is null, render a **muted "Co-op Operation · standby"** card in the same slot that still links to `/nexus/operation`, so admins can enter and start a new one and players see the mode exists.
- Expand the bottom nav grid from `grid-cols-3` to `grid-cols-2` on row 1 (Co-op + Sector Map prominent) and `grid-cols-3` on row 2 (Leaderboard / Codex / Endless), OR simpler: switch the existing 3-tile row to 4 tiles with Co-op added. Use the simpler 4-tile approach with `grid-cols-4` and tighter sizing — purple Co-op tile, distinguishable from the cyan campaign tiles.

### 2. `src/pages/NexusMissionsPage.tsx` — surface Endless + Co-op

Add a "Special Operations" section above or below the campaign mission list with two cards:

- **Endless Defense (Solo)** → `/nexus/loadout/{ENDLESS_MISSION_ID}` — amber-themed, "Survive as long as you can. Standalone leaderboard."
- **Club Co-op Operation** → `/nexus/operation` — purple-themed, shows live phase/progress chip when an op is active, "Standby" chip otherwise. Uses the existing `useActiveOperation` hook.

This also fixes the broken solo-Endless entry path.

### 3. `src/components/nexus/NexusHUD.tsx` — quick link in HUD

- Add a small purple **Users** icon button next to the Trophy/Codex button (or replacing one based on context). It pulses subtly when an operation is active. Links to `/nexus/operation`.
- Visible on every Nexus screen except `/nexus/battle/*` (HUD already hides there).
- Hide on `/nexus/operation` itself to avoid redundancy.

### 4. `src/components/profile/AdminHub.tsx` — admin shortcut

Add a third Nexus admin entry:
- `{ icon: Users, label: 'Nexus Co-op Operations', description: 'Start, monitor, end club operations', to: '/nexus/operation', iconColor: 'primary' }`

### 5. `src/pages/NexusLoadoutPage.tsx` — context banner for Endless

When the loadout page is opened for `ENDLESS_MISSION_ID`:
- If `?op=<id>` query param is present, show a small purple banner: "Contributing to: {operation.name} · Phase {n}".
- Otherwise show: "Solo Endless run — standalone score, no co-op contribution." with a link to `/nexus/operation` to opt into the active op (if one exists).

This makes the difference between solo-Endless and co-op-Endless explicit, and gives a soft cross-link.

## Visual / Interaction Notes

- Purple `hsl(280 80% 65%)` family is already established as the Co-op color (used in the existing home card).
- All new touch targets ≥ 44px (per Mobile Interaction Standards memory).
- "Standby" state uses muted purple (40% opacity surface, dotted border) to read as inactive without disappearing.
- Pulse dot on HUD button only when `operation?.status === 'active'`.
- No new realtime channels — reuse `useActiveOperation()` which is already deduped per-mount.

## Out of Scope

- No changes to the contribution formula, RPC, calibration, telemetry, modifiers, or battle engine.
- No new realtime subscriptions or tables.
- No changes to the solo campaign mission list ordering or unlock logic.
- No redesign of the Operation hub page itself.

## Files Touched

- `src/pages/NexusHomePage.tsx` — standby card + 4-tile nav grid
- `src/pages/NexusMissionsPage.tsx` — Special Operations section
- `src/components/nexus/NexusHUD.tsx` — Co-op quick button
- `src/components/profile/AdminHub.tsx` — admin shortcut row
- `src/pages/NexusLoadoutPage.tsx` — Endless context banner

## Manual Verification After Build

1. Visit `/nexus` with no active op → Co-op standby card and tile both visible and tappable.
2. Visit `/nexus` with an active op → existing rich card still shows + HUD button pulses.
3. From `/nexus/missions`, both Special Operations cards lead to the right destinations.
4. Open `/nexus/loadout/100` directly (solo) and via `?op=...` (co-op) — banner differs.
5. Admin Hub shows new Co-op Operations row for global admin only (existing AdminHub gating).
6. HUD Co-op button appears on Hub, Missions, Loadout, Results, Leaderboard, Codex; hidden on Battle and Operation pages.
