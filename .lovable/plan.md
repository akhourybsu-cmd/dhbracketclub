

# Profile Avatars — Custom Photo Upload

## What we're building
Users can upload a profile photo that appears as their avatar across the entire app — on their profile page, in chat messages, thread panels, pinned messages, and pool member lists. The profile page identity card gets a tappable avatar with camera overlay for uploading.

## Changes

### 1. Storage bucket (SQL migration)
Create an `avatars` public storage bucket with RLS policies allowing authenticated users to upload/update/delete files in their own folder (`{user_id}/*`) and anyone to read.

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 2. ProfilePage.tsx — avatar upload UI
- Replace the static initial-letter square with a tappable circular avatar
- If `avatar_url` exists, show the image; otherwise show the gradient initial
- Overlay a small camera icon on hover/tap
- Hidden `<input type="file" accept="image/*">` triggered on click
- On file select: upload to `avatars/{user_id}/avatar.{ext}`, get public URL, update `profiles.avatar_url`
- Show loading spinner during upload
- Fetch `avatar_url` alongside `display_name` in the existing profile query

### 3. UserAvatar component — support avatar images
Add optional `avatarUrl` prop to `UserAvatar`. When provided and non-null, render an `<img>` instead of the gradient initial circle. Fall back to the existing initial if the image fails to load (onError handler).

```
UserAvatar({ userId, name, avatarUrl?, size })
  → if avatarUrl: <img> with rounded-full, object-cover
  → else: existing gradient initial
```

### 4. Pass avatar_url through the app
All places that render `UserAvatar` already query `profiles(display_name, avatar_url)`. Just pass `msg.profiles?.avatar_url` as the new `avatarUrl` prop:
- **MessageBubble.tsx** — two `UserAvatar` calls
- **ThreadPanel.tsx** — parent message + reply avatars
- **ChatPage.tsx** — pinned messages section
- **PoolDetailPage.tsx** — member list (already fetches `avatar_url`)

### 5. Dashboard profile shortcut
The dashboard hero has a profile avatar shortcut — update it to show the user's avatar image if available.

## Files to modify
- **Migration**: new SQL for `avatars` storage bucket + policies
- `src/components/chat/UserAvatar.tsx` — add `avatarUrl` prop with image rendering
- `src/pages/ProfilePage.tsx` — avatar upload UI, fetch/save `avatar_url`
- `src/components/chat/MessageBubble.tsx` — pass `avatarUrl` prop
- `src/components/chat/ThreadPanel.tsx` — pass `avatarUrl` prop  
- `src/pages/ChatPage.tsx` — pass `avatarUrl` to pinned message avatars
- `src/pages/DashboardPage.tsx` — show avatar in profile shortcut

