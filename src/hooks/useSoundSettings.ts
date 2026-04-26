import { useCallback, useEffect, useState } from 'react';

/**
 * Centralised sound + haptics preferences for the whole app.
 *
 * Backed by `localStorage` so settings persist across sessions and sync
 * across tabs via the `storage` event. Any place that plays sound (the
 * legacy `useSoundEffect` and the themed `useRuneDelveSfx`) consults
 * this hook (or the synchronous `getSoundSettings()` helper) before
 * actually playing audio or firing haptics.
 *
 * Categories
 * - `ui`        — taps, hovers, sheet open/close, tab switches
 * - `combat`    — rune fires, enemy hit/die, hero hurt/heal, ability casts
 * - `rewards`   — coins, shards, stars, level-up, victory/defeat fanfares
 * - `ambient`   — boot drone, idle/world ambience
 *
 * The `master` switch silences everything when off. `haptics` controls
 * `navigator.vibrate` independently from sound output.
 */

export type SoundCategory = 'ui' | 'combat' | 'rewards' | 'ambient';

export interface SoundSettings {
  master: boolean;
  haptics: boolean;
  categories: Record<SoundCategory, boolean>;
}

const STORAGE_KEY = 'dh-club-sound-enabled';        // legacy master flag (back-compat)
const SETTINGS_KEY = 'dh-club-sound-settings-v1';   // new structured settings

const DEFAULTS: SoundSettings = {
  master: true,
  haptics: true,
  categories: { ui: true, combat: true, rewards: true, ambient: true },
};

function read(): SoundSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundSettings>;
      return {
        master: parsed.master ?? DEFAULTS.master,
        haptics: parsed.haptics ?? DEFAULTS.haptics,
        categories: { ...DEFAULTS.categories, ...(parsed.categories ?? {}) },
      };
    }
    // Back-compat: fall back to the legacy master flag if no v1 settings exist.
    const legacy = localStorage.getItem(STORAGE_KEY);
    return { ...DEFAULTS, master: legacy === null ? true : legacy === 'true' };
  } catch {
    return DEFAULTS;
  }
}

function write(next: SoundSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    // Keep the legacy boolean in sync so older readers stay correct.
    localStorage.setItem(STORAGE_KEY, String(next.master));
    // Same-tab notification — `storage` events only fire across tabs natively.
    window.dispatchEvent(new StorageEvent('storage', { key: SETTINGS_KEY }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Synchronous reader for non-hook contexts (e.g., audio engines). */
export function getSoundSettings(): SoundSettings {
  return read();
}

/** Should the app play a sound in this category right now? */
export function shouldPlaySound(category: SoundCategory): boolean {
  const s = read();
  return s.master && s.categories[category];
}

/** Should the app emit haptic feedback right now? */
export function shouldHaptic(): boolean {
  const s = read();
  return s.master && s.haptics;
}

/** Hook for reading + updating settings with cross-tab sync. */
export function useSoundSettings() {
  const [settings, setSettings] = useState<SoundSettings>(read);

  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY || e.key === STORAGE_KEY) setSettings(read());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const update = useCallback((patch: Partial<SoundSettings>) => {
    setSettings(prev => {
      const next: SoundSettings = {
        master: patch.master ?? prev.master,
        haptics: patch.haptics ?? prev.haptics,
        categories: { ...prev.categories, ...(patch.categories ?? {}) },
      };
      write(next);
      return next;
    });
  }, []);

  const setMaster = useCallback((on: boolean) => update({ master: on }), [update]);
  const setHaptics = useCallback((on: boolean) => update({ haptics: on }), [update]);
  const setCategory = useCallback(
    (cat: SoundCategory, on: boolean) =>
      setSettings(prev => {
        const next: SoundSettings = {
          ...prev,
          categories: { ...prev.categories, [cat]: on },
        };
        write(next);
        return next;
      }),
    [],
  );
  const reset = useCallback(() => {
    write(DEFAULTS);
    setSettings(DEFAULTS);
  }, []);

  return { settings, setMaster, setHaptics, setCategory, reset };
}
