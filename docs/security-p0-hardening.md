# P0 Security Hardening — Closeout

Status: **COMPLETE** (as of this pass)

## Edge functions audited

| Function | Trigger model | Auth gate | Authorization | Verified |
|---|---|---|---|---|
| `suggest-items` | User-triggered (poll/ranking creation) | `Bearer` JWT required, `auth.getUser()` | Any signed-in user | ✅ 401 on no/malformed/invalid JWT |
| `suggest-playoff-topics` | User-triggered (commissioner UI) | `Bearer` JWT required, `auth.getUser()` | Any signed-in user | ✅ 401 on no/malformed/invalid JWT |
| `advance-playoffs` | User-triggered (commissioner UI) | `Bearer` JWT required, `auth.getUser()` | Any signed-in user (further gated by RPCs) | ✅ 401 on no/malformed/invalid JWT |
| `sync-games` | User-triggered (Game Center / pool admin UI) | `Bearer` JWT required, `auth.getUser()` | **Pool-scoped role check** via `pool_members.role` join to `pools.tournament_id`. `syncGameResults` allows any pool member (auto-poll); all other actions require `role='admin'`. | ✅ 401 on no/malformed/invalid JWT; 403 path enforced in code (lines 1969-1989) |

`sync-games` authorization model:
- Reads `pool_members` filtered by `user_id` (and `role='admin'` for non-result actions)
- Joins to `pools` and verifies `pools.tournament_id === body.tournamentId`
- Denies with 403 + log line `[sync-games] DENIED: ...` on mismatch
- No separate RPC; the check is inline in `index.ts` ~L1969-1989 against table `pool_members` (RLS bypassed via service-role client, but the access decision is made server-side from the verified `userId`)

## Auth configuration

- **HIBP leaked-password protection**: `password_hibp_enabled = true` (set via `configure_auth`)
- Email signup: enabled, manual email confirmation (no auto-confirm)
- Anonymous signups: disabled

### HIBP manual QA checklist

1. Open the signup form (or password reset).
2. Enter `password123` (a known leaked password).
3. **Expected**: Supabase rejects with an error like “Password has been found in a data breach…”.
4. **Verify**: the form shows a clean inline error and does not crash. No console errors.
5. Repeat with `qwerty12345` and `letmein123` to confirm consistency.
6. Confirm a strong unique password (e.g. random 16+ chars) is accepted.

## Accepted residual risks (deferred to P1+)

| Risk | Why deferred | Mitigation today |
|---|---|---|
| Public `chat-attachments` storage bucket | Migration to private bucket + signed URLs requires client-side refactor of every `<img>` and link preview that consumes the public URL | Bucket holds only friend-group chat photos; URLs are unguessable UUIDs; club is invite-only |
| Permissive Rune Delve seed INSERT policies | Game-content seeds are written by client during run init; tightening requires moving seed creation to an edge function | RLS still scopes reads/updates per `user_id`; no PII in seed rows |
| No per-user AI rate limiter on `suggest-items` / `check-draft-pick` | Requires a `rate_limits` table + RPC; deferred to P1 along with broader cost-control work | Auth gate now blocks all anonymous abuse; AI calls only run for signed-in club members |

## Recommended P1 starting point

1. **Move `chat-attachments` to private bucket + signed URLs** (highest-leverage residual risk; fixes share-link enumeration concern).
2. Then: per-user AI rate limiter (table `ai_rate_limits(user_id, function_name, window_start, count)` + RPC `consume_ai_quota`).
3. Then: PWA polish + image pipeline (WebP/thumbnail edge function).

Do **not** start P1 work until this closeout is reviewed.
