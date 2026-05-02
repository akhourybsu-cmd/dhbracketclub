## Goal

Make the Drafts experience feel more **alive and intriguing** by adding purposeful motion and a few high-signal visual elements. Keep density low: the rule is "one hero moment per screen, everything else calms down."

This focuses on three surfaces, in priority order:

1. `DraftsListPage` — the lobby
2. `DraftDetailPage` live phase — the **On the Clock** hero, pick input, and pick history
3. `DraftDetailPage` complete phase — small podium / MVP polish

No schema changes, no new pages. All existing layouts stay intact; only animation, depth, and a couple of new compact components are added.

---

## 1. Drafts List — feel like a living lobby

Today the list is informationally good but visually flat: identical cards, small status pill, no sense of momentum.

Changes:

- **Live row pulse**: rows where `status === 'in_progress'` get a soft, slow gold edge-glow that breathes (~3s loop), and the gold corner ✦ that today only renders for playoff rows is reused (low-opacity Bookmark glyph) to give every live card a subtle decorative spark. Already-styled playoff rows keep their stronger amber treatment.
- **"Your pick" emphasis**: when `current_pick_user_id === user.id`, prepend a tiny animated `🎯` badge that gently bobs once on mount (`y: [0, -2, 0]`, 600ms), and add a faint left-edge gold bar (2px) so the user can scan their turn at a glance. The existing "🎯 Your pick!" line stays, just with motion.
- **Stagger + spring**: replace the linear `delay: 0.04 + i * 0.04` with a Framer parent `staggerChildren` and a `spring` (stiffness ~260, damping ~24) so cards "snap" in instead of fading. Cap stagger at 8 children so long lists don't crawl.
- **Stat strip restyle**: the three big numbers (Total Pts / Wins / Podiums) get a `CountUp`-style number animation on first mount (60-frame ease-out from 0). Bottom row (Avg / Best / Rated) stays static. No new card, just internal motion.
- **Hover**: rows get `hover-lift` (already present) plus a subtle `transform: translateX(2px)` on the `ArrowRight` chevron — a 150ms tease that signals "tap to enter."

No new rows, no extra metadata, no new cards. Density unchanged.

---

## 2. Draft Detail — the Live phase (the most important screen)

This is where the magic should live. Today the **On the Clock** banner is the centerpiece but it's quite static for non-playoff drafts. The playoff version is already premium; we want regular drafts to feel ~80% as exciting without copying the gold treatment (we keep that special).

### 2a. New "Pulse Hero" for the standard On the Clock banner

Replace the plain `glass-card` On-the-Clock block (lines ~1115-1136) with a refined hero that has:

- A soft **breathing radial gradient** behind the text — emerald when waiting on someone else, gold when it's your turn — that pulses ~3s. Implemented with a single absolutely-positioned div + CSS `@keyframes pulseGlow` (no JS).
- A **2-stop top edge rule** (1px, gradient gold→transparent) — the same pattern playoff hero already uses, just thinner and emerald for non-playoff "waiting" state.
- An **avatar disc** for the current picker (32px, initial-based, already available in the pick history rows). Shows whose turn it is at a glance instead of just a name.
- Existing `OnTheClockTimer` stays where it is, but when `isUrgent` (>= 60s) the whole hero gets a single horizontal **shake** (60ms, 3px) on the second the timer crosses 60s. One-shot, never repeats.
- "Your turn" state animates the headline text with a one-time scale pop (`scale: [0.95, 1.04, 1]`, 400ms).

This is the one allowed "hero moment" on the screen — everything else stays muted.

### 2b. Pick input — make submitting feel rewarding

- The Send button gets a **press ripple** identical to Rune Delve's `rd-btn-juice` pattern (already in `src/lib/runedelve/btnRipple.ts`). Scope it to just this button via a `data-draft-juice` attr; no global delegation.
- On successful submit, the input shrinks to `scale: 0.96` then snaps back (200ms total) before clearing — gives tactile "sent" feedback before the optimistic pick row appears.
- The existing `PickAnnouncement` banner (other people's picks) gets a tiny `Flame` glyph that rotates 180° on entry — already styled for fire; just needs `motion` rotation.

### 2c. Pick History — timeline feel

Today picks are a vertical scroll of `EnrichedItemCard`s with `AnimatePresence`. The timeline is good but new picks don't pop.

- Newly inserted picks (top of the reversed list) get a **sweep highlight**: a 1.5s gold-tinted background that fades from `hsl(var(--gold) / 0.12)` → transparent. Implemented as `initial={{ backgroundColor: 'hsl(var(--gold) / 0.12)' }} animate={{ backgroundColor: 'transparent' }} transition={{ duration: 1.5 }}` on the wrapper. Only applied when `pick.id` is the most recent and was added after mount (compare to a `useRef<Set<string>>` of seen IDs).
- Round dividers: insert a tiny **"Round N" pill** between picks when `pick.round` changes during the iteration. Style: 9px, uppercase, `tracking-[0.2em]`, muted. Visually breaks up long lists into chapters without adding a new section.
- Header: the `picks.length` counter on the right gets the same `CountUp` treatment as the lobby stats — small detail but it makes the screen feel reactive when picks stream in via realtime.

### 2d. Setup phase — friendlier waiting room

Small, contained changes (the screen is already calm):

- Participant rows in the Setup list get a sequenced fade-in (60ms stagger) when the page mounts, then a **subtle shimmer** sweeps once across the "Waiting for players…" copy when a new participant joins (detect via `participants.length` change in a ref). Same pattern as the existing `skeleton-shimmer` keyframe, just one-shot.
- The "Start Draft" button (creator only) gets a soft, slow `box-shadow` pulse — a single emerald ring breathing at 3s — once `participants.length >= 2`. Signals "ready to go."

---

## 3. Draft Detail — Complete phase

The podium and AI report sections are already strong. Two small touches:

- **Podium reveal**: the three pillars (currently rendered with fixed heights and 2nd-1st-3rd ordering) animate up from height 0 to their target with a 120ms stagger and a `spring` (already partial; tighten the spring params and add a `Trophy` glyph that drops onto 1st place with a small bounce after the pillars settle).
- **MVP pick highlight**: the `mvpPick` row in the per-user pick list gets a slow gold edge-shimmer (`box-shadow` keyframe, 4s loop, very low intensity) so the eye returns to it on subsequent views.

No new sections, no extra cards.

---

## 4. Shared infrastructure

Add a small `src/lib/draft/animations.ts` exporting:

- `pulseGlow` — Framer variants for the breathing radial used by the On-the-Clock hero.
- `springSnap` — the shared `{ type: 'spring', stiffness: 260, damping: 24 }` used by list rows and the pick input.
- `useCountUp(value, duration?)` — a tiny hook returning the animated number (uses `requestAnimationFrame`, no deps).
- `useFirstSeen<T>(ids: T[])` — returns the set of IDs newly added since last render. Drives the "sweep highlight" in pick history.

Add ~25 lines of new keyframes in `src/index.css` under a `/* Drafts polish */` block:

- `@keyframes draftHeroBreath` — opacity 0.5 → 0.8 → 0.5 over 3s.
- `@keyframes draftEdgeShimmer` — used for live row glow and MVP highlight.
- `@keyframes draftHeroShake` — single 60ms horizontal shake for the urgent timer crossover.

All new utilities are namespaced (`.draft-*`) so they don't leak.

---

## What we are NOT doing

- No new tabs, sections, or cards added to either page.
- No changes to data fetching, schemas, or RLS.
- No always-on heavy animations — every motion is either one-shot, on-event, or a slow ≥3s breath at low alpha.
- No new icons in the lobby rows beyond what's already there (one decorative ✦ at low opacity for live rows).
- No sound effects (drafts intentionally don't use the SFX system, unlike Nexus / Rune Delve).
- The playoff hero, podium, and AI report layouts stay structurally identical — only motion/depth refinements.

---

## Files touched

- `src/pages/DraftsListPage.tsx` — lobby polish (stagger spring, live-row glow, your-turn bar, CountUp stats)
- `src/pages/DraftDetailPage.tsx` — new On-the-Clock hero block, pick input ripple, pick history sweep + round dividers, setup polish, podium reveal tightening
- `src/components/draft/OnTheClockTimer.tsx` — emit a "crossed urgent threshold" event the new hero subscribes to (single shake)
- `src/components/draft/PickAnnouncement.tsx` — flame rotation on entry
- `src/lib/draft/animations.ts` — **new**, shared variants + hooks
- `src/index.css` — `~25` lines of new keyframes under a `/* Drafts polish */` block

Total scope: 1 new small file, 5 edits. No backend.
