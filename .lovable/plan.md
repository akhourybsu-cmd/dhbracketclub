

# Fix Push Notifications — Reliable End-to-End

## Root Cause

The database trigger (`on_new_message_push_notify`) calls `net.http_post` to invoke the edge function, but `net._http_response` has zero rows and the edge function has zero logs. This means the trigger's HTTP call is silently failing — likely due to vault secret retrieval issues or pg_net job execution timing. The DB-trigger-to-edge-function pipeline has too many fragile moving parts (vault secrets, pg_net async jobs, custom Web Push crypto).

Additionally, the `push_subscriptions` table is missing an **UPDATE** RLS policy, so the `upsert` call in the client silently fails when a user re-subscribes from the same browser.

## Plan

### 1. Switch from DB trigger to client-side edge function invocation
Instead of relying on the fragile `pg_net` + vault pipeline, call the edge function directly from the client after a message is successfully inserted. This is the most reliable approach — the client already has auth context and can handle errors visibly.

**Files**: `src/pages/ChatPage.tsx`
- After a successful message insert, fire-and-forget `supabase.functions.invoke('send-push-notification', { body: { record } })`
- No need to await — push is best-effort

### 2. Drop the DB trigger
Create a migration to drop the `on_new_message_push_notify` trigger (keep the function for reference but it won't be used).

### 3. Add UPDATE RLS policy on push_subscriptions
The upsert with `onConflict: 'endpoint'` requires UPDATE permission. Add:
```sql
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
```

### 4. Replace custom Web Push crypto with `web-push` library
The current 280-line hand-rolled ECDSA + AES-128-GCM encryption is error-prone. Replace with the battle-tested `web-push` npm package available via `npm:web-push` in Deno.

**File**: `supabase/functions/send-push-notification/index.ts`
- Import `web-push` via npm specifier
- Use `webpush.sendNotification()` instead of custom crypto
- Keep existing preference filtering and expired subscription cleanup
- Remove `verify_jwt` requirement since client calls will include auth header

### 5. Add a push notification test button
Add a "Send Test Notification" button in the Profile page's notification section so users can verify their setup works.

**Files**: `src/components/profile/NotificationPreferences.tsx`, new edge function logic or inline test

## Technical Details

- The `web-push` library handles VAPID JWT signing and payload encryption correctly — eliminates the most likely failure point (custom crypto)
- Client-side invocation means we get proper error reporting via `supabase.functions.invoke()` return value
- Fire-and-forget pattern ensures message sending speed isn't affected
- UPDATE policy fix ensures re-subscriptions work when users revisit the app

## Files to modify
- `supabase/functions/send-push-notification/index.ts` — rewrite with web-push lib
- `src/pages/ChatPage.tsx` — add post-send push invocation
- `src/components/profile/NotificationPreferences.tsx` — add test button
- Migration: drop trigger + add UPDATE policy

