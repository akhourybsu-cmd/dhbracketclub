

## Desktop Sidebar Sync — Reflect All Current Features

### Problem
The desktop sidebar in `src/components/AppLayout.tsx` is out of sync with the app. It's missing several flagship modules that exist as full routes and are surfaced on mobile:

**Missing from desktop sidebar:**
- `/compete` — the Compete hub (on mobile bottom nav, central to the app)
- `/lockbox` — DH Lockbox daily competition
- `/pickem` — NFL Pick'em (just polished for 2026 season)
- `/posts` — Posts/discussions module

**Mis-prioritized:**
- Polls + Rankings are surfaced as top-level Compete items, but memory says they're archived under "More" with Drafts as flagship
- Drafts (flagship per memory) is buried at the bottom of Compete group
- No visual priority for the league/seasonal aesthetic

### Plan — reorganize `sidebarModules` in `AppLayout.tsx`

Restructure into 4 logical sections matching the actual app hierarchy and mobile nav:

```
SOCIAL
  Home          /dashboard
  Chat          /chat       (with unread badge)
  Feed          /feed
  Events        /events
  Lore          /lore

COMPETE  (Drafts-first per flagship priority)
  Compete Hub   /compete
  Drafts        /drafts     (flagship)
  Pick'em       /pickem     (NFL season)
  Lockbox       /lockbox    (daily)
  Brackets      /brackets

MORE  (archived modes per memory)
  Polls         /polls
  Rankings      /rankings
  Shared Media  /shared
  Posts         /posts

(footer)
  Theme toggle
  Profile       /profile
```

### Visual + behavior
- Keep current `nav-item` styling, dividers as section eyebrows (same `text-[8px] uppercase tracking-[0.2em]` pattern already used)
- Add appropriate Lucide icons: `Swords` (Compete), `Bookmark` (Drafts), `Trophy` (Pick'em), `Lock` (Lockbox), `LayoutGrid` or keep `Trophy` for Brackets
- Update `isNavActive` to handle `/lockbox`, `/pickem`, and so `/compete` only matches `=== '/compete'` (not all sub-routes, since each sub-module gets its own sidebar entry)
- Keep all unread-badge and animation behavior intact
- No mobile bottom-nav change (5-tab structure is correct per memory)

### Files touched
- `src/components/AppLayout.tsx` — only the `sidebarModules` array, icon imports, and the `isNavActive` logic for `/compete`

### Out of scope
- No new routes, no new pages
- No mobile nav changes
- No Electron packaging (the `useful-context` mentioned it but no Electron setup exists in the project — "desktop app" here = the desktop web sidebar)
- No styling redesign

### QA after build
- Resize to ≥1024px: every section visible, all items navigable
- Active highlight works for each new entry (Lockbox, Pick'em, Compete, Posts)
- Chat unread badge still renders
- Mobile (411×734): bottom nav unchanged, no regression

