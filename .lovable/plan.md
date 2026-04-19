

User wants: any authenticated member can add their own context/comments to a lore entry, but cannot edit the original author's text. Like a comments thread per lore entry.

Best approach: add a `lore_contributions` table (comments/addenda) rather than letting people edit the entry itself. Keeps original entry author-owned, lets everyone contribute their POV/context.

### Schema
New table `lore_contributions`:
- `id`, `lore_id` (fk), `user_id`, `content` (text), `created_at`, `updated_at`
- RLS: SELECT all authenticated; INSERT auth.uid() = user_id; UPDATE/DELETE only own row (or admin)

### Backend
Migration only — no edge function needed.

### Frontend
- New hook `useLoreContributions.ts`: list, add, edit (own), delete (own)
- `LoreDetailPage.tsx`: add "Context & Additions" section under main entry showing contributions sorted oldest→newest, with add-form for any auth user, inline edit/delete on own contributions only
- `LoreCard.tsx` (list view): small "+N additions" counter pill if any contributions exist (light touch)
- `useLoreEntries.ts`: include contribution count via `contributions:lore_contributions(count)` in the select

### Files
- NEW: `supabase/migrations/<ts>_lore_contributions.sql`
- NEW: `src/hooks/useLoreContributions.ts`
- EDIT: `src/pages/LoreDetailPage.tsx` — add contributions section
- EDIT: `src/hooks/useLoreEntries.ts` — include contribution count
- EDIT: `src/components/lore/LoreCard.tsx` — small additions indicator

### UX details
- Contribution form: small textarea + "Add context" button, mirrors current chat composer style at smaller scale
- Each contribution shows author avatar, name, timestamp, content; pencil/trash on own only
- Empty state: "Be the first to add context" when none exist
- Original entry remains visually dominant; contributions feel like discussion thread beneath

### Out of scope
- No reactions on individual contributions (keep simple)
- No threading/replies on contributions
- No notifications when someone adds context (can add later)

