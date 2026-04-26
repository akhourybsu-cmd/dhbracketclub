# Rune Delve — Game-Feel Polish Pass

A focused, end-to-end pass to make every surface of Rune Delve feel like a real game. Today the combat board has rich FX (rune chains, ability cinematics, camera shake) but the menus, transitions, enemies, and rewards are mostly static. This plan adds a themed sound family, idle motion, juicy reactions, and celebratory micro-sequences everywhere — without changing gameplay or balance.

Mobile-first, GPU-only animations, all `prefers-reduced-motion` aware, and gated by the existing global sound toggle.

---

## What you'll feel after this pass

- **Every tap has a voice.** A themed RuneDelve sound family — rune hums, sword strike, healing chime, shield clang, mana shimmer, gold pickup, level-up fanfare, boss roar, doom drum — replaces the generic taps.
- **The world breathes.** Enemies idle-bob, runes occasionally sparkle, the HUD glows, your hero portrait pulses when ability is ready.
- **Reactions are juicy.** Damage numbers, "+HP" floaters, mana-pip pop, shield-up clang, screen-edge red flash on hero hit, gold-coin showers on shard pickup.
- **Menus feel alive.** Animated home banner, parallax level-map path, hover/tap glow on cards, staged list entrances, rune-charge transitions between routes.
- **Rewards are a scene.** Results page becomes a cinematic: stars reveal one-by-one, score counts up, XP bar fills, shards rain in, level-up bursts into a class title.

---

## 1 — Sound: a themed RuneDelve audio family

The current `useSoundEffect` hook plays 6 generic Web-Audio tones. We'll add a parallel `useRuneDelveSfx` hook with a richer themed library, still procedurally generated (no asset downloads needed) but using layered oscillators, noise bursts, and envelope shaping to evoke each event.

**New themed sounds (all WebAudio, no assets):**

| Cue | Sound design |
|---|---|
| `rune.tap` | Soft glassy ping, pitch shifts up per chain link |
| `rune.red.fire` | Sword swoosh (filtered noise sweep) + metallic ring |
| `rune.blue.fire` | Crystal shimmer (FM bell, 3-tone arpeggio up) |
| `rune.green.fire` | Soft harp pluck + warm pad |
| `rune.gold.fire` | Anvil clang (filtered noise + low square thump) |
| `rune.invalid` | Muted dud thud |
| `chain.bonus` | Magical "ting-ting-tinggg" rising arpeggio (chain ≥7) |
| `chain.epic` | Big bloom: low boom + high shimmer (chain ≥8) |
| `enemy.hit` | Short impact thud |
| `enemy.die` | Descending whoosh + soft bone-crack click |
| `boss.roar` | Detuned saw bass swell on boss spawn |
| `hero.hurt` | Low filtered grunt + screen-flash trigger |
| `hero.heal` | Soft 3-note ascending chime |
| `shield.up` | Metallic clang + sustained shimmer |
| `mana.gain` | Crystal pip ping (one per orb) |
| `ability.ready` | Subtle rising whoosh when mana hits 5 |
| `ability.cast` | Class-flavored cast: warrior=earth-rumble, mage=zap, rogue=whoosh, cleric=hallow-chord |
| `ui.tap` | Soft tactile click |
| `ui.hover` | Tiny breath (only if pointer:fine) |
| `ui.openSheet` | Soft whoosh up |
| `ui.closeSheet` | Soft whoosh down |
| `coin.pickup` | Coin clink (single) |
| `shards.shower` | Rapid coin clink loop (results screen) |
| `level.unlock` | Stone-click into place |
| `star.earned` | Twinkle (one per star, ascending pitch) |
| `xp.fill` | Smooth synth glissando |
| `levelup.fanfare` | 4-note triumphant arpeggio |
| `relic.equip` | Magical "snap-clasp" |
| `tab.switch` | Page-flip whisk |
| `boot.charge` | Already exists conceptually in `RuneDelveBoot` — add an actual rising drone |

Implementation: `src/hooks/useRuneDelveSfx.ts`. Reuses the existing `dh-club-sound-enabled` localStorage key and `prefers-reduced-motion` gate so existing toggle still works.

---

## 2 — Combat board: stack juice on top of existing FX

The board already has `RuneChainFx`, `AbilityFx`, and camera shake. We'll layer in:

- **Floating damage / heal numbers** rising from each enemy / hero HP bar (`+24`, `-13`, `+18 HP`, `+1 SHIELD`). New `<FloatingNumber>` component, queued in same `useFxQueue`.
- **Hero portrait avatar** in the HUD — small ClassBadge with a subtle breathing animation; shakes briefly on hero hit, glows when ability ready.
- **Screen-edge red flash** when hero takes ≥10% max-HP damage (vignette pulse, 200ms).
- **Mana pip pop**: when a pip fills, scale-in + tiny shimmer particle on it. When all 5 fill, a soft pulse around the ability button + `ability.ready` cue.
- **Shield clang**: when shield turns appear, the gold shield chip pops in with a short scale-bounce + clang.
- **Enemy idle bob**: subtle 2-second sine `y: ±2px` loop on living enemies. Bosses bob bigger and slower with a faint dark aura.
- **Enemy death**: instead of just opacity, a quick scale-up → fade with 6 outward dust-mote particles + `enemy.die` cue.
- **Enemy intent flash**: when intent counter hits 1, the badge already pulses — add a subtle red border glow on the enemy frame too.
- **Boss spawn beat**: when a wave with a boss appears, half-second dark vignette + `boss.roar` cue + boss frame slams in from above with bounce.
- **Rune board ambient**: every ~5s a random non-sealed cell does a 1-frame sparkle (tiny 3-particle burst). Throttled, off when dragging or `prefers-reduced-motion`.
- **Invalid chain**: when player releases a 1-2 length chain, runes wiggle (rotate ±3°) + `rune.invalid` cue (replaces the toast for short chains).
- **Turn-end "next turn" flourish**: when enemies attack, a subtle horizontal sweep across the board area to mark the turn change.

---

## 3 — Hero status bar + HUD

- `HeroStatusBar`: HP bar gets a soft inner shimmer when at full, a slow red pulse when below 25%. Mana pips animate-in with stagger.
- `RuneDelveHUD` (sticky header): on shard balance change, the `ShardBalance` chip jiggles + shows a "+N" floater. Hero name/class chip in HUD gets a subtle hover glow.
- Add a small **turn counter pip** that ticks down with a 200ms scale-pulse each turn so the player feels the timer.

---

## 4 — Boot sequence (already premium)

Light additions only:
- Add the actual `boot.charge` rising drone synced to the progress bar (currently silent).
- One soft `level.unlock` chime on completion.
- Already perfect visually — leave alone.

---

## 5 — Home page (`RuneDelveHomePage`)

Today: glass cards, mostly static. Will become a living dashboard.

- **Continue banner**: animated arcane-mote drift behind the chapter name, gentle float on the chapter title, primary CTA gets a periodic "shimmer sweep" every 4s to draw the eye.
- **Today section** (Daily / Quests cards): when claimable quests exist, the Quests card pulses gold; when daily is undone, the Daily card has a tiny 🔥 ember drift.
- **Hero snapshot card**: ClassBadge breathes; XP bar animates from 0% to current% on first mount; on hover/tap, the title text gets a brief shimmer.
- **Leaderboard preview**: rows stagger-in (50ms each), top-3 trophy glints once on mount.
- **Class picker (first-run)**: each class card on hover/tap glows in its class color; selecting plays `ui.tap` + a brief class-color radial burst behind the badge.
- **All `btn-press` buttons**: get a global ripple-on-press effect (radial fade from press point) and `ui.tap` sound.

---

## 6 — Level Map (`RuneDelveLevelMapPage`)

Today: a plain grid of pips. Will become a journey.

- **Path visualization**: behind the level pips, draw a connecting SVG path (gentle S-curve, dashed when locked, solid when cleared). The path "draws in" when chapter loads.
- **Cleared pips**: small ✓ stamp animates on, with a 3-star mini-row that twinkles in sequence on first reveal.
- **Next-up pip**: pulses with primary glow + "YOU ARE HERE" floating chevron above it.
- **Boss/milestone pips**: larger crown icon with slow rotation + faint gold halo.
- **Chapter switcher**: tab-press triggers `tab.switch` whisk + a horizontal slide transition for the level grid.
- **Tap a level**: brief scale-down + `ui.tap`; navigation uses a route transition (see §11).

---

## 7 — Results page (`RuneDelveResultsPage`)

Currently shows everything at once. Becomes a celebratory sequence (~2.5s total, skippable on tap).

Sequence (only on clear):
1. **Outcome label** drops in (`Victory!`) with a small bloom.
2. **Score counts up** from 0 → final using requestAnimationFrame, ~800ms; soft `xp.fill` glissando under it.
3. **Stars reveal one at a time**, each with `star.earned` twinkle + scale-bounce, gold particle burst on the third.
4. **Shard reward** chip slides in, plays `shards.shower` for the count-up.
5. **XP bar** in the hero strip animates fill from previous → new value; if level up, the bar hits 100%, flashes white, resets, and a `levelup.fanfare` plays with a "Level N!" burst overlaying the hero card.
6. **Improvement chips** stagger-in last (50ms each).
7. **Confetti** stays as today, but tied to step 3 not first paint.

On failure: somber mute drum + a single shake of the score card; "near-miss" callout slides up gently.

---

## 8 — Shop, Armory, Bestiary, Quests, Daily, Hero, History, Leaderboard

These are mostly static lists today. Apply a consistent treatment:

- **Page enter**: `<PageTransition>` already exists app-wide; layer a small staggered list-entrance on each page's primary list (50–80ms per item, max 12 items animated then snap).
- **List items**: hover/tap ripple + `ui.tap` cue. Card images/icons get a subtle breath if a "new" badge is present.
- **Shop**: purchase already plays `success`/`achievement`; upgrade `relic.equip` "snap" sound + a sparkle burst on the relic icon. Locked items have a faint rotating lock shimmer.
- **Armory**: equipping a relic into a slot triggers a "click-into-place" stone sound + a brief gold ring around the slot. Upgrade sheet: rank-up button presses cause the rank gem to "level up" (scale-pop + color shift + `level.unlock` chime).
- **Bestiary**: enemy cards idle-bob like in combat. Newly defeated entries get a "discovered" pulse on first view.
- **Quests**: claimable quests have a gold breathing border; claim button on press fires `coin.pickup` + a tiny shard-burst from the button.
- **Daily**: streak flame icon flickers (looped). The big "Begin trial" CTA shimmers like the home banner.
- **Hero page**: class badge bigger, breathes; cosmetic title shimmers; mastery progress bars animate fill on mount.
- **Leaderboard**: top-3 rows get rank-color halos (gold/silver/bronze), your row pulses subtly.

---

## 9 — Sheets, dialogs, drawers

- `HowToPlaySheet`, `CodexSheet`, `MechanicIntroSheet`, `RelicUpgradeSheet`, `ExitRunDialog`: open/close sounds (`ui.openSheet`/`ui.closeSheet`), and a slight backdrop bloom (existing radix overlay + a brief radial gradient fade).
- Mechanic intro (when entering a level with a new mechanic): the mechanic icon "stamps" in with a small camera-shake-lite on the sheet body.

---

## 10 — Buttons & cards (global RuneDelve treatment)

A small shared `useRdButton` hook + a `.rd-btn-juice` utility class (added to `index.css` under `.rd-mode`):

- **Press**: tactile `ui.tap` + scale to 0.96 with a radial ripple from the press coordinate.
- **Hover (pointer:fine)**: subtle gold inner-glow lift, 1px Y translate.
- **Disabled**: no sound, no juice — clear cue.
- **Primary CTAs** (gradient buttons): periodic 4-second "shimmer sweep" diagonal across them when idle and visible.

This will be applied via a one-line className addition on existing `btn-press` elements inside `rd-mode`, so it cascades to every menu without rewriting any button.

---

## 11 — Route transitions inside `/rune-delve/*`

- Use the existing `<PageTransition>` + add a brief 80ms whoosh `tab.switch` on RuneDelve route changes (detected by a route-change listener inside `RuneDelveLayout`).
- When entering `/play/:n`: a quick "rune-charge" wipe (vertical light sweep) + boot-style mote-rise for 350ms, then board fades in.
- When leaving combat to results: the board does a brief inward zoom dissolve.

---

## 12 — Accessibility, perf, and "off switches"

- Everything respects `prefers-reduced-motion: reduce`: idle bobs stop, only essential FX play, no camera shake, no shimmer sweeps. Sounds still play.
- Sound respects the existing global toggle (`dh-club-sound-enabled`) — no new setting.
- All animations are transform/opacity only; no layout thrash; FX components un-mount when offscreen.
- Idle ambient (rune sparkle, enemy bob, shimmer sweeps) pause when the tab is hidden via `document.visibilitychange`.
- Mobile haptics already exist in `useSoundEffect` — extend with themed haptic patterns for the new cues (boss roar = long buzz, level-up = triple pulse, etc.).

---

## Technical implementation outline

### New files
- `src/hooks/useRuneDelveSfx.ts` — themed audio family + haptic patterns; wraps WebAudio with a small synth toolkit (oscillator stack, noise burst, ADSR envelope, simple FM bell).
- `src/components/runedelve/fx/FloatingNumber.tsx` — damage/heal/mana floaters; integrates with existing `useFxQueue`.
- `src/components/runedelve/fx/EnemyAura.tsx` — idle bob, boss aura, telegraph glow wrapper for `EnemyDisplay`.
- `src/components/runedelve/fx/HeroPortrait.tsx` — animated hero badge in HUD with breath/glow/hurt-shake states.
- `src/components/runedelve/fx/ScreenEdgeFlash.tsx` — vignette pulse on hero hit.
- `src/components/runedelve/fx/AmbientSparkle.tsx` — throttled rune-board ambient.
- `src/components/runedelve/fx/CountUp.tsx` — RAF-based number tweener for results score / shards / XP.
- `src/components/runedelve/fx/RouteWipe.tsx` — short rune-charge wipe between RD routes.
- `src/components/runedelve/MapPath.tsx` — SVG connector path for the Level Map.
- `src/lib/runedelve/soundCues.ts` — central enum + helper to play the right cue from gameplay events.

### Edited files (additive only — no logic changes)
- `src/index.css` — `.rd-mode` utilities for: `.rd-btn-juice` (ripple + hover glow + shimmer sweep), `.rd-breath` (idle bob), `.rd-aura-boss`, `.rd-screen-flash`, `@keyframes` for shimmer-sweep / breath / sparkle / star-pop / xp-fill-flash. Reduced-motion overrides for each.
- `src/components/runedelve/RuneBoard.tsx` — wire `useRuneDelveSfx` for typed rune cues, invalid wiggle, ambient sparkle layer.
- `src/components/runedelve/RuneCell.tsx` — small invalid-wiggle prop + ambient sparkle slot.
- `src/components/runedelve/EnemyDisplay.tsx` — wrap each enemy in `<EnemyAura>` for idle bob + boss aura + death animation.
- `src/components/runedelve/HeroStatusBar.tsx` — HP shimmer/pulse states, mana pip pop, ability-ready glow + cue, embed `<HeroPortrait>` slot.
- `src/components/runedelve/RuneDelveHUD.tsx` — shard chip jiggle on change with `+N` floater, turn-counter pip, route-change cue trigger.
- `src/components/runedelve/RuneDelveLayout.tsx` — mount `<RouteWipe>` + route-change `tab.switch` cue + `<ScreenEdgeFlash>` mount point.
- `src/components/runedelve/RuneDelveBoot.tsx` — add `boot.charge` drone + completion chime.
- `src/components/runedelve/{HowToPlaySheet,CodexSheet,MechanicIntroSheet,RelicUpgradeSheet,ExitRunDialog}.tsx` — open/close sound hooks via a small `useSheetSfx(open)` helper.
- `src/components/runedelve/RelicCard.tsx`, `LoadoutSlot.tsx` — equip click cue + slot-glow on equip.
- `src/pages/RuneDelvePlayPage.tsx` — emit themed cues at: chain resolved (per rune type + tier), enemy hit/die, hero hurt (+ screen flash), heal, shield up, mana gain (per pip), ability ready/cast, boss spawn, turn end, victory/defeat. Damage/heal floaters via the FX queue.
- `src/pages/RuneDelveResultsPage.tsx` — sequenced reveal: count-up score, star-by-star, shard count-up, XP bar fill with potential level-up burst, then improvement chips. Skippable on tap.
- `src/pages/RuneDelveHomePage.tsx` — banner shimmer, hero card breath, list-stagger, ember on Daily card, gold pulse on Quests card when claimable.
- `src/pages/RuneDelveLevelMapPage.tsx` — `<MapPath>` connector, you-are-here pulse, milestone halos, chapter-switch slide.
- `src/pages/RuneDelve{Shop,Armory,Bestiary,Quests,Daily,Hero,History,Leaderboard}Page.tsx` — apply `.rd-btn-juice`, `useSheetSfx` where applicable, list-stagger, themed cues for primary actions.

### Risk & scope control
- Zero gameplay/balance changes — purely presentation + audio.
- All new FX/sound modules are additive; if any underperforms, removing the wrapping `<...Fx>` reverts cleanly.
- No new dependencies (uses existing framer-motion + WebAudio).
- Built and verified one screen at a time, in this order: SFX library → combat polish → home → results → level map → other menus → transitions.

---

## Out of scope (intentionally)

- No new music tracks (would need ElevenLabs + storage; ask later if you want ambient dungeon music).
- No remixed combat balance, scoring, or level generation.
- No new game modes or screens.
- No changes to the existing in-board `RuneChainFx` / `AbilityFx` cinematics — they're already premium; we only add sound + ambient layering around them.

If you want music later (boot drone, dungeon ambience, boss leitmotif, victory fanfare), that's a clean follow-up: it would go through ElevenLabs Music API, cached in storage, and gated by the same sound toggle.
