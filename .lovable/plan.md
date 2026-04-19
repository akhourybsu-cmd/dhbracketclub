
The user already has the PWA installed on Android and isn't getting the latest version, even after our recent update improvements. The issue: Android Chrome PWAs cache the precached `index.html` very aggressively, and the existing installed SW (from before our recent changes) may not be checking often enough — or the precache manifest itself isn't being invalidated.

Looking at current state:
- `vite.config.ts` precaches `**/*.{js,css,html,...}` — this includes `index.html`. Even with our NetworkFirst nav rule, Workbox's precache controller can still serve the precached HTML before the runtime route matches.
- Android installed PWAs often keep the OLD service worker active for a long time because the browser only checks for SW updates ~every 24h on its own when foregrounded briefly.
- The user's *currently installed* SW is the old one — it doesn't have our new 10s polling or focus listeners yet. They need ONE good update to land, then future updates will be fast.

### Root causes
1. `index.html` is in the precache → served instantly from cache, never hits network on navigation
2. Old installed SW doesn't aggressively self-update on Android
3. No "tap to update now" escape hatch when user knows there's a new version

### Plan

**1. Stop precaching `index.html`** (`vite.config.ts`)
- Remove `html` from `globPatterns` so the HTML shell is never precached
- The existing NetworkFirst nav route will fetch fresh HTML every time (with 3s timeout fallback to cache)
- This is the single biggest fix — guarantees the next visit pulls fresh HTML which loads fresh JS hashes

**2. Add a manual "Update available" action** (`src/hooks/useAppUpdate.ts`)
- When `needRefresh` is true, in addition to the auto-reload toast, also expose a tap-to-update button via the toast action
- Shorter, clearer messaging
- Also: call `registration.update()` once on every route change (cheap, no-op when nothing new)

**3. Force one-time SW reset for stuck installs** (`public/sw-push.js` + `src/main.tsx`)
- Bump a `SW_VERSION` constant in `sw-push.js` so the SW file content changes → forces browser to detect SW update
- In `main.tsx`, on app boot, if a query param `?fresh=1` is present, unregister all SWs and clear all caches then reload — gives the user a recovery URL to share

**4. User recovery instructions**
- Tell user: open `https://dhbracketclub.lovable.app/?fresh=1` once on the installed PWA — this nukes the old SW and caches, then on next launch the new fast-update SW takes over.
- After that one-time reset, all future updates land within ~10s of opening the app.

### Files to modify
- `vite.config.ts` — drop `html` from precache globs
- `src/hooks/useAppUpdate.ts` — route-change update check, clearer toast with action
- `public/sw-push.js` — version bump comment to invalidate
- `src/main.tsx` — `?fresh=1` recovery handler

### Result
- Next deploy: installed Android PWA pulls fresh `index.html` on next launch (no longer precached)
- New SW takes over with 10s polling + focus/online listeners
- User has `?fresh=1` recovery URL if stuck
- Future updates: visible within seconds of foregrounding
