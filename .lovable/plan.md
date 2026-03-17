

# DH Bracket Club — Full Product Audit & Stabilization Plan

## Phase 1: Audit Summary

### Already Solid
- Premium dark "Arena" design system with cohesive CSS tokens, gradients, shadows
- Auth flow (sign up, sign in, redirect, protected routes)
- Pool CRUD (create, join, view detail, delete with cascade)
- Bracket entry with pick cascading, round navigation, tiebreaker
- Bracket detail view with correct/incorrect indicators
- Realtime subscriptions (standings, games, sync runs)
- Edge function sync architecture (multi-provider, reconciliation)
- RLS policies properly configured across all tables
- Mobile bottom nav with spring-animated active indicator
- Loading, empty, and error states throughout
- PWA configuration with install banner

### Broken or Fragile

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | **Global `/leaderboard` route is broken** — `LeaderboardPage` requires `poolId` from params, but the sidebar/bottom nav links to `/leaderboard` without one. Results in empty/null state. |
| 2 | **High** | **AdminToolsPage has no admin guard** — Any pool member can navigate to `/pools/:poolId/admin` and access game overrides, sync triggers, simulations. Only the pool detail page hides the link. |
| 3 | **Medium** | **Leaderboard N+1 query** — Champion picks fetched in a loop (one DB call per bracket). Will degrade with 10+ members. |
| 4 | **Medium** | **CreatePoolPage hardcoded fallback lock time** is `2026-03-17T22:00:00Z` (today). Pools created without a tournament lock_time would lock immediately. |
| 5 | **Medium** | **Dashboard bracket status uses picksCount=0** for all brackets, so draft brackets always show "Draft" regardless of actual completion. |
| 6 | **Medium** | **`useRealtimeSubscription` dependency array** creates a new string each render from `configs.map(...).join(',')`, potentially causing unnecessary channel reconnections. |
| 7 | **Low** | **Console `forwardRef` warnings** — React Router v6 ref warnings polluting console. |
| 8 | **Low** | **No password reset flow** — Auth page has no "Forgot password?" link or reset page. |
| 9 | **Low** | **BracketComparePage unreachable** — No UI element links to the compare view. |
| 10 | **Low** | **`Index.tsx` is redundant** — Just does `<Navigate to="/" />` but `/` already maps to LandingPage. |

### Visually Inconsistent
- Leaderboard "View bracket" eye icon uses `opacity-0 group-hover:opacity-100` — invisible on mobile (no hover)
- Pool detail member list bracket-view eye icon is tiny and hard to tap (3.5w)
- Some pages use `back-link` class, others use inline styled back buttons

---

## Phase 2: Implementation Plan

### Task 1 — Fix Global Leaderboard Route
The `/leaderboard` nav item should redirect to the user's most recent pool leaderboard, or show a pool selector if they're in multiple pools. If no pools, show an empty state.

**Approach**: Change the nav link to go to `/pools` instead, OR make LeaderboardPage handle the missing `poolId` by fetching the user's pools and auto-selecting or showing a picker.

### Task 2 — Add Admin Guard to AdminToolsPage
Add an admin role check at the top of `AdminToolsPage`. Fetch the user's pool membership, verify `role === 'admin'`, and redirect non-admins back to the pool detail page with an error toast.

### Task 3 — Fix Leaderboard N+1 Query
Batch the champion pick fetches: query all bracket_picks with `picked_in_round=6` for all bracket IDs in a single query instead of looping.

### Task 4 — Fix CreatePoolPage Lock Time Fallback
Use a sensible default (e.g., 14 days from now) instead of a hardcoded past/current date. Or require the tournament to have a lock_time and disable pool creation if it doesn't.

### Task 5 — Fix Dashboard Bracket Status Accuracy
On the dashboard, fetch `bracket_picks` count for each user bracket (or at least a boolean for "has picks") to pass accurate `picksCount` to `getBracketDisplayStatus`.

### Task 6 — Stabilize Realtime Subscription Dependencies
Memoize the configs array and the joined string to prevent unnecessary re-subscriptions.

### Task 7 — Add Password Reset Flow
- Add "Forgot password?" link to AuthPage
- Create a `/reset-password` route and page
- Use `supabase.auth.resetPasswordForEmail()` and `supabase.auth.updateUser()`

### Task 8 — Fix Mobile Visibility of Leaderboard Actions
Replace `opacity-0 group-hover:opacity-100` pattern with always-visible but subtle icons on mobile. Use a media query or always show at reduced opacity.

### Task 9 — Minor Cleanup
- Remove redundant `Index.tsx` (or redirect to `/dashboard`)
- Add `play_in_group` to `Team` interface in bracketUtils
- Increase tap target size for member bracket eye icon (min 44px)
- Make back-link styling consistent across all sub-pages

### Task 10 — Visual Polish Pass
- Ensure consistent spacing between page headers and content
- Verify all status pills use the same sizing
- Check mobile overflow on leaderboard table columns
- Ensure bracket entry sticky header doesn't overlap content on scroll

---

## Estimated Scope
- ~10 files modified
- 1 new file (ResetPasswordPage)
- 1 migration possible (none required for above)
- No architecture changes
- No design system changes

All fixes are targeted repairs preserving the existing premium dark direction, branding, and data model.

