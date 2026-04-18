

# DH Club Home — Command Center Refinement

## Audit Findings (current Home: `src/pages/DashboardPage.tsx`)

**Works well**
- Clean hero with monogram + greeting, online presence dots
- Lore tile in quick-create row, smooth animations
- Section dividers + glass cards have a premium feel
- Drafts/Brackets sections handle dismissed/completed states

**Too passive / low-signal**
- Hero only shows "Good morning, Name 👋" + "X active competitions" — no season, no rank, no urgency
- "Your turn" only appears as a small line *inside* a draft card — easy to miss
- 4 quick-create tiles are visually equal (Lore, Draft, Bracket, Lockbox) — doesn't reflect that Drafts/League are the backbone
- No League/Season presence on Home at all, despite being central to the product
- Recent Activity is a flat 6-row list, no priority weighting
- "X active competitions" is a generic counter, not actionable

## Changes (smallest set, no app redesign)

### 1. Hero → Command Strip
Keep the greeting line compact (1 row: monogram + "Hey, Name"). **Add a Season Command Strip directly under the greeting** — a single horizontal row of 3 stat chips:
- **Season** — e.g. `Season 1` (from `useCurrentSeason`)
- **Your rank** — e.g. `2nd` with seed dot color (from `useSeasonStandings` filtered to current user)
- **Progress** — e.g. `Draft 7 of 12` (entries count vs `regular_season_drafts`)

Tappable → routes to `/compete`. Falls back gracefully if no season exists (hides chip strip, keeps greeting).

### 2. New "Needs Your Attention" Block (above quick-create)
Render only when there's ≥1 urgent item. Compact list of 1–3 action chips:
- **Your pick is up** in *<draft topic>* → `/drafts/:id` (gold accent, pulse dot)
- **Playoffs live** if season status = `playoffs`
- **Season ends in N drafts** when ≤2 regular drafts remain
- **Lockbox closes today** (if applicable from existing lockbox hook)

Distinct visual: thin gold left-border stripe, no padding bloat. Hidden entirely when nothing urgent (preserves clean feel for empty states).

### 3. Rebalance Quick Create Tiles
Reorder to reflect real priority and make Drafts visually dominant:
- **Drafts** tile gets a subtle gold gradient halo (slightly brighter)
- Order: `Draft → Lore → Bracket → Lockbox`
- Same 4-col grid, no layout change — just hierarchy via accent intensity

### 4. Drafts Section — sharper status hierarchy
- Sort: **your-turn first**, then in-progress, then setup
- "Your pick!" line promoted to a **left edge gold stripe** on the card (not just text)
- Status pill colors made more distinct: in_progress = success green pulse, setup = muted, on-the-clock-you = gold solid
- Add a tiny "on the clock: Name" chip under topic when in_progress and not your turn (already partly there — just elevate visual)
- Truncate gracefully: ensure `min-w-0` on the flex child (already present — verify)

### 5. League Snapshot card (new, inserted before Drafts section, only if season exists)
Single compact glass card:
- Header: `Season 1 · Draft 7 of 12` + "View League →" link to `/compete`
- Mini top-3 podium: gold/silver/bronze rank dots + display names + season points (one row each, super compact)
- Progress bar: regular-season completion %
- If status = `playoffs`: replace progress bar with "Playoffs Live" badge

Reuses existing hooks (`useCurrentSeason`, `useSeasonStandings`, `useSeasonEntries`) — no new queries to write from scratch.

### 6. Recent Activity — pulse, not noise
- Cap at 5 items (was 6)
- **Promote high-signal events** (`draft_completed`, `bracket_submitted`, `event_created`) with a subtle accent dot
- De-emphasize routine events (`poll_voted`, `event_rsvp`) with reduced opacity
- Keep "Open Feed" link intact (Feed stays accessible)

### 7. Light/Dark polish
- Command-strip chips: use `bg-surface-elevated` with `border-border/40` for clean separation in light mode
- Gold accents already use HSL tokens — verify contrast on light bg, slightly darken `--gold` usage in light mode if needed via existing `.light` overrides
- "Needs Attention" block: gold tint at 8% opacity in dark, 12% in light for parity

### 8. Mobile-first
All new elements sit above the fold on 411×734. Command strip is a single row of 3 chips (~28px tall). Needs-attention block is ≤2 rows. League snapshot ≈140px. No horizontal scroll, all touch targets ≥44px.

## Files to Modify
- `src/pages/DashboardPage.tsx` — hero command strip, needs-attention block, league snapshot, drafts sort/accent, activity tier
- `src/index.css` — minor: needs-attention left-stripe utility, dark/light polish tokens (if needed)

## Files NOT Changed
- Navigation (`AppLayout.tsx`)
- Routes (`App.tsx`)
- Data model / migrations
- Other pages

## Final Output (will summarize after build)
1. Hierarchy: greeting → command strip → needs-attention → quick-create → league snapshot → drafts → brackets → activity
2. Hero: now shows season, rank, draft progress at a glance
3. Urgency: dedicated block surfaces "your turn" + season milestones
4. League/Drafts centrality: snapshot card + gold-accented draft tile + sorted draft list
5. Draft cards: your-turn-first sort, gold left stripe when on the clock, clearer status pills
6. Activity: trimmed to 5, signal events accented, routine events dimmed
7. Light/Dark: chip backgrounds tuned, gold contrast verified
8. Future: easy to add "On this day" lore resurfacing, lockbox urgency hook, playoff bracket teaser — all slot into the new attention block or league snapshot

