
The user is stuck — even with `?fresh=1` and our SW updates, the installed Android PWA isn't picking up new versions. Time for a nuclear, universal solution that doesn't rely on the user remembering URLs or the old SW behaving correctly.

## Root problem
The OLD service worker (installed before our fixes) is still in control. It's serving cached HTML, never lets the new SW activate, and the user can't reach `?fresh=1` because even that route loads through the stale shell. We need a solution that works **without** depending on the old SW cooperating.

## The Universal Solution: Build-time version stamping + in-app force-update

### 1. Build-time version stamp (`vite.config.ts` + new `src/lib/version.ts`)
- Inject `__BUILD_ID__` (timestamp) at build time via Vite `define`
- Every deploy gets a unique ID baked into the JS bundle

### 2. Version probe endpoint (`public/version.json`)
- Static file written at build time containing `{ "buildId": "<timestamp>" }`
- Served fresh from network (cache-busted with `?t=${Date.now()}`)
- This bypasses the SW entirely because we fetch with `cache: 'no-store'`

### 3. Active version checker (`src/hooks/useAppUpdate.ts` — rewrite)
- On mount + every 30s + on focus/online: fetch `/version.json?t=<now>` with `cache: 'no-store'`
- Compare server `buildId` to baked-in `__BUILD_ID__`
- If mismatch → show prominent toast with "Update Now" button
- "Update Now" handler: unregister ALL service workers, clear ALL caches, then `window.location.reload(true)` — does NOT depend on the old SW behaving

### 4. Auto-nuke after grace period
- If mismatch detected and user doesn't tap within 10s, auto-execute the nuke + reload
- This guarantees update lands within 30-40s of opening the app, regardless of SW state

### 5. In-app "Force Update" button (Profile page)
- Always-available manual escape hatch in Settings/Profile
- Same nuke + reload logic
- User can hit it anytime they suspect they're on an old version

### 6. Removed dependency on SW update cycle
- Stop relying on `useRegisterSW`'s `needRefresh` (which requires the old SW to cooperate)
- Our version check works at the app layer — even a totally broken SW can't prevent it

## Files to modify
- `vite.config.ts` — add `define: { __BUILD_ID__: ... }` and emit `version.json` via a small plugin
- `src/vite-env.d.ts` — declare `__BUILD_ID__` global
- `src/hooks/useAppUpdate.ts` — rewrite with version-probe strategy + nuke helper
- `src/lib/forceUpdate.ts` (new) — exported `nukeAndReload()` helper
- `src/pages/ProfilePage.tsx` — add "Force Update" button in settings area
- `public/version.json` — placeholder (overwritten at build)

## Why this works universally
- Doesn't trust the SW to self-update
- Doesn't trust the browser to check for SW changes
- Doesn't require the user to remember a URL
- Probes a no-store endpoint that bypasses all caches
- When mismatch found, nukes everything from the JS layer and forces a hard reload
- Works on Android Chrome, iOS Safari, desktop, anywhere
