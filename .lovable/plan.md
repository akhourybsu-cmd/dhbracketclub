

## Chat @Mention Tagging

### What we're building
An @mention system for chat: users type `@` in the composer, see a dropdown of members to tag, and tagged users see highlighted mentions in messages. Tagged users also get push notifications even if they have general chat notifications off.

### Plan

**1. Fetch available users for autocomplete**
- In `ChatPage.tsx`, fetch all profiles (`id`, `display_name`, `avatar_url`) on mount and store in state.
- Pass this list to `MessageComposer`.

**2. Add @mention autocomplete to MessageComposer**
- Detect when the user types `@` followed by characters.
- Show a floating dropdown (positioned above the textarea) filtered by display name.
- On selection, insert `@DisplayName` into the textarea and store the user ID mapping.
- Use a `Popover` or simple absolutely-positioned div for the dropdown list.

**3. Render mentions with highlighting in MessageBubble**
- Update the `renderContent` function in `MessageBubble.tsx` to detect `@DisplayName` patterns.
- Render them as styled spans (e.g., `bg-primary/15 text-primary font-semibold rounded px-1`).
- Highlight mentions of the current user more prominently.

**4. Push notifications for mentions**
- Update the `notify_new_message` database trigger (or the Edge Function) to parse `@mentions` from message content.
- Send push notifications to mentioned users regardless of their `chat_messages` preference (or add a separate `mentions` preference).

### Technical details

- **Mention format in DB**: Store as plain text `@DisplayName` in the message content. No special encoding needed since display names are unique enough for this use case.
- **Autocomplete filtering**: Case-insensitive prefix match on `display_name`.
- **Composer changes**: Track cursor position to know where to insert the mention. Listen for `@` keystrokes to trigger/dismiss the popup.
- **Files modified**:
  - `src/components/chat/MessageComposer.tsx` — autocomplete logic + dropdown UI
  - `src/components/chat/MessageBubble.tsx` — `renderContent` to highlight mentions
  - `src/pages/ChatPage.tsx` — fetch profiles, pass to composer
  - `supabase/functions/send-push-notification/index.ts` — mention-aware notification delivery

