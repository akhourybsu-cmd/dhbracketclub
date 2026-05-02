
# Draft Arena — Visual Consistency Pass

The shell (`DraftArenaLayout` + HUD + Boot + `.da-mode`) is in place and the gold/charcoal palette renders correctly inside `/drafts/*`. But the five draft pages still use generic DH chrome (`glass-card`, `bg-muted/40` back buttons, emerald `text-primary` accents, `bg-success` status pills). Inside the gold arena shell those primitives feel borrowed from the main app instead of from the Arena.

Goal: push the gold + charcoal identity all the way down through every draft page, while keeping every hook, query, realtime subscription, status string, and route exactly as-is.

## What changes (and what doesn't)

Changed: surface colors, status-pill palette, back-button skin, page-header icon tints, "season chip" treatment, skeleton shimmer color, hero card glow on `DraftDetailPage`, and a few cross-page `text-primary` → gold swaps **only where it visually clashes inside the arena**. Status meaning and labels stay identical ("Setup" / "In Progress" / "Complete").

Not touched: `DraftArenaLayout`, `DraftArenaHUD`, `DraftArenaBoot`, `DraftArenaExitDialog`, `App.tsx` routing, `AppLayout.tsx` chrome guard, `CompetePage` Draft Arena enter banner, draft engine, snake logic, AI suggestions, enrichment, scoring, repick, dispute system, podium logic, league standings math, push payloads, share URLs, db schema.

## 1. New shared CSS utilities (`src/index.css`, append to the existing `.da-mode` block)

Add a small set of reusable arena-flavored primitives so pages can opt into the look without inline-styling every card:

- `.da-glass` — gold-tinted variant of `glass-card` (charcoal gradient, hairline gold border, soft inner highlight). Used for primary content cards inside `/drafts/*`.
- `.da-back` — back-button skin for the gold-on-charcoal aesthetic (replaces inline `bg-muted/40`).
- `.da-page-icon` — gradient-filled icon tile (gold radial → emerald floor) for page headers.
- `.da-status-setup`, `.da-status-live`, `.da-status-complete` — three status pill variants tuned for the arena background. Live = emerald (kept), Complete = **gold** (instead of emerald primary) to read as "trophy", Setup = neutral charcoal.
- `.da-divider` — 1px gold/8% horizontal rule for in-card section breaks.
- `.da-shimmer` — overrides `skeleton-shimmer` color stops so loading skeletons inside `/drafts/*` shimmer in warm gold instead of cool grey.

These additions are namespaced inside `.da-mode` selectors where appropriate, so they only apply inside the Arena shell. DH Club pages remain untouched.

## 2. `DraftsListPage.tsx`

- Replace the page-header icon block with `.da-page-icon` (already gold-tinted; removes inline `style={{ background: ... }}`).
- Swap "Seasons" / "Create" buttons to the gold arena treatment (`.da-cta` for Create, ghost-gold outline for Seasons). Keeps icons and routes.
- Cumulative stats card: `glass-card` → `.da-glass`. Divider line uses `.da-divider`.
- Draft row cards: keep the existing `.draft-row-live` / `.draft-row-mine` / `.arena-edge` modifiers (they already work in arena), but switch the base `glass-card` to `.da-glass` and update `statusConfig`:
  - `setup` → `.da-status-setup`
  - `in_progress` → `.da-status-live` (still emerald — reads as "live now")
  - `complete` → `.da-status-complete` (gold instead of emerald primary)
- Skeleton shimmer rows use `.da-shimmer`.
- Empty state icon tile re-uses `.da-page-icon`.

## 3. `DraftDetailPage.tsx` (surgical, large file)

Only the **chrome** changes; nothing in the pick/edit/dispute/playoff logic moves.

- Header card wrapper (around L818): `glass-card` → `.da-glass`, with the gold edge shimmer (`draft-edge-shimmer`) re-enabled on the hero so it reads as "in the arena".
- Status pill (L862–871): swap the three branch classes to `.da-status-setup` / `.da-status-live` / `.da-status-complete`.
- Stat cards row (Players / Picks / Round, L906–922): keep structure, but the three icons standardize on gold (`hsl(var(--gold))`) — `Trophy` for Round currently uses `text-primary`, switch to gold for arena consistency.
- "Season Draft #" chip (L924–928) and "Add to Season" CTA (L929–947): already gold — leave as-is.
- "Spectating" pill (L949–956): change `bg-muted/40 border-border/40` → `.da-pill` variant (muted charcoal with gold hairline) so it doesn't look like a stray DH chip.
- "Enriching picks with AI…" strip (L989–991): `text-primary` → gold for arena consistency.
- Pick-history round dividers and the fresh-pick sweep keep their existing animations (already arena-flavored from the previous pass).
- Inline pick input cards (L1316, L1141 backgrounds): the inline `hsl(var(--card))` backdrops get a subtle gold inner-glow when it's the active picker's row — uses an extra `style` layer, no structural changes.
- Report card "Draft Complete 🎉" + "Generating draft report…" (L1502–1521): emerald `text-primary` → gold so the trophy moment reads as gold-trophy, not emerald-active.
- Per-pick rating chips (L1690): keep emerald for mid-scores, but elevate the 8+ "elite" tier to gold border to feel arena-special.

All `bg-muted/30 border-border/30` "card-on-card" sub-blocks (disputes list, pick rows in the report) get a quieter charcoal recipe so they don't fight the gold arena background.

## 4. `CreateDraftPage.tsx`

- Back link `<Link to="/drafts" className="back-link">` → `.da-back` styling (kept as a Link, just restyled).
- `page-header-icon` → `.da-page-icon`.
- Form card `glass-card` → `.da-glass`.
- Round-selector active state: `bg-primary text-primary-foreground` (emerald) → gold (`background: linear-gradient(...gold...)`, dark text). This single change makes the form feel arena-native.
- Submit button: `Button` keeps its component but gains `.da-cta` className for the gold gradient.

## 5. `SeasonsArchivePage.tsx`

- Back button `bg-muted/40` → `.da-back`.
- `page-header-icon` already gold via inline style — leave as-is, but add `boxShadow` consistency via `.da-page-icon`.
- `STATUS_PRESET` palette swap:
  - `upcoming.cls` → `.da-status-setup`
  - `regular_season.cls` → `.da-status-live` (kept emerald = active)
  - `playoffs.cls` → keeps gold (already gold)
  - `complete.cls` → `.da-status-complete` (gold trophy, not emerald primary)
- Skeleton rows use `.da-shimmer`.
- `SeasonCard` `glass-card` → `.da-glass`. The active-season gold left-border stays. Archived rows get a subtle silver left-border (`hsl(var(--silver))`) so the active vs archived distinction stays sharp inside the gold shell.

## 6. `SeasonArchiveDetailPage.tsx`

- Back button `bg-muted/40` → `.da-back`.
- All `glass-card` → `.da-glass`.
- "Final" podium strip (L99–131) and "Season in progress" card (L142–160): already gold-tinted via inline styles — keep, but standardize the inline `border` to use the same `hsl(45 80% 50% / 0.18)` as `.da-glass` so they sit flush with surrounding cards.
- Sub-sections (`bg-muted/20`, `bg-muted/30`) inside Standings, Playoff Bracket, Drafts list: replace with a tokenized `.da-subcard` (charcoal 35% over arena bg, 1px gold-8 hairline) — same density, but reads as one continuous arena material.
- Top-3 standings rows (L205): keep `bg-gold/5 border-gold/15` — already on-palette.
- "View Live" mini-button (L154–158) → `.da-cta` (small variant via inline height override).

## 7. Skeleton + loading polish across all five pages

Every existing skeleton block (`.skeleton-shimmer`) renders cool grey, which clashes inside the warm gold shell. Adding `.da-shimmer` overrides the gradient stops to a faint gold sweep over charcoal. No layout shift, no extra DOM — purely a class swap.

## 8. Accessibility / contrast checks

- Gold-on-charcoal status pills: tuned to AA at 12px/600 — `hsl(45 95% 65%)` text on `hsl(45 95% 55% / 0.12)` background passes against the charcoal arena floor.
- Live emerald pill stays at current contrast (already AA).
- Back-button focus ring: `.da-back` adds `focus-visible:ring-1 ring-gold/40` so keyboard nav remains visible on the dark shell.

## 9. Files touched

Edited:
- `src/index.css` — append `.da-glass`, `.da-back`, `.da-page-icon`, `.da-status-*`, `.da-divider`, `.da-shimmer`, `.da-subcard` inside the existing `.da-mode` block.
- `src/pages/DraftsListPage.tsx` — class swaps + `statusConfig` palette.
- `src/pages/DraftDetailPage.tsx` — chrome-only swaps in the header/stat-row/status-pill/report sections.
- `src/pages/CreateDraftPage.tsx` — back link, form card, round selector, submit button.
- `src/pages/SeasonsArchivePage.tsx` — back button, status preset palette, season card surfaces.
- `src/pages/SeasonArchiveDetailPage.tsx` — back button, all card surfaces, sub-card recipe.

Not edited:
- `src/components/drafts/DraftArenaLayout.tsx`, `DraftArenaHUD.tsx`, `DraftArenaBoot.tsx`, `DraftArenaExitDialog.tsx`.
- `src/App.tsx`, `src/components/AppLayout.tsx`.
- `src/pages/CompetePage.tsx` (the enter banner is already correct).
- Any draft hook, lib, or edge function.

## 10. Implementation order after approval

1. Add the new `.da-*` utilities to `src/index.css`.
2. Reskin `DraftsListPage` (most-visited surface, fastest visual win).
3. Reskin `DraftDetailPage` chrome (largest file, surgical).
4. Reskin `CreateDraftPage`, `SeasonsArchivePage`, `SeasonArchiveDetailPage` (small, parallelizable edits).
5. Visual QA: viewport 411×734 and 390×844, walk `/drafts → /drafts/:id (setup, live, complete) → /drafts/seasons → /drafts/seasons/:id → /drafts/create`, confirm no DH-blue/emerald chrome leaks into the arena and no layout shift.

