

## Mobile Platform Deep Review

Goal: systematic audit of the mobile experience (411×734 viewport) — verify every module is wired up, navigates correctly, renders without overflow, and updates in real-time. Identify loose ends and produce a prioritized fix list before changing any code.

### Approach — read-only audit in 4 sweeps

**Sweep 1 — Navigation & shell integrity**
- `AppLayout.tsx` mobile bottom-nav (5 tabs: Home/Compete/Chat/More/Profile)
- Verify every route in `App.tsx` is reachable and `ProtectedRoute` works
- Confirm safe-area insets, 4.5rem nav height, no content obscured
- Check the recent desktop-sidebar reorg didn't regress mobile

**Sweep 2 — Module-by-module functionality** (read each main page + its hook)
| Module | Page(s) | Hook(s) / data path |
|---|---|---|
| Dashboard | DashboardPage | Drafts/Brackets/Events priority sort, presence |
| Drafts | DraftsList, DraftDetail, CreateDraft | useDraftSeasons, useDraftResults, draftTurn |
| Pick'em | PickemHome, PickemWeek, PickemWeekResults, Standings, History, Rules | usePickem, usePickSuggestion |
| Lockbox | LockboxPage, LockboxCrackPage | useLockbox |
| Chat | ChatPage | useChatMessages, useChatActions, useChatRealtime, presence |
| Lore | LorePage, LoreDetail | useLoreEntries |
| Events | EventsPage, EventDetail | (RSVP + thread) |
| Compete | CompetePage | hub routing |
| Polls/Rankings/Posts | (archived in More) | basic reachability |
| Profile | ProfilePage + AdminHub | avatar, notifications, admin gating |

**Sweep 3 — Cross-cutting concerns**
- Realtime subscriptions: chat messages, presence, draft picks, lockbox cracks
- Push notifications: VAPID fetch, subscription persistence, throttle behavior
- PWA update flow: confirm probe + ChunkLoadError recovery still wired after recent changes
- Auth: login/signup/reset flow, session persistence, ProtectedRoute redirects
- AI flows: suggestions, draft enrichment, draft reports, dispute resolution
- Edge function health: spot-check logs for `enrich-draft-picks`, `score-nfl-week`, `finalize-lockbox-day`, `send-push-notification`
- Mobile interaction standards: 44px touch targets, no-truncation policy, image lazy/async decoding

**Sweep 4 — Live preview QA at 411×734**
- Browser-test each main route for: overflow, broken layouts, tap-target size, empty-state correctness, loading skeletons, console errors

### Deliverable

A categorized findings report with:
- ✅ Verified working
- ⚠️ Minor polish opportunities
- 🔴 Real bugs / loose ends needing fixes

Then propose a follow-up implementation plan only for the 🔴 items, scoped tightly so we don't redesign anything.

### Out of scope
- No redesign, no new features
- No mobile native (Capacitor) work — PWA only
- No edge function rewrites unless a real bug surfaces

### Files to inspect (read-only)
- `src/App.tsx`, `src/components/AppLayout.tsx`, `src/components/ProtectedRoute.tsx`
- All pages listed above + their primary hooks
- Recent edits: `src/main.tsx`, `src/lib/forceUpdate.ts`, `src/hooks/useAppUpdate.ts`, `src/components/profile/AdminHub.tsx`
- Edge function logs (spot-check) via supabase tools

### After audit
Present findings inline in chat with a prioritized fix plan you can approve before any code changes.

