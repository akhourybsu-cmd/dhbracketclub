

# Push Notifications for Chat Messages

## Overview
When a new message is sent in any chat channel, all other subscribed users receive a browser push notification — even if the app is in the background or closed.

## Architecture

```text
User sends message → messages INSERT
                         ↓
              Database webhook trigger
                         ↓
           Edge Function: send-push-notification
                         ↓
              Web Push API → Browser notifications
```

## Steps

### 1. Generate VAPID keys
Create a one-time edge function `generate-vapid-keys` (or use a script) to generate a VAPID key pair. Store the private key as a secret (`VAPID_PRIVATE_KEY`) and the public key as another secret (`VAPID_PUBLIC_KEY`) or embed it in the codebase since it's a public key.

Alternatively, I'll use the `web-push` npm library in the edge function and ask you to provide pre-generated VAPID keys via the secrets tool.

### 2. Create `push_subscriptions` table
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
-- Service role needs full access for the edge function (uses service role key)
```

### 3. Create edge function `send-push-notification`
- Triggered by a database webhook on `messages` INSERT
- Reads the new message, looks up the channel, fetches all push subscriptions for users in the app (excluding the sender)
- Sends Web Push notifications using the `web-push` library (available for Deno)
- Notification body: sender display name + message preview + channel name

### 4. Set up database webhook
Configure a webhook trigger on the `messages` table for INSERT events that calls the `send-push-notification` edge function.

### 5. Client-side push subscription
Create a `usePushNotifications` hook:
- Check if browser supports push (`'PushManager' in window`)
- Request notification permission
- Subscribe to push via the service worker's `pushManager.subscribe()` with the VAPID public key
- Save the subscription (endpoint, p256dh, auth keys) to the `push_subscriptions` table
- Add a toggle in the Profile page to enable/disable notifications

### 6. Service worker push handler
Add push event handling to the PWA service worker (via `vite-plugin-pwa` `injectManifest` or a custom SW snippet):
- Listen for `push` events
- Show notification with title, body, icon
- Handle `notificationclick` to open/focus the app at the relevant chat channel

## Files to create/modify
- **New migration** — `push_subscriptions` table + webhook trigger
- **New edge function** — `supabase/functions/send-push-notification/index.ts`
- **New hook** — `src/hooks/usePushNotifications.ts`
- **Modified** — `src/pages/ProfilePage.tsx` (add notification toggle)
- **Modified** — `vite.config.ts` (add custom SW for push handler if needed)
- **New** — `public/sw-push.js` (push event handler merged into the PWA SW)

## Secrets needed
- `VAPID_PRIVATE_KEY` — private key for signing push messages
- `VAPID_PUBLIC_KEY` — stored as secret or in codebase (it's public)
- A `VAPID_SUBJECT` (mailto: or URL) — can be hardcoded as the app URL

