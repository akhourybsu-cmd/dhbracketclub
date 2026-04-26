import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRuneDelveSfx } from '@/hooks/useRuneDelveSfx';

/**
 * Mounts a one-off "rune-charge" wipe each time the user navigates
 * between Rune Delve routes. Plays a subtle whisk SFX in sync.
 *
 * Skips the very first mount so entering RD doesn't double up with the
 * boot sequence, and skips combat (`/play/:n`) so wipes don't intrude
 * on the rune board.
 */
export function RouteWipe() {
  const location = useLocation();
  const { play } = useRuneDelveSfx();
  const first = useRef(true);
  const lastPath = useRef(location.pathname);
  const wipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      lastPath.current = location.pathname;
      return;
    }
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;

    // Don't wipe into the combat board — the boot/transition handles it.
    if (location.pathname.startsWith('/rune-delve/play/')) return;

    const el = wipeRef.current;
    if (!el) return;
    el.classList.remove('rd-route-wipe');
    void el.offsetWidth;
    el.classList.add('rd-route-wipe');
    play('tab.switch', { skipHaptic: true });
    const t = window.setTimeout(() => el.classList.remove('rd-route-wipe'), 520);
    return () => window.clearTimeout(t);
  }, [location.pathname, play]);

  return <div ref={wipeRef} aria-hidden style={{ pointerEvents: 'none' }} />;
}
