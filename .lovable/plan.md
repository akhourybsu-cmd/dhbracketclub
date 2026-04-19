

## Pick'em Final Polish Plan

Goal: bring NFL Pick'em up to the same premium "Arena" bar as Drafts/Lockbox before 2026 kickoff. No new features — pure visual + microinteraction polish.

### Pages to polish
1. **PickemHomePage** — hero, season status, CTA hierarchy
2. **PickemWeekPage** — slate header, game cards, tiebreaker
3. **PickemWeekResultsPage** — recap header, leaderboard
4. **PickemStandingsPage** — podium + table feel
5. **PickemHistoryPage** — week chips + record summary
6. **PickemRulesPage** — typography + section rhythm
7. **PickemAdminPage** — admin density (lower priority, tighten only)

### Polish themes (applied across)

**Visual identity**
- Adopt Pick'em accent: NFL navy + gold-on-emerald accent already in module identity. Use `gold` for "picked" state, `emerald` for "correct", `destructive` for "wrong" — already consistent, just unify hues.
- Replace flat `glass-card` headers with the seasonal hero pattern (gold radial glow + Arena Edge motif) used on League dashboard for the home/standings hero.
- Add `<TeamLogo>` glow on selected pick (subtle gold ring + scale 1.02).

**Typography & spacing**
- Page titles: bump to `text-[26px] font-extrabold tracking-tight` to match Drafts.
- Section headers: small uppercase eyebrow chips (e.g., "THIS WEEK", "STANDINGS") with `text-[10px] tracking-[0.14em] text-muted-foreground`.
- Tighter consistent spacing: `space-y-4` between sections, `space-y-2` within lists.

**Empty / pre-season states** (critical for 2026 — currently shows nothing)
- Premium empty state on home: large gold gradient NFL shield icon + "Inaugural 2026 Season — Kickoff Sept 10" countdown chip + "Schedule drops in May 2026" subtitle.
- Empty week page: skeleton-style placeholder game cards (3 ghosted) with "Schedule not yet imported" overlay.

**Microinteractions**
- Tap-to-pick: spring scale (Framer `whileTap={{scale:0.97}}`) + soft gold glow pulse on selected button.
- Pick saved: brief checkmark badge that fades in over the team logo (existing `Check` icon, animate `scale-in`).
- Week navigator: snap-scroll chips with active gold underline that animates with `layoutId`.
- Week status pill: keep live pulse, add subtle `animate-fade-in` on status change.
- Results page: stagger-in leaderboard rows (`motion.div` with `delay: i * 0.04`).
- Confetti trigger when week is fully scored and user finishes top-3 (reuse existing `<Confetti>`).

**Game card refinements** (`GamePickCard.tsx`)
- Increase team name weight, add `min-h-[68px]` for cleaner thumb targets.
- "@" divider → vertical separator with "VS" label in extra-small caps.
- Lock badge: replace text "LOCKED" with subtle muted lock icon + greyscale logos.
- Final scores: bigger, more tabular, winner team gets faint emerald background tint across full row.

**Tiebreaker card**
- Promote to a featured panel with gold border accent + "TIEBREAKER" eyebrow + featured-game team logos preview.

**Standings/leaderboard**
- Top 3 podium row at top (reuse Draft podium aesthetic, scaled down): 2nd-1st-3rd pillars with gold/silver/bronze glow.
- Current user row: persistent sticky highlight with gold left border.

**Loading skeletons**
- Replace any spinner/blank with the standardized shimmer skeletons used on Feed/Events.

### Out of scope
- No data model or RLS changes.
- No new routes.
- Admin page gets light tightening only (consistent button sizes, spacing).

### Files to touch
- `src/pages/PickemHomePage.tsx`
- `src/pages/PickemWeekPage.tsx`
- `src/pages/PickemWeekResultsPage.tsx`
- `src/pages/PickemStandingsPage.tsx`
- `src/pages/PickemHistoryPage.tsx`
- `src/pages/PickemRulesPage.tsx`
- `src/components/pickem/GamePickCard.tsx`
- `src/components/pickem/TiebreakerInput.tsx`
- `src/components/pickem/WeekNavigator.tsx`
- `src/components/pickem/WeekStatusPill.tsx`
- (light) `src/pages/PickemAdminPage.tsx`

### QA after build
- 411×734 mobile viewport: every page screenshot, check for overflow, tap targets ≥44px, safe-area respected.
- Console clean, no layout shift on data load.
- Verify empty states render cleanly with the current 2026-upcoming-no-schedule data state.

