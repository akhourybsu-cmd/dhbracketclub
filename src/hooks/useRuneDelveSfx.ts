import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Themed RuneDelve sound family.
 *
 * Procedurally synthesised via the WebAudio API — no audio assets required.
 * Built on top of a small synth toolkit (oscillator stack, noise burst,
 * ADSR envelope, FM bell, filter sweep) so each cue has a *signature*
 * timbre rather than the generic ping/beep used in the broader app.
 *
 * Reuses the same global toggle key as `useSoundEffect` so the existing
 * sound on/off control naturally turns these off too. Always silent if
 * the user prefers reduced motion (treated as "low-stim" preference).
 *
 * Mobile haptics are emitted alongside cues where it adds tactile value.
 */

const STORAGE_KEY = 'dh-club-sound-enabled';
const HOVER_COOLDOWN_MS = 60;

export type RdSfxCue =
  // Rune board
  | 'rune.tap'
  | 'rune.invalid'
  | 'rune.fire.red'
  | 'rune.fire.blue'
  | 'rune.fire.green'
  | 'rune.fire.gold'
  | 'chain.bonus'
  | 'chain.epic'
  // Combat
  | 'enemy.hit'
  | 'enemy.die'
  | 'boss.roar'
  | 'hero.hurt'
  | 'hero.heal'
  | 'shield.up'
  | 'mana.gain'
  | 'ability.ready'
  | 'ability.cast.warrior'
  | 'ability.cast.mage'
  | 'ability.cast.rogue'
  | 'ability.cast.cleric'
  | 'turn.end'
  // UI / menu
  | 'ui.tap'
  | 'ui.hover'
  | 'ui.openSheet'
  | 'ui.closeSheet'
  | 'tab.switch'
  // Rewards / progression
  | 'coin.pickup'
  | 'shards.shower'
  | 'level.unlock'
  | 'star.earned'
  | 'xp.fill'
  | 'levelup.fanfare'
  | 'relic.equip'
  | 'victory'
  | 'defeat'
  // Boot
  | 'boot.charge'
  | 'boot.ready';

function getStoredSoundPref(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
}

/* ─── Synth toolkit ───────────────────────────────────────────────── */

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  start?: number; // delay seconds
  dur?: number;
  attack?: number;
  release?: number;
  peak?: number; // gain peak (0..1)
  detune?: number;
  bend?: number; // freq * bend at end
}

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type ?? 'sine';
  if (o.detune) osc.detune.setValueAtTime(o.detune, ctx.currentTime);
  const t0 = ctx.currentTime + (o.start ?? 0);
  const dur = o.dur ?? 0.25;
  const peak = o.peak ?? 0.08;
  const att = o.attack ?? 0.005;
  const rel = o.release ?? Math.max(0.04, dur - att);

  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.bend), t0 + dur);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + att);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + att + rel);

  osc.connect(gain).connect(dest);
  osc.start(t0);
  osc.stop(t0 + att + rel + 0.02);
}

interface NoiseOpts {
  start?: number;
  dur?: number;
  peak?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
}

function noise(ctx: AudioContext, dest: AudioNode, o: NoiseOpts) {
  const dur = o.dur ?? 0.2;
  const start = o.start ?? 0;
  const peak = o.peak ?? 0.06;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let last: AudioNode = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, t0);
    if (o.filter.q != null) f.Q.setValueAtTime(o.filter.q, t0);
    if (o.filter.sweepTo) f.frequency.exponentialRampToValueAtTime(o.filter.sweepTo, t0 + dur);
    src.connect(f);
    last = f;
  }
  last.connect(gain).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Simple FM bell — modulator + carrier. Great for crystal/mana cues. */
function bell(ctx: AudioContext, dest: AudioNode, freq: number, opts: { start?: number; dur?: number; peak?: number; ratio?: number; modDepth?: number } = {}) {
  const start = opts.start ?? 0;
  const dur = opts.dur ?? 0.6;
  const peak = opts.peak ?? 0.08;
  const ratio = opts.ratio ?? 2.01;
  const depth = opts.modDepth ?? 240;
  const t0 = ctx.currentTime + start;

  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const gain = ctx.createGain();

  carrier.type = 'sine';
  mod.type = 'sine';
  carrier.frequency.setValueAtTime(freq, t0);
  mod.frequency.setValueAtTime(freq * ratio, t0);
  modGain.gain.setValueAtTime(depth, t0);
  modGain.gain.exponentialRampToValueAtTime(0.01, t0 + dur);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  mod.connect(modGain).connect(carrier.frequency);
  carrier.connect(gain).connect(dest);
  mod.start(t0); carrier.start(t0);
  mod.stop(t0 + dur + 0.05); carrier.stop(t0 + dur + 0.05);
}

/* ─── Cue compositions ────────────────────────────────────────────── */

function playCue(cue: RdSfxCue, chainIndex = 0): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, ctx.currentTime);
  master.connect(ctx.destination);
  const out: AudioNode = master;

  switch (cue) {
    /* Rune board */
    case 'rune.tap': {
      const base = 520;
      const f = base + Math.min(8, chainIndex) * 60;
      tone(ctx, out, { freq: f, type: 'sine', dur: 0.08, peak: 0.05, release: 0.06 });
      tone(ctx, out, { freq: f * 2, type: 'sine', dur: 0.06, peak: 0.025, release: 0.05 });
      break;
    }
    case 'rune.invalid':
      tone(ctx, out, { freq: 180, type: 'square', dur: 0.16, peak: 0.06, bend: 0.6 });
      noise(ctx, out, { dur: 0.12, peak: 0.025, filter: { type: 'lowpass', freq: 600 } });
      break;
    case 'rune.fire.red':
      // Sword swoosh + metallic ring
      noise(ctx, out, { dur: 0.22, peak: 0.08, filter: { type: 'bandpass', freq: 1200, q: 1.2, sweepTo: 4200 } });
      tone(ctx, out, { freq: 880, type: 'triangle', dur: 0.2, peak: 0.06, bend: 1.6, start: 0.05 });
      tone(ctx, out, { freq: 1320, type: 'sine', dur: 0.18, peak: 0.04, bend: 1.4, start: 0.07 });
      break;
    case 'rune.fire.blue':
      // Crystal arpeggio
      bell(ctx, out, 660, { dur: 0.4, peak: 0.07 });
      bell(ctx, out, 880, { dur: 0.42, peak: 0.06, start: 0.06 });
      bell(ctx, out, 1100, { dur: 0.5, peak: 0.06, start: 0.12 });
      break;
    case 'rune.fire.green':
      // Warm harp pluck + soft pad
      tone(ctx, out, { freq: 392, type: 'triangle', dur: 0.45, peak: 0.07, attack: 0.005, release: 0.4 });
      tone(ctx, out, { freq: 587, type: 'sine', dur: 0.45, peak: 0.05, start: 0.04, release: 0.4 });
      tone(ctx, out, { freq: 784, type: 'sine', dur: 0.5, peak: 0.04, start: 0.08, release: 0.45 });
      break;
    case 'rune.fire.gold':
      // Anvil clang
      noise(ctx, out, { dur: 0.18, peak: 0.07, filter: { type: 'highpass', freq: 2000 } });
      tone(ctx, out, { freq: 220, type: 'square', dur: 0.18, peak: 0.06, bend: 0.7 });
      bell(ctx, out, 1100, { dur: 0.5, peak: 0.07, start: 0.03 });
      bell(ctx, out, 1700, { dur: 0.4, peak: 0.05, start: 0.05 });
      break;
    case 'chain.bonus': {
      const notes = [880, 1108, 1318, 1760];
      notes.forEach((n, i) => bell(ctx, out, n, { dur: 0.32, peak: 0.06, start: i * 0.05 }));
      break;
    }
    case 'chain.epic':
      tone(ctx, out, { freq: 80, type: 'sine', dur: 0.7, peak: 0.1, bend: 0.5 });
      tone(ctx, out, { freq: 110, type: 'sawtooth', dur: 0.6, peak: 0.05, bend: 0.6, start: 0.02 });
      bell(ctx, out, 1320, { dur: 0.7, peak: 0.07, start: 0.08 });
      bell(ctx, out, 1980, { dur: 0.7, peak: 0.06, start: 0.12 });
      noise(ctx, out, { dur: 0.4, peak: 0.04, filter: { type: 'bandpass', freq: 3000, sweepTo: 6000 } });
      break;

    /* Combat */
    case 'enemy.hit':
      tone(ctx, out, { freq: 240, type: 'square', dur: 0.1, peak: 0.07, bend: 0.55 });
      noise(ctx, out, { dur: 0.08, peak: 0.04, filter: { type: 'bandpass', freq: 1400 } });
      break;
    case 'enemy.die':
      tone(ctx, out, { freq: 320, type: 'sawtooth', dur: 0.4, peak: 0.07, bend: 0.25 });
      noise(ctx, out, { dur: 0.32, peak: 0.05, filter: { type: 'lowpass', freq: 1200, sweepTo: 200 } });
      tone(ctx, out, { freq: 600, type: 'triangle', dur: 0.1, peak: 0.04, start: 0.18, bend: 0.5 });
      break;
    case 'boss.roar':
      tone(ctx, out, { freq: 70, type: 'sawtooth', dur: 0.9, peak: 0.1, bend: 1.3, detune: -8 });
      tone(ctx, out, { freq: 72, type: 'sawtooth', dur: 0.9, peak: 0.08, bend: 1.3, detune: 12 });
      noise(ctx, out, { dur: 0.7, peak: 0.05, filter: { type: 'lowpass', freq: 600, sweepTo: 1400 } });
      break;
    case 'hero.hurt':
      tone(ctx, out, { freq: 180, type: 'sawtooth', dur: 0.18, peak: 0.07, bend: 0.55 });
      noise(ctx, out, { dur: 0.14, peak: 0.05, filter: { type: 'lowpass', freq: 800 } });
      break;
    case 'hero.heal': {
      const notes = [523, 659, 880];
      notes.forEach((n, i) => bell(ctx, out, n, { dur: 0.35, peak: 0.06, start: i * 0.07 }));
      break;
    }
    case 'shield.up':
      noise(ctx, out, { dur: 0.18, peak: 0.07, filter: { type: 'highpass', freq: 1800 } });
      tone(ctx, out, { freq: 320, type: 'square', dur: 0.16, peak: 0.06, bend: 0.85 });
      bell(ctx, out, 1200, { dur: 0.5, peak: 0.06, start: 0.04 });
      break;
    case 'mana.gain':
      bell(ctx, out, 1100 + chainIndex * 110, { dur: 0.22, peak: 0.05 });
      break;
    case 'ability.ready':
      tone(ctx, out, { freq: 440, type: 'sine', dur: 0.35, peak: 0.05, bend: 1.8 });
      noise(ctx, out, { dur: 0.3, peak: 0.025, filter: { type: 'bandpass', freq: 2000, sweepTo: 4500 } });
      break;
    case 'ability.cast.warrior':
      tone(ctx, out, { freq: 60, type: 'sawtooth', dur: 0.55, peak: 0.1, bend: 0.7 });
      noise(ctx, out, { dur: 0.4, peak: 0.06, filter: { type: 'lowpass', freq: 800 } });
      tone(ctx, out, { freq: 180, type: 'square', dur: 0.2, peak: 0.06, start: 0.1, bend: 0.5 });
      break;
    case 'ability.cast.mage':
      bell(ctx, out, 880, { dur: 0.5, peak: 0.07 });
      bell(ctx, out, 1320, { dur: 0.5, peak: 0.06, start: 0.04 });
      noise(ctx, out, { dur: 0.35, peak: 0.05, filter: { type: 'bandpass', freq: 3000, sweepTo: 6000 } });
      tone(ctx, out, { freq: 1760, type: 'sine', dur: 0.2, peak: 0.05, start: 0.18, bend: 1.5 });
      break;
    case 'ability.cast.rogue':
      noise(ctx, out, { dur: 0.4, peak: 0.06, filter: { type: 'bandpass', freq: 600, q: 1.5, sweepTo: 3500 } });
      tone(ctx, out, { freq: 240, type: 'triangle', dur: 0.18, peak: 0.05, bend: 1.6 });
      break;
    case 'ability.cast.cleric': {
      const chord = [392, 494, 587, 784];
      chord.forEach(n => bell(ctx, out, n, { dur: 0.7, peak: 0.05 }));
      noise(ctx, out, { dur: 0.4, peak: 0.025, filter: { type: 'highpass', freq: 3000 } });
      break;
    }
    case 'turn.end':
      tone(ctx, out, { freq: 360, type: 'sine', dur: 0.12, peak: 0.04, bend: 0.7 });
      break;

    /* UI */
    case 'ui.tap':
      tone(ctx, out, { freq: 720, type: 'sine', dur: 0.05, peak: 0.04 });
      tone(ctx, out, { freq: 1080, type: 'sine', dur: 0.04, peak: 0.025, start: 0.005 });
      break;
    case 'ui.hover':
      tone(ctx, out, { freq: 1400, type: 'sine', dur: 0.04, peak: 0.018 });
      break;
    case 'ui.openSheet':
      tone(ctx, out, { freq: 320, type: 'sine', dur: 0.18, peak: 0.05, bend: 1.6 });
      noise(ctx, out, { dur: 0.16, peak: 0.025, filter: { type: 'bandpass', freq: 1600, sweepTo: 3000 } });
      break;
    case 'ui.closeSheet':
      tone(ctx, out, { freq: 520, type: 'sine', dur: 0.18, peak: 0.05, bend: 0.55 });
      noise(ctx, out, { dur: 0.14, peak: 0.022, filter: { type: 'bandpass', freq: 3000, sweepTo: 1200 } });
      break;
    case 'tab.switch':
      noise(ctx, out, { dur: 0.1, peak: 0.04, filter: { type: 'bandpass', freq: 2400, sweepTo: 800 } });
      tone(ctx, out, { freq: 660, type: 'sine', dur: 0.08, peak: 0.04, bend: 0.7 });
      break;

    /* Rewards */
    case 'coin.pickup':
      bell(ctx, out, 1320, { dur: 0.18, peak: 0.07 });
      bell(ctx, out, 1760, { dur: 0.2, peak: 0.05, start: 0.03 });
      break;
    case 'shards.shower': {
      // Brief shimmer flurry
      for (let i = 0; i < 8; i++) {
        const freq = 1000 + Math.random() * 1400;
        bell(ctx, out, freq, { dur: 0.18, peak: 0.05, start: i * 0.04 });
      }
      break;
    }
    case 'level.unlock':
      tone(ctx, out, { freq: 220, type: 'square', dur: 0.12, peak: 0.07, bend: 0.6 });
      tone(ctx, out, { freq: 440, type: 'triangle', dur: 0.18, peak: 0.06, start: 0.05, bend: 1.4 });
      bell(ctx, out, 1320, { dur: 0.3, peak: 0.05, start: 0.1 });
      break;
    case 'star.earned': {
      const f = 1320 + chainIndex * 220;
      bell(ctx, out, f, { dur: 0.36, peak: 0.07 });
      bell(ctx, out, f * 1.5, { dur: 0.32, peak: 0.05, start: 0.04 });
      break;
    }
    case 'xp.fill':
      tone(ctx, out, { freq: 440, type: 'sine', dur: 0.6, peak: 0.05, bend: 2.2 });
      noise(ctx, out, { dur: 0.5, peak: 0.022, filter: { type: 'bandpass', freq: 2000, sweepTo: 5000 } });
      break;
    case 'levelup.fanfare': {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => {
        tone(ctx, out, { freq: n, type: 'triangle', dur: 0.22, peak: 0.07, start: i * 0.1, bend: 1.02 });
        bell(ctx, out, n * 2, { dur: 0.3, peak: 0.05, start: i * 0.1 });
      });
      // Final sustain
      tone(ctx, out, { freq: 1047, type: 'sine', dur: 0.5, peak: 0.06, start: 0.42 });
      break;
    }
    case 'relic.equip':
      noise(ctx, out, { dur: 0.08, peak: 0.05, filter: { type: 'highpass', freq: 3000 } });
      tone(ctx, out, { freq: 880, type: 'sine', dur: 0.08, peak: 0.05, bend: 1.4 });
      bell(ctx, out, 1760, { dur: 0.3, peak: 0.05, start: 0.04 });
      break;
    case 'victory': {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((n, i) => {
        tone(ctx, out, { freq: n, type: 'triangle', dur: 0.25, peak: 0.07, start: i * 0.08 });
        bell(ctx, out, n * 1.5, { dur: 0.3, peak: 0.05, start: i * 0.08 });
      });
      break;
    }
    case 'defeat':
      tone(ctx, out, { freq: 220, type: 'sawtooth', dur: 0.5, peak: 0.07, bend: 0.4 });
      tone(ctx, out, { freq: 175, type: 'sawtooth', dur: 0.6, peak: 0.06, start: 0.15, bend: 0.4 });
      tone(ctx, out, { freq: 130, type: 'sawtooth', dur: 0.7, peak: 0.06, start: 0.32, bend: 0.4 });
      break;

    /* Boot */
    case 'boot.charge':
      tone(ctx, out, { freq: 110, type: 'sawtooth', dur: 1.2, peak: 0.05, bend: 2.5, detune: -6 });
      tone(ctx, out, { freq: 112, type: 'sine', dur: 1.2, peak: 0.04, bend: 2.5, detune: 8 });
      noise(ctx, out, { dur: 1.0, peak: 0.02, filter: { type: 'bandpass', freq: 600, sweepTo: 4000 } });
      break;
    case 'boot.ready':
      bell(ctx, out, 1320, { dur: 0.5, peak: 0.07 });
      bell(ctx, out, 1980, { dur: 0.5, peak: 0.06, start: 0.05 });
      break;
  }
}

/* ─── Haptics map ─────────────────────────────────────────────────── */

function haptic(cue: RdSfxCue) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    const v = (navigator as any).vibrate?.bind(navigator);
    if (!v) return;
    switch (cue) {
      case 'rune.tap': v(6); break;
      case 'rune.invalid': v([10, 30, 10]); break;
      case 'rune.fire.red':
      case 'rune.fire.gold': v(18); break;
      case 'rune.fire.blue':
      case 'rune.fire.green': v(12); break;
      case 'chain.bonus': v([8, 30, 8]); break;
      case 'chain.epic': v([10, 20, 10, 20, 30]); break;
      case 'enemy.die': v(14); break;
      case 'boss.roar': v([30, 60, 30]); break;
      case 'hero.hurt': v([20, 30, 20]); break;
      case 'hero.heal': v([6, 30, 6]); break;
      case 'shield.up': v(14); break;
      case 'ability.cast.warrior':
      case 'ability.cast.mage':
      case 'ability.cast.rogue':
      case 'ability.cast.cleric': v([10, 20, 25]); break;
      case 'level.unlock': v(10); break;
      case 'star.earned': v(8); break;
      case 'levelup.fanfare': v([10, 30, 10, 30, 50]); break;
      case 'victory': v([10, 40, 10, 40, 80]); break;
      case 'defeat': v([40, 80, 40]); break;
      case 'relic.equip':
      case 'coin.pickup': v(8); break;
      case 'ui.tap': v(4); break;
      default: break;
    }
  } catch { /* swallow */ }
}

/* ─── Public hook ─────────────────────────────────────────────────── */

export function useRuneDelveSfx() {
  const [enabled, setEnabled] = useState(getStoredSoundPref);
  const lastHoverRef = useRef(0);

  // React to global toggle changes from other tabs / the regular SoundEffect hook.
  useEffect(() => {
    const sync = () => setEnabled(getStoredSoundPref());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const play = useCallback(
    (cue: RdSfxCue, opts: { index?: number; skipHaptic?: boolean } = {}) => {
      if (!enabled) return;
      // Honour reduced-motion as a low-stim preference for sound too.
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      // Throttle hover cue so it never machine-guns.
      if (cue === 'ui.hover') {
        const now = performance.now();
        if (now - lastHoverRef.current < HOVER_COOLDOWN_MS) return;
        lastHoverRef.current = now;
      }
      try { playCue(cue, opts.index ?? 0); } catch { /* never break gameplay over audio */ }
      if (!opts.skipHaptic) haptic(cue);
    },
    [enabled],
  );

  return { play, enabled };
}
