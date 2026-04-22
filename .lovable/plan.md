

## Rune Delve — Cinematic Chain & Ability FX Layer

Add a thematic, mobile-first overlay animation system that fires when a chain resolves or an ability triggers. Visuals match each rune's identity (and each class's ability), reinforce what the player just did, then get out of the way fast (~600–900ms). No gameplay logic changes — purely a visual/feedback pass.

### What players will see

**Per-rune chain FX (overlay above the board, then fly toward the relevant HUD target)**

- **🔴 Red — Crimson Slash:** Three diagonal sword slashes streak across the targeted enemy's portrait (offset, staggered 60ms). Brief radial impact flash + screen-shake-lite (existing `shake`) on the enemy card. Color: `hsl(var(--destructive))`.
- **🟢 Green — Verdant Bloom:** Soft emerald wind swirls from the board upward; HP bar pulses with a "rising" inner glow as the number ticks up. Tiny leaf/spark motes drift over the hero status bar.
- **🟡 Gold — Bulwark Lock:** Two interlocking shield halves slide in from left/right, "click" together centered over the board (gold flash, scale 1.15→1.0), then dissolve into the shield turn counter. Pulse the `🛡 N` chip.
- **🔵 Blue — Arcane Charge:** Pulsing diamond cores rise from each chained cell, converge into a single bright orb, then split into the mana pips that just filled. Blue-violet radial pulse on each newly lit orb.

**Per-class ability FX (full-board overlay, ~900ms)**

- **Warrior · Cleave:** A wide horizontal arc-slash sweeps across all enemy portraits with a red shockwave; each enemy's HP bar flashes white then drops.
- **Mage · Arc Burst:** A bright violet bolt charges from the hero status bar, arcs upward, and detonates on the targeted enemy with a radial lightning ring.
- **Rogue · Shadowstep:** Hero "afterimage" briefly streaks across the board; gold sparkle trail settles onto a new "Shadowstep ✦" badge that pulses until the next chain.
- **Cleric · Sanctuary:** Concentric green halos expand outward from the hero bar; HP bar fills with a crest sweep; gold shield turns chip pops in with a soft chime sparkle.

**Chain-tier flourishes** (visual only, no balance change)
- Chain ≥6: rune trail flashes gold.
- Chain ≥7 (bonus move): adds a subtle "✨ Bonus" floating chip near the chain.
- Chain ≥8: full-board gold bloom on dissolve.

### How it's built (technical)

**New files**
- `src/components/runedelve/fx/RuneChainFx.tsx` — overlay layer rendering chain-specific motion presets via Framer Motion. Props: `kind: RuneType`, `length`, `tier`, `targetRect?: DOMRect`, `onDone()`.
- `src/components/runedelve/fx/AbilityFx.tsx` — overlay layer for class abilities. Props: `cls: HeroClass`, `targetRect?: DOMRect`, `onDone()`.
- `src/components/runedelve/fx/FxLayer.tsx` — single mounted portal-style absolutely-positioned layer (parented to the play page's relative container) that renders queued FX entries via `AnimatePresence`. Manages a small FIFO queue (max 2) so rapid chains don't pile up.
- `src/hooks/useFxQueue.ts` — tiny hook returning `{ trigger(fx), Layer }`. Internally uses `useReducer` + `id` counter; auto-pops on each `onDone`.

**CSS additions (in `src/index.css`, scoped under `.rd-mode`)**
- `@keyframes rd-slash`, `rd-bloom`, `rd-shield-lock`, `rd-mana-pulse`, `rd-cleave-arc`, `rd-arc-bolt`, `rd-shadowstep`, `rd-sanctuary-halo` — purely transform/opacity for GPU compositing; no layout thrash.
- All durations 400–900ms; `prefers-reduced-motion: reduce` short-circuits to a 120ms fade so accessibility users still get visual confirmation without motion.

**Wiring (minimal touch to existing files)**
- `src/pages/RuneDelvePlayPage.tsx`:
  - Mount `<FxLayer />` once inside the existing root `<div className="space-y-2 pb-2 relative">`.
  - In `handleChain`, after computing `type` + `chain.length`, find the targeted enemy DOM rect via `data-enemy-id={e.id}` (added in `EnemyDisplay`) and call `trigger({ kind: type, length: chain.length, tier, targetRect })`. For green/blue/gold the target is the corresponding HUD chip (added `data-fx-target="hp"|"mana"|"shield"` on `HeroStatusBar`).
  - In `handleAbility`, call `trigger({ kind: 'ability', cls: hero.class, targetRect })` before `setCombat`.
- `src/components/runedelve/EnemyDisplay.tsx`: add `data-enemy-id={e.id}` on the wrapping motion.div (no behavior change).
- `src/components/runedelve/HeroStatusBar.tsx`: add `data-fx-target="hp" | "mana" | "shield"` on the relevant chips/bars.

**Performance & a11y**
- Single overlay node, `pointer-events-none`, `will-change: transform, opacity` only during animation.
- Max 2 concurrent FX (queue overflow drops oldest visual cue but never blocks gameplay state).
- Honors `@media (prefers-reduced-motion: reduce)` → 120ms cross-fade only.
- Mobile-tuned: all FX clamp to the board's `max-w-[400px]` container so they never bleed past the safe area.

### Files touched
- New: `src/components/runedelve/fx/{FxLayer,RuneChainFx,AbilityFx}.tsx`, `src/hooks/useFxQueue.ts`
- Edited: `src/pages/RuneDelvePlayPage.tsx` (mount layer + 2 trigger calls), `src/components/runedelve/EnemyDisplay.tsx` (1 data attr), `src/components/runedelve/HeroStatusBar.tsx` (3 data attrs), `src/index.css` (~8 keyframes scoped under `.rd-mode`)

### Manual mobile testing checklist
- 411×734 viewport: chain reds → slashes land on the leftmost living enemy, no horizontal overflow.
- Chain green → leaf motes rise toward HP bar; HP number ticks up smoothly.
- Chain gold → shield halves lock at board center; `🛡 N` chip pulses.
- Chain blue → orbs converge to mana pips; pip border glows on fill.
- Cast each class ability → ability FX fires once, finishes ≤900ms, no doubled animation on rapid taps.
- Chain 8+ → gold bloom appears once.
- Toggle reduced motion → all FX collapse to a quick fade.
- Rapid two-chain test → second FX queues and plays after first.

