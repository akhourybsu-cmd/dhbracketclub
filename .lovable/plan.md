## Database Migration: Club Settings + Admin Portal

This migration adds the schema needed by the new Club Settings and Admin Portal pages that were already wired up in the previous pass.

### Changes to `clubs` table
Add optional columns:
- `description` (text) — club bio shown in settings
- `banner_url` (text) — header image
- `visibility` (text, default `'invite_only'`, check in `'invite_only' | 'private' | 'public'`) — kept invite-only by default to match the current single-group ethos, but forward-compatible
- `settings` (jsonb, default `'{}'::jsonb`) — per-club feature toggles (Drafts, Portfolio Wars, Pick'em, Nexus, Lockbox, etc.)

### New tables (all platform-scoped, admin-only writes, RLS enabled)

- **`app_feature_flags`** — `key` (unique), `enabled` (bool), `description`, `rollout` (jsonb)
  - Read: any authenticated user. Write: `is_app_admin(auth.uid())`.
- **`announcements`** — `title`, `body`, `severity` (`info|warning|critical`), `published_at`, `expires_at`, `created_by`
  - Read: any authenticated user where `published_at <= now()` and (`expires_at is null or expires_at > now()`). Write: app admins.
- **`admin_notes`** — internal scratchpad. `subject_type` (`user|club|system`), `subject_id`, `body`, `created_by`
  - Read/write: app admins only.
- **`admin_audit_log`** — `actor_id`, `action` (text), `target_type`, `target_id`, `metadata` (jsonb)
  - Insert: app admins. Read: app admins. No update/delete.

### New helper function
- `is_club_manager(_user uuid, _club uuid) returns boolean` — security definer; returns true if `is_club_admin(_user,_club)` OR `is_app_admin(_user)`. Used by future club-settings RLS policies and the `ClubAdminRoute` guard server-side checks.

### Notes
- All tables get `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` with the existing `update_updated_at_column` trigger.
- No data is modified — additive only. Existing `clubs` rows get defaults.
- No changes to `auth`, `storage`, or other reserved schemas.
- Suspension/ban logic is **not** included in this migration (stub for Phase 4 as discussed).
- Announcements push fan-out is **not** wired here — table only; in-app banner first, push later.

Approve and I'll run the migration, then update the admin pages to read/write these tables.
