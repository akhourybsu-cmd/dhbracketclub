

## Rune Delve — Battle FX Glow-Up: Distinctive, Signature Visuals

The current FX system works, but every effect leans on the same vocabulary: radial gradients, ✦ sparkles, and short fades. Players can't immediately tell red from blue at a glance. This pass replaces each effect with a **signature visual identity** — bespoke SVG shapes, particle physics, and timing that makes each rune and ability feel like its own move from a fighting game.

### What changes per rune (signature redesigns)

**🔴 Red — Blade Storm** (replaces 3 horizontal slashes)
- Three SVG katana-shaped blades materialize *off-screen*, fly in from different angles (top-left, right, bottom-left), pierce the enemy at staggered 80ms intervals, then evaporate in red embers.
- On impact: white-hot **impact star** (8-point SVG burst) flashes, enemy card hard-shakes (existing `shake` boosted to amplitude 6), red floor-crack lines briefly appear under the enemy portrait.
- Chain ≥6: blades turn molten gold, embers double, a thin **kanji-style stroke** ("斬") flashes for 120ms.

**🟢 Green — Lifebloom Spiral** (replaces drifting motes)
- A single **SVG vine spiral** unfurls from the board, twisting upward toward the HP bar in a logarithmic curve (Framer Motion `path` with `pathLength` 0→1).
- Along the vine, **3 SVG leaves** (custom path) bloom and detach, gently floating upward with sine-wave drift.
- HP bar receives a **green inner-glow pulse** (box-shadow inset) synchronized to the leaves' arrival — looks like the leaves are *feeding* the bar.
- Chain ≥6: vine is gold-veined; a small **bird silhouette** (SVG) crosses the screen briefly.

**🟡 Gold — Aegis Forge** (replaces emoji shields)
- Two **SVG shield halves** (proper heater-shield shape with rivets, beveled edge) slide in from screen edges, rotating slightly. They meet center-board with a **gold sparkscape** — 12 short radial sparks shoot outward like a hammer-strike.
- A **runic ring** (SVG circle with notched ticks) briefly orbits the shield, then the whole construct *implodes* into the `🛡 N` chip with a ribbon of gold light.
- Chain ≥6: shield is **double-rimmed**, ring contains 4 cardinal rune glyphs that flash sequentially.

**🔵 Blue — Aether Resonance** (replaces converging diamonds)
- Six **hexagonal SVG nodes** (not diamonds) rise from the chained cells with a vertical bob, each pulsing at a slightly offset phase so they look like they're *resonating*.
- They draw connecting **lightning lines** (SVG polyline with jitter) between each other forming a magic circle, then *collapse inward* into a single bright orb that splits into ribbons of light streaking to each newly-filled mana pip.
- Each filled pip gets a **2-frame ring expansion** + brief blue rim-light.
- Chain ≥6: ribbons are gold and the magic circle leaves a faint gold afterimage on the board for 400ms.

### What changes per class ability (signature set pieces)

**⚔️ Warrior — Earthshatter Cleave** (replaces single arc)
- Hero "winds up" (faint red aura pulses on the hero status bar for 180ms first), then a **ground-cracking arc** sweeps the full board: a wide curved SVG slash trails red embers; **3 jagged crack lines** split the floor under the enemies; a **white shockwave ring** expands; every enemy card flashes white → red and shakes.
- Closes with falling **rock chunk particles** (small brown SVG triangles) for 240ms.

**🔮 Mage — Starfall Convergence** (replaces single bolt)
- 3 **violet meteor streaks** rain down diagonally from off-screen top, each leaving a comet-tail. They converge on the targeted enemy, where a **runic glyph circle** (SVG) flashes gold-violet just before impact.
- Detonation: chromatic-aberration ring (3 rings offset RGB-style: red, green, blue) expands; lightning forks branch outward to 4 directions with crackle.

**🗡️ Rogue — Fivefold Shadow** (replaces single afterimage)
- Hero's afterimage **splits into 5 ghost copies** that fan across the board horizontally with motion blur, each tagging an enemy with a tiny `✕` slash.
- All ghosts converge back to a single point with an inward whoosh; a **Shadowstep ✦ badge** with a soft black smoke aura settles into the HUD.

**✨ Cleric — Hallowed Sanctum** (replaces concentric rings)
- A **6-pointed SVG star** (sacred geometry) inscribes itself on the board with `pathLength` animation (320ms draw-in), then a **dome of light** sweeps upward.
- Concentric halos pulse outward in 3 waves with **floating gold cross-glyphs** (✟ SVG path, not emoji) drifting up; HP bar gets a **crest sweep** (gold gradient wipe left→right inside the bar fill).
- Soft chime sparkle on the shield chip with a **brief radial bloom**.

### Cross-cutting upgrades

- **Camera-feel screen shake** (CSS variable–driven): tiny `--rd-cam-shake-x/y` applied to the play container's transform on red chains and Warrior cleave only (4–8px, 200ms decay). No layout reflow — pure transform.
- **Tier crescendo**: chain-tier flourishes restructured so 6/7/8 chains read like distinct beats — gold tint at 6, "✨ BONUS" floating chip + brief slow-mo (CSS `animation-duration *= 1.2` for next 200ms) at 7, screen-wide gold bloom + soft white vignette flash at 8.
- **Audio sync hooks**: each effect calls existing `useSoundEffect` triggers at the right beat (slash impact, vine bloom, shield clang, mana resonance, ability detonation). Wire only — no new audio assets.
- **Reduced motion**: keeps the existing 120ms cross-fade fallback. New SVG paths render statically (no draw-in) and just fade.

### How it's built (minimal surface area)

**New file**
- `src/components/runedelve/fx/FxIcons.tsx` — pure SVG primitives: `<KatanaBlade/>`, `<HeaterShield/>`, `<HexNode/>`, `<VineLeaf/>`, `<Meteor/>`, `<RuneCircle/>`, `<SacredStar/>`, `<CrossGlyph/>`, `<Kanji/>`, `<RockChunk/>`. Each ~20–40 lines, accepts `size` + `color` + `className` props. Reusable across rune and ability components.

**Edited files**
- `src/components/runedelve/fx/RuneChainFx.tsx` — full rewrite of `RedSlash`, `GreenBloom`, `GoldShieldLock`, `BlueArcane` using the new SVG primitives + Framer Motion variants. Same component signatures, same `containerRect`/`tx`/`ty` math, same auto-clear timing. **No public API change.**
- `src/components/runedelve/fx/AbilityFx.tsx` — full rewrite of `WarriorCleave`, `MageArcBurst`, `RogueShadowstep`, `ClericSanctuary` to the set-piece designs above. Same component signature.
- `src/index.css` — add ~6 new keyframes scoped under `.rd-mode`: `rd-cam-shake`, `rd-bonus-chip`, `rd-vignette-flash`, `rd-crack`, `rd-ember-rise`, `rd-resonance-pulse`. Add `--rd-cam-shake-x/y` CSS vars wired to the play container.
- `src/pages/RuneDelvePlayPage.tsx` — (1) on red chains ≥4 and Warrior ability, set inline `style={{ ['--rd-cam-shake-x' as any]: '6px' }}` on the root container for 200ms via a tiny `useShake()` ref helper; (2) call `playSound('slash'|'bloom'|'clang'|'resonance'|'cast')` at FX trigger points (existing hook, no new sounds — just additional invocations of the same primitives).
- `src/components/runedelve/HeroStatusBar.tsx` — add `data-fx-hp-glow` toggle + a small CSS pulse target on the HP bar's inner fill so Lifebloom can sync the bar's inner-glow.

**Performance**
- All new visuals are SVG (transform/opacity only) or HSL gradients — same GPU-composited budget as before.
- Particle counts capped: blades 3, leaves 3, sparks 12, hex nodes 6, meteors 3, ghost copies 5, halos 3, cross-glyphs 4. Total per-FX nodes ≤ 16, well under the 30-node mobile budget.
- Queue cap stays at 2; no new state added to the FX queue.
- `prefers-reduced-motion` short-circuits all draw-in animations to opacity-only.

### Files touched

- New: `src/components/runedelve/fx/FxIcons.tsx`
- Rewritten internals: `src/components/runedelve/fx/RuneChainFx.tsx`, `src/components/runedelve/fx/AbilityFx.tsx`
- Light edits: `src/index.css` (+~6 keyframes), `src/pages/RuneDelvePlayPage.tsx` (cam-shake + sound hooks), `src/components/runedelve/HeroStatusBar.tsx` (HP glow target)

### Manual testing checklist (411×734)

- Red chain → katana blades fly in from 3 angles, impact star flashes, board shakes briefly. Chain ≥6 turns gold + 斬 glyph.
- Green chain → vine spiral curls toward HP bar, 3 leaves bloom/float, HP bar inner-glow pulses on arrival.
- Gold chain → shield halves slam together, sparkscape fires outward, runic ring orbits then implodes into 🛡 chip.
- Blue chain → 6 hex nodes resonate, lightning lines connect them, ribbons stream to mana pips with rim-light.
- Warrior ability → wind-up aura → arc-slash → ground cracks → shockwave → falling rock chunks. Screen shakes once.
- Mage ability → 3 meteors converge on rune-circle → chromatic ring + lightning forks.
- Rogue ability → 5 ghost copies fan across board, converge, shadow badge settles in HUD.
- Cleric ability → sacred star inscribes, dome rises, cross-glyphs drift up, HP crest sweep.
- Chain 8 → screen vignette flash + gold bloom; no overlap with next FX (queue caps at 2).
- Reduced-motion mode → static SVG fade-in/out only, no draw or shake.

