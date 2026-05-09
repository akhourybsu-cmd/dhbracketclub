## Audit findings

The current onboarding has three overlapping surfaces that all touch the same data:

| Surface | What it does today | Problem |
|---|---|---|
| `AuthPage` mode `request` | Signup **and** asks `proposed_name` + `reason` in the same form | Duplicates the request form; on email-confirm flows it stashes data in `sessionStorage` and replays it later |
| `RequestClubPage` | Status display + form + auto-submit-from-stash | Mixes "create new", "view pending", "view approved", "view rejected", "edit" all loosely |
| `ClubGate` | Bounces users without a club to `/club/request` | Has no awareness of request status — can't differentiate pending vs needs_info vs rejected vs no_request |

Schema gaps (`public.club_requests`):
- No `updated_at`, no `user_note`, no `needs_info`/`cancelled` statuses.
- No constraint preventing two active requests per user (today only behavior of the form prevents it).
- RLS: user has INSERT + SELECT only; can't update/cancel their own request.

Result: redundant inputs, brittle session-storage handoffs, no `needs_info` round-trip, no centralized "where does this user belong now?" decision.

## Plan — smallest clean rebuild

### 1. Schema (one migration)
- Add columns to `club_requests`: `updated_at timestamptz`, `user_note text`, plus expand `status` allowed values to `pending | needs_info | approved | rejected | cancelled` (CHECK constraint).
- Add **partial unique index** `(requested_by) WHERE status IN ('pending','needs_info')` — DB-level guarantee of one active request per user.
- Trigger `update_updated_at_column` on UPDATE.
- Tighten RLS:
  - Keep INSERT (own row only, status forced to `pending`).
  - Add UPDATE policy so a user can edit their own request only while it is `pending`, `needs_info`, or `rejected`, and only the `proposed_name`, `reason`, `user_note`, `status='cancelled'` paths (enforced via SECURITY DEFINER RPC).
- New SECURITY DEFINER RPCs:
  - `upsert_club_request(name, reason, user_note)` — single entry-point that creates a new request *or* updates the user's existing active/rejected one. Handles status reset (`needs_info`/`rejected` → `pending`).
  - `cancel_club_request()` — sets active row to `cancelled`.
  - `admin_set_request_needs_info(req_id, admin_note)` — platform owner only.

### 2. AuthPage simplification
- Remove the inline "proposed club name" / "reason" fields from the `Request` tab.
- That tab becomes pure "sign up" — display name + email + password. After signup the user lands on `/club/request` (via the new `OnboardingGate`) and fills the request there. No more `sessionStorage` stash.
- `Join Club` (password) tab stays as-is (instant join, separate flow).

### 3. New `useOnboardingStatus` hook
Returns `{ state, request, club, loading }` where `state ∈ 'loading' | 'approved' | 'pending' | 'needs_info' | 'rejected' | 'no_request' | 'no_club_no_account'`. Single source of truth, queries `club_members` + active `club_requests` once.

### 4. Reusable `resolvePostLoginDestination(state)` helper
- `approved` → `/dashboard` (or saved deep-link)
- `pending` / `needs_info` / `rejected` → `/club/request`
- `no_request` → `/club/request`
- platform owner with no club → `/admin/clubs`

### 5. `ClubGate` rewrite
- Uses `useOnboardingStatus` instead of just checking `club`.
- Allows `/club/request`, `/profile`, `/admin/clubs` for non-approved users.
- Otherwise redirects per `resolvePostLoginDestination`.

### 6. Rebuilt `/club/request` page (mobile-first onboarding shell)
Single page that adapts to status:

```text
┌────────────────────────────────────┐
│  ⚪ Account created                │
│  ⚪ Club request submitted         │  ← progress checklist
│  ⚪ Awaiting admin approval        │
│  ⚪ Welcome in                     │
├────────────────────────────────────┤
│  STATUS BADGE  · last updated 2m   │
│                                    │
│  Submitted details (read-only      │
│  when pending; editable inline)    │
│                                    │
│  Admin note (if needs_info / rej.) │
│  Your reply (if needs_info)        │
│                                    │
│  [ Update request ] [ Cancel ]     │
│  [ Sign out ]                      │
└────────────────────────────────────┘
```

State-driven UI:
- **no_request** → form (proposed_name, reason).
- **pending** → progress + read-only details + Cancel + Sign out + "no need to resubmit".
- **needs_info** → admin_note callout + editable response field + "Send update" (which calls `upsert_club_request` and flips back to `pending`).
- **rejected** → reason callout + optional "Submit a new request" (which `upsert_club_request` overwrites the same row).
- **approved** → success card + "Enter the app" CTA.

### 7. Admin surface (`AdminClubsPage`)
Minimal additions only:
- New "Request more info" action with inline note → calls `admin_set_request_needs_info`.
- Show `needs_info` requests grouped above pending; show `cancelled` in history.
- No layout redesign.

### 8. Backfill / safety
- Existing 2 `approved` rows untouched.
- No active pending rows exist (verified via DB) → safe to add the partial-unique index immediately.
- Existing approved users keep working: `ClubGate` now hits `useOnboardingStatus` which still resolves them to `approved` via `club_members`.

### Files touched

**New**
- `supabase/migrations/<ts>_onboarding_rebuild.sql`
- `src/hooks/useOnboardingStatus.ts`
- `src/lib/onboarding.ts` (resolver + small helpers)

**Edited**
- `src/components/ClubGate.tsx`
- `src/pages/AuthPage.tsx` (remove duplicate fields in Request tab)
- `src/pages/RequestClubPage.tsx` (full state-driven rewrite)
- `src/pages/AdminClubsPage.tsx` (add needs_info action)
- `src/integrations/supabase/types.ts` (auto-regenerated)

**Untouched**
- `Join Club` password flow, `AuthContext`, `ClubContext`, all in-app routes, all existing approved users.

### Acceptance map
1. Signup → request once → logout → login: same row surfaced via `useOnboardingStatus`. ✓
2. Duplicate active request: blocked by partial unique index + RPC upsert. ✓
3. Approved user → `/dashboard`. ✓
4. Pending user → `/club/request` status screen. ✓
5. needs_info → admin note + reply field. ✓
6. Rejected → clear state + optional resubmit (overwrites same row). ✓
7. Admin approve creates club + member (existing flow). ✓
8. No duplicate fields between AuthPage and RequestClubPage. ✓
9. Existing approved users unaffected (no schema change to `club_members`). ✓
10. Mobile-first throughout. ✓
