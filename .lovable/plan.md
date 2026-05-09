
## Goal

Cleanly separate three concerns that are currently mashed into `ProfilePage`:

1. **Profile** → personal account only
2. **Club Settings** → manage one specific club (owners/admins)
3. **Admin Portal** → platform-wide control (global admin only)

Built mobile-first, role-aware navigation, real permission checks (not just hidden buttons).

> Note on scope: per project memory, DH Club is currently a single-group platform (every user belongs to one club). The architecture below supports per-club routing (`/clubs/:clubId/settings`) so it scales, but in practice most users will only ever see their own club's settings. Global admin tools already assume multiple clubs (`/admin/clubs` exists).

---

## 1. Profile (personal-only)

**Route:** `/profile` (unchanged)

Keep:
- Display name, avatar, bio
- Personal notification preferences (`NotificationPreferences`)
- Sound settings (`SoundSettingsCard`)
- Theme toggle
- Linked accounts (`LinkedAccounts`)
- Security panel (`SecurityInfoPanel`)
- Personal stats (drafts/polls/rankings I participated in)
- Log out

Remove from Profile (relocate, don't delete):
- `AdminHub` component (entire commissioner hub) → moves to Admin Portal
- Club password reveal / club join info → moves to Club Settings
- "Force refresh app", "Send test notification", build diagnostics → Admin Portal
- Any competition admin shortcuts (Pick'em admin, Drafts hub, Nexus tools, Rune Delve tools) → Admin Portal

Add:
- A small **"Manage your club"** card linking to `/clubs/:clubId/settings` — only visible if `isClubAdmin`
- A small **"Admin Portal"** card linking to `/admin` — only visible if `is_app_admin`

---

## 2. Club Settings (per-club)

**Route:** `/clubs/:clubId/settings` (new canonical) — keep `/club/settings` as a redirect to current user's club for backward compatibility.

**Access:** club `owner` / `admin` role, or global `is_app_admin`. Enforced by:
- Route guard component `ClubAdminRoute` (checks membership.role + global admin override)
- RLS already covers writes; we add a server-side `is_club_manager(_user, _club)` security-definer helper for clarity

**Layout:** mobile-first stacked settings cards with sticky header showing club logo + name.

Sections (each as its own card/component):

- **Club Identity** — name, description, logo, banner, visibility (public/private/invite-only). New columns may be needed: `description`, `banner_url`, `visibility` on `clubs` (migration in Phase 3).
- **Branding & Appearance** — primary color (existing `accent_color`), tagline, header style preview.
- **Members & Roles** — searchable list, promote/demote, remove member, transfer ownership (confirmation modal). Already partially implemented in current `ClubSettingsPage`.
- **Invites & Access** — invite codes (existing), club password visibility toggle (existing), regenerate link.
- **Competition Defaults** — toggles for which modules are enabled (drafts/polls/rankings/pickem/portfolio-wars/lockbox/nexus), who can create competitions. Stored in new `club_settings` JSONB column or separate `club_feature_flags` table.
- **Moderation** — reported messages/posts queue scoped to this club. Wires to existing `messages`/`posts` flagging if present; otherwise UI shell with "no reports" empty state.
- **Club Notifications** — send announcement (already supported via push), default notification behavior.
- **Danger Zone** — leave club, archive club, delete club (owner only, double-confirm modal).

Components to create under `src/components/clubSettings/`:
- `ClubSettingsLayout.tsx` (sticky header, back button)
- `ClubIdentityCard.tsx`
- `ClubBrandingCard.tsx`
- `ClubMembersCard.tsx` (extract from current page)
- `ClubInvitesCard.tsx` (extract)
- `ClubFeatureFlagsCard.tsx`
- `ClubModerationCard.tsx`
- `ClubAnnouncementsCard.tsx`
- `ClubDangerZone.tsx`

---

## 3. Admin Portal (platform-wide)

**Route:** `/admin` (currently redirects to `/admin/clubs` — turn into a real dashboard).

**Access:** only users with `user_roles.role = 'admin'`. Guarded by new `AdminRoute` component (server check via `is_app_admin` RPC, not just client state).

**Layout:** mobile-first dashboard with section cards, similar to `AdminHub` styling but full-page.

Sections:

- **Platform Overview** — stat cards: total clubs, total users, active clubs (last 7d), recent signups, recent competitions, system warnings. Queries: `count(*)` from `clubs`, `profiles`, `auth.users`, `activity_feed` recent.
- **Clubs Management** — fold existing `/admin/clubs` page in. Add "Open Club Settings as Admin" deep link to `/clubs/:clubId/settings` (works because admin override).
- **User Management** — search users, view profile summary, list memberships, ban/suspend (new `profiles.suspended_at` column), promote to global admin.
- **Competitions** — links to existing per-module admin tools (Pick'em admin, Drafts hub, Nexus balance/calibration, Rune Delve analytics/sim/balance). Move from `AdminHub`.
- **Feature Flags** — global toggles per module. New `app_feature_flags` table (`key text pk, enabled bool, rollout_pct int, updated_at`).
- **Mobile Refinement / UI Notes** — simple notes/checklist table (`admin_notes`: title, body, status, created_by). Markdown content.
- **Announcements** — create platform announcements (title, body, link, audience, start/end). New `announcements` table; pushed via existing `send-push-notification`.
- **Audit Log** — read-only feed from existing `activity_feed` filtered to admin-relevant events plus a new `admin_audit_log` table for role/feature-flag changes.
- **Diagnostics** — force refresh, test push, build info, update probe (move `UpdateDiagnostics` from AdminHub).

Routes:
```
/admin                      → AdminDashboardPage
/admin/clubs                → existing AdminClubsPage
/admin/users                → AdminUsersPage (new)
/admin/competitions         → AdminCompetitionsPage (new, link hub)
/admin/feature-flags        → AdminFeatureFlagsPage (new)
/admin/announcements        → AdminAnnouncementsPage (new)
/admin/notes                → AdminNotesPage (new)
/admin/audit                → AdminAuditPage (new)
/admin/diagnostics          → AdminDiagnosticsPage (new)
```

Components under `src/components/admin/`:
- `AdminLayout.tsx` (shared sticky header, back navigation)
- `AdminDashboardCard.tsx`
- `AdminStatTile.tsx`
- Page-specific bodies as listed.

---

## 4. Navigation

`AppDrawer.tsx` updates:

| Role | Items shown |
|------|-------------|
| Member | Profile, Clubs they belong to |
| Club admin | Profile, **Club Settings** (gear) |
| Global admin (`is_app_admin`) | Profile, Club Settings (for any club), **Admin Portal** |

Rules:
- Bottom tab bar **unchanged** — no new tabs.
- Club Settings entry point: gear icon on club page header + entry in profile menu when applicable.
- Admin Portal entry point: dedicated row in drawer's admin section + small chip on Profile page.

---

## 5. Permissions / DB

New migration (Phase 3):

```sql
-- club expansions
alter table public.clubs
  add column if not exists description text,
  add column if not exists banner_url text,
  add column if not exists visibility text default 'invite-only',
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists archived_at timestamptz;

-- club_members already exists; ensure roles include 'admin' alongside 'member'
-- Promote existing owner_admin_id to club_members admin row if missing.

-- security helper
create or replace function public.is_club_manager(_user uuid, _club uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_app_admin(_user)
      or public.is_club_admin(_user, _club)
      or exists (select 1 from public.clubs c where c.id=_club and c.owner_admin_id=_user)
$$;

-- platform tables
create table public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_pct int not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link_url text,
  audience text not null default 'all',  -- 'all'|'club_owners'|'club:<id>'
  starts_at timestamptz default now(),
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  status text not null default 'open',  -- open|in_progress|done
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- RLS: all four tables — read/write only when public.is_app_admin(auth.uid())
-- announcements: public read where now() between starts_at and coalesce(ends_at,'infinity')
```

Profile suspension (optional Phase 4):
```sql
alter table public.profiles add column if not exists suspended_at timestamptz;
```

---

## 6. Phased rollout (so nothing breaks)

**Phase 1 — Refactor Profile + Club Settings (no schema changes)**
1. Create `ClubAdminRoute` and `AdminRoute` guard components.
2. Create `src/components/clubSettings/*` by extracting existing logic from `ClubSettingsPage.tsx`. Add new section shells (Identity/Branding/Features/Moderation/Announcements/DangerZone) with empty/coming-soon states wired to current data.
3. Slim down `ProfilePage.tsx`: remove `AdminHub`, club password reveal, admin shortcuts. Add small "Manage Club" / "Admin Portal" entry cards.
4. Add `/clubs/:clubId/settings` route; keep `/club/settings` redirect.
5. Update `AppDrawer` role-aware items.

**Phase 2 — Admin Portal shell**
1. Convert `/admin` from redirect into `AdminDashboardPage` with stat tiles + section cards.
2. Move `AdminHub` content into `/admin/diagnostics` and `/admin/competitions`.
3. Stub `/admin/users`, `/admin/feature-flags`, `/admin/announcements`, `/admin/notes`, `/admin/audit` with real lists where data exists, "coming soon" disabled state otherwise.

**Phase 3 — Schema migration**
1. Run migration above (new columns + 4 platform tables + RLS).
2. Wire Club Identity (description, banner, visibility), Feature Flags, Announcements, Admin Notes, Audit Log to real data.
3. Backfill `club_members` admin rows for any club with `owner_admin_id` not represented.

**Phase 4 — Polish**
1. User suspension column + UI.
2. Reported-content moderation queue (if flagging tables exist; otherwise leave as future work).
3. Confirmation modals for destructive actions, empty states, search/filter.

---

## 7. Acceptance criteria

- `/profile` shows only personal items; no admin or club-management content.
- `/clubs/:clubId/settings` exists and is gated to club admins + global admin; non-admins hitting the URL get a 403 redirect.
- `/admin` is a real dashboard, gated to `is_app_admin`; non-admins get redirected to `/`.
- Drawer items adapt by role; bottom tab bar unchanged.
- All previously-working settings still work (notifications, sound, theme, club password, invite codes, member promotion, club admin tools).
- Destructive actions confirm before execution.
- Mobile viewport (≤411px) renders cleanly with stacked cards and 44px+ touch targets per project standards.

---

## Open questions before I start coding

1. **Visibility model** — should clubs really have public/private/invite-only, or stay invite-only forever (matches current single-group ethos)? If staying invite-only, I'll skip the visibility toggle and the migration column.
2. **User suspension** — do you want me to wire actual ban/suspend logic in this pass, or stub it for Phase 4?
3. **Announcements** — fan out via push notifications to all subscribed users, or just in-app banner for v1?
4. **Multi-club future** — keep `/clubs/:clubId/settings` (forward-compatible) or use simpler `/club/settings` since the platform is single-group today?

Answer these and I'll move to build mode and execute Phase 1 first.
