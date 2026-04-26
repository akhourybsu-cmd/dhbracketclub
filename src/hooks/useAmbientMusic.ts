import { useCallback, useEffect, useRef, useState } from 'react';
import { getSoundSettings } from './useSoundSettings';

/**
 * Procedural fantasy ambient music for the Rune Delve home screen.
 *
 * No external audio assets — generated entirely in WebAudio with a
 * synth pad (detuned saw + sine layers through a low-pass filter and
 * delay), a slow harmonic root drift, and intermittent FM "bell"
 * arpeggios that drift through the natural minor scale.
 *
 * Design goals:
 *   • Subtle: peak gain ~0.06 so it sits well under SFX.
 *   • Endless: the loop has no perceivable seam — chord changes are
 *     timed events, not file boundaries.
 *   • Cheap: a handful of long-running oscillators + scheduled bell
 *     events; CPU footprint is negligible on mobile.
 *   • Honours the central sound settings: requires `master ON` and
 *     the `ambient` category enabled. Auto-pauses when the tab is
 *     hidden or the user prefers reduced motion.
 *
 * Browser autoplay policy: WebAudio cannot start until the first user
 * gesture. We wait for the first pointer/keydown anywhere on the
 * document and only then resume the context.
 */

interface UseAmbientMusicOptions {
  /** When false, music will not play even if the user has enabled it. */
  enabled?: boolean;
  /** Target peak gain (0..1). Defaults to 0.06 — intentionally quiet. */
  volume?: number;
  /** Fade-in duration in seconds. */
  fadeInSec?: number;
  /** Fade-out duration in seconds when stopping or unmounting. */
  fadeOutSec?: number;
}

// Natural minor scale (A minor) — soothing, "fantasy" feel.
const SCALE_HZ = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0];
// Chord roots (slow harmonic drift)
const ROOTS_HZ = [55, 73.42, 65.41, 82.41]; // A1, D2, C2, E2

// Settings key — we listen to it directly so changes propagate immediately
// even before React re-renders.
function readMusicEnabled(): boolean {
  try {
    const raw = localStorage.getItem('dh-club-music-enabled-v1');
    return raw === null ? false : raw === 'true';
  } catch {
    return false;
  }
}

/** Persist the user's "Music" preference. Independent from SFX category. */
export function setMusicEnabled(on: boolean) {
  try {
    localStorage.setItem('dh-club-music-enabled-v1', String(on));
    window.dispatchEvent(new StorageEvent('storage', { key: 'dh-club-music-enabled-v1' }));
  } catch { /* ignore */ }
}

/** Hook: returns reactive enable state + setter. */
export function useMusicPref() {
  const [enabled, setEnabled] = useState(readMusicEnabled);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === 'dh-club-music-enabled-v1' || e.key === null) {
        setEnabled(readMusicEnabled());
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const set = useCallback((on: boolean) => {
    setMusicEnabled(on);
    setEnabled(on);
  }, []);
  return { enabled, setEnabled: set };
}

export function useAmbientMusic({
  enabled = true,
  volume = 0.06,
  fadeInSec = 2.5,
  fadeOutSec = 1.5,
}: UseAmbientMusicOptions = {}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const oscRefs = useRef<OscillatorNode[]>([]);
  const lfoRefs = useRef<OscillatorNode[]>([]);
  const bellTimerRef = useRef<number | null>(null);
  const chordTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback((immediate = false) => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const fade = immediate ? 0.05 : fadeOutSec;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    } catch { /* noop */ }

    if (bellTimerRef.current) {
      window.clearTimeout(bellTimerRef.current);
      bellTimerRef.current = null;
    }
    if (chordTimerRef.current) {
      window.clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }

    // Tear down oscillators after the fade finishes so we don't audibly cut.
    window.setTimeout(() => {
      oscRefs.current.forEach(o => { try { o.stop(); o.disconnect(); } catch {/*noop*/} });
      lfoRefs.current.forEach(o => { try { o.stop(); o.disconnect(); } catch {/*noop*/} });
      oscRefs.current = [];
      lfoRefs.current = [];
      try { master.disconnect(); } catch { /* noop */ }
      masterRef.current = null;
      startedRef.current = false;
    }, (fade + 0.1) * 1000);
  }, [fadeOutSec]);

  const start = useCallback(() => {
    if (startedRef.current) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let ctx = ctxRef.current;
    try {
      if (!ctx || ctx.state === 'closed') {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        ctxRef.current = ctx;
      }
      if (ctx!.state === 'suspended') ctx!.resume().catch(() => {});
    } catch {
      return;
    }
    if (!ctx) return;
    startedRef.current = true;

    const now = ctx.currentTime;

    // Master bus → low-pass filter → output. Filter softens highs so the
    // pad sits well under UI clicks.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(volume, now + fadeInSec);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(0.6, now);

    // Faux reverb via a short feedback delay → softens transient bell hits.
    const delay = ctx.createDelay(0.6);
    delay.delayTime.setValueAtTime(0.32, now);
    const delayGain = ctx.createGain();
    delayGain.gain.setValueAtTime(0.28, now);
    const delayOut = ctx.createGain();
    delayOut.gain.setValueAtTime(0.45, now);
    delay.connect(delayGain).connect(delay); // feedback loop
    delay.connect(delayOut).connect(filter);

    filter.connect(master).connect(ctx.destination);
    masterRef.current = master;

    // ── Pad voices ────────────────────────────────────────────────
    // 3 detuned saw layers + 1 sine sub-octave per "voice slot".
    // We allocate 4 voice slots and re-tune them on chord changes.
    const padBus = ctx.createGain();
    padBus.gain.setValueAtTime(0.85, now);
    padBus.connect(filter);

    interface PadVoice {
      saws: OscillatorNode[];
      sine: OscillatorNode;
      gain: GainNode;
    }
    const voices: PadVoice[] = [];

    for (let i = 0; i < 3; i++) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.connect(padBus);

      const detunes = [-7, 0, 7];
      const saws = detunes.map(d => {
        const o = ctx!.createOscillator();
        o.type = 'sawtooth';
        o.detune.setValueAtTime(d, now);
        o.frequency.setValueAtTime(220, now);
        o.connect(g);
        o.start(now);
        oscRefs.current.push(o);
        return o;
      });
      const sine = ctx.createOscillator();
      sine.type = 'sine';
      sine.frequency.setValueAtTime(110, now);
      sine.connect(g);
      sine.start(now);
      oscRefs.current.push(sine);
      voices.push({ saws, sine, gain: g });
    }

    // Slow LFO on the filter cutoff for organic motion.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.07, now);
    lfoGain.gain.setValueAtTime(220, now);
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(now);
    lfoRefs.current.push(lfo);

    // ── Chord progression ────────────────────────────────────────
    let chordIdx = 0;
    const setChord = () => {
      if (!ctxRef.current || !startedRef.current) return;
      const t = ctxRef.current.currentTime;
      const root = ROOTS_HZ[chordIdx % ROOTS_HZ.length];
      // Triad-like spacing using scale degrees.
      const intervals = [1, 1.5, 2.0]; // root, fifth, octave
      voices.forEach((v, vi) => {
        const target = root * intervals[vi];
        v.saws.forEach(s => {
          try {
            s.frequency.cancelScheduledValues(t);
            s.frequency.setValueAtTime(s.frequency.value, t);
            s.frequency.exponentialRampToValueAtTime(target, t + 4.0);
          } catch { /* noop */ }
        });
        try {
          v.sine.frequency.cancelScheduledValues(t);
          v.sine.frequency.setValueAtTime(v.sine.frequency.value, t);
          v.sine.frequency.exponentialRampToValueAtTime(target / 2, t + 4.0);
        } catch { /* noop */ }
      });
      chordIdx++;
      // Each chord lasts ~10s for a slow, contemplative drift.
      chordTimerRef.current = window.setTimeout(setChord, 10000);
    };
    setChord();

    // ── Sparse FM bell arpeggios ─────────────────────────────────
    const playBell = (freq: number, when: number, dur = 1.4, peak = 0.045) => {
      const c = ctxRef.current;
      if (!c) return;
      const carrier = c.createOscillator();
      const mod = c.createOscillator();
      const modGain = c.createGain();
      const g = c.createGain();
      carrier.type = 'sine';
      mod.type = 'sine';
      carrier.frequency.setValueAtTime(freq, when);
      mod.frequency.setValueAtTime(freq * 2.01, when);
      modGain.gain.setValueAtTime(180, when);
      modGain.gain.exponentialRampToValueAtTime(0.01, when + dur);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      mod.connect(modGain).connect(carrier.frequency);
      carrier.connect(g).connect(delay); // route through delay for shimmer
      mod.start(when);
      carrier.start(when);
      mod.stop(when + dur + 0.05);
      carrier.stop(when + dur + 0.05);
    };

    const scheduleBells = () => {
      if (!ctxRef.current || !startedRef.current) return;
      const t = ctxRef.current.currentTime;
      // Pick 3-4 notes from the scale, ascending, sparse.
      const count = 3 + Math.floor(Math.random() * 2);
      const startIdx = Math.floor(Math.random() * (SCALE_HZ.length - count));
      for (let i = 0; i < count; i++) {
        const note = SCALE_HZ[startIdx + i] * 2; // up an octave for shimmer
        playBell(note, t + i * 0.45, 1.6, 0.035 + Math.random() * 0.015);
      }
      // Re-trigger every 8-14 seconds for sparse, atmospheric punctuation.
      const next = 8000 + Math.random() * 6000;
      bellTimerRef.current = window.setTimeout(scheduleBells, next);
    };
    bellTimerRef.current = window.setTimeout(scheduleBells, 3500);
  }, [volume, fadeInSec]);

  // Try to start; if blocked by autoplay, wait for the first user gesture.
  const tryStart = useCallback(() => {
    if (startedRef.current) return;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      const probe = ctxRef.current ?? new Ctor();
      ctxRef.current = probe;
      if (probe.state === 'running') {
        start();
        return;
      }
      // Wait for any user gesture — a single one is enough to unlock audio.
      const onGesture = () => {
        probe.resume().then(() => start()).catch(() => {});
        cleanup();
      };
      const cleanup = () => {
        document.removeEventListener('pointerdown', onGesture);
        document.removeEventListener('keydown', onGesture);
        document.removeEventListener('touchstart', onGesture);
        gestureCleanupRef.current = null;
      };
      gestureCleanupRef.current = cleanup;
      document.addEventListener('pointerdown', onGesture, { once: true });
      document.addEventListener('keydown', onGesture, { once: true });
      document.addEventListener('touchstart', onGesture, { once: true });
    } catch { /* noop */ }
  }, [start]);

  // Effect: react to enabled flag, settings changes, and tab visibility.
  useEffect(() => {
    const evaluate = () => {
      const s = getSoundSettings();
      const allowed =
        enabled &&
        readMusicEnabled() &&
        s.master &&
        s.categories.ambient &&
        document.visibilityState === 'visible';
      if (allowed && !startedRef.current) tryStart();
      if (!allowed && startedRef.current) stop(false);
    };
    evaluate();

    const onStorage = () => evaluate();
    const onVis = () => evaluate();
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, tryStart, stop]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (gestureCleanupRef.current) gestureCleanupRef.current();
      stop(true);
    };
  }, [stop]);

  return { isPlaying: startedRef.current };
}
