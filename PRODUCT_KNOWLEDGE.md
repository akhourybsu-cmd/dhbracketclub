# Bracket Battle — Product Knowledge

## Product Summary
Bracket Battle is a mobile-first web app for private March Madness bracket pools among friends. Users create or join pools, fill out tournament brackets, and compete on leaderboards as results come in. **This is NOT a gambling app** — no betting, wagering, odds, spreads, moneylines, or money-based competition.

## Users
1. **Pool Owner / Admin** — creates pools, manages settings, can enter/override results
2. **Pool Member** — joins pools, fills out brackets, views leaderboards

## App Terminology
- **Pool** — a private group competing with brackets
- **Bracket** — a user's set of picks for an entire tournament
- **Pick** — selecting a team to win a specific game
- **Lock Time** — deadline after which brackets become read-only
- **Standings** — ranked leaderboard within a pool
- **Invite Code** — 6-character code to join a pool

## Pages
- Landing, Auth, Dashboard, Create Pool, Join Pool, Pool Detail
- Bracket Entry, Bracket Detail, Bracket Compare
- Leaderboard, Admin Tools, Profile

## Data Model
- `profiles` — user display info
- `tournaments` — tournament metadata
- `teams` — 64 teams with seed/region
- `games` — 63 games with round/slot/region structure
- `pools` — private groups with invite codes
- `pool_members` — membership with role (admin/member)
- `brackets` — one per user per pool
- `bracket_picks` — individual game picks
- `scoring_rules` — per-pool point values by round
- `standings` — cached scores/ranks per pool
- `admin_logs` — audit trail for admin actions
- `sync_logs` — (phase 2) external data sync history

## Scoring Rules (Default)
| Round | Points |
|-------|--------|
| Round of 64 | 1 |
| Round of 32 | 2 |
| Sweet 16 | 4 |
| Elite 8 | 8 |
| Final Four | 16 |
| Championship | 32 |

## Bracket Lock Rules
- Before lock: users can edit their own bracket (draft or submitted)
- After lock: all brackets are read-only
- After lock: members can view each other's submitted brackets
- Unsubmitted but complete drafts at lock → treated as locked
- Incomplete drafts at lock → marked incomplete, non-competitive

## Bracket Statuses
- `draft` — in progress, editable
- `submitted` — finalized before lock
- `locked` — frozen after lock time
- `incomplete` — not enough picks at lock

## Security
- Row-Level Security on all tables
- `is_pool_member` / `is_pool_admin` security definer functions
- Users can only edit own profiles and brackets
- Pool data scoped to members only
- API keys never in frontend code

## UX Principles
- Mobile-first, dark mode default
- Sports-inspired but clean, not a sportsbook clone
- No gambling language anywhere
- Bracket readability > flashy effects
- Competitive feel through leaderboards and status indicators

---

## Phase One (Complete)
- Authentication (email/password)
- User profiles
- Private pools with invite codes
- Tournament data model (64 teams, 63 games)
- Bracket pick entry with cascade logic
- Save draft / submit bracket
- Lock picks after deadline
- Bracket viewing and comparison
- Scoring engine (server-authoritative)
- Leaderboard with champion picks
- Admin mock result entry
- Admin audit logging

## Phase One Non-Goals (Delivered Later)
- External sports APIs
- Realtime subscriptions
- Live game syncing
- Push notifications
- Multiple tournaments per season UI
- Women's bracket UI
- Yearly archives

---

## Phase Two (Current)

### Objectives
1. Integrate external sports data via server-side Edge Functions
2. Abstract the data provider so the source can be swapped
3. Build a sync pipeline that normalizes external data into existing tables
4. Automatically recalculate standings after game results sync
5. Enable realtime updates on leaderboard and game data
6. Provide sync status visibility and admin override controls

### Live Data Architecture
- **External APIs are accessed ONLY through backend Edge Functions** — never from the frontend
- **Provider Abstraction**: A `SportDataProvider` interface defines `fetchGames()`, `fetchTeams()`, etc. Concrete implementations (e.g. ESPN, NCAA, SportsDataIO) are swappable
- **Normalization**: Raw API responses are mapped to the existing `games` table schema before any database writes
- **Game data is normalized before touching UI tables** — raw provider data never enters the DB directly

### Realtime Architecture
- Supabase Realtime enabled on `games` and `standings` tables
- Frontend subscribes to postgres_changes for live leaderboard/game updates
- **Realtime updates are layered on top of stable stored database state** — UI always falls back to latest DB query
- No optimistic updates for score data; always server-authoritative

### Provider Abstraction Principles
- Edge Function accepts a provider parameter or uses a configured default
- Provider returns normalized data matching internal schema
- Provider errors are caught, logged, and surfaced to admin — never silently dropped
- Provider can be swapped without changing sync logic or UI

### Sync Lifecycle
1. Sync triggered (scheduled cron or admin manual trigger)
2. Edge Function fetches from configured provider
3. Raw data normalized to internal game format
4. Upsert into `games` table (only changed fields)
5. Standings recalculation triggered for affected pools
6. Sync result logged to `sync_logs`
7. Realtime broadcasts changes to connected clients

### Standings Recalculation Rules
- **Scoring logic remains server-authoritative**
- Recalculation runs after every sync that changes game winners
- Safe to run repeatedly (idempotent upsert)
- Recalculates: total_points, correct_picks, possible_points_remaining, rank
- Rank computed per pool with tie handling

### Admin Fallback Rules
- Admins can always manually override any game result
- Manual overrides take precedence over synced data
- Manual overrides are flagged in `admin_logs`
- Admins can pause/resume automatic sync per pool or globally
- Admins can trigger a manual re-sync at any time

### Error Handling Expectations
- Provider API failures → log error, retain last known good data, surface status to admin
- Partial sync failures → apply successful updates, log failures separately
- Rate limiting → respect provider limits, implement backoff
- Stale data detection → track last_synced_at, warn if data is old

### Phase Two Non-Goals
- Gambling or betting features
- Push notifications
- Chat
- Presence / who is online
- Women's bracket support
- Historical archive UI
- Advanced analytics beyond standard pool standings

---

## Phase Three (Future Notes)
- Women's bracket support
- Multiple tournaments per season
- Historical season archives
- Advanced analytics and insights
- Social features (reactions, comments)
- Push notifications
- Mobile native wrapper (PWA or Capacitor)
- Public pool discovery
- Custom scoring rule templates
- Export/share bracket images
