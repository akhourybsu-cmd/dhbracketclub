
# DH Club — Security Hardening Plan

## Architectural decision needed first

The brief describes a **multi-club** model ("users belong to multiple clubs"), but the current schema is **single-club-per-user**:

- `club_members` is treated as 1:1 (`maybeSingle()` in `ClubContext`)
- `current_user_club_id()` does `LIMIT 1` — undefined behavior if a user ever joins 2 clubs
- ~60 RLS policies use `club_id = current_user_club_id()`
- Memory `architecture/group-model` says "single-group platform"

**Two valid paths** — pick one before phase 2:

- **A. Stay single-club** (current memory). Confirm constraint with `UNIQUE (user_id)` on `club_members`, keep policies as-is, treat the 3 existing clubs as fully isolated tenants.
- **B. Move to true multi-club**. Replace every `current_user_club_id()` reference with `is_club_member(auth.uid(), club_id)`, add an "active club" client concept, and audit every query that filters by club.

The plan below assumes **A** (lower risk, matches today's data). Path B is a much larger migration and should be its own project.

---

## Phase 1 — Database linter cleanup (low risk)

Fix the 78 linter findings that are pure correctness:

- **Function `search_path` mutable** — add `SET search_path = public` to every `SECURITY DEFINER` function missing it.
- **`SECURITY DEFINER` functions callable by anon** — `REVOKE EXECUTE ... FROM anon` on every helper that should require auth (`is_club_admin`, `is_app_admin`, `is_platform_owner`, `current_user_club_id`, `has_role`, `consume_*`, `_credit_*`, RPCs like `join_club_with_password`, `submit_operation_contribution`, etc.). Keep `GRANT EXECUTE ... TO authenticated`.
- **RLS Enabled No Policy** — add explicit deny-all (or correct) policies for the 2 flagged tables.
- **RLS Policy Always True (INSERT/UPDATE)** — replace any `WITH CHECK (true)` on writes with proper checks.

## Phase 2 — RLS audit & policy consolidation

Today several tables have **two overlapping permissive policies** (e.g. `drafts`, `draft_picks`, `events`, `event_rsvps`, `lockbox_*`). Postgres ORs permissive policies — the looser one wins, which silently weakens the stricter one.

For each user/club content table:

1. Drop legacy user-only policies that predate the club-scoping pass.
2. Keep one canonical set per command (SELECT / INSERT / UPDATE / DELETE) with both **club membership AND ownership/role checks**.
3. Standardize on new helpers:
   - `is_club_member(_user, _club)` (new)
   - `is_club_admin(_user, _club)` (exists)
   - `is_app_admin(_user)` (exists)
   - `is_creator(_user, _created_by)` (inline)
4. Audit every table containing `club_id` (69 tables) and confirm SELECT/INSERT/UPDATE/DELETE all enforce club scope.

Specific issues already identified:

- **`profiles`** SELECT = `true`. OK today (no email/PII column) but document it explicitly and add a CI check that no sensitive column is added without revisiting the policy.
- **`app_feature_flags`** SELECT = `true` to all authenticated. Acceptable for flag fan-out, but flag *names* leak. Consider restricting to admins or shipping flags via an edge function.
- **`channels` INSERT** only checks `created_by = auth.uid()` — add club-scope `WITH CHECK`.
- **`admin_logs` INSERT** had a permissive qual; tighten to `is_pool_admin` (already on WITH CHECK — verify USING also restricts).
- **`invite_codes` UPDATE** allows any auth user to claim — add `is_active`, `expires_at > now()`, `used_count < max_uses`.
- **`event_rsvps`/`drafts`/`draft_picks`** — collapse the 2 overlapping policy sets into one.

Deliverable: a single migration file per table family plus an updated `docs/rls-matrix.md` mapping every table → who can do what.

## Phase 3 — Plugin / Asset Library hardening

Today `club_installed_assets` has correct RLS (admins write, members read). Gaps are in the **frontend**:

- No route guard that asserts "plugin X is installed for the active club" before rendering its routes (Lockbox, Nexus, Pickem, Portfolio Wars, Drafts, Polls, Rankings, Lore, Celebrations, Rune Delve).
- Plugin-config screens rely on `isClubAdmin` checks scattered per page.

Add:

- `usePluginEnabled(slug)` hook backed by `club_installed_assets`.
- `<PluginRoute slug="lockbox">` guard wrapping each plugin's route subtree, redirecting to `/dashboard` if not installed.
- `<PluginAdminRoute slug="...">` for plugin settings screens (requires `isClubAdmin && installed`).
- Server-side: every plugin-data table policy must also assert the plugin is installed for that club (`EXISTS (SELECT 1 FROM club_installed_assets WHERE club_id = ... AND asset_slug = ... AND enabled)`).

## Phase 4 — Admin & audit logging

- Consolidate `admin_logs`, `admin_audit_log`, `activity_feed` — there are 3 overlapping log tables. Pick `admin_audit_log` as the canonical security log.
- Add a SECURITY DEFINER RPC `log_admin_action(action_type, target_type, target_id, metadata)` that always stamps `actor_user_id = auth.uid()` server-side (clients can't forge it).
- Wire it into: role grant/revoke, club create/delete/transfer, member remove, plugin install/uninstall, channel delete, post/comment hard-delete, invite create/revoke, club_request approve/reject, push subscription wipe.
- Confirm `admin_audit_log` SELECT remains `is_app_admin` only.

## Phase 5 — Auth, sessions, frontend guards

- Verify `ProtectedRoute`, `ClubGate`, `AdminRoute`, `ClubAdminRoute` are applied to every sensitive route in `App.tsx` (manual sweep + add a lint rule / test).
- `signOut()` should also clear app-scoped localStorage keys (chat last channel, dismissals, draft drafts, push state, lovable cache) and invalidate React Query.
- Audit localStorage usage — list every key, mark which are non-sensitive UI state vs anything that could be PII; remove the latter.
- Confirm Supabase tokens stay in localStorage (default) but no other auth-equivalent secrets are stored there.
- Add `password_hibp_enabled = true` (already done) and document the manual QA in `docs/security-p0-hardening.md`.
- Disable anonymous sign-ups (already done — verify in `configure_auth`).

## Phase 6 — Storage hardening (chat-attachments)

This is the largest residual P0 risk:

- `chat-attachments` is a **public** bucket; URLs are unguessable but listable per linter.
- Migrate to **`chat-attachments-private`** (already exists):
  - Edge function `sign-chat-attachment(path)` returns a 5-minute signed URL.
  - Client component (`ChatAttachmentImage`, `LinkPreviewCard`) calls it on demand and caches in memory.
  - New uploads go to private bucket; old public URLs grandfathered or migrated by a one-shot edge function.
- Storage policies: only club members can `SELECT` (signed URL request) on objects whose first folder segment matches a `club_id` they belong to; only the uploader can `INSERT`/`DELETE`.
- Validate uploads in `chatAttachments.ts`: MIME allowlist (`image/png|jpeg|webp|gif`), max 8 MB, dimension cap. Reject anything else server-side via the sign function.
- `avatars` bucket: keep public (intentional) but enforce path `${user_id}/...` ownership.

## Phase 7 — Edge functions hardening

For every function in `supabase/functions/`:

- Confirm JWT validation (`getClaims`) for any user-triggered function. Public webhooks must validate signatures (sync-games already does pool-scoped check — pattern to copy).
- Add Zod input validation at the top of each handler.
- Apply `consume_ai_quota` to every AI-calling function (`suggest-items`, `check-draft-pick`, `enrich-*`, `rate-draft`, `resolve-pick-dispute`, `suggest-playoff-topics`, `pickem` AI helpers, `pw-week-action` if it calls AI).
- Standardize CORS via SDK helper.
- Never echo raw DB errors; map to safe `{error: 'Internal error', code: '...'}`.
- Confirm only `SUPABASE_SERVICE_ROLE_KEY` is used server-side and never imported into `src/`.

Frontend secret sweep: grep `src/` for `service_role`, `SERVICE_ROLE`, `SECRET`, `VAPID_PRIVATE`, `FINNHUB`, `TMDB_READ_ACCESS`. None should exist (already verified for VAPID; confirm full list).

## Phase 8 — Input validation, output escaping, abuse limits

- Add a shared `src/lib/validation/` directory with Zod schemas for: club name, channel name, post body, comment body, poll question/options, ranking item, event title/description, draft topic, profile display name, invite code, plugin settings.
- Use the same schemas in edge functions (port to Zod-Deno).
- Sanitize markdown rendering: use `react-markdown` with `disallowedElements=['script','iframe','style']` and `urlTransform` to block `javascript:`. Audit every `dangerouslySetInnerHTML` (should be zero — verify).
- External links: enforce `rel="noopener noreferrer"` + `target="_blank"` via a shared `<SafeLink>`.
- Rate limits via `consume_ai_quota`-style RPCs on: invite creation, post creation, comment creation, poll creation, RSVP spam, push test-send.

## Phase 9 — Privacy review

- `profiles` exposes `display_name` + `avatar_url` to all signed-in users — fine.
- Birthdays / celebrations table: confirm visibility column is enforced in RLS, not just UI.
- Member roster of a club is only visible to club members (already enforced via `current_user_club_id()`). Re-verify after phase 2.
- Push subscriptions visible only to owner (verify policy).
- Notification preferences: owner-only.
- Document a "what is visible to whom" matrix in `docs/privacy-matrix.md`.

## Phase 10 — Test checklist & docs

Add `docs/security-checklist.md` with the brief's test list plus:

- Playwright e2e tests for the most important guards:
  - non-member of club B cannot read club B drafts/posts/messages
  - regular member cannot open `/club/settings`
  - regular member cannot install/uninstall a plugin
  - removed member loses access on next request (no stale cache)
  - direct URL to `/admin/*` redirects non-admins
  - uninstalled plugin route 404s/redirects
- Add `npm run security-check` script that runs the linter + a custom grep for forbidden patterns (service-role import in `src/`, `dangerouslySetInnerHTML`, `USING (true)` in new migrations).

Update `docs/security-p0-hardening.md` to reference this multi-phase plan and mark P1 items as in-progress.

---

## Technical notes

- Out of scope: replacing `current_user_club_id()` (depends on the architectural decision above).
- Out of scope: application-level encryption of message bodies. Brief explicitly says "do not invent custom crypto" — we'll rely on TLS + Postgres-at-rest + tightened RLS, and document this choice.
- One **pre-existing build error** in `src/components/celebrations/AddMilestoneModal.tsx:113` (TS2322 on `CelebrationVisibility`) is unrelated and will be fixed as a one-line type cast in phase 1.
- Migrations will be split per phase so each can be rolled back independently. No single migration touches more than ~10 tables.
- Each phase ends with a re-run of `supabase--linter` to confirm zero regressions and that the unfixed-finding count is monotonically decreasing.

## Suggested execution order

Phase 1 (linter) → Phase 4 (audit log infra) → Phase 2 (RLS consolidation, leans on the new audit log for visibility) → Phase 3 (plugin guards) → Phase 6 (storage migration — biggest user-facing change) → Phase 7 (edge funcs) → Phase 5 (frontend guards) → Phase 8 (validation) → Phase 9 (privacy) → Phase 10 (tests + docs).

Recommend pausing after each phase for QA rather than shipping all 10 at once.
