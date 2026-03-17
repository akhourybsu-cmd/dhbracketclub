

## AI-Powered Suggestions for Create Pages

### What we're building
When a user types a title/topic on any create page (Poll, Ranking, or Draft), a "Suggest" button appears. Tapping it calls an AI edge function that returns ~5-8 relevant suggestions based on the title. Suggestions appear as tappable chips that quick-add to the list.

### Architecture

**1. Edge Function: `suggest-items`**
- Accepts `{ title: string, type: "poll" | "ranking" | "draft", existingItems: string[] }`
- Uses Lovable AI (`google/gemini-3-flash-preview`) via tool calling to return structured JSON: `{ suggestions: string[] }`
- System prompt tailored per type: poll options vs ranking items vs draft pick ideas
- Returns 5-8 short, distinct suggestions, excluding any `existingItems`
- CORS headers, 429/402 error handling

**2. Shared React hook: `useAISuggestions`**
- New file: `src/hooks/useAISuggestions.ts`
- Takes `title`, `type`, `existingItems`
- Debounced fetch on demand (not auto — user clicks a button)
- Returns `{ suggestions, loading, fetchSuggestions }`
- Calls `supabase.functions.invoke('suggest-items', ...)`

**3. Shared UI component: `AISuggestions`**
- New file: `src/components/AISuggestions.tsx`
- Shows a "Suggest with AI" button (sparkle icon) next to the items section header
- Displays loading shimmer while fetching
- Renders suggestions as horizontal-wrapping chips with a `+` icon
- Tapping a chip calls `onAdd(text)` and removes it from the visible list
- Fits the existing glass-card dark premium aesthetic

**4. Integration into 3 create pages**

- **CreatePollPage**: Button appears next to "Options" header. `onAdd` fills next empty option or appends a new one (up to 10 max).
- **CreateRankingPage**: Button appears next to "Items to Rank" header. `onAdd` fills next empty item or appends (up to 20 max).
- **CreateDraftPage**: No item list on create page (items are picked during the draft). Instead, show suggestions below the topic as "Draft pick ideas" inspiration text — non-interactive, just helpful context. Or skip draft entirely since picks happen live.

Actually, for Draft the create page has no items list — picks happen during the live draft. So AI suggestions apply to **Poll** and **Ranking** create pages only. For drafts, we could add suggestions on the DraftDetailPage during picking, but that's a separate feature.

### Files to create/edit

| File | Action |
|------|--------|
| `supabase/functions/suggest-items/index.ts` | Create edge function |
| `src/hooks/useAISuggestions.ts` | Create shared hook |
| `src/components/AISuggestions.tsx` | Create shared UI component |
| `src/pages/CreatePollPage.tsx` | Wire in suggestions for poll options |
| `src/pages/CreateRankingPage.tsx` | Wire in suggestions for ranking items |
| `supabase/config.toml` | Add `suggest-items` function config |

### Edge function prompt strategy
```
System: You suggest items for a fun private friend group competition app.
Given a {type} titled "{title}", suggest 5-8 short, distinct options.
Exclude these already-added items: {existingItems}.
Keep suggestions fun, relevant, and concise (1-5 words each).
```
Uses tool calling to extract `{ suggestions: string[] }` — no raw JSON parsing.

### UX flow
1. User types topic/question (e.g. "Best Fast Food Chains")
2. User taps sparkle "Suggest" button next to the items header
3. Loading shimmer appears for ~1-2s
4. 5-8 chip suggestions appear (e.g. "McDonald's", "Chick-fil-A", "In-N-Out", ...)
5. User taps a chip → it fills the next empty slot or appends a new row
6. Chip disappears after being added
7. User can tap "Suggest" again for more ideas

