import { useEffect, useRef } from 'react';
import { useRuneDelveSfx } from './useRuneDelveSfx';

/**
 * Plays themed open/close cues whenever a sheet/dialog `open` prop flips.
 * Skips the very first render so a sheet that mounts already-open
 * (rare) does not produce a phantom "open" sound.
 */
export function useSheetSfx(open: boolean) {
  const { play } = useRuneDelveSfx();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    play(open ? 'ui.openSheet' : 'ui.closeSheet', { skipHaptic: true });
  }, [open, play]);
}
