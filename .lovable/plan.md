

# Fix Draft Order Randomization Bug

## Problem
The creator of every draft always ends up with pick_order 1 (first pick), despite the Fisher-Yates shuffle code existing. Queried all 11 completed/in-progress drafts — the creator is at position 1 in every single one. The probability of this happening by chance is effectively zero.

## Root Cause
The shuffle updates via `Promise.all` on individual `.update()` calls likely fail silently — Supabase's `.update()` without `.throwOnError()` doesn't throw on zero-rows-affected results. Even if RLS permits it, individual updates in parallel may race or fail without surfacing errors.

## Fix (single file: `src/pages/DraftDetailPage.tsx`)

### 1. Add `.throwOnError()` to each shuffle update
Add `.throwOnError()` to the `.update()` calls inside the `Promise.all` so failures are caught and surfaced.

### 2. Verify shuffle results before proceeding
After the `Promise.all` completes, re-fetch participants to confirm the new pick_orders took effect. Use the re-fetched data (not the local `shuffled` array) to set `current_pick_user_id`.

### 3. Add a small sequential fallback
If `Promise.all` still fails, fall back to updating participants sequentially with error logging — this ensures at least one approach works.

### Updated `handleStartDraft` logic:
```typescript
const handleStartDraft = async () => {
  if (!draftId || !canManage) return;
  if (participants.length < 2) {
    toast.error('Need at least 2 participants');
    return;
  }
  setStarting(true);
  try {
    // Fisher-Yates shuffle
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Update pick_order sequentially with error handling
    for (let idx = 0; idx < shuffled.length; idx++) {
      const { error } = await supabase
        .from('draft_participants')
        .update({ pick_order: idx + 1 })
        .eq('id', shuffled[idx].id);
      if (error) throw error;
    }

    // Start the draft with the first shuffled participant
    const { error } = await supabase.from('drafts').update({
      status: 'in_progress',
      current_round: 1,
      current_pick_number: 1,
      current_pick_user_id: shuffled[0].user_id,
    }).eq('id', draftId);
    if (error) throw error;

    toast.success('Draft started! Order randomized 🎲');
    fetchData();
  } catch (err: any) {
    toast.error(err.message || 'Failed to start');
  } finally {
    setStarting(false);
  }
};
```

Key change: sequential updates instead of `Promise.all` to avoid race conditions, plus explicit error checking on each update.

## Files Modified
1. **`src/pages/DraftDetailPage.tsx`** — Fix `handleStartDraft` shuffle persistence

