# Portfolio Wars — Standalone Shell

Bring Portfolio Wars in line with the other flagship modules (Pick'em, Nexus, Draft Arena, RuneDelve) by giving it its own full-screen shell, custom HUD, branded boot animation, exit dialog, and a stock-market visual identity.

## Visual identity — "Trading Floor"

Distinct from the emerald/gold of Pick'em & Drafts so the user instantly knows they've entered a different module:

- **Background base**: deep midnight navy `hsl(220 50% 4%)` → `hsl(218 45% 7%)` (Bloomberg-terminal feel, not the green-on-green of Pick'em)
- **Primary accent — "Bull Green"**: `hsl(152 80% 50%)` (ticker-up green, matches existing `PctBadge` positives)
- **Secondary accent — "Bear Red"**: `hsl(0 75% 60%)` (used sparingly, mostly in the HUD's market-status pip and price-down states)
- **Highlight — "Ticker Amber"**: `hsl(38 100% 60%)` (LED/CRT amber for chip outlines and the boot title gradient)
- **Mono numerics**: `font-mono tabular-nums` everywhere prices/percentages appear (already partially used on the page)
- **Texture**: subtle scanline overlay + faint candlestick grid (repeating-linear-gradient) in the boot screen and HUD background, evoking a trading terminal

## Files to add

```text
src/assets/portfolio-wars-emblem.png        ← new (generated, transparent)
src/components/portfolioWars/PwLayout.tsx   ← shell wrapper (mirrors PickemLayout)
src/components/portfolioWars/PwHUD.tsx      ← sticky in-game header
src/components/portfolioWars/PwBoot.tsx     ← one-time boot intro
src/components/portfolioWars/PwExitDialog.tsx
```

### Emblem
Generate a transparent PNG: stylized rising candlestick / bull-horns mark inside a hex frame, bull-green + ticker-amber glow. Premium tier (it'll appear in the HUD and boot at large scale).

### PwLayout
Identical structure to `PickemLayout` / `DraftArenaLayout`:
- Wraps children in `.pw-mode .pw-shell` div, `min-h-[100dvh]`
- Mounts `<PwHUD />` at top, `<PwBoot />` below
- `<main>` capped at `max-w-[640px]`, `pt-3`, padded for safe-area bottom

### PwHUD
Mirrors `PickemHUD` patterns:
- Sticky header, `h-12`, gradient background (navy variant), bull-green border-bottom glow
- **Left**: back arrow → opens exit dialog when on `/portfolio-wars` hub, otherwise `navigate(-1)`
- **Center**: emblem + "Portfolio Wars" eyebrow + contextual subtitle. Subtitle derived from URL/active tab (Lobby / Leaderboard / History / Admin / "Locks in 2d 4h" when a challenge is active)
- **Right**: 
  - **Market-status pip** — small pulsing dot: green (open / picks open), amber (locked, in-progress), red (closed weekend). Reads from `useCurrentChallenge`.
  - **Week chip** — `WK 19` style or date range, using bull-green tinted badge
  - **Trophy icon** linking to leaderboard tab (when not already there)

### PwBoot
One-time per session (`pw_boot_played_v1` flag). Same engine as `PickemBoot`, restyled:
- Background: navy radial + faint amber glow
- Overlay: animated **scanlines** + **candlestick grid** instead of yard-line stripes
- Emblem with rotating dashed ring (bull-green glow)
- Title: "Portfolio Wars" with white→amber gradient, eyebrow "◆ DH · MARKET DESK ◆"
- Stage labels: `Connecting to market feed…` → `Loading watchlist…` → `Trading floor online`
- Progress bar: green→amber gradient

### PwExitDialog
Copy/paste of `PickemExitDialog` with PW-themed copy: "Exit Portfolio Wars? Your picks are locked in — come back anytime to track the leaderboard."

## Files to edit

### `src/components/AppLayout.tsx` (line ~125-129)
Add `/portfolio-wars` to the game-shell detection so the DH Club mobile header and bottom nav hide while in the module:
```ts
const isPortfolioWars = location.pathname.startsWith('/portfolio-wars');
const isGameShell = isRuneDelve || isNexus || isPickem || isDrafts || isPortfolioWars;
```

### `src/App.tsx` (line 163)
Wrap the route element in the new layout:
```tsx
<Route path="/portfolio-wars" element={
  <ProtectedPage>
    <PwLayout><PortfolioWarsPage /></PwLayout>
  </ProtectedPage>
} />
```

### `src/pages/PortfolioWarsPage.tsx`
Strip the page-level header (back arrow, title block, share button) since the HUD now owns that chrome. Move the **Share button** into `PwHUD`'s right cluster (replaces or sits beside the trophy when on the leaderboard/results tab). Adjust top padding since `pt-3` is already supplied by `PwLayout`.

### `src/index.css`
Add a `.pw-mode` skin block (opt-in token overrides scoped to the shell) so deep components inherit the trading-terminal palette without leaking into DH Club:
```css
.pw-mode {
  --pw-bg: 220 50% 4%;
  --pw-bull: 152 80% 50%;
  --pw-bear: 0 75% 60%;
  --pw-amber: 38 100% 60%;
  background: hsl(var(--pw-bg));
}
```

## Memory update

Append to `mem://index.md` under Memories:
- `[Portfolio Wars Game Shell](mem://features/portfolio-wars-game-shell)` — Standalone PwLayout/HUD/Boot, navy + bull-green + amber, hides DH chrome on /portfolio-wars

Add corresponding `mem://features/portfolio-wars-game-shell.md` describing the pattern.

## Out of scope

- No business-logic changes to picks, scoring, edge functions, or cron
- No new sub-routes (single `/portfolio-wars` page stays — HUD subtitles derive from active tab via a small context or query param sync; simplest: read `?tab=` param if present, else default)
- Sound/haptics — defer (Pick'em & Drafts shells don't have module-specific SFX wired in either)
