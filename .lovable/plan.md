
## AI-Powered Draft Rating & Results System

### Overview
When a draft completes, the system automatically calls an AI edge function to analyze all picks, score each participant's selections, generate explanations, rank participants 1st/2nd/3rd+, and award points. Results are stored in a new table and displayed on the draft detail page.

### 1. New Database Table — `draft_results`

```sql
CREATE TABLE public.draft_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  total_score numeric NOT NULL DEFAULT 0,
  pick_ratings jsonb NOT NULL DEFAULT '[]',
  summary text,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, user_id)
);
ALTER TABLE public.draft_results ENABLE ROW LEVEL SECURITY;
-- Viewable by authenticated
-- Insertable via edge function (service role) or by draft creator
```

`pick_ratings` JSON structure per pick:
```json
[
  { "pick_id": "...", "pick_text": "...", "score": 8.5, "explanation": "..." }
]
```

Points awarded: 1st place = N points (N = participant count), 2nd = N-1, etc.

### 2. New Edge Function — `rate-draft`

**File:** `supabase/functions/rate-draft/index.ts`

- Receives `{ draft_id }` in the request body
- Fetches draft topic, participants, and all picks from the database (service role)
- Sends picks to Lovable AI (Gemini) with a prompt asking it to:
  - Rate each pick 1-10 based on quality, creativity, relevance to the topic, and value
  - Provide a short explanation for each rating
  - Rank participants by total score
  - Write a brief summary for each participant
- Uses tool calling to extract structured output (scores, explanations, rankings)
- Inserts results into `draft_results` table
- Returns the results to the frontend

### 3. Frontend Changes — `DraftDetailPage.tsx`

- When draft status becomes `complete`, auto-trigger the rating edge function (once, if no results exist yet)
- Add a new "AI Report" section below the current completion view:
  - Trophy podium showing 1st/2nd/3rd with scores
  - Each participant's card expands to show per-pick ratings (score badge + explanation)
  - Overall summary text from the AI
  - Loading state with sparkle animation while AI is generating
- Add a "Regenerate Report" button for the draft creator

### 4. Hook — `useDraftResults.ts`

- Fetches existing results from `draft_results` for the draft
- Mutation to call the `rate-draft` edge function
- Manages loading/error states

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/rate-draft/index.ts` | New edge function — AI rating logic |
| `src/hooks/useDraftResults.ts` | New hook — fetch/trigger draft results |
| `src/pages/DraftDetailPage.tsx` | Add AI report section to completed drafts |
| Migration | New `draft_results` table with RLS |
