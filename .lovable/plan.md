
The user wants PWA updates to propagate quickly on mobile devices. Looking at current setup:

- `useAppUpdate.ts` polls every 15s + on visibility change, shows toast, auto-reloads after 2.5s
- `vite.config.ts` has `registerType: "autoUpdate"`, `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`
- `sw-push.js` clears non-workbox caches on activate

This is already pretty aggressive. Issues that can still slow mobile updates:
1. iOS Safari throttles background tabs hard — 15s polling stops when backgrounded
2. The Supabase NetworkFirst runtime cache can serve stale `index.html`-adjacent responses
3. No explicit check on app mount (only after 15s)
4. `useAppUpdate` is only called once — need to verify it's mounted at app root
5. The toast 2.5s delay before reload feels long when user just wants the latest

### Plan

**1. Faster initial + foreground update checks (`src/hooks/useAppUpdate.ts`)**
- Trigger an immediate `registration.update()` call on SW registration (don't wait 15s for first check)
- Reduce poll interval from 15s → 10s
- Add `focus` and `online` event listeners (in addition to `visibilitychange`) — iOS fires `focus` more reliably when returning from background
- Reduce toast→reload delay from 2.5s → 1.2s so updates feel near-instant
- Add a manual check on route change is overkill; skip it

**2. Prevent stale shell on mobile (`vite.config.ts`)**
- Add `navigateFallback: null` behavior is fine, but add `cacheId` bump and ensure `index.html` is served NetworkFirst (currently it's precached). Switch to a runtime caching rule for navigation requests so the HTML shell is always fresh when online:
  - Add a `navigateFallback` with NetworkFirst-style behavior via `runtimeCaching` for `request.mode === 'navigate'` with a 3s network timeout
- Reduce Supabase API cache TTL from 5min → 60s to avoid stale data after deploys
- Confirm `skipWaiting`/`clientsClaim` stay enabled (already set)

**3. Verify mount point**
- Confirm `useAppUpdate()` is called once at the app root (`App.tsx`). If not present, wire it in.

**4. Service worker activation cleanup (`public/sw-push.js`)**
- Already clears non-workbox caches on activate — keep as-is, it's correct
- Add `self.skipWaiting()` call in `install` event for belt-and-suspenders

### Files to modify
- `src/hooks/useAppUpdate.ts` — faster polling, more triggers, shorter toast delay
- `vite.config.ts` — navigation NetworkFirst, shorter Supabase cache
- `public/sw-push.js` — add `skipWaiting` on install
- `src/App.tsx` — verify `useAppUpdate()` is mounted (no-op if already there)

### Result
Mobile users will see updates within ~10s of returning to the app, and within ~3s of opening it cold (vs currently waiting up to 15s of foreground time). Toast reload window drops from 2.5s → 1.2s.
