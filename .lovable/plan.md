

# Restrict Report Regeneration + Add Pick Dispute System

## Overview
Two changes: (1) Lock down the "Regenerate Report" button to admin-only, and (2) add a "Dispute Pick" feature where any participant can flag a specific pick rating with reasoning, which the admin can then use to trigger an AI re-evaluation of just that pick.

## Changes

### 1. Restrict Regenerate Report to Admin Only
**`src/pages/DraftDetailPage.tsx`**
- Change the regenerate button guard from `canManage` (creator OR admin) to `isAppAdmin` only
- Keep the initial "Generate Report" button available to all participants (first-time generation)

### 2. Create `draft_pick_disputes` Table
New migration:
```sql
CREATE TABLE public.draft_pick_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  pick_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.draft_pick_disputes ENABLE ROW LEVEL SECURITY;
-- Everyone can view disputes for transparency
CREATE POLICY "Disputes viewable by authenticated" ON public.draft_pick_disputes FOR SELECT TO authenticated USING (true);
-- Users can submit disputes
CREATE POLICY "Users can create disputes" ON public.draft_pick_disputes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Admin can update disputes
CREATE POLICY "Admin can update disputes" ON public.draft_pick_disputes FOR UPDATE TO authenticated USING (is_app_admin(auth.uid()));
-- Admin can delete disputes
CREATE POLICY "Admin can delete disputes" ON public.draft_pick_disputes FOR DELETE TO authenticated USING (is_app_admin(auth.uid()));
```

### 3. Add Dispute UI on Pick Ratings
**`src/pages/DraftDetailPage.tsx`**
- Add a small flag icon button next to each pick rating score (visible to all participants)
- Clicking opens a dialog with the pick text, current score, current explanation, and a textarea for "Why do you think this rating is wrong?"
- Submit inserts into `draft_pick_disputes`
- Show a small badge/indicator on picks that have pending disputes

### 4. Admin Dispute Resolution Panel
**`src/pages/DraftDetailPage.tsx`**
- Below the results section (admin-only), show pending disputes with the pick, current score, and user's reasoning
- Each dispute gets a "Re-evaluate" button that calls a new edge function
- Also a "Dismiss" button to reject the dispute

### 5. New Edge Function: `resolve-pick-dispute`
**`supabase/functions/resolve-pick-dispute/index.ts`**
- Accepts: `dispute_id`
- Admin-only (verify via `is_app_admin` RPC)
- Fetches the dispute, the original pick, the draft topic, and the user's reasoning
- Sends the single pick back to AI with the dispute context: "A user has disputed this rating because: [reason]. Re-evaluate this pick considering their argument."
- AI returns a new score and explanation for just that one pick
- Updates the `pick_ratings` JSONB in `draft_results` for that specific pick
- Recalculates `total_score` by summing all pick scores
- Re-ranks all participants using the same tiebreaker cascade
- Updates the dispute status to `resolved`
- Triggers season standings recalc if applicable

### 6. Notification
- Toast feedback to the disputing user ("Dispute submitted") and to admin on resolution

## Files Modified
1. **`src/pages/DraftDetailPage.tsx`** — Restrict regenerate to admin, add dispute flag button + dialog, add admin dispute panel
2. **`supabase/functions/resolve-pick-dispute/index.ts`** — New edge function for AI re-evaluation of a single pick
3. **Migration** — New `draft_pick_disputes` table

