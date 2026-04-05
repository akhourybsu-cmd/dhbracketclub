

# Draft UI Enhancement: Fun Elements & Comprehensive Stats

## Overview
Enhance the draft experience with celebratory animations, an "on the clock" experience, and deep pick-level statistics — all using existing data (especially the `picked_at` timestamps already stored on every pick).

---

## Part 1: Fun & Engaging UI Elements

### 1A. Confetti on Draft Completion
- Fire the existing `<Confetti>` component when results first load on a completed draft
- Trigger once per session (use a `useRef` flag)

### 1B. Pick Announcement Animation
- When a new pick lands via realtime, show a brief full-width "toast-style" banner that slides in at the top of the pick history: **"🔥 Alex K. picks Nirvana — Round 2, Pick #4"** with a spring animation, then collapses after 3 seconds
- Adds drama to live drafts without disrupting flow

### 1C. "On the Clock" Live Timer
- When it's your turn, show a live elapsed-time counter (stopwatch style) below the "Your Turn" banner: `⏱ 0:12`
- Uses `Date.now()` minus the timestamp of the last pick (or draft start). Purely cosmetic — no enforcement
- Pulses gold after 60 seconds for gentle urgency

### 1D. Streak & Fire Indicators on Picks
- In pick history, if a player makes 3+ consecutive picks all scored ≥ 7.5 (from `pick_ratings`), show a 🔥 streak badge next to their name
- In results view, highlight the longest scoring streak per player

### 1E. "MVP Pick" Highlight in Results
- The single highest-scored pick across all participants gets a special gold-bordered card with a ⭐ "MVP Pick" label in the results section

---

## Part 2: Comprehensive Draft Statistics

### 2A. Per-Draft Stats Panel (new section on completed draft page)
A collapsible "Draft Stats" card shown below the podium on completed drafts, displaying:

| Stat | Source |
|------|--------|
| **Fastest Pick** | Min time between consecutive `picked_at` timestamps per user |
| **Slowest Pick** | Max time delta |
| **Average Pick Time** | Mean time per player |
| **Highest Single Pick** | Max score from `pick_ratings` across all participants |
| **Most Consistent** | Player with lowest score variance (std dev) |
| **Biggest Steal** | Latest-round pick with the highest score |
| **Total Draft Duration** | First pick `picked_at` to last pick `picked_at` |

All computed client-side from existing `draft_picks.picked_at` and `draft_results.pick_ratings` data.

### 2B. Enhanced Drafts List Stats Card
Expand the existing 3-stat card (Total Pts / Wins / Rated) to include:
- **Avg Score** — average `total_score` across rated drafts
- **Best Finish** — highest rank achieved (e.g., "1st")
- **Podiums** — count of top-3 finishes

### 2C. Per-Player Pick Time in Results Accordion
When expanding a player's result card, show their average pick time and fastest pick time as small stat pills alongside their pick ratings.

---

## Technical Approach

### Files Modified
1. **`src/pages/DraftDetailPage.tsx`** — Add Confetti import, on-the-clock timer, pick announcement banner, stats panel, MVP pick highlight, streak badges
2. **`src/pages/DraftsListPage.tsx`** — Expand stats card with avg score, best finish, podiums
3. **`src/lib/draftStats.ts`** (new) — Pure utility functions to compute timing stats, streaks, MVP pick, consistency scores from picks + results data

### No Database Changes
All stats are derived from existing columns:
- `draft_picks.picked_at` (timestamp) — for all timing stats
- `draft_results.pick_ratings` (jsonb) — for scoring streaks, MVP, consistency
- `draft_results.total_score`, `rank`, `points_awarded` — for aggregate stats

### No Edge Function Changes
Everything is computed client-side from data already fetched.

### Design
- All new elements use existing design tokens (`glass-card`, `stat-card`, Arena Edge motif, gold/emerald palette)
- Animations use Framer Motion (already imported)
- Timer uses JetBrains Mono (tabular data font per design system)
- Stats panel uses the existing collapsible accordion pattern

