

# Multi-Club (Multi-Tenant) Platform

Transform DH Club from a single shared group into a platform where **Alex provisions isolated clubs**, each with their own admin, members, invite code, branding, and fully separate data — Drafts, Seasons, Chat, Events, Lockbox, RuneDelve scores, Posts, Lore, everything.

## Concept

```text
┌─────────────────── Platform (Alex = Owner) ──────────────────┐
│                                                              │
│   ┌── Club: "DH Club" ──┐  ┌── Club: "Smith Fam" ──┐         │
│   │ admin: Alex         │  │ admin: Maria          │         │
│   │ code: DH-2026       │  │ code: SMITH-25        │         │
│   │ accent: emerald     │  │ accent: amber         │         │
│   │ • drafts            │  │ • drafts              │         │
│   │ • seasons           │  │ • seasons             │         │
│   │ • #channels         │  │ • #channels           │         │
│   │ • events / lockbox  │  │ • events / lockbox    │         │
│   │ • runedelve scores  │  │ • runedelve scores    │         │
│   └─────────────────────┘  └───────────────────────┘         │
│                                                              │
│   Club Requests Inbox → Alex approves → club created         │
└──────────────────────────────────────────────────────────────┘
```

Decisions locked in: **everything club-scoped**, **one club per account**, **Alex approves all club requests**, **each club has its own name + accent color**.

## What gets built

### 1. Data model (migration)

New tables:
- **`clubs`** — `id, name, slug, accent_color, logo_url, owner_admin_id, created_at, status`
- **`club_requests`** — `id, requested_by, proposed_name, reason, status (pending/approved/rejected), reviewed_by, reviewed_at`
- **`club_members`** — `club_id, user_id, role (admin/member), joined_at` (UNIQUE on user_id → enforces one-club-per-account)

Existing tables get a `club_id uuid NOT NULL` column added (with a backfill to the existing "DH Club" club for all current rows):
- drafts, draft_participants, draft_picks, draft_results, draft_seasons, draft_season_entries, draft_season_standings, draft_playoff_matches, draft_pick_disputes
- channels, channel_categories, messages, message_reactions, message_link_previews, channel_read_states
- events, event_rsvps, event_comments
- posts, post_comments, reactions
- polls, poll_options, poll_votes, rankings, ranking_items, ranking_submissions, ranking_submission_entries
- lore_entries, lore_contributions, lore_reactions
- lockbox_weeks, lockbox_locks, lockbox_attempts, lockbox_guesses, lockbox_scores
- rune_delve_runs, rune_delve_heroes, rune_delve_progress, rune_delve_class_progress, rune_delve_daily_runs, rune_delve_daily_streaks, rune_delve_wallet, rune_delve_loadouts, rune_delve_bestiary, rune_delve_relic_unlocks, rune_delve_active_quests, rune_delve_failure_rewards
- activity_feed, push_subscriptions, notification_preferences
- invite_codes (codes are now tied to a club)

Tables that stay global (read-only reference data): `nfl_teams`, `nfl_games`, `nfl_weeks`, `nfl_seasons`, `rune_delve_levels`, `rune_delve_dungeons`, `rune_delve_quest_definitions`, `item_enrichments`, `provider_configs`.

### 2. RLS — isolation guarantee

New security-definer helpers:
- `current_user_club_id()` → returns the club_id from `club_members` for `auth.uid()`
- `is_club_admin(_user uuid, _club uuid)` → boolean
- `is_platform_owner(_user uuid)` → checks `user_roles.role = 'owner'` (Alex)

Every club-scoped table's RLS policies get rewritten to require `club_id = current_user_club_id()` for SELECT/INSERT/UPDATE/DELETE. Platform owner bypasses everywhere. This is the security backbone — no code path can leak data across clubs.

### 3. Club lifecycle flows

**Request a club** (public, on `/auth` page after sign-in or via "Start a Club" CTA on landing):
- New screen: `RequestClubPage` — proposed name, short reason, submit. Creates `club_requests` row.
- User sees a pending state: "Your request is under review."

**Owner approval** (Alex only, `/admin/clubs`):
- New screen: `AdminClubsPage` — list of pending requests, approve/reject. Approving creates the `club`, makes the requester its admin in `club_members`, generates a unique invite code, transitions user to active.

**Sign-up flow** (`AuthPage`):
- Invite code lookup now resolves to a specific club. On successful signup, `club_members` row is inserted automatically.
- Users without a club land on a "Request a club or enter a code" splash.

**Club admin panel** (`/club/settings`, club admin only):
- Edit club name, accent color, upload logo
- Manage invite codes (generate, deactivate)
- Member list + remove member
- Transfer admin role

### 4. Club context + branding

- New `ClubContext` provider wrapping `AuthContext` — exposes `currentClub` (id, name, accent_color, logo_url) and `isClubAdmin`.
- App shell injects the club's accent color as a CSS variable (`--club-accent`) at the root, used by `AppLayout`, `Dashboard` hero, season aesthetic, and key buttons. Emerald/charcoal base remains; the accent swaps.
- Header/dashboard show club name + logo instead of hardcoded "DH Club" / DH monogram. DH monogram becomes the platform-level fallback only.

### 5. UI updates

- **Dashboard** — hero shows club name & logo, "Welcome to {clubName}".
- **Profile** — adds "Your Club" section with name, role (Admin/Member), and "Leave Club" (members) / "Manage Club" (admins).
- **Landing page** — adds discreet "Start your own club" CTA leading to request form.
- **Admin Hub** — Alex's existing AdminHub gains a "Clubs" tab linking to club approval queue + roster.
- **Empty states** — when a club is brand-new, every module shows a fresh "No drafts yet — create the first one" state cleanly (no leakage from other clubs).

### 6. Edge function updates

All edge functions that read/write club-scoped tables need a club_id check:
- `advance-playoffs`, `start-playoff-match`, `suggest-playoff-topics`, `enrich-draft-picks`, `rate-draft`, `check-draft-pick`, `finalize-lockbox-day`, `lockbox-daily-reminder`, `score-nfl-week`, `sync-nfl-week`, `send-push-notification`
- They derive `club_id` from the row they're operating on (e.g. draft → club_id) and only act within that club. Cron-driven functions (lockbox finalizer, lockbox reminder) loop per club.

### 7. Data backfill

One-time migration:
- Insert "DH Club" into `clubs` with Alex as admin, accent emerald, existing invite codes attached.
- Backfill `club_id = '<dh-club-uuid>'` on every existing row across all club-scoped tables.
- Insert every existing user into `club_members` for DH Club.
- Make `club_id` `NOT NULL` after backfill.

## Mobile-first considerations

- Club switcher is **not** needed (one-club-per-account decision).
- Club name + logo replace DH branding in headers — designed for phone widths first.
- Request flow and admin approval queue are full-screen mobile cards, not tables.
- Accent color applied via a single CSS variable so existing components stay clean.

## What stays the same

- DH Club itself keeps all its data, members, drafts, seasons, channels — nothing is lost.
- Single-group architectural memory note will be updated to reflect multi-tenant model.
- Draft scoring, playoff logic, lockbox rules, RuneDelve mechanics — untouched.
- Visual identity (Emerald & Charcoal base, Arena aesthetic) — untouched, accent layered on top.

## Risks & call-outs

- This is the **largest schema change to date** (~30 tables, all RLS rewritten). Will be done in one migration with backfill, but I'll stage policies carefully to avoid lockouts.
- One-club-per-account means if you ever want to be in multiple clubs, we'd need a follow-up migration to drop the unique constraint and add a switcher.
- Realtime channels (chat, presence) will subscribe with a `club_id` filter so cross-club chatter never crosses streams.
- RuneDelve leaderboards become per-club — global comparisons disappear by design.

## Files (high level)

**New**: migration (clubs/club_members/club_requests + club_id columns + RLS rewrites + backfill), `src/contexts/ClubContext.tsx`, `src/pages/RequestClubPage.tsx`, `src/pages/ClubSettingsPage.tsx`, `src/pages/admin/AdminClubsPage.tsx`, `src/hooks/useCurrentClub.ts`.

**Edited**: `AuthPage`, `AppLayout`, `DashboardPage`, `ProfilePage`, `AdminHub`, `LandingPage`, all edge functions touching club-scoped tables, all hooks that read those tables (most queries get implicit club scoping via RLS, so most code changes are minimal beyond the context provider + branding).

