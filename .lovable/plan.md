## NFL Pick'em — Admin & Player QoL Upgrades

### 1. Database (one migration)

Add commissioner-tunable settings to `nfl_seasons`:

- `pick_lock_minutes` int default `10` — picks for the entire week freeze this many minutes before the first kickoff.
- `hide_unresolved_future_weeks` bool default `false` — hide future weeks from members until the prior week is `scored`.
- `visible_week_window` int default `null` — when set, only the current week + next N upcoming weeks are visible.
- `require_finalized_schedule` bool default `true` — weeks with zero games (schedule not yet synced) are hidden from members.

Update `is_pick_unlocked(game_id)` to use a **week-level lock**: picks open until `min(kickoff) - pick_lock_minutes` for that week (instead of per-game kickoff). Members can still change picks freely until that single moment, then everything in the week freezes.

Add helper `nfl_week_lock_at(week_id) returns timestamptz` for the UI countdown.

RLS already covers admin writes; no new policies needed.

### 2. Hooks (`src/hooks/usePickem.ts`)

- Extend `NflSeason` and `NflWeek` types with the new columns.
- New `weekLockAt(week, games)` helper → first kickoff − `pick_lock_minutes`.
- Replace `isGameLocked(game)` with `isWeekLocked(week, games, season)` (keeps a thin per-game wrapper for compatibility). Locked = `now() >= weekLockAt`.
- New `deleteMyPick(pickId)` for tap-to-unselect.
- New `useVisibleWeeks(season, weeks, games)` that applies the three visibility rules for non-admins (admins see everything).
- New tiny `useCardLock(weekId)` → localStorage flag `dh_pickem_card_lock_v1:{userId}:{weekId}` for the personal "lock my card" toggle.

### 3. Player UI

**`GamePickCard.tsx`**
- Tap on the already-selected team → call `onUnpick()` (deletes the pick) with the same sweep animation in reverse.
- Disable both buttons if either the week is locked or the user has personally locked their card; show a small lock chip overlay when card-locked but week still open ("Tap to unlock card").

**`PickemWeekPage.tsx`**
- Wire `handleUnpick`, pass new `cardLocked` state, recompute `slipStatus`.
- When week is unlocked but user hasn't card-locked, show the "Lock Card" CTA inside `PickSlipBar`.

**`PickSlipBar.tsx`**
- Add `cardLocked`, `onToggleCardLock`, `weekLockAt` props.
- Primary action button: "Lock Card" (gold) when open & all picked, "Unlock Card" (muted) when card-locked, hidden when week-locked.
- Show countdown `Picks freeze in 2h 14m` under the label using `weekLockAt`.

**`WeekNavigator.tsx`** & **`PickemHomePage.tsx`**
- Use `useVisibleWeeks` so members never see hidden weeks. Admins always see all.

### 4. Admin UI (`PickemAdminPage.tsx`)

New "League Settings" card under the Season block with four controls bound to the new columns:
- Toggle: Hide future weeks until prior is scored
- Number input: Visible week window (blank = all)
- Toggle: Hide weeks with no schedule yet
- Number input: Lock picks N minutes before first kickoff (default 10)

Each saves via `update nfl_seasons … where id = season.id` with a debounced toast.

The existing partially_locked / closed / scored status flow already works (DB trigger `recompute_nfl_week_status` runs on game changes); no changes needed there beyond confirming the manual override dropdown still functions.

### 5. Verification

- `tsc --noEmit` passes.
- Manual: as admin toggle each setting; confirm members' week list updates; tap a selected team to unselect; lock card and confirm taps are ignored; advance system clock past `first kickoff − N min` and confirm both buttons disable across the whole week.

### Out of scope (not requested)
- Changing the existing scoring/score-week edge function.
- New admin auditing for setting changes.
- Server-side enforcement of the personal "lock card" (it's a UX guardrail, not a security boundary — RLS still controls real lock).
