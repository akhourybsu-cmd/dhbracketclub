

## Chat System Security Audit & Fixes

### PHASE 1 — Current Security Inventory

**Features**: Channels, categories, messages, threads/replies, reactions, pinning, unread tracking, search, editing, deletion, image uploads, rich link previews, shared media repository, typing indicators, push notifications, @mentions.

**Tables involved**: `channels`, `channel_categories`, `messages`, `message_reactions`, `message_link_previews`, `channel_read_states`, `push_subscriptions`, `push_throttle`, `notification_preferences`, `profiles`.

**Storage**: `chat-attachments` bucket (public).

**Edge Functions**: `send-push-notification`, `fetch-link-preview`.

**Key files**: `ChatPage.tsx`, `MessageBubble.tsx`, `MessageComposer.tsx`, `LinkPreviewCard.tsx`, `ThreadPanel.tsx`, `ChannelList.tsx`, `SharedMediaPage.tsx`, `useChatMessages.ts`, `useChatRealtime.ts`, `useChatActions.ts`, `linkParser.ts`.

**Trust model**: All authenticated users are trusted club members (invite-code gated). No per-channel membership. This is appropriate for a private friend-group app.

---

### PHASE 2 — Access Control / Permission Audit

#### CRITICAL: Messages UPDATE RLS Policy Allows Any User to Edit Any Message

The current UPDATE policy on `messages`:
```
USING: (auth.uid() = user_id) OR (auth.uid() IS NOT NULL)
WITH CHECK: (auth.uid() = user_id) OR ((auth.uid() IS NOT NULL) AND (user_id = user_id))
```
- `(auth.uid() IS NOT NULL)` is true for ALL authenticated users
- `(user_id = user_id)` compares the column to itself — always true
- **Any authenticated user can edit any message's content, set `is_pinned`, or modify `edited_at`**

The intent was to let any user pin/unpin messages while restricting content edits. The implementation is broken.

**Severity**: Critical — a user could silently alter another user's messages.

**Fix**: Split the concern. Allow all authenticated users to update `is_pinned` only, and restrict content/edited_at changes to the message author. Since RLS can't do column-level checks, we need two approaches:
1. Tighten the RLS UPDATE policy to owner-only: `auth.uid() = user_id`
2. Create a separate `toggle_pin` security-definer function that only updates `is_pinned`
3. Update client code to call the RPC for pinning instead of direct `.update()`

#### Other Access Findings (Low/Acceptable for Private App)

- **All channels visible to all authenticated users** — By design. No per-channel membership needed for a private club.
- **All messages readable by all authenticated users** — By design. SELECT policy is `true` for authenticated.
- **Any user can delete any link preview** — By design (community moderation model, documented).
- **Realtime subscriptions scoped by channel_id** — Correct and safe.
- **`push_throttle` has RLS enabled but no policies** — Only accessed by edge function using service role key, so this is fine (no client access possible).
- **Storage: any authenticated user can upload to `chat-attachments`** — Appropriate. Files are scoped to user folders for deletion.

---

### PHASE 3 — Data Protection / Privacy

- **Transport**: All traffic uses HTTPS (Supabase enforces TLS). This is secure.
- **Server-side storage**: Messages stored in plaintext in Postgres. This is standard and appropriate. Supabase provides encryption-at-rest for the database volume.
- **E2EE is NOT implemented and NOT practical** here. The app relies on server-side search, link previews, push notifications with message content, and shared media aggregation — all of which require the server to read message content.
- **Recommended model**: Secure transport (TLS) + server-side encryption-at-rest (provided by infra) + strict RLS + minimal data exposure. This is honest and appropriate for a private friend-group app.

---

### PHASE 4 — Input Safety / Content Handling

- **No `dangerouslySetInnerHTML` on user content** — Only used in chart.tsx for theme CSS. Safe.
- **URL rendering**: Uses `<a>` tags with `target="_blank" rel="noopener noreferrer"`. Safe.
- **`isSafeUrl()` check**: Validates `http:` / `https:` protocols before rendering link previews. Good.
- **Search uses `.ilike()`** via Supabase SDK — parameterized, no SQL injection risk.
- **Spotify embed**: Uses iframe with allowlisted URL pattern (`open.spotify.com/embed/...`). The `embedType` and `embedId` are extracted via regex. Should validate `embedType` against a whitelist to prevent iframe URL manipulation.

**Fix needed**: Validate Spotify `embedType` against known values (`track`, `album`, `playlist`, `artist`, `episode`, `show`).

---

### PHASE 5 — Realtime / Session Security

- **Realtime channel scoped by `channel_id`** — Correct.
- **No cross-channel data leakage** — Filters are server-side via Postgres changes.
- **Channel switch resets state** — `selectChannel()` clears search, edits, drafts, thread. Good.
- **Auth state handled by Supabase SDK** — Session refresh and logout handled automatically.
- **No issues found**.

---

### PHASE 6 — Abuse / Spam Resilience

- **Push notification throttling** — 1 per minute per channel, with active viewer suppression. Good.
- **No client-side rate limiting on message sends** — The `sending` state prevents double-sends but doesn't limit rapid sequential sends.
- **`fetch-link-preview` SSRF risk** — The edge function fetches arbitrary URLs. It validates protocol (http/https) but doesn't block private IP ranges (10.x, 172.16.x, 192.168.x, localhost, etc.). An attacker could probe internal infrastructure.
- **No file size validation on upload** — Storage bucket likely has default limits, but no explicit client-side check.

**Fixes needed**:
1. Add private IP blocking to `fetch-link-preview`
2. Add client-side file size limit (e.g., 10MB per image)

---

### PHASE 7-8 — Logging / Mobile / Shared Content

- **No security-sensitive audit logging** for message edits/deletes — acceptable for a small private app.
- **Shared media accessible to all authenticated users** — By design.
- **No mobile-specific access leaks** — All access is gated by auth.

---

### PHASE 9 — Implementation Plan

#### Fix 1: Messages UPDATE RLS (Critical)
**Migration SQL**:
1. Drop the existing overly-permissive UPDATE policy
2. Create strict owner-only UPDATE policy: `auth.uid() = user_id`
3. Create `toggle_message_pin` security-definer function that only updates `is_pinned`

**Code changes**:
- `src/hooks/useChatActions.ts` — Change `togglePin` to call `supabase.rpc('toggle_message_pin', { message_id: msg.id })` instead of `.update({ is_pinned: !wasPinned })`

#### Fix 2: Spotify Embed Type Validation (Low)
**File**: `src/components/chat/LinkPreviewCard.tsx`
- Validate `link.embedType` against `['track', 'album', 'playlist', 'artist', 'episode', 'show']` before rendering iframe

#### Fix 3: SSRF Protection in fetch-link-preview (Medium)
**File**: `supabase/functions/fetch-link-preview/index.ts`
- Add hostname/IP validation to block private ranges, localhost, and metadata endpoints before fetching

#### Fix 4: Client-side Upload Size Limit (Low)
**File**: `src/components/chat/MessageComposer.tsx`
- Reject files larger than 10MB with a toast error

#### Fix 5: Security Documentation
**File**: `PRODUCT_KNOWLEDGE.md` or inline comments
- Document the actual security model: TLS transport, server-side encryption-at-rest, RLS enforcement, no E2EE

### Summary

| Finding | Severity | Fix |
|---------|----------|-----|
| Messages UPDATE RLS lets any user edit any message | **Critical** | Restrict to owner + pin RPC |
| fetch-link-preview can reach private IPs (SSRF) | Medium | Block private IP ranges |
| Spotify embed type not validated | Low | Whitelist valid types |
| No client-side upload size limit | Low | 10MB max per file |
| No E2EE | Info (by design) | Document honestly |

