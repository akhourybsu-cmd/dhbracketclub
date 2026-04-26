## Goal

Redesign the combat & ability sound cues in `src/hooks/useRuneDelveSfx.ts` so each one *sounds like the thing it does* — a sword cleave actually whooshes and clangs, a mage's arc actually crackles with electricity, a rogue's strike actually slices air, a cleric's sanctuary actually rings like a chapel, shields thud and shimmer, healing chimes warmly, etc.

No new cue keys, no API changes, no callsite changes. Just much better-composed audio in the same `playCue()` switch so existing triggers across the game instantly feel meatier and more thematic.

## What gets reworked

### Rune ignition (chain-fire) cues
- **`rune.fire.red` (sword chain)** — front-load a sharper air whoosh (bandpass sweep 800→5500Hz), then a metallic edge ring (two detuned triangle/sine partials), then a brief low-mid thud so it lands like a slash that connects.
- **`rune.fire.blue` (arcane chain)** — replace plain bell arpeggio with a rising electric crackle: noise burst through a high-Q bandpass sweep (1500→6000Hz) layered with a quick FM-bell triad and a final sparkle bell — sounds like a building spark, not a wind chime.
- **`rune.fire.green` (nature/heal chain)** — soften into a warm harp pluck plus a gentle airy pad (filtered pink-ish noise lowpass 1200Hz) and a leaf-rustle shimmer; current is fine but needs more "growing" feel via a slow upward bend on the top partial.
- **`rune.fire.gold` (guard chain)** — anvil-clang upgrade: short hard noise transient (highpass 2500Hz) → low square thud → two metallic bells with slight inharmonic detune (ratio 2.76) so it rings like struck steel rather than a chime.

### Ability casts (one per class)
- **`ability.cast.warrior` (Cleave)** — full slash arc: long whoosh (bandpass 600→4500Hz, 0.35s), heavy metallic clang on impact (square thud + detuned bell at ratio 2.76), low body thud, brief grunt-like saw growl. Should feel like a horizontal sweep that connects.
- **`ability.cast.mage` (Arc Bolt)** — electric zap: crackling noise with sweeping bandpass (800→7000Hz), a sharp sine "zip" with strong upward bend, a bright bell on impact, and a tiny secondary crackle 80ms later to imply the Arc Cascade chain.
- **`ability.cast.rogue` (Shadowstep)** — silk-and-steel: very short low whoosh (lowpass swept down) for the vanish, brief silence beat, then a quick high-frequency blade unsheathe (highpass noise + sine zip up). Conveys disappear → reappear → strike-ready.
- **`ability.cast.cleric` (Sanctuary)** — chapel chord: sustained perfect-fifth bell chord with a longer release (0.9s), soft airy "halo" noise (highpass 4000Hz), and a low warm pad underneath for a sacred-sanctified feel rather than a thin chime stack.

### Defensive / status cues
- **`shield.up`** — woody/metallic shield raise: short noise *thunk* (lowpass 800Hz, very short attack), then a metallic ring-up bell with upward bend, plus the existing high shimmer. Currently too chime-y; needs body.
- **`hero.heal`** — keep ascending bell triad but add a soft warm sine pad underneath (~0.4s) so it feels enveloping, not just sparkly.
- **`mana.gain`** — add a tiny rising "fill" sweep (sine bend up) under the existing bell so stacking mana feels like water dropping into a glass.
- **`ability.ready`** — make it feel like a weapon humming to life: add a low resonant pulse (square at ~110Hz with tight LFO-style retriggers via two short tone hits) under the existing rising sine + airy noise.

### Enemy / impact cues
- **`enemy.hit`** — add a leather/cloth thump (very short lowpass noise burst at 400Hz) before the existing square thud + bandpass noise so hits feel like they connect with a body, not just a square wave.
- **`enemy.die`** — add a brief bone-crack transient (very short highpass noise 4000Hz, 30ms) at start so deaths punctuate before the existing fall-off.
- **`boss.roar`** — add a snarling mid-band (sawtooth ~180Hz with heavy bend) layered over the existing low rumble so the roar has teeth, not just sub-bass.
- **`hero.hurt`** — add a short breath/grunt approximation (filtered noise lowpass 600Hz, very fast decay) to humanize the hit.

### Chain bonus / epic
- **`chain.bonus`** — keep ascending bell sequence but speed up the stagger and add a tiny sparkle (high bell at ~2640Hz) at the end as a cherry.
- **`chain.epic`** — add a low impact thud at t=0 (square 80Hz, very short) before the existing rumble + bell stack so the epic feels *triggered* by an impact, not just ambient.

## Approach

All edits live in the `switch (cue)` block of `playCue()` in `src/hooks/useRuneDelveSfx.ts`. Reuses the existing `tone()`, `noise()`, `bell()` synth toolkit — no new helpers needed.

A few of the new layers want one capability the toolkit doesn't quite have: **inharmonic bell ratios** (e.g. 2.76 instead of 2.01) for metallic clangs. The `bell()` helper already accepts a `ratio` option, so this is just a matter of passing it.

No changes to:
- The cue keys (`RdSfxCue` union)
- The category mapping (`categoryFor`)
- Haptic patterns (already aligned per-cue)
- Sound settings, callsites, or any component code

## Files touched

- `src/hooks/useRuneDelveSfx.ts` — only the cue compositions inside `playCue()`'s switch statement.

## Out of scope

- UI/menu cues (`ui.tap`, `ui.hover`, sheet open/close, tab switch) — already feel right, leaving alone.
- Reward cues (coins, stars, victory fanfare, levelup) — those are about progression celebration, not combat, so untouched unless you want them next.
- Boot cues — ambient and intentional.
- Ambient music — separate system.
