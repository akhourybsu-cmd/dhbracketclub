

## Fix Clipping & Out-of-Bounds Issues on Mobile (iPhone)

After reviewing the codebase, I identified several areas where content can clip or escape boundaries, especially on iPhones with notches/Dynamic Island and safe area insets.

---

### Issues Found

1. **Channel list view not scrollable on mobile** — The channel list wrapper (`div.w-full`) inside the chat page has no `overflow-y-auto`. If there are many channels, they overflow the container and get clipped by `overflow-hidden` on the parent. On iPhone this means channels at the bottom are unreachable.

2. **No horizontal safe area insets** — The app uses `env(safe-area-inset-bottom)` in several places but never accounts for `safe-area-inset-left` or `safe-area-inset-right`. On iPhones in landscape, content can clip behind the notch/sensor housing. The `viewport-fit=cover` meta tag is already set, which means the app *must* handle safe areas on all sides.

3. **Chat header back button clips on left edge** — The back chevron (`-ml-1`) in the message view header sits very close to the left edge. On iPhones with rounded corners or in landscape, this can feel clipped.

4. **Mobile action sheet (reactions) lacks side safe areas** — The `MessageBubble` action sheet is `fixed bottom-0 left-0 right-0` with only bottom safe area padding. On landscape iPhone, the left/right edges can be behind the notch.

5. **Channel list `ChannelList.tsx` padding doesn't account for safe areas** — The `px-4` is fine for portrait but insufficient for landscape on notched iPhones.

---

### Plan

#### 1. Make channel list scrollable on mobile
In `ChatPage.tsx` (line 606), add `overflow-y-auto` to the channel list wrapper div so the list scrolls when channels exceed the viewport height.

#### 2. Add horizontal safe area insets globally
In `index.css`, add `padding-left: env(safe-area-inset-left, 0px)` and `padding-right: env(safe-area-inset-right, 0px)` to the `body` element. This protects all content from landscape notch clipping without needing per-component changes.

#### 3. Add safe area padding to the mobile bottom nav
In `AppLayout.tsx` (line 180), the mobile nav already has bottom safe area but not left/right. Add `paddingLeft: 'env(safe-area-inset-left, 0px)'` and `paddingRight: 'env(safe-area-inset-right, 0px)'` to the style object.

#### 4. Add safe area padding to the chat message action sheet
In `MessageBubble.tsx`, the fixed action sheet (line 379) needs horizontal safe area insets added to its style: `paddingLeft` and `paddingRight` with `env(safe-area-inset-left)`.

#### 5. Increase chat header left padding on mobile
In `ChatPage.tsx` (line 647), change `-ml-1` on the back button to `-ml-0.5` and add `pl-[max(1rem,env(safe-area-inset-left,0px))]` to the header bar so it respects the left safe area.

#### 6. Add safe area to MessageComposer
In `MessageComposer.tsx` (line 184), add left/right safe area insets to the container's style object alongside the existing bottom inset.

---

### Files to modify

| File | Change |
|------|--------|
| `src/index.css` | Add `padding-left/right: env(safe-area-inset-left/right)` to `body` |
| `src/components/AppLayout.tsx` | Add horizontal safe area to mobile bottom nav |
| `src/pages/ChatPage.tsx` | Add `overflow-y-auto` to channel list wrapper; add safe area to chat header |
| `src/components/chat/MessageBubble.tsx` | Add horizontal safe area to action sheet |
| `src/components/chat/MessageComposer.tsx` | Add horizontal safe area to composer container |

