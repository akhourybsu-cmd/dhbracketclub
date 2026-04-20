import { ReactNode } from 'react';

/**
 * Scopes the Rune Delve "fantasy mode" skin.
 * The visual treatment is defined in index.css under `.rd-mode`.
 * Two faint, decorative arcane motes are added in opposite corners
 * to suggest a magical atmosphere — purely decorative, pointer-events-none.
 */
export function RuneDelveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rd-mode relative overflow-hidden">
      {/* Decorative ambient motes — non-interactive. Pinned to corners so they
          never overlap interactive UI on narrow phones. */}
      <span className="rd-mote" aria-hidden style={{ top: '4px', left: '6px' }} />
      <span className="rd-mote rd-mote-2" aria-hidden style={{ top: '10px', right: '6px' }} />
      {children}
    </div>
  );
}
