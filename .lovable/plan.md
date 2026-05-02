
# Plan: Drafts → Standalone "Draft Arena" Experience

Goal: keep all draft logic, pages, and routes intact, but wrap every `/drafts/*` route in a full-screen game shell (own HUD, boot intro, skinned background, no DH bottom nav/sidebar) — exactly like Pick'em / Nexus / Rune Delve. The Compete → League tab becomes a glossy front-facing standings hub with a flashy "Enter Draft Arena" banner that launches into the shell.

## What stays untouched

- All draft data, hooks, realtime subscriptions, season logic, playoff logic.
- `DraftsListPage`, `DraftDetailPage`, `CreateDraftPage`, `SeasonsArchivePage`, `SeasonArchiveDetailPage` — internals unchanged. They simply render inside a new shell.
- All routes keep the same paths. Deep links, push notifications, share URLs continue to work.

## 1. New shell components (mirrors Pick'em)

Create `src/components/drafts/`:

- `DraftArenaLayout.tsx` — wraps children in `.da-mode .da-shell`, mounts HUD + Boot, owns `min-h-[100dvh]` and safe-area padding. Same structure as `PickemLayout`.
- `DraftArenaHUD.tsx` — sticky 12-px header with Back button, gold-on-charcoal skin, emblem, contextual subtitle per route ("Live Draft Room", "Season Archive", "New Draft", "All Drafts"), and a season chip (e.g. `S4 · D7`) pulled from `useCurrentSeason`. Right-side icon button to "Standings" (jumps back to `/compete` league tab).
- `DraftArenaBoot.tsx` — one-shot per session boot intro (sessionStorage key `da_boot_played_v1`) with the existing Bookmark/trophy emblem, gold/emerald glow, rotating dashed ring, 3-stage progress strip ("Loading league data…", "Syncing standings…", "Draft Arena online").
- `DraftArenaExitDialog.tsx` — confirms exit back to `/compete` from the hub route. Copy: "Leave the Draft Arena?".

Skin: reuse the **gold + charcoal** identity already used by SeasonHeaderCard (`hsl(var(--gold))` + `hsl(160 50% 4%)`). This visually distinguishes it from Pick'em (gold+emerald) and Nexus (cyan).

## 2. CSS additions in `src/index.css`

Namespaced under `.da-mode`:

- `.da-shell` ambient background — radial gold glow at top, subtle emerald floor glow, layered charcoal gradient.
- `.da-mote` decorative drifting gold particles (analogous to `.rd-mote`).
- `@keyframes daBootRingSpin`, `daHudShimmer` — already partially covered by existing draft animations; reuse `draftEdgeShimmer` from the previous pass.
- `.da-card`, `.da-pill`, `.da-cta` utility classes so existing draft pages can be lightly upgraded without rewrites.

## 3. Route wrapping in `src/App.tsx`

Wrap the five draft routes:

```text
/drafts                       → <DraftArenaLayout><DraftsListPage/></DraftArenaLayout>
/drafts/create                → <DraftArenaLayout><CreateDraftPage/></DraftArenaLayout>
/drafts/:draftId              → <DraftArenaLayout><DraftDetailPage/></DraftArenaLayout>
/drafts/seasons               → <DraftArenaLayout><SeasonsArchivePage/></DraftArenaLayout>
/drafts/seasons/:seasonId     → <DraftArenaLayout><SeasonArchiveDetailPage/></DraftArenaLayout>
```

## 4. Hide DH chrome on `/drafts/*`

In `src/components/AppLayout.tsx`, extend the `isGameShell` check:

```ts
const isDrafts = location.pathname.startsWith('/drafts');
const isGameShell = isRuneDelve || isNexus || isPickem || isDrafts;
```

Bottom nav and desktop sidebar disappear, exactly as they do for Pick'em.

## 5. Compete → League tab redesign

The "League" tab in `CompetePage.tsx` becomes a **front-facing showcase**, not a launcher to scattered pages. Layout, top to bottom:

1. **Draft Arena Enter Banner** (new, top of column) — flashy hero card mirroring the Rune Delve / Nexus / Pick'em banners but in the gold skin. Emblem (Bookmark/trophy), title "Draft Arena", subline derived from current state ("S4 · Draft 7 of 12 — You're on the clock", or "S4 Playoffs · Round 1 in progress", or "S4 Complete · View champion"), big gold "Enter Arena" CTA → `/drafts`. Pulse glow when there's a draft user can act on.
2. **Season hero** (existing `SeasonHeaderCard`) — kept as-is.
3. **Standings card** (existing `StandingsCard`) — kept as-is, this is the "front-facing standings information".
4. **Playoff picture / control center** — kept.
5. **Season draft history** (existing `SeasonDraftHistory`) — kept; each row still deep-links into `/drafts/:id` (which now opens inside the shell).
6. **Lifetime stats** — kept.
7. **Footer chip row**: trim to a single "Seasons Archive" link; remove the redundant "New Draft" pill (now lives in the Arena HUD/list page).

The League tab keeps DH chrome (it's part of Compete), but every link out goes into the shelled `/drafts/*` routes.

## 6. Polish inside the shelled draft pages

No structural changes — purely surface upgrades that ride on the existing animation utilities from `src/lib/draft/animations.ts`:

- `DraftsListPage`: outer container gets `.da-shell-section` padding tweaks; existing live-row glow and stagger spring already in place from the previous pass — keep.
- `DraftDetailPage`: existing On-the-Clock pulse hero, round dividers, and fresh-pick sweep already in place — keep. Add a subtle gold edge shimmer on the hero card so it feels "in the arena". Realtime is already wired through `useDraftUpdates`.
- `CreateDraftPage`, `SeasonsArchivePage`, `SeasonArchiveDetailPage`: wrap content in a `.da-card` shell so they pick up the arena chrome without touching internal logic.

## 7. Loading / realtime story

- `DraftArenaLayout` renders HUD immediately so navigating between draft pages never shows a blank header (matches Pick'em).
- Each page keeps its own React Query loaders; we add a unified high-fidelity skeleton in `DraftsListPage` and `DraftDetailPage` headers so the layout never shifts during data fetch.
- Realtime: `useDraftListUpdates` + `useDraftUpdates` already update in place. No changes needed — the shell does not interrupt subscriptions.

## 8. Files touched

New:
- `src/components/drafts/DraftArenaLayout.tsx`
- `src/components/drafts/DraftArenaHUD.tsx`
- `src/components/drafts/DraftArenaBoot.tsx`
- `src/components/drafts/DraftArenaExitDialog.tsx`

Edited:
- `src/App.tsx` — wrap 5 draft routes in `DraftArenaLayout`.
- `src/components/AppLayout.tsx` — add `/drafts` to `isGameShell`.
- `src/pages/CompetePage.tsx` — add `DraftArenaEnterBanner` at top of League tab; trim redundant footer chips.
- `src/index.css` — add `.da-mode`, `.da-shell`, `.da-mote`, `.da-card`, `.da-cta` keyframes/utilities.
- Light surface tweaks to `DraftsListPage.tsx` / `DraftDetailPage.tsx` headers (skeletons + arena-edge hero shimmer).

## 9. Out of scope (will not change)

- Draft engine, snake logic, randomization, AI suggestions, enrichment, scoring, repick, dispute system, podium logic, league standings math.
- Push notification payloads, share URLs, deep-link routes.
- Any database schema or edge function.

After approval, I'll implement in this order: shell components → CSS → AppLayout chrome guard → App.tsx route wrap → CompetePage banner & League trim → header skeleton polish.
