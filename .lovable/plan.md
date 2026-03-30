

## Fix: Push Content Below the Status Bar

### Problem
The app uses `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style: black-translucent`, which means content renders *behind* the iOS status bar (time, battery, signal). But there is zero `safe-area-inset-top` padding anywhere in the codebase — so page content overlaps the status bar on iPhones.

### Fix
Add top safe area padding in two places to cover all screens:

#### 1. `src/components/AppLayout.tsx`
Add `padding-top: env(safe-area-inset-top, 0px)` to the outer shell `div` (line 99). This pushes all authenticated pages (dashboard, chat, events, etc.) below the status bar. The desktop sidebar also needs `pt-[env(safe-area-inset-top)]` so it doesn't clip on iPad/Mac notch.

#### 2. `src/pages/LandingPage.tsx`
Add `pt-[env(safe-area-inset-top)]` to the outer container (line 15) so the landing header doesn't sit behind the status bar.

#### 3. `src/pages/AuthPage.tsx`
Same — add `pt-[env(safe-area-inset-top)]` to the outer container so the auth form doesn't overlap the status bar.

#### 4. `src/pages/ChatPage.tsx`
The chat header (line 647) needs `padding-top` that accounts for the safe area since chat uses its own full-height layout outside the normal AppLayout content wrapper.

### Scope
Four files, one-line change each. No redesign, no structural changes.

