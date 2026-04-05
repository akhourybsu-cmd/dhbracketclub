

# Tiebreaker Logic for Draft Rankings

## Current Problem
When two participants have the same total score, the rank is determined by the arbitrary order the AI returns them — essentially random.

## Proposed Tiebreaker Cascade
When total scores are tied, apply these rules in order until the tie is broken:

1. **Highest single-pick score** — The participant with the better "best pick" wins. This rewards having at least one standout selection.
2. **Count of elite picks (score ≥ 8)** — More high-quality picks indicates stronger overall drafting.
3. **Lowest single-pick score (higher is better)** — The participant with the better "worst pick" wins. This rewards consistency and penalizes bad picks.
4. **Average pick score** — Acts as a fallback normalizer (relevant if pick counts ever differ).
5. **Earlier final pick** — If still tied, the participant who finished drafting first wins (using `draft_picks.created_at` of their last pick). This is a rare, neutral fallback.

## Technical Change
One file: `supabase/functions/rate-draft/index.ts`

Replace the simple `.sort((a, b) => b.total_score - a.total_score)` with a multi-factor comparator that extracts max score, count of 8+ picks, min score, and average from each participant's `pick_ratings` array. If all factors are still equal, use the `picks` data to compare last-pick timestamps.

No database or UI changes needed — ranks and points are already derived from the sorted order.

