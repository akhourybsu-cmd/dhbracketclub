/**
 * Tiny imperative helper that gives any `.rd-btn-juice` element a
 * radial ripple emanating from the press point. Reads/sets CSS vars
 * on the element so all the actual animation lives in `index.css`.
 *
 * Usage:
 *   import { attachRipple } from '@/lib/runedelve/btnRipple';
 *   <button onPointerDown={attachRipple} className="rd-btn-juice ..."/>
 */
export function attachRipple(e: React.PointerEvent | PointerEvent) {
  const target = (e as React.PointerEvent).currentTarget as HTMLElement | null;
  if (!target || !(target instanceof HTMLElement)) return;
  const rect = target.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  target.style.setProperty('--rd-ripple-x', `${x}%`);
  target.style.setProperty('--rd-ripple-y', `${y}%`);
  target.classList.remove('is-rippling');
  // Force reflow to restart the animation reliably.
  void target.offsetWidth;
  target.classList.add('is-rippling');
  window.setTimeout(() => target?.classList.remove('is-rippling'), 520);
}
