

# DH Club — Refinement & Enhancement Plan

## Current State Assessment

The app has a solid foundation with 5-tab navigation (Home, Chat, Compete, Events, Feed), working competition modules (Brackets, Rankings, Polls, Drafts), a real-time chat system, events with RSVP, posts/discussions, and an activity feed. There are some console warnings (forwardRef issues) and areas needing polish.

---

## Phase 1: Bug Fixes & Stability

**Fix console warnings and runtime issues**
- Fix `forwardRef` warning in `AppLayout` and `DashboardPage` — `AnimatePresence` children need proper refs
- Fix `PageTransition` component to use `forwardRef` correctly
- Audit all pages for missing error boundaries and loading states

**Files:** `src/components/PageTransition.tsx`, `src/components/AppLayout.tsx`, `src/pages/DashboardPage.tsx`

---

## Phase 2: Data Integrity & Missing Connections

**Wire up activity feed properly across all modules**
- Ensure creating/completing events, posts, and chat milestones insert into `activity_feed`
- Add activity feed entries for RSVP changes and post comments
- Verify the Feed page displays all event types correctly with proper linking

**Add missing cascade behaviors**
- Verify deleting a channel cleans up messages, reactions, and read states
- Verify deleting an event cleans up RSVPs and comments
- Verify deleting a post cleans up comments

**Files:** `src/pages/EventsPage.tsx`, `src/pages/PostsPage.tsx`, `src/pages/ChatPage.tsx`, `src/pages/FeedPage.tsx`

---

## Phase 3: UX Polish Pass

**Navigation & routing refinements**
- Add Profile access from mobile bottom nav (currently desktop-only via sidebar)
- Add a "Posts" / "Discussions" entry in the Feed tab or as a sub-section — currently the route exists but is not easily discoverable from nav
- Add breadcrumb-style back navigation on detail pages (Event Detail, Post Detail)

**Empty states**
- Add premium empty states for Chat (no messages), Events (no events), Feed (no activity), Posts (no discussions)
- Each empty state should have a clear CTA (e.g., "Create the first event")

**Loading states**
- Add skeleton loading to Chat channel list, Events list, Feed page
- Replace raw `loading` booleans with shimmer skeletons matching card layouts

**Files:** `src/components/AppLayout.tsx`, all detail/list pages

---

## Phase 4: Chat System Refinement

**Unread count badges on nav**
- Show total unread count as a badge on the Chat nav icon (both mobile and desktop)

**Message editing**
- Allow users to edit their own messages (the DB policy exists but UI doesn't support it)

**Channel management**
- Add ability to create new channels from the chat UI
- Add channel description visible in the channel header

**Search**
- Add basic message search within a channel (filter messages by text content)

**Files:** `src/pages/ChatPage.tsx`, `src/components/AppLayout.tsx`

---

## Phase 5: Events Refinement

**Attendee list improvements**
- Show avatar + name for RSVPs on the event detail page
- Group by status (Going / Maybe / Pass)

**Linked polls**
- Allow creating a poll directly from an event (e.g., "Where should we eat?")
- Show linked poll inline on event detail

**Files:** `src/pages/EventDetailPage.tsx`, `src/pages/EventsPage.tsx`

---

## Phase 6: Feed & Posts Enhancement

**Feed improvements**
- Add clickable links from feed items to the relevant detail pages
- Add inline previews (e.g., show poll question, ranking topic)
- Add "load more" pagination instead of fixed limit

**Posts improvements**
- Add reactions to posts (using existing `reactions` table)
- Show comment previews on post cards
- Add the ability to edit posts

**Files:** `src/pages/FeedPage.tsx`, `src/pages/PostsPage.tsx`, `src/pages/PostDetailPage.tsx`

---

## Phase 7: Profile & Settings Enhancement

**Richer profile page**
- Show user's recent activity (last 5 feed items for current user)
- Show stats: polls voted, rankings submitted, events attended, messages sent
- Add avatar upload (using storage bucket)

**Files:** `src/pages/ProfilePage.tsx`

---

## Phase 8: Cross-Feature Integration

**Home dashboard refinements**
- Add recent chat activity preview (latest message from a channel)
- Add recent posts preview
- Better section ordering: Events > Activity > Competitions

**Compete page enrichment**
- Show active counts per module (e.g., "3 open rankings")
- Show recent winners or top participants

**Files:** `src/pages/DashboardPage.tsx`, `src/pages/CompetePage.tsx`

---

## Recommended Implementation Order

| Priority | Phase | Effort |
|----------|-------|--------|
| 1 | Bug fixes & stability | Small |
| 2 | Empty & loading states | Small |
| 3 | Chat refinement (unread badges, editing, search) | Medium |
| 4 | Nav & routing polish (Profile on mobile, Posts discoverable) | Small |
| 5 | Feed & Posts enhancement | Medium |
| 6 | Events refinement (attendees, linked polls) | Medium |
| 7 | Profile enhancement | Medium |
| 8 | Cross-feature dashboard integration | Medium |

Each phase is independent and can be implemented without breaking existing functionality.

