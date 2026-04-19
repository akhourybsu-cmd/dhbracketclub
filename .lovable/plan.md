

## PWA Update Audit — DH Club

### Phase 1 — Current setup inventory

| Concern | Current implementation |
|---|---|
| Manifest | `public/manifest.webmanifest`, `start_url: /?source=pwa`, standalone |
| Service worker | `public/sw-push.js` — push-only, **no fetch handler**, no caching |
| SW registration | `src/main.tsx` → registers `/sw-push.js`, skipped on iframes/preview hosts |
| Caching | None app-side. Browser HTTP cache only |
| Asset versioning | Vite default: hashed JS/CSS. `index.html` is unhashed |
| Update check | `useAppUpdate.ts` polls `/version.json` every 30s + on focus/visibility/route change + boot probe in `index.html` |
| Update prompt | Sonner toast "🚀 New version available" with 10s auto-nuke |
| skipWaiting / claim | Yes (push-only branch) and self-destruct branch unregisters legacy Workbox SWs |
| Manual refresh | `nukeAndReload()` exposed via Profile → Admin Hub → "Force Refresh App" |
| Build ID in UI | Yes — bottom of Admin Hub (`build <id>`) |
| Bootstrap probe | `index.html` inline script: probes `/version.json` pre-bundle, nukes on mismatch, evicts non-push SWs |

### Phase 2 — SW lifecycle audit

The push-only SW has no fetch handler, so **the SW itself cannot serve stale assets**. `skipWaiting` + `clients.claim` are in place. The legacy self-destruct branch handles the migration from any older Workbox SW. There is no "stuck waiting worker" risk.

✅ SW lifecycle is not the cause.

### Phase 3 — Cache / asset versioning audit

- Vite emits hashed JS/CSS — those cannot collide across builds.
- `index.html` is the only unhashed file. It already has `Cache-Control: no-cache, no-store, must-revalidate` meta tags.
- `version.json` is fetched with `cache: 'reload'` + query buster.
- No service worker cache exists, so `caches.delete()` cleans up only legacy Workbox leftovers.

⚠️ **Real risk: `index.html` HTTP cache headers from the *server* (Lovable hosting)**. Meta tags only affect *subsequent* navigations — Android Chrome's HTTP cache decides based on response headers from the CDN, which we don't control directly. If the CDN sent a long-lived `Cache-Control` for `index.html` once, Chrome may keep it for hours.

### Phase 4 — Installed Android PWA-specific audit

This is where the single-user issue lives. Likely root causes, ranked:

1. **WebAPK shell snapshot.** When you installed the PWA, Chrome captured a WebAPK pointing at a specific `start_url`. On launch, Android **may serve the cached `index.html` from the HTTP cache before any JS runs**, AND on slow/offline networks the bootstrap probe `fetch('/version.json')` can silently fail (caught and ignored). When that happens, the stale shell loads its stale JS chunks and never sees the new build.
2. **`fetch(..., {cache:'reload'})` not honored on installed Android PWAs in some Chrome builds** — there are documented cases where installed PWA contexts use a more aggressive HTTP cache.
3. **Stuck on a chunk that no longer exists.** After a deploy, a stale `index.html` references hashed chunks that 404. The app silently fails to hydrate, never reaching `useAppUpdate`, so no toast ever appears.
4. **Legacy SW remnant.** If you installed *before* the push-only migration, a Workbox SW may still be active and intercepting `/version.json` with a cached HTML response. The bootstrap probe handles this (`nukeAll('version.json intercepted as non-JSON')`) — but only if it actually runs, which requires the new `index.html` to load.
5. **Other users are fine** because they never installed, or they installed *after* the bootstrap probe was added, or their Android version is more aggressive about updating WebAPK shells.

### Phase 5 — Debugging aids

Most are already present (build ID display, manual refresh, toast). Missing pieces worth adding:
- Console-log every probe attempt + result (currently silent).
- Surface the **last probe timestamp** + **remote build ID** on Admin Hub so you can immediately see "remote=X local=Y last checked Ns ago" — the smoking gun for "is the probe even running?".

### Phase 6 — Safest fixes (minimal, surgical)

**Fix 1 — Defeat HTTP cache on `index.html` & `version.json` at the response level via query strings on every request that matters.**
- `useAppUpdate` already cache-busts `/version.json`. ✅
- Add `?v=${BUILD_ID}` to the SW registration URL in `main.tsx` so a new bundle re-registers a "different" SW URL, forcing Chrome to re-evaluate.

**Fix 2 — Visible diagnostics on Admin Hub.**
Add a live "Update Status" sub-section showing:
- Local build ID (full)
- Last fetched remote build ID
- Last probe time + outcome (ok / network-failed / mismatched)
- Currently controlling SW script URL
- Number of registered SWs + cache keys

This makes "is the probe even running on my Android" answerable in 2 seconds.

**Fix 3 — Aggressive recovery on chunk load failure.**
Add a global `window.addEventListener('error', …)` and `unhandledrejection` listener that detects `ChunkLoadError` / `Loading chunk … failed` patterns, and auto-triggers `nukeAndReload()`. This catches the "stale index.html points at deleted chunk" failure mode that currently leaves the app in silent limbo.

**Fix 4 — Periodic `registration.update()` call.**
Even though the push-only SW doesn't cache, calling `registration.update()` on focus forces Chrome to re-fetch `/sw-push.js` with cache-bypassing semantics, which on installed PWAs sometimes also nudges Chrome to revalidate the launch shell.

**Fix 5 — One-time forced re-evaluation on next launch.**
Bump `SW_VERSION` in `sw-push.js` and (if needed) flip the bootstrap probe to also nuke when `localStorage.__dh_build_id__` is older than 24h with no remote check succeeding — assume staleness on long-lived installs.

### Phase 7 — Manual test plan

Run on the affected Android device:

1. **Baseline read.** Open installed PWA → Profile → note `build <id>`.
2. **Browser parity.** Open Chrome (not the installed PWA), go to `dhbracketclub.lovable.app`, hard-refresh, note build id. If it differs from #1 → installed PWA is stale.
3. **Probe diagnostic.** On the new Admin Hub diagnostic panel, confirm "last probe" is recent (<60s) and "remote build" matches what the browser shows. If "last probe" is "never" → bootstrap probe is being intercepted.
4. **Force refresh.** Tap "Force Refresh App" → app should reload with new build id.
5. **Cold launch test.** Fully close the PWA from Android task switcher → reopen → check build id immediately. Should match latest.
6. **Background/resume test.** Send PWA to background for 1 min, deploy a new build, foreground PWA → toast should appear within 30s.
7. **Chunk-failure test.** (Synthetic: hard to reproduce on demand.) Deploy a build, leave PWA open without focus for 2+ deploys, then focus. Auto-recovery should fire instead of white screen.
8. **Last-resort.** Visit `dhbracketclub.lovable.app/?fresh=1` from Chrome (not the installed app) — bootstrap nukes everything. Then relaunch installed PWA.
9. **Nuclear option (only if all above fail).** Uninstall PWA from Android home screen → clear Chrome site data for `dhbracketclub.lovable.app` (Settings → Apps → Chrome → Storage → Manage Storage → clear for that site) → reinstall. This rebuilds the WebAPK with a fresh shell.

### Files to change

- `src/components/profile/AdminHub.tsx` — add live "Update Diagnostics" subsection (remote build, last probe, SW URL, cache count)
- `src/lib/forceUpdate.ts` — export probe state (timestamp, last result, last remote id) for the diagnostics panel
- `src/hooks/useAppUpdate.ts` — write probe outcomes to a shared store; call `registration.update()` on focus
- `src/main.tsx` — register SW with `?v=${BUILD_ID}` cache buster; add global `ChunkLoadError` listener that triggers `nukeAndReload()`
- `public/sw-push.js` — bump `SW_VERSION` to force one-time activate cycle (no behavior change)

### Final summary

**Current setup**: Push-only SW + version.json polling + bootstrap probe + manual nuke-and-reload + build-id display. Architecture is sound.

**Most likely root cause(s) for your stale Android install** (in order):
1. Stale `index.html` HTTP-cached by Android Chrome's WebAPK launch path, with the bootstrap probe failing silently on launch.
2. Possible legacy Workbox SW still alive from a pre-migration install, intercepting `/version.json`.
3. Silent `ChunkLoadError` after deploys leaving app in limbo with no recovery.

**What to do *right now* on your device while we ship the fixes**:
- Open Chrome (not the installed PWA) → `https://dhbracketclub.lovable.app/?fresh=1` → wait for reload.
- Then in Chrome: long-press the installed PWA icon → App info → Storage & cache → **Clear storage**.
- Relaunch the PWA. Note the new build id on Profile → Admin Hub.
- If still stale: uninstall the PWA, reinstall from Chrome menu → "Install app".

