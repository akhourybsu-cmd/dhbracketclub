import { ReactNode } from 'react';
import { RuneDelveHUD } from './RuneDelveHUD';
import { RuneDelveBoot } from './RuneDelveBoot';

/**
 * Full-screen game shell for Rune Delve. Applies the `.rd-mode` skin to the
 * entire viewport, mounts the in-game HUD, and plays the one-time boot
 * overlay on first entry into the module.
 *
 * The DH Club bottom nav and sidebar are hidden by AppLayout while any
 * `/rune-delve/*` route is active, so this shell owns the full viewport.
 */
export function RuneDelveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rd-mode rd-shell relative min-h-[100dvh]">
      {/* Decorative ambient motes — non-interactive. */}
      <span className="rd-mote" aria-hidden style={{ top: '60px', left: '6px' }} />
      <span className="rd-mote rd-mote-2" aria-hidden style={{ top: '70px', right: '6px' }} />

      <RuneDelveHUD />

      <main
        className="max-w-[640px] mx-auto px-3 sm:px-5 pt-2 pb-3 sm:pt-3 sm:pb-4"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <RuneDelveBoot />
    </div>
  );
}
