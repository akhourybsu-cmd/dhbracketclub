
## Plan: Surface "Who's Up" on Draft Cards

### What Changes
Add a line like **"🎯 Alex K.'s pick"** or **"🎯 Your pick!"** to every in-progress draft card across three pages:

1. **DashboardPage** — Draft cards in the "Drafts" section
2. **DraftsListPage** — Each draft row  
3. **CompetePage** — Draft module card (already shows active count, will add current picker for the most recent in-progress draft)

### How It Works
- The `drafts` table already has `current_pick_user_id` — we just need to join it to `profiles` to get the display name
- For each in-progress draft, show the current picker's name below the topic
- If it's the logged-in user's turn, highlight it: **"🎯 Your pick!"** in the gold accent color

### Technical Details

**DashboardPage.tsx** (lines ~157-160, ~570-598):
- Update drafts query to include `current_pick_profiles:current_pick_user_id(display_name)` 
- Add a subtitle line on in-progress draft cards showing the current picker

**DraftsListPage.tsx** (lines ~22-25, ~196-235):
- Update drafts query to also select `current_pick_user_id` and join to profiles
- Add picker name below rounds/participants info on in-progress cards

**CompetePage.tsx** (lines ~104-108):
- Fetch the current picker profile for in-progress drafts
- Show "Alex K. is picking" context line on draft cards

### Files Changed

| File | Change |
|------|--------|
| `src/pages/DashboardPage.tsx` | Add current picker subtitle to draft cards |
| `src/pages/DraftsListPage.tsx` | Add current picker to draft list rows |
| `src/pages/CompetePage.tsx` | Add picker info to draft module card |
