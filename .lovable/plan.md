

# Rune Delve — Stale Results Page Fix

## The bug

After clearing a level, some players land on `/rune-delve/results/:level` and see **"No run yet for this level. Enter the dungeon!"** instead of their score. One affected user fixed it by clearing their browser cache — confirming it's a stale-data issue, not a missing write.

## What's actually happening

Three overlapping causes, in order of likelihood:

1. **Stale React Query cache** — `useMyLevelRun` has `staleTime: 30_000` and an `enabled` flag that flips off while `level.id` is `transient-*` and back on once the canonical row appears. When the gate flips on, React Query returns the previously cached `null` (from when the query was disabled or returned early) and only refetches in the background — so the page renders the empty state for a beat, and on slow networks gets *stuck* there if the user backgrounds the tab before the refetch lands.
2. **Mount-before-write race** — `RuneDelvePlayPage` waits 2.5 s after submitting the run, then navigates to results. If the results page mounts and queries `rune_delve_runs` before the insert/upsert is fully committed (or before the invalidation broadcast reaches it across a route change), it sees nothing.
3. **Legacy Workbox service worker** — players still on an old install have a SW that intercepts and caches `/rest/v1/rune_delve_runs` GETs. The "self-destruct" SW is in place, but until it activates the user keeps seeing the cached empty response. This is why a manual cache-clear fixes it.

## The fix

### 1. Make `useMyLevelRun` self-healing in `src/hooks/useRuneDelveCampaign.ts`

- Drop `staleTime` to `0` for this query so route re-entries always revalidate.
- Add `refetchOnMount: 'always'` and `refetchOnWindowFocus: true`.
- Add a small **bounded retry** inside the queryFn: if the run isn't found yet AND we know the user just finished a run on this level (signaled via `sessionStorage`), wait 400 ms and re-query up to 3 times before returning `null`. This eliminates the post-submit race without spinning forever.

### 2. Signal "just submitted" from the play page

In `src/pages/RuneDelvePlayPage.tsx`, right after `useSubmitLevelRun` resolves, write `sessionStorage.setItem('rd-just-submitted-' + level.level_number, Date.now())`. The results page reads + clears this key on mount and uses it to enable the bounded retry above. Self-cleaning, no global state.

### 3. Force a fresh fetch when results page mounts

In `src/pages/RuneDelveResultsPage.tsx`, on mount, call `queryClient.invalidateQueries({ queryKey: ['rune-delve-level-run', level?.id] })` and `['rune-delve-progress']` once `level?.id` is known. Belt-and-suspenders against any cached `null` from a prior visit.

### 4. Friendlier empty state with a manual recovery action

Replace the bare "No run yet" text with:
- A subtle spinner for the first ~1.5 s after mount (covers the normal race).
- After that, a card showing **"Hmm — we couldn't find that run yet"** with two buttons: **"Refresh"** (re-invalidates the query) and **"Back to Level Map"**. So even in the worst case the user is never stuck — one tap recovers.

### 5. Bypass any legacy SW HTTP cache for Supabase reads

The Supabase JS client lets us pass custom fetch headers globally via the `global.fetch` option, but we can't change `src/integrations/supabase/client.ts`. Instead, add the cache-bust at call-site in the two hot paths — `useMyLevelRun` and `useMyProgress` — by appending a no-op query param via `.select('*, _t:now()')` won't work; instead use the lower-level approach of adding a `Cache-Control: no-cache` header isn't possible per-query either. **Simpler, correct fix:** force-update the SW probe in `src/main.tsx` to also call `navigator.serviceWorker.getRegistration().then(r => r?.update())` once on app boot — this nudges any legacy Workbox SW into the self-destruct phase faster. Players on the old install will heal within one session instead of needing to clear cache.

## Files

**Edited**
- `src/hooks/useRuneDelveCampaign.ts` — `useMyLevelRun` revalidation + bounded retry; touch-up to `useMyProgress` invalidation timing.
- `src/pages/RuneDelvePlayPage.tsx` — write `sessionStorage` signal post-submit.
- `src/pages/RuneDelveResultsPage.tsx` — mount-time invalidation, spinner, recovery UI.
- `src/main.tsx` — eager `registration.update()` on boot to flush legacy SWs faster.

**Not changed**
- No DB migrations, no RLS changes, no gameplay or scoring changes.
- No changes to other Rune Delve pages or components.

## How we'll know it worked

- Affected user retries level: results page renders the actual score within < 500 ms, no cache clear needed.
- Re-entering a previously-played level's results page from the level map shows fresh data, not a stale `null`.
- Legacy-SW users heal within one app launch (the self-destruct SW activates immediately).

