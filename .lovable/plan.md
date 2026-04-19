

## Diagnose: Android PWA not getting updates

### Current state (from code I've read)
- `useAppUpdate.ts` polls `/version.json` every 30s and on focus/visibility/route change. On mismatch → toast + auto nuke + reload via `nukeAndReload()`.
- `nukeAndReload()` unregisters SWs, deletes caches, hard-reloads with `?_v=timestamp`.
- `sw-push.js` is push-only (no fetch handler, no caching).
- `vite.config.ts` emits `/version.json` with `BUILD_ID = Date.now()` at build time.
- `main.tsx` registers `/sw-push.js` only on non-preview hosts.

### Why Android specifically gets stuck

Three high-probability culprits:

1. **The `manifest.webmanifest` `start_url` has no cache-buster.** Android Chrome aggressively caches the launch HTML for installed PWAs. When you tap the home-screen icon, Android may serve a cached `index.html` from HTTP cache *before* JS ever runs — so `useAppUpdate` never gets a chance to fire on a stale shell. The bundle hash inside that stale HTML points at old JS chunks.

2. **No HTTP cache headers on `index.html`.** Lovable hosting may serve `index.html` with default caching. Without `Cache-Control: no-cache` on the shell, Android holds onto it for hours/days.

3. **`/version.json` may itself be cached by Android's HTTP cache** even with `cache: 'no-store'` in the fetch — Android Chrome has been known to ignore that hint for installed PWAs in certain conditions. The query param `?t=${Date.now()}` is there but only helps if the request actually goes out.

4. **No visible recovery affordance** in the installed PWA. The `?fresh=1` escape hatch exists but users can't type URLs into a launched PWA easily.

### Fix plan

**A. Force `index.html` + `version.json` to never be cached**
- Add `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />`, `Pragma: no-cache`, `Expires: 0` to `index.html` `<head>`. Belt + suspenders for Android's HTTP cache.

**B. Cache-bust the PWA `start_url`**
- Change `manifest.webmanifest` `start_url` from `/` to `/?source=pwa` so Android treats launches as a unique URL. Add a `?v=` token isn't possible without a build step — `?source=pwa` is enough to defeat the most aggressive caching path on Android.

**C. Make the version probe bulletproof on Android**
- In `fetchRemoteBuildId()`: switch from `fetch(..., {cache:'no-store'})` to a `Request` with `cache: 'reload'` (forces network revalidation, more reliably honored on Android than `no-store`).
- Add a fallback: if 3 consecutive probes fail to detect change but the page has been open >5 min since last successful check, do a soft `location.reload()` anyway on next focus. Catches the case where the cached JS bundle never sees a fresh `version.json`.

**D. User-facing manual update button (the real fix for frustration)**
- Add a tiny "Check for updates" row to `NotificationPreferences.tsx` (already on Profile page). Tapping it calls `nukeAndReload()` directly. Gives the user a permanent panic button inside the installed PWA — no URL typing needed.
- Show current `__BUILD_ID__` next to it as tiny grey text so the user/you can confirm what version they're on.

**E. Trigger update check on PWA launch**
- In `main.tsx`, after `createRoot`, immediately call `fetchRemoteBuildId()` once before the `useAppUpdate` hook even mounts. Reduces time-to-detect on cold launch from ~30s to ~immediate.

### Files to touch
- `index.html` — no-cache meta tags
- `public/manifest.webmanifest` — `start_url: "/?source=pwa"`
- `src/lib/forceUpdate.ts` — switch to `cache: 'reload'`, add stale-detection fallback
- `src/hooks/useAppUpdate.ts` — track consecutive probe count for fallback reload
- `src/components/profile/NotificationPreferences.tsx` — add "Check for updates" row + build id display
- `src/main.tsx` — fire one immediate `fetchRemoteBuildId` on boot

### Out of scope
- No service worker rewrite (current push-only SW is fine and not the cause).
- No build-pipeline changes.

### How to verify after deploy
1. Install PWA on Android, note build id shown on Profile.
2. Make any code change, publish.
3. Within ~30s of opening the PWA the toast should appear. If not, tap "Check for updates" — should nuke + reload immediately to new build.

