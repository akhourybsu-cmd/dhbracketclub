
# DH Lore Module — Plan

## Overview
Add **DH Lore** as a new primary navigation tab replacing Feed. Feed moves to a secondary entry point on the Dashboard. DH Lore becomes a private archive of inside jokes, quotes, moments, and nicknames with a fast Quick Add flow.

## Navigation Changes
- **Bottom nav (`AppLayout.tsx`)**: Replace `Feed` tab with `Lore` tab (icon: `ScrollText` or `BookHeart`, gold accent matching Drafts/module-identity guidelines).
- **Dashboard (`DashboardPage.tsx`)**: Add a compact "Recent Activity" card with a clear "Open Feed" CTA in the secondary section (below primary modules).
- **Routes (`App.tsx`)**:
  - `/lore` → LorePage (home/library hybrid)
  - `/lore/create` → opens via dialog/sheet (not full route, faster UX)
  - `/lore/:loreId` → LoreDetailPage
  - `/feed` → kept intact

## Data Model (new migration)

**`lore_entries`** table:
- `id` uuid pk
- `created_by` uuid (auth user)
- `type` text — enum-like: `quote | inside_joke | story | nickname | bit | hall_of_fame | hall_of_shame`
- `title` text (required) — the phrase/quote/nickname
- `context` text (required) — short story
- `people_involved` uuid[] (optional, references profile ids)
- `tags` text[] (optional)
- `image_url` text (optional)
- `era` text (optional, freeform like "Summer 2023")
- `status` text — `classic | active | legendary | cursed | retired` (default `classic`)
- `source_message_id` uuid (nullable, future chat-to-lore)
- `created_at`, `updated_at`

**`lore_reactions`** table (lightweight):
- `id`, `lore_id`, `user_id`, `reaction` text (`legendary | elite | cursed | fraud | all_timer | certified`), `created_at`
- Unique on (lore_id, user_id, reaction)

RLS: viewable by all authenticated; insert/update/delete by creator or admin (matching app pattern).

## Screens

### 1. LorePage (`/lore`) — Home + Library combined
- **Header**: "DH Lore" title, subtitle "The archive", `+ Add Lore` button (top-right, gold accent)
- **Featured strip**: 1-2 random "legendary" entries as hero cards
- **Quick filters**: chip row — All / Quotes / Jokes / Moments / Nicknames / Bits / Legendary / Cursed
- **Search bar**: keyword search (title + context + tags)
- **Random Lore button**: dice icon, fetches random entry → opens detail
- **Grid/list of entries**: card layout with type badge, title (large), context preview (2 lines), tags, reaction counts, era

### 2. LoreDetailPage (`/lore/:id`)
- Type badge + status badge (e.g. "LEGENDARY")
- Large title/quote (display typography)
- Era + created by + date
- Full context/story
- People involved (avatar row)
- Tags
- Image if present
- Reaction bar (6 reactions, tap to toggle, count display)
- Edit/delete for owner/admin

### 3. Quick Add Lore (Sheet/Dialog from `+ Add Lore`)
- **Step 1 (visible by default)** — only 3 fields:
  1. **Type** — segmented chip selector (Quote / Joke / Moment / Nickname / Bit) — default Quote
  2. **Title or phrase** — single line input, autofocus, large text
  3. **What's the story?** — compact textarea (3 rows)
- **"Add more details" collapsible** — hidden until expanded:
  - People involved (multi-select profiles)
  - Tags (chip input)
  - Era (text)
  - Status (segmented: Classic/Active/Legendary/Cursed/Retired)
  - Image upload (uses existing `chat-attachments` bucket or new `lore-images`)
- **Save to Lore** button — sticky bottom, gold, full-width on mobile
- Toast confirmation + redirect to detail or list

## Dashboard Feed Relocation
- New secondary card under main modules: **"Recent Activity"** card
  - Shows last 2-3 activity items inline
  - "Open Feed" button → `/feed`
- Compact, doesn't compete visually with Lore/Drafts/Brackets

## Design Language
- Lore module color: **soft purple/violet accent** (new module identity, distinct from gold/blue/teal/amber) OR reuse existing gold for archive feel. Recommend: **violet** `hsl(265 70% 65%)` for "lore/memory" feel.
- Cards: same Surface/Elevated pattern, Arena Edge top gradient
- Type badges: subtle pill, monospace label
- Status badges: more prominent for Legendary/Cursed (gold/red glow)
- Mobile-first: 44px touch targets, safe-area aware

## Files to Add
- `supabase/migrations/<new>_dh_lore.sql` — tables, RLS, indexes
- `src/pages/LorePage.tsx`
- `src/pages/LoreDetailPage.tsx`
- `src/components/lore/QuickAddLoreSheet.tsx`
- `src/components/lore/LoreCard.tsx`
- `src/components/lore/LoreReactionBar.tsx`
- `src/components/lore/LoreTypeBadge.tsx`
- `src/hooks/useLoreEntries.ts`

## Files to Modify
- `src/App.tsx` — add 3 routes, keep `/feed`
- `src/components/AppLayout.tsx` — swap Feed → Lore in bottom nav
- `src/pages/DashboardPage.tsx` — add "Recent Activity / Open Feed" secondary card
- `tailwind.config.ts` / `src/index.css` — add `--lore` violet token if going that route

## Future-Friendly Hooks
- `source_message_id` column ready for "Save to Lore" from chat
- `people_involved` array ready for profile linking
- `era` + `created_at` ready for "On this day" resurfacing
- Reaction system extensible (just add to enum)
- Image upload path generic enough for future video/audio

## Manual Testing Checklist
- Navigation tab swap on mobile (411px viewport)
- Quick Add: 3-field flow saves under 20s
- Optional details expand/collapse smoothly
- Search + filter chips work together
- Random Lore returns different entries
- Reactions toggle correctly per user
- Feed still accessible from Dashboard
- Detail page edit/delete permissions
- Dark mode polish on new violet accent
