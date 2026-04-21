

## Playoff Control Center — guided portal for advancing the playoffs

The playoff machinery (advance + topic-picker + bracket) is already wired correctly, but it's scattered and unguided. Members hit the Playoff Picture and see static cards with no clear "what now?" Commissioners have to dig into a management drawer to trigger Advance Playoffs. Let's add a dedicated **Playoff Control Center** that consolidates state, status, and next actions in one mobile-first card — visible to everyone, with role-aware CTAs.

### What this builds

A new `PlayoffControlCenter` component that renders just above the Playoff Picture during `regular_season` and `playoffs` seasons. It is the **single source of "what happens next"** for the entire playoff lifecycle.

```text
┌─────────────────────────────────────┐
│ 🏆 PLAYOFF CONTROL CENTER           │
│ Status pill: Regular Season / Live  │
├─────────────────────────────────────┤
│ Current step (live, contextual):    │
│ • "Play-In: #4 vs #5 — waiting for  │
│    Alex to choose topic"            │
│   [Choose topic ✦]  ← if you're picker│
│   [Open Draft →]    ← if draft live │
├─────────────────────────────────────┤
│ Next steps timeline (3 dots):       │
│ ✓ Regular Season  ● Play-In  ○ Semis│
├─────────────────────────────────────┤
│ Action row:                         │
│ [Advance Playoffs] [How it works ⓘ] │
└─────────────────────────────────────┘
```

### 1. Active match surface (always visible to everyone)

For each match in `awaiting_topic`, `pending`, or `in_progress` state, render a single high-priority row with:
- Round label (`Play-In`, `Semi 1`, `Semi 2`, `Final G2`, `3rd Place`)
- Both players + seeds
- A **clear status sentence** like *"Waiting for Alex (higher seed) to pick the topic"* or *"Draft is live — go make your picks"*
- A **single primary CTA** that adapts:
  - `awaiting_topic` + you're the picker → **"Choose Topic ✦"** (opens existing TopicPickerDialog)
  - `awaiting_topic` + not picker → muted **"Nudge Picker"** (toast-only "Reminder sent" stub for now, no infra needed)
  - `pending` / `in_progress` → **"Open Draft →"**
  - `complete` → muted "Final · Winner: X"

Sort matches: `awaiting_topic` first, then `in_progress`, then `pending`, then `complete`. Show only the top 3 to keep it scannable.

### 2. Lifecycle status pill + timeline

A small horizontal stepper showing where the season is:
`Regular Season → Play-In → Semis → Finals → Champion Crowned`
The current step glows gold; completed steps get a checkmark; future steps stay muted.

Auto-derived from `season.status` and the highest-progress completed round in `matches`.

### 3. "Advance Playoffs" — promoted out of the Commissioner panel

Move the **Advance Playoffs** button out of the Commissioner drawer and into the Control Center action row. Keep it visible to everyone (the edge function is idempotent and safe), but show a friendly subtitle:
- If nothing to advance: button is **muted** with text *"Up to date · auto-advances after each draft"*
- If there's progress to score / next round to spawn: button is **gold** with text *"Tap to score completed games and create the next round"*

Detection logic: look for any `m.draft_id` whose underlying draft is `complete` but `m.status !== 'complete'`, OR any qualifying-round transition gap (e.g. SF done but no Final created). When detected, surface as ready-to-act.

### 4. "How it works" — replaces the duplicated PlayoffFormatGuide blocks

A compact **inline expandable** (chevron) that shows the existing `PlayoffFormatGuide` content. Removes the need to render the format guide three separate times in `PlayoffPicture` (currently rendered in all three states). Format guide stays as the same component — just relocated/dedupped.

### 5. First-time-in-playoffs onboarding hint

When `season.status === 'playoffs'` and there are zero completed playoff matches yet, prepend a one-line dismissible banner inside the Control Center:
*"🏆 Playoffs have started! Higher seeds pick topics, then both players draft. First to clinch wins the round."*
Uses `localStorage` key `playoff_onboarding_dismissed_{seasonId}`.

### Files to touch

- **`src/pages/CompetePage.tsx`**
  - Add new `PlayoffControlCenter` component (just above where `PlayoffPicture` is rendered).
  - Render `<PlayoffControlCenter season={season} matches={matches} standings={standings} userId={user?.id} onUpdate={handleSeasonUpdate} />` between `StandingsCard` and `PlayoffPicture`.
  - Remove the three duplicate `<PlayoffFormatGuide />` renders inside `PlayoffPicture` (the Control Center owns the guide now).
  - Remove the **Advance Playoffs** button from `CommissionerPanel` (it now lives in the Control Center for everyone).
  - The existing `TopicPickerDialog` is reused — Control Center opens it the same way `PlayoffPicture` does.

### Why this works

- **One place to look.** The Control Center answers "what should I do?" at a glance.
- **No backend changes.** All the edge functions (`advance-playoffs`, `start-playoff-match`, `suggest-playoff-topics`) already exist and are idempotent.
- **Doesn't replace the bracket.** The Playoff Picture stays as the visual map; the Control Center is the *action* layer.
- **Mobile-first.** Compact stack, single-CTA-per-row, no horizontal scroll.

### Manual testing checklist after build

- View as non-commissioner during regular season → see status pill + format guide, no scary buttons.
- View as #4 seed when Play-In is `awaiting_topic` → see "Choose Topic ✦" as primary CTA.
- View as #5 seed at same moment → see "Waiting for #4 to pick topic" with muted Nudge.
- Complete a playoff draft → return to Compete → "Advance Playoffs" button glows gold, tapping it scores + spawns next round.
- After Final clinch → Control Center collapses to a Champion banner.

