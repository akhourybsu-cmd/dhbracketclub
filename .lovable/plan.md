## Draft Arena Visual Audit — Findings & Fixes

I logged in and walked through `/drafts`, `/drafts/create`, draft detail (setup + complete), `/drafts/seasons`, season recap, and the `/compete` league entry. Most pages already feel cohesive on the gold/charcoal arena skin. A handful of contrast and color-consistency issues remain, plus one console warning.

### Issues Found

1. **`Create Draft` button — dark-on-dark (contrast)**
   On `/drafts/create`, the disabled state of the submit button renders a muddy dim-gold gradient with near-black text that's hard to read. Active state needs verification too.

2. **HUD season chip uses emerald palette**
   The "summer" chip in `DraftArenaHUD.tsx` is styled with emerald (`hsl(152 …)`) — clashes with the gold arena identity used everywhere else in the HUD.

3. **`Start Draft` CTA on draft setup is full emerald**
   On a not-yet-started draft, the primary CTA is plain emerald, not the arena gold gradient. Same for the "HOST" pill next to the host's name in the participants list.

4. **`ACTIVE` season pill is emerald on `/drafts/seasons`**
   The "ACTIVE" tag on the current season card is emerald, while every other status pill in the arena (SETUP, COMPLETE, ARCHIVED) uses the gold/charcoal `.da-status-*` palette.

5. **React warning: `Function components cannot be given refs` on `CountedNumber`**
   `DraftsListPage.tsx` defines `function CountedNumber(...)` and is rendered inside a `motion.p` (or otherwise wrapped) that forwards a ref. Console floods with the warning on every animated count tick. Wrap with `React.forwardRef` (or render the count inside a span the parent owns).

### Pages Verified Clean
- Drafts list (cards, status pills, cumulative stats dashboard)
- Draft detail — complete view (rankings podium, MVP pick card, draft stats)
- Seasons archive recap (podium, regular standings, stats)
- Compete → League → "Enter Arena" banner
- Boot sequence and back-button behavior

### Implementation

**`src/components/drafts/DraftArenaHUD.tsx`**
- Recolor the season chip background/border/text from emerald to gold tokens (match `.da-status-setup` style: gold tint background, gold border, gold-95 text).

**`src/pages/CreateDraftPage.tsx`**
- Replace the submit button's gradient with the same arena gold gradient used by the "Enter Arena" CTA on Compete (solid gold → amber, charcoal text via `text-[hsl(45_95%_10%)]`, font-black).
- Add a clearly distinct disabled state: lower opacity + cursor-not-allowed but keep readable text color.

**`src/pages/DraftDetailPage.tsx`**
- Restyle the `Start Draft` button to the arena gold CTA (charcoal text on gold).
- Restyle the `HOST` participant pill to gold (`.da-status-setup` palette or matching inline tokens).

**`src/pages/SeasonsArchivePage.tsx`**
- Map the `ACTIVE` season pill to the `.da-status-live` (or a dedicated gold "active" variant) instead of the default emerald.

**`src/pages/DraftsListPage.tsx`**
- Wrap `CountedNumber` in `React.forwardRef<HTMLSpanElement, { value: number }>` and render `<span ref={ref}>{Math.round(animated)}</span>` — eliminates the runtime warning without touching animation logic.

### Out of Scope
- No changes to draft engine, snake logic, realtime, routing, or Compete page chrome outside the entry banner.
- The emerald accents on the broader Compete league dashboard (Season 2 panel, "REGULAR SEASON" pill) stay as-is — they live outside the arena shell and follow the standard DH Club palette.
