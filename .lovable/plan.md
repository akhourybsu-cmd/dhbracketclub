# Club-Scope All Activities

Make every competition and social feature private to the user's club. Today the platform was built single-group, so almost no game tables carry a `club_id` and their RLS allows any authenticated user to read everything. This plan adds club isolation across the board.

## Ground rules

- **`club_id uuid NOT NULL`** added to every activity-owning table.
- **RLS** rewritten so reads/writes require the row's `club_id = current_user_club_id()` (or app admin).
- **Per-club challenges**: PW, Lockbox, NFL Pick'em weeks/challenges become per-club. Cron jobs fan out to create one row per active club.
- **Backfill**: every existing row is assigned to Alex K.'s club (DH Club).
- **Triggers**: a `set_club_id_from_user()`-style trigger auto-stamps `club_id` on insert from `current_user_club_id()` so existing client code keeps working.

## Tables getting `club_id` + RLS rewrite

Grouped by module:

```text
Portfolio Wars   pw_challenges, pw_entries, pw_picks, pw_price_snapshots, pw_accolades
Lockbox          lockbox_weeks, lockbox_locks, lockbox_attempts, lockbox_guesses, lockbox_scores
NFL Pick'em      nfl_seasons, nfl_weeks, nfl_games, nfl_picks, nfl_tiebreakers,
                 nfl_weekly_standings, nfl_season_standings
Drafts           drafts, draft_participants, draft_picks, draft_results,
                 draft_pick_disputes, draft_seasons, draft_season_entries,
                 draft_season_standings, draft_playoff_matches
Nexus            nexus_runs, nexus_progress, nexus_operations, nexus_operation_runs,
                 nexus_operation_contributions, nexus_user_sigils, nexus_user_boosts,
                 nexus_salvage_wallet, nexus_salvage_ledger
                 (catalog tables nexus_sigils/nexus_boosts/nexus_mission_drafts stay global)
Rune Delve       rune_delve_daily_runs, rune_delve_daily_streaks,
                 rune_delve_class_progress, rune_delve_loadouts, rune_delve_active_quests
                 (bestiary, dungeons, levels, heroes, failure_rewards stay global catalog)
Social           posts, post_comments, polls, poll_options, poll_votes,
                 rankings, ranking_items, ranking_submissions, ranking_submission_entries,
                 events, event_rsvps, event_comments, lore_entries, lore_contributions,
                 lore_reactions, activity_feed, reactions
Chat             channels, channel_categories already scoped via club_members; verify and tighten
```

## Per-club weekly challenge fan-out

Today a single weekly row drives all users. After this change:

- PW `pw_challenges`, Lockbox `lockbox_weeks`, NFL `nfl_weeks` get `club_id`.
- Cron edge functions (`pw-create-week`, `lockbox-rollover`, `nfl-create-week`) loop over active clubs and insert one row per club per week.
- Finalization functions (`pw-finalize`, `lockbox-finalize`, `nfl-score-week`) likewise loop per club.
- Leaderboards already join through these tables, so they become naturally club-scoped.

## Backfill strategy

One migration block, run after columns are added but before `NOT NULL` is enforced:

```sql
WITH dh AS (SELECT id FROM clubs ORDER BY created_at LIMIT 1)
UPDATE pw_challenges SET club_id = (SELECT id FROM dh) WHERE club_id IS NULL;
-- repeat for each table
```

Then `ALTER TABLE ... ALTER COLUMN club_id SET NOT NULL`.

## Frontend impact

- All Supabase reads stop needing manual `club_id` filters (RLS handles it), but inserts that don't go through a trigger get `club_id: currentClubId` added.
- `ClubContext` already exposes `currentClubId`; reuse it.
- Pages mostly need no logic changes — leaderboards, lists, etc. will naturally narrow to club.

## Edge functions touched

- `pw-create-week`, `pw-finalize`, `pw-refresh-quotes`
- `lockbox-rollover`, `lockbox-finalize`, `lockbox-daily-reminder`
- `nfl-create-week`, `nfl-score-week`, `nfl-sync-scores`
- Any push-fanout functions: scope recipient queries to the row's club.

## Rollout phases (one migration per phase, executed in order)

1. **Phase A — Portfolio Wars** (smallest, validates the pattern): add `club_id`, backfill, RLS rewrite, trigger, update `pw-*` edge functions, verify in preview.
2. **Phase B — Lockbox + NFL Pick'em**: same pattern, update cron functions.
3. **Phase C — Drafts + Draft Seasons**: includes season standings recompute scoping.
4. **Phase D — Nexus + Rune Delve**: keep catalog tables global, scope user-progress tables.
5. **Phase E — Social** (posts, polls, rankings, events, lore, activity_feed, reactions): tighten RLS.
6. **Phase F — Chat audit**: verify channels/messages already enforce membership; close any gaps.
7. **Phase G — Memory + docs**: update `mem://architecture/group-model` to reflect multi-club, update Core rules.

Each phase is a separate approval so you can test between them and roll back cleanly. I'll start with Phase A and pause for your review before continuing.

## Open risks

- **Cron multiplication**: with N clubs the per-week row count multiplies. Fine while N is small (~1–5).
- **Cross-club admin views**: app admins (Alex K.) keep visibility via `is_app_admin` bypass in every policy.
- **Single-club users**: today every user belongs to exactly one club (`current_user_club_id` returns one row). If you ever want users in multiple clubs, the policies will need to switch from `=` to `IN (...)` — easy follow-up.

Approve to start with **Phase A (Portfolio Wars)**.