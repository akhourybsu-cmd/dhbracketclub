import { ReactNode } from 'react';
import { PwHUD } from './PwHUD';
import { PwBoot } from './PwBoot';
import { TickerTape } from './TickerTape';

/**
 * Full-screen standalone shell for the Portfolio Wars module. Applies the
 * `.pw-mode` trading-terminal skin to the entire viewport, mounts the
 * in-game HUD, and plays the one-time boot overlay on first entry into
 * /portfolio-wars.
 *
 * AppLayout hides the DH Club bottom nav and mobile header while any
 * /portfolio-wars route is active, so this shell owns the full viewport —
 * exactly how Pick'em, Nexus Defense, Draft Arena, and Rune Delve work.
 */
export function PwLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pw-mode pw-shell relative min-h-[100dvh]">
      <PwHUD />
      <TickerTape />

      <main
        className="max-w-[640px] mx-auto px-3 sm:px-5 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <PwBoot />
    </div>
  );
}
