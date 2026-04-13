

# Enforce Tenth-Precision Scoring in Draft Reports

## Problem
The AI currently scores picks in whole numbers or half-point increments (e.g., 7.0, 7.5, 8.0) because the prompt only says "Rate each pick on a scale of 1-10" without specifying precision. This makes scores feel coarse and reduces differentiation between picks.

## Solution
Update the scoring instructions in the AI prompt to explicitly require tenth-of-a-point precision (e.g., 7.3, 8.7, 6.1). This requires changes to two edge functions.

## Changes

### 1. `supabase/functions/rate-draft/index.ts`
- Update the `=== SCORING ===` section (line 133-134) from:
  > "Rate each pick on a scale of 1-10."
  to:
  > "Rate each pick on a scale of 1.0 to 10.0 using tenth-of-a-point precision (e.g. 7.3, 8.7, 6.1). Do NOT round to whole numbers or half-points — every score must reflect a specific tenth. Differentiate meaningfully between similar picks."
- Update the tool schema description (line 183) from `"Score from 1.0 to 10.0"` to `"Score from 1.0 to 10.0, must use tenth precision (e.g. 7.3, not 7.0 or 7.5)"`

### 2. `supabase/functions/resolve-pick-dispute/index.ts`
- Apply the same tenth-precision scoring instruction to the dispute re-evaluation prompt for consistency.

### No migration or UI changes needed
The scores are already stored as `number` type and displayed with `.toFixed(1)` — the UI already supports tenths.

