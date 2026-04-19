

## Playoff System — 3-Round Head-to-Head with AI-Generated Topics

### Current state
- `draft_playoff_matches` table exists with the right shape (round, match_number, seed_a/b, user_a/b, draft_id, winner)
- Visual `PlayoffPicture` bracket already renders matches if they exist
- **Missing**: nothing actually creates matches, generates the H2H draft, or advances winners

### New playoff format (per your direction)
Every playoff round is a **head-to-head 1v1 mini-draft** with an **AI-generated topic** unique to that matchup. **3 rounds** total, all 5 seeds qualify:

```
Round 1 — QUARTERFINAL (Play-In)
  M1:  #4 seed  vs  #5 seed         (#1, #2, #3 get byes)

Round 2 — SEMIFINALS
  M1:  #1 seed  vs  M1 winner       (lowest remaining seed)
  M2:  #2 seed  vs  #3 seed

Round 3 — CHAMPIONSHIP
  M1:  Semi M1 winner  vs  Semi M2 winner
```

Each match = a real draft (`drafts` row) with exactly 2 participants, AI-generated topic, snake-style, normal scoring. Winner = higher `total_score` from `draft_results`.

### Implementation

**1. New edge function: `generate-playoff-draft`** (Lovable AI / Gemini 2.5 Pro)
- Input: `{ seasonId, round, matchNumber, userA, userB, seedA, seedB }`
- AI generates a fresh, fun, never-before-used topic (passes prior season topics for variety) — e.g. "Top 5 movie villains of all time", "Best pizza toppings"
- Creates a `competitions` row + `drafts` row (`num_rounds: 5`, `status: 'setup'`, topic from AI, category inferred)
- Inserts both users as `draft_participants` with random pick_order (Fisher-Yates, per memory)
- Updates `draft_playoff_matches.draft_id` to link
- Returns the new draft id

**2. New edge function: `advance-playoffs`**
- Input: `{ seasonId }`
- Logic:
  - **Trigger transition**: if `season.status === 'regular_season'` AND all regular drafts complete AND all top-5 standings finalized → set `status = 'playoffs'`, write `playoff_seed` (1–5), generate **Round 1** (QF: #4 vs #5)
  - **Advance**: for each completed playoff match (linked draft is `complete`), set `winner_user_id` from highest `total_score`. Then check if the round is complete:
    - QF done → generate Semis (#1 vs QF winner; #2 vs #3)
    - Semis done → generate Final (SF1 winner vs SF2 winner)
    - Final done → set `season.status = 'complete'`
- Idempotent (safe to re-run)

**3. Auto-trigger hooks**
- Call `advance-playoffs` from `CompetePage` mount + visibility-change (alongside existing `recalculateSeasonStandings`) when `season.status` is `regular_season` or `playoffs`
- Also expose a manual "Advance Playoffs" button in `CommissionerPanel` for safety

**4. UI updates to `PlayoffPicture` (existing component)**
Update the existing 3-column bracket render to:
- Column 1: QF (1 match — #4 vs #5)
- Column 2: SF (2 matches)
- Column 3: Final (1 match)
- Each match card shows: AI topic, both players with seeds, status pill (Pending / In Progress / Complete + winner), "Open Draft" link if `draft_id` exists
- Champion banner above bracket once Final is decided

**5. Lifetime stats**
`useLifetimeStats` already counts `round = 'final'` wins as championships — keep that, and the new round names will be `'qf' | 'sf' | 'final'`.

### Files touched
- **NEW**: `supabase/functions/generate-playoff-draft/index.ts`
- **NEW**: `supabase/functions/advance-playoffs/index.ts`
- **NEW**: `supabase/migrations/<timestamp>_playoff_round_constraint.sql` — drop any old round CHECK if it exists; allow `'qf' | 'sf' | 'final'`. (Schema shows no constraint, so likely a no-op confirmation.)
- `src/hooks/useDraftSeasons.ts` — add `advancePlayoffs(seasonId)` helper that invokes the edge function
- `src/pages/CompetePage.tsx` — auto-invoke advance on mount/visibility; rewrite `PlayoffPicture` bracket layout for QF/SF/Final; add Commissioner "Advance Playoffs" button

### Out of scope
- No changes to regular-season scoring or standings logic
- No changes to the underlying draft engine — playoff drafts use the existing snake draft
- No notifications wiring in this pass (can add later: "Your playoff matchup is ready" push)

### QA
- With a season at `regular_season` and all 12 drafts complete → seeing the bracket auto-generate QF #4 vs #5
- Complete the QF draft → Semis auto-generate with correct pairings
- Complete both Semis → Final auto-generates
- Complete Final → season flips to `complete`, championship counted in Lifetime Stats
- Each generated draft has a distinct AI topic, both users present, snake order randomized

