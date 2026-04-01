

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
```

RLS: viewable by authenticated users, insertable/updatable by draft creator.

`pick_ratings` stores per-pick AI scores:
```json
[{ "pick_id": "...", "pick_text": "...", "score": 8.5, "explanation": "Strong choice because..." }]
```

Points awarded: 1st = N pts (N = participant count), 2nd = N-1, down to last = 1 pt.

### 2. New Edge Function — `rate-draft`

- Receives `{ draft_id }`
- Fetches draft topic, participants, picks via service role
- Calls Lovable AI (Gemini) with structured tool calling to rate each pick 1-10, explain why, rank participants, and summarize each person's draft
- Upserts results into `draft_results`
- Returns the full report

### 3. New Hook — `src/hooks/useDraftResults.ts`

- Queries `draft_results` for the draft
- Mutation to invoke the `rate-draft` edge function
- Loading/error state management

### 4. UI Changes — `DraftDetailPage.tsx`

In the "Draft Complete" section, add:
- Auto-trigger AI rating on first load if no results exist
- Trophy podium (1st/2nd/3rd) with scores and point awards
- Expandable participant cards showing per-pick ratings (score badge + explanation)
- AI summary text per participant
- Loading shimmer while generating
- "Regenerate Report" button for draft creator

### Files Changed

| File | Change |
|------|--------|
| Migration | New `draft_results` table + RLS policies |
| `supabase/functions/rate-draft/index.ts` | New — AI rating edge function |
| `src/hooks/useDraftResults.ts` | New — fetch/trigger results hook |
| `src/pages/DraftDetailPage.tsx` | Add AI report section to completed drafts |

