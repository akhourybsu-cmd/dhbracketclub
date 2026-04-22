

## Playoffs — fix missing Play-In match so MGMgrandiose can pick a topic

### What's actually happening

Season 1 already flipped to `status = 'playoffs'` on 2026-04-21, and standings are seeded #1–#5 correctly (MGMgrandiose is the #4 seed). But there are **zero rows in `draft_playoff_matches`** — the Quarterfinal (#4 vs #5, the play-in) was never created.

Root cause is in `supabase/functions/advance-playoffs/index.ts`. The QF-creation block is nested *inside* the `if (season.status === "regular_season")` branch. The flow expects: same invocation that flips status to `playoffs` also inserts the QF. Something broke between those two writes on the previous run (likely the season was flipped to `playoffs` manually, or an earlier deploy that didn't include the QF block ran first). Now every subsequent call short-circuits past Phase 1 entirely, so the QF never gets created and MGMgrandiose has no match → no "Choose Topic" CTA on the Compete page.

This is also a latent bug: the QF-creation code is unreachable on any season that's already in `playoffs` status, even though it's written to be idempotent (it checks `existingQF`).

### The fix

**A) Make Phase 1 self-healing.** Restructure `advance-playoffs/index.ts` so the QF-creation block runs whenever:
- season status is `regular_season` AND all regular drafts are complete (existing path), **OR**
- season status is already `playoffs` AND no QF row exists yet (new self-heal path).

The existing `existingQF` length check already makes the insert idempotent, so this just means moving the QF-creation block out of the inner `if/else` and gating it on `(season.status === 'playoffs' || justTransitioned) && standings.length >= 5`. Standings re-fetch happens unconditionally when we need to create the QF.

**B) Backfill Season 1's missing QF immediately.** Once the function is fixed, a single call to `advance-playoffs` for season `c62ab880-19f3-4a36-bf60-ba6a3e6318bb` will insert:

```
round=qf, match_number=1, seed_a=4, seed_b=5,
user_a=a0e950e7-… (MGMgrandiose),
user_b=79ebdb7f-… (seed #5),
topic_picker_user_id=a0e950e7-… (MGMgrandiose),
status='awaiting_topic'
```

Done from the Compete page by anyone (it's a public edge function), or directly from the admin tools page if there's a trigger there. Easiest: I'll just call it from the play page on next mount of the Compete page (it already auto-runs `advance-playoffs` on load — checking next), but we should also one-shot it now.

**C) Verify Compete page surfaces the picker UI.** Already verified: `CompetePage.tsx` lines 712 and 1278 render a "Choose Topic" / gold "✨ Choose topic" button when `match.status === 'awaiting_topic'` and `user.id === match.topic_picker_user_id`. Once the QF row exists, MGMgrandiose will see that button under the Playoff Picture card.

### Files touched

- `supabase/functions/advance-playoffs/index.ts` — lift the QF-creation block so it also runs when season is already in `playoffs` status with no QF row.
- One-shot invoke `advance-playoffs` for season `c62ab880-19f3-4a36-bf60-ba6a3e6318bb` to backfill the QF row.

### Verification

- After deploy + invoke, `select * from draft_playoff_matches` returns one QF row with MGMgrandiose as `topic_picker_user_id` and `status = 'awaiting_topic'`.
- MGMgrandiose loads `/compete` → Playoff Picture card shows the QF, the gold "✨ Choose topic" button is visible to him only.
- Submitting a topic calls `start-playoff-match` → creates the draft, flips match to `pending`, both players see the matchup.
- Seed #5 sees the same match with a "Waiting on MGMgrandiose to choose topic" label, no button.
- Future seasons: when the next one ends, the QF is created in the same edge-function call that flips status. If anything interrupts, the next invocation self-heals.

