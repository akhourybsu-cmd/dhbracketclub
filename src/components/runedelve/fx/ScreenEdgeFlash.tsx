import { useEffect, useRef } from 'react';

interface Props {
  /** Increment to trigger a hurt flash. */
  hurtKey: number;
  /** Increment to trigger a heal glow. */
  healKey?: number;
}

/**
 * Full-screen vignette pulse, mounted once inside the play page. Other
 * components fire flashes by bumping a counter in state; the effect
 * reapplies the CSS animation class for a clean replay.
 */
export function ScreenEdgeFlash({ hurtKey, healKey = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const firstHurt = useRef(true);
  const firstHeal = useRef(true);

  useEffect(() => {
    if (firstHurt.current) { firstHurt.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-on', 'is-heal');
    void el.offsetWidth;
    el.classList.add('is-on');
    const t = window.setTimeout(() => el.classList.remove('is-on'), 380);
    return () => window.clearTimeout(t);
  }, [hurtKey]);

  useEffect(() => {
    if (firstHeal.current) { firstHeal.current = false; return; }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-on', 'is-heal');
    void el.offsetWidth;
    el.classList.add('is-on', 'is-heal');
    const t = window.setTimeout(() => el.classList.remove('is-on', 'is-heal'), 380);
    return () => window.clearTimeout(t);
  }, [healKey]);

  return <div ref={ref} aria-hidden className="rd-screen-flash" />;
}
