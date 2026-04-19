

## Admin Hub on Profile Page

Goal: one organized "Admin Tools" section on Alex's Profile page surfacing every admin capability in the app, plus the force-refresh button.

### Discovery — what admin tools exist today

From the file tree:
- `/admin` → `AdminToolsPage.tsx` (sync runs, general admin)
- `/pickem/admin` → `PickemAdminPage.tsx` (NFL season/week/game management)
- Draft commissioner controls (season-eligibility, league management) — accessed inline on draft pages today
- Force update / build ID display — currently buried in `NotificationPreferences.tsx`
- Chat changelog posting — done via DB today, no UI

### Plan

**1. New `AdminHub` section on `ProfilePage.tsx`** (only renders when `has_role(user, 'admin')`)
- Premium gold-bordered card with "Admin Tools" eyebrow + Shield icon header
- Grouped into 3 logical sections with eyebrow labels:

  **a. App Management**
  - "Sync Runs & Logs" → `/admin` (existing AdminToolsPage)
  - "Force refresh app" → calls `nukeAndReload()` directly (moved from NotificationPreferences)
  - Build ID displayed as small mono text

  **b. Competitions**
  - "NFL Pick'em Admin" → `/pickem/admin`
  - "Draft Commissioner" → `/drafts` with note "Manage seasons from any draft page" (or link to a future commissioner view if one exists — confirm during build)

  **c. Diagnostics**
  - "Test push notification" → reuses existing test-push action from NotificationPreferences
  - Current role + user ID display for debugging

**2. Clean up `NotificationPreferences.tsx`**
- Remove the build-id + "Check for updates" row (now lives in AdminHub)
- Keep the push-notification test there for non-admin users since it's also user-relevant

**3. Visual treatment**
- Match the seasonal-league-aesthetic: gold radial glow header, Shield icon in gold gradient container
- Each tool = full-width row button with icon + title + chevron right (44px touch targets)
- Section eyebrows: `text-[10px] tracking-[0.14em] uppercase text-muted-foreground`

### Files to touch
- `src/pages/ProfilePage.tsx` — add AdminHub section (admin-gated)
- `src/components/profile/NotificationPreferences.tsx` — remove build/refresh row (relocated, not duplicated)
- (read first to confirm structure: `ProfilePage.tsx`, `AdminToolsPage.tsx`)

### Out of scope
- No new admin capabilities — purely consolidation
- No changes to existing admin pages themselves
- Non-admins see no change to Profile

### QA after build
- Sign in as Alex → Profile shows Admin Tools section with all 3 groups
- Sign in as non-admin → no Admin section visible
- Tap "Force refresh" → confirms + nukes + reloads
- All deep links navigate correctly on mobile (411×734)

