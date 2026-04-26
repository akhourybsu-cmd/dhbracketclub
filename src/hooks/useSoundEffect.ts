import { useCallback, useRef, useEffect, useState } from 'react';
import { getSoundSettings, type SoundCategory } from './useSoundSettings';

type SoundType = 'tap' | 'success' | 'error' | 'achievement' | 'ping' | 'pick';

const CATEGORY: Record<SoundType, SoundCategory> = {
  tap: 'ui',
  ping: 'ui',
  pick: 'combat',
  success: 'rewards',
  achievement: 'rewards',
  error: 'ui',
};

export function useSoundEffect() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [settings, setSettings] = useState(() => getSoundSettings());

  // Sync with the central settings store across tabs / settings panel.
  useEffect(() => {
    const sync = () => setSettings(getSoundSettings());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.08, ramp = true) => {
      try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        // silent fail
      }
    },
    [getCtx]
  );

  const play = useCallback(
    (sound: SoundType) => {
      // Re-read on every call so updates from the settings panel take effect
      // without re-rendering every consumer.
      const s = getSoundSettings();
      const cat = CATEGORY[sound];
      const soundOk = s.master && s.categories[cat];
      const hapticOk = s.master && s.haptics;
      if (!soundOk && !hapticOk) return;
      // Respect prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      if (soundOk) {
        switch (sound) {
          case 'tap':
            playTone(800, 0.06, 'sine', 0.05);
            break;
          case 'pick':
            playTone(600, 0.08, 'sine', 0.06);
            setTimeout(() => playTone(900, 0.1, 'sine', 0.05), 60);
            break;
          case 'success':
            playTone(523, 0.12, 'sine', 0.07);
            setTimeout(() => playTone(659, 0.12, 'sine', 0.06), 100);
            setTimeout(() => playTone(784, 0.18, 'sine', 0.07), 200);
            break;
          case 'error':
            playTone(200, 0.15, 'triangle', 0.06);
            setTimeout(() => playTone(160, 0.2, 'triangle', 0.05), 100);
            break;
          case 'achievement':
            playTone(523, 0.1, 'sine', 0.06);
            setTimeout(() => playTone(659, 0.1, 'sine', 0.06), 80);
            setTimeout(() => playTone(784, 0.1, 'sine', 0.06), 160);
            setTimeout(() => playTone(1047, 0.25, 'sine', 0.07), 260);
            break;
          case 'ping':
            playTone(1200, 0.12, 'sine', 0.06);
            break;
        }
      }

      // Haptic feedback on mobile
      if (hapticOk && navigator.vibrate) {
        switch (sound) {
          case 'tap': navigator.vibrate(5); break;
          case 'pick': navigator.vibrate(10); break;
          case 'success': navigator.vibrate([10, 30, 10]); break;
          case 'error': navigator.vibrate([15, 20, 15]); break;
          case 'achievement': navigator.vibrate([10, 20, 10, 20, 30]); break;
          case 'ping': navigator.vibrate(8); break;
        }
      }
    },
    [playTone]
  );

  const toggleSound = useCallback(() => {
    // Defer to the central settings store so legacy callers still work.
    const s = getSoundSettings();
    const next = !s.master;
    try {
      localStorage.setItem('dh-club-sound-enabled', String(next));
      localStorage.setItem(
        'dh-club-sound-settings-v1',
        JSON.stringify({ ...s, master: next }),
      );
    } catch { /* ignore */ }
    setSettings({ ...s, master: next });
    // Notify other listeners in this tab.
    window.dispatchEvent(new StorageEvent('storage', { key: 'dh-club-sound-settings-v1' }));
  }, []);

  return { play, soundEnabled: settings.master, toggleSound };
}
