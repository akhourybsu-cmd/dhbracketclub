import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { NexusHUD } from './NexusHUD';
import { NexusBoot } from './NexusBoot';

/**
 * Full-screen game shell for Nexus Defense. Applies the `.nx-mode` skin to
 * the entire viewport, mounts the in-game HUD (except on the active battle
 * screen, which owns its own header), and plays the one-time boot overlay
 * on first entry into the module.
 *
 * The DH Club bottom nav and sidebar are hidden by AppLayout while any
 * /nexus/* route is active, so this shell owns the full viewport.
 */
export function NexusLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isBattle = location.pathname.startsWith('/nexus/battle/');

  return (
    <div className="nx-mode nx-shell relative min-h-[100dvh]">
      <NexusHUD />

      {isBattle ? (
        // Battle owns the full viewport — no inner padding.
        children
      ) : (
        <main
          className="max-w-[640px] mx-auto px-3 sm:px-5 pt-3 pb-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {children}
        </main>
      )}

      <NexusBoot />
    </div>
  );
}
