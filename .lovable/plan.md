

# Seasons Homepage Visual Polish Plan

## 1. Current Strengths

- **Solid data hierarchy**: Season header → This Week → Standings → Playoffs → History → Lifetime Stats flows logically
- **Gold accent consistency**: Season-related elements use the `--gold` token consistently, establishing Draft League identity
- **Glass-card system**: The existing `glass-card` and `arena-edge` CSS classes provide premium depth
- **Expandable standings rows**: Tapping a player to reveal detailed stats is a good interaction pattern
- **Playoff bracket preview**: Showing all 5 seeds with their path (BYE / Semis / Play-In) is clear and informative
- **Status pill on season header**: Quick at-a-glance season phase identification
- **Mobile-first sizing**: Text sizes and padding are appropriately scaled for phone viewports

## 2. Current Weaknesses

- **Hero area is underwhelming**: The Season Header card looks like any other card — same `glass-card` treatment, no visual weight. It should feel like a *banner*, not a list item.
- **Visual monotony**: Every section uses the same `glass-card` with identical border radius, padding, and depth. Nothing stands out — standings look the same as schedule, which looks the same as lifetime stats.
- **No season progress indicator**: There's no visual sense of "where are we in the season?" — no progress bar, no countdown, no week-over-week momentum.
- **Standings feel flat**: The standings table is functional but reads like a settings list. The leader isn't celebrated. The gap between 1st and 2nd isn't visualized.
- **"This Week" card is too subtle**: The most actionable section (current week's draft) blends in with everything else. It should be the primary CTA.
- **Playoff bracket is text-heavy**: The bracket preview section is a wall of tiny text lines. It needs visual structure — connector lines, or at minimum, distinct round groupings.
- **Season Schedule is a plain list**: Week history has no visual indication of results, wins, or point outcomes. It's just a list of links.
- **Lifetime Stats grid feels utilitarian**: 3x2 grid of numbers with no visual emphasis on the most impressive stat (championships).
- **No "race narrative"**: There's no sense of who's hot, who's close, what the points gap is. The standings are static numbers.
- **Quick action buttons at the bottom feel orphaned**: "All Drafts" and "New Draft" buttons sit alone at the bottom with no card wrapper.

## 3. Visual Direction Recommendation

The Seasons homepage should feel like opening the **league app on game day** — a premium sports dashboard that immediately tells you the competitive story.

**Design principles:**
- **Layered depth**: Hero area should use the `arena-edge` motif with a richer gold glow (not emerald). Interior sections should use varying card treatments.
- **Gold as the seasonal accent**: Lean into `--gold` more aggressively for the league context — it distinguishes Draft League from the emerald base palette.
- **Contrast through hierarchy**: The hero and standings should feel "elevated" above schedule and stats sections.
- **Restrained motion**: Use `framer-motion` staggered entrances (already partially in place) but add subtle scale-in for the hero.
- **Typographic hierarchy**: Hero title should be larger and bolder; section headers should use consistent weight but smaller size; stat numbers should use `font-extrabold` with `tabular-nums`.

## 4. Section-by-Section Plan

### A. Season Hero Banner (currently SeasonHeaderCard)
**Elevate significantly.** This should be the page's visual anchor.

- Add a **gold-tinted radial glow** behind the card (similar to `--gradient-hero` but using `--gold`)
- Increase title size from `text-lg` to `text-xl` or `text-2xl`
- Add a **season progress bar** below the stats row showing weeks completed out of total (e.g., "Week 5 of 8 — Regular Season"). Use the `Progress` component with gold fill.
- Make the status pill larger and more prominent
- Add a subtle pulsing dot next to "Regular Season" status to indicate active
- The 3-stat row (Reg Weeks / Best 6 / Playoffs) is good but should use slightly more visual separation — perhaps small icon badges

### B. This Week's Draft (currently ThisWeekDraft)
**Elevate to primary CTA position.** Move it above standings or give it a distinct treatment.

- Add a **gold left-border accent** (4px solid gold) to distinguish it from regular cards
- If a draft is active/in-progress, add a **pulsing "LIVE" indicator**
- Make the draft topic text larger and bolder
- Add the draft status as a colored status-pill rather than plain text
- When no draft is assigned, the "Create" CTA should be more prominent — use a full-width gold-accent button

### C. Standings Table (currently StandingsCard)
**Add competitive energy.** This is the heart of the page.

- **Leader highlight**: Give the #1 row a subtle gold gradient background (not just an emoji)
- **Points gap indicator**: Show the gap to the player above (e.g., "-3" or "LEADER" badge)
- **Seed badge**: Replace the text "Seed #1" with a small colored badge (gold for #1, silver for #2, bronze for #3)
- **Podium styling**: Top 3 rows should feel visually distinct from rows 4-5
- **"You" row**: If the current user is in standings, give their row a more visible left-border highlight
- **Expanded stats**: The expanded detail grid is good — add subtle dividers between stat cells

### D. Playoff Picture (currently PlayoffPicture)
**Add visual bracket structure.**

- Replace the flat text list with a **mini bracket diagram** using flexbox columns for each round
- Use **connector lines** (CSS borders) between rounds to show advancement paths
- Highlight seed #1's bye with a distinct "BYE" badge (gold background)
- Each matchup should be in its own mini-card within the bracket
- Add round headers (Play-In → Semis → Finals) as column labels
- Keep the helper text at the bottom ("All 5 qualify, #1 gets bye")

### E. Season Schedule (currently SeasonWeekHistory)
**Add result context to each row.**

- Show a **result indicator** per week — green check for completed, current-week highlight, grey for future
- If `season_points_awarded` data is available, show a small "You: +7 pts" badge on each completed week
- Add a subtle alternating row tint for readability
- Consider making this collapsible/accordion — default collapsed after 3+ weeks to reduce page length

### F. Lifetime Stats (currently LifetimeStatsCard)
**Minor polish — add a visual accent to the championship stat.**

- Give the Championships number a gold ring/border or gold background
- Ensure `tabular-nums` font feature for number alignment
- This section is fine as a supporting card — keep it low in the hierarchy

### G. Quick Actions (bottom buttons)
**Wrap in a subtle card or give more intentional spacing.**

- Wrap "All Drafts" and "New Draft" in a single row with card background
- Or remove the card and make them feel like footer actions with more vertical spacing above

## 5. Mobile-First Recommendations

- **Above the fold**: Season Hero + This Week's Draft should both be visible without scrolling
- **Standings**: Always visible, not collapsible — this is core content
- **Playoff bracket**: Keep compact on mobile — a vertical bracket (round-by-round stacked) rather than horizontal
- **Season Schedule**: Collapsible after the current page already gets long with 5+ weeks of history
- **Lifetime Stats**: Fine at the bottom — supporting content
- **Touch targets**: All draft links and standings rows should maintain minimum 44px tap height (currently ~48px via py-3, which is good)
- **Avoid horizontal scroll**: The bracket section must stack vertically on small screens

## 6. Top 5 Highest-Impact Improvements

1. **Season Hero upgrade** — Add gold glow, progress bar, and larger typography to make the season identity unmissable
2. **Standings leader treatment** — Differentiate the top 3 rows visually so the race feels real and competitive
3. **This Week elevation** — Make the current draft the most actionable element with gold accent border and status pill
4. **Card differentiation** — Break the visual monotony by using at least 3 distinct card treatments (hero, content, supporting)
5. **Playoff bracket visualization** — Replace the text-list bracket with a structured mini-bracket diagram

## 7. Recommended Implementation Order

1. **Hero area** — Season banner with gold glow, progress bar, larger type
2. **Card differentiation** — Distinct treatments for hero vs. content vs. supporting cards
3. **Standings polish** — Leader highlight, seed badges, points gap, podium row styling
4. **This Week elevation** — Gold accent border, live indicator, prominent CTA
5. **Playoff bracket** — Structured visual bracket with connector lines and round labels
6. **Season Schedule** — Result indicators, collapsible behavior
7. **Mobile polish + motion** — Staggered entrance timing, final spacing pass, touch target verification

