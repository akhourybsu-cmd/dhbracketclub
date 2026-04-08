

# Add Inline Pick Editing for Admins

## Overview
Add an "Edit pick text" capability so admins (and draft creators) can tap a pick, edit the text inline, and save — across all drafts regardless of ownership. The RLS policies already permit admin updates on `draft_picks`.

## Changes (single file: `src/pages/DraftDetailPage.tsx`)

### 1. New State
- `editingPickId: string | null` — tracks which pick is being edited
- `editPickText: string` — the current edited text
- `savingPick: boolean` — loading state during save

### 2. Edit Handler Functions
- `handleStartEditPick(pick)` — sets `editingPickId` and `editPickText`
- `handleSavePickEdit()` — updates `draft_picks` row's `pick_text` via Supabase, resets enrichment for that pick to `pending` (so it re-enriches with new text), then calls `fetchData()`
- `handleCancelEditPick()` — clears editing state

### 3. UI Changes — Pick Action Buttons
In both the in-progress pick list (~line 837) and the completed results pick list (~line 1136), add a **Pencil icon button** next to the existing Trash button, visible when `canManage || pick.user_id === user?.id`:

```
{(canManage || pick.user_id === user?.id) && (
  <div className="flex items-center gap-0.5">
    <button onClick={() => handleStartEditPick(pick)} title="Edit pick">
      <Pencil className="w-3 h-3" />
    </button>
    <button onClick={() => setPickToRemove(pick)} title="Remove pick">
      <Trash2 className="w-3 h-3" />
    </button>
  </div>
)}
```

### 4. Inline Edit Mode
When `editingPickId === pick.id`, replace the `EnrichedItemCard` label display with an inline input + save/cancel buttons:

```
<div className="flex items-center gap-2 w-full">
  <Input value={editPickText} onChange={...} className="h-8 text-sm" autoFocus />
  <Button size="sm" onClick={handleSavePickEdit} disabled={savingPick}>
    <Check className="w-3 h-3" />
  </Button>
  <button onClick={handleCancelEditPick}>
    <X className="w-3 h-3" />
  </button>
</div>
```

### 5. Save Logic
```typescript
const handleSavePickEdit = async () => {
  if (!editingPickId || !editPickText.trim()) return;
  setSavingPick(true);
  // Update pick text
  await supabase.from('draft_picks').update({ pick_text: editPickText.trim() }).eq('id', editingPickId);
  // Reset enrichment so it re-matches
  await supabase.from('item_enrichments').update({ status: 'pending', matched_name: null, image_url: null, thumbnail_url: null, metadata: {}, confidence: 0 }).eq('item_id', editingPickId);
  setEditingPickId(null);
  fetchData();
  fetchEnrichments();
  setSavingPick(false);
  toast.success('Pick updated');
};
```

## Files Modified
1. **`src/pages/DraftDetailPage.tsx`** — Add edit state, edit handlers, pencil button in pick actions, inline edit input mode

## Summary
- Admins get a pencil icon on every pick to edit the text inline
- Saving updates the pick and resets enrichment for re-matching
- Works on both in-progress and completed draft views
- No database changes needed — RLS already permits admin updates

