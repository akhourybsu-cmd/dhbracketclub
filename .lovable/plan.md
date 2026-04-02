

## Plan: Duplicate Prevention & Enrichment Accuracy Fixes

### Problems Identified

1. **No hard duplicate block** — The current system uses AI to *suggest* a pick might be a duplicate, but nothing stops the user from submitting it anyway. Duplicates can slip through if the AI check hasn't returned yet or the user ignores the warning.

2. **Enrichment mismatch for bands** — When enriching "top bands of the nineties," the system is matching band names to albums/songs instead of the bands themselves. The enrichment function likely searches iTunes or similar sources and picks the first result (an album) rather than the artist.

3. **Data fix needed** — "World of Warcraft" needs to be corrected to "Warcraft" in the video game franchises draft.

---

### Changes

**1. Hard duplicate prevention on pick submission** (`DraftDetailPage.tsx`)

- Add a client-side check in `handleMakePick` that compares the new pick against all existing picks using case-insensitive, trimmed matching
- If a duplicate is detected, show a toast error and block submission — no database call made
- This is the primary safeguard; the AI suggestion remains as an early warning while typing

**2. Server-side duplicate guard** (`check-draft-pick/index.ts`)

- Add a deterministic (non-AI) duplicate check before calling the AI — compare `pick_text` against `existing_picks` using normalized string matching (lowercase, trimmed, stripped punctuation)
- If a deterministic match is found, return `is_duplicate: true` immediately without burning an AI call
- Keep the AI duplicate detection as a fuzzy secondary layer for near-duplicates (e.g., "Green Day" vs "Greenday")

**3. Fix enrichment category context** (`enrich-draft-picks/index.ts`)

- When the draft category is "music" and the topic references "bands" or "artists," bias the enrichment search toward artist results rather than album/song results
- For iTunes: use `entity=musicArtist` instead of default when the topic suggests bands/artists
- For Deezer: search the `/artist` endpoint instead of `/search`
- This prevents album art from appearing instead of band photos

**4. Data correction** — Update the "World of Warcraft" pick text to "Warcraft" in the database

---

### Technical Details

**Client-side duplicate check:**
```typescript
// In handleMakePick, before the insert:
const normalized = pickText.trim().toLowerCase();
const isDuplicate = picks.some(p => p.pick_text.trim().toLowerCase() === normalized);
if (isDuplicate) {
  toast.error('This has already been picked!');
  setSubmitting(false);
  return;
}
```

**Deterministic server-side check** in `check-draft-pick`:
```typescript
const normalizedPick = pick_text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
const normalizedExisting = existingList.map(p => p.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ''));
if (normalizedExisting.includes(normalizedPick)) {
  return { corrected_text: null, is_duplicate: true, is_irrelevant: false, relevance_note: "Already picked" };
}
```

**Enrichment music fix** in `enrich-draft-picks`:
- Detect when topic contains "band", "artist", "musician", "group" keywords
- Override iTunes search entity to `musicArtist`
- Use artist images instead of album artwork

### Files Changed

| File | Change |
|------|--------|
| `src/pages/DraftDetailPage.tsx` | Add hard duplicate block in `handleMakePick` |
| `supabase/functions/check-draft-pick/index.ts` | Add deterministic duplicate check before AI call |
| `supabase/functions/enrich-draft-picks/index.ts` | Fix music enrichment to prefer artist results for band/artist topics |
| Database update | Correct "World of Warcraft" → "Warcraft" in the relevant draft pick |

