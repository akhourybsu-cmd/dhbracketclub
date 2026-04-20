

## Lore Submission Audit

### What works correctly
- **RLS for lore_entries**: Any authenticated user can create entries (`auth.uid() = created_by`). ✅
- **RLS for lore_contributions**: Any authenticated user can add context, only owners can edit/delete their own. ✅
- **RLS for lore_reactions**: Any authenticated user can react/unreact. ✅
- **QuickAddLoreSheet**: Wired correctly to `useCreateLoreEntry`, uses `user.id` as `created_by`, navigates to detail on success.
- **LoreContributions**: Insert/update/delete mutations all pass `user.id`, invalidate queries correctly.
- **Edit/delete authorship**: Contribution rows only show pencil/trash to `isOwner` — others cannot edit each other's text. ✅

### Bugs / UX issues found

**1. Edit/Delete buttons hidden on mobile (critical)**
In `LoreContributions.tsx` line 202, the per-contribution edit/trash actions use `opacity-0 group-hover:opacity-100`. On touch devices there's no hover — **users cannot edit or delete their own contributions on mobile**. This breaks the feature on the primary platform (PWA).
- Fix: always show the actions on mobile (e.g. `opacity-60 sm:opacity-0 sm:group-hover:opacity-100`), or render a small overflow menu.

**2. Touch targets below 44px**
The pencil/trash buttons are `p-1.5` on a `w-3.5 h-3.5` icon (~26px total). Per `mem://ui/mobile-interaction-standards`, icon-only buttons should be 44px. Bump to `p-2.5` with `min-w-[44px] min-h-[44px]`.

**3. Random Lore uses full page reload**
`LorePage.tsx` line 44 uses `window.location.href` instead of `navigate()`, dropping React state and the SW cache benefit. Swap to `useNavigate()`.

**4. `useDeleteLoreContribution` doesn't toast on success**
Other mutations toast; this one is silent (entry just disappears). Add a small `toast.success('Removed')` or rely on the optimistic removal — minor polish.

**5. Confirm dialogs use native `confirm()`**
Both `LoreDetailPage` (delete entry) and `LoreContributions` (delete contribution) use `window.confirm`. Consistent with rest of app? Acceptable, just noting.

### Plan: fix the two critical mobile issues + minor polish

**File: `src/components/lore/LoreContributions.tsx`**
- Make edit/delete buttons always visible on mobile, hover-reveal on desktop only.
- Bump button padding to meet 44px touch target.
- Add success toast on contribution delete.

**File: `src/pages/LorePage.tsx`**
- Replace `window.location.href` in `onRandom` with `useNavigate()`.

### Out of scope
- No schema changes (RLS already correct).
- No changes to `QuickAddLoreSheet` (works correctly).
- No changes to reactions UI.

