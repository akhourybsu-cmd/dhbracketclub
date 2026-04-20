import { ReactNode } from 'react';

/**
 * Scopes the Rune Delve "fantasy mode" skin.
 * The visual treatment is defined in index.css under `.rd-mode`.
 * Two faint, decorative arcane motes are added in opposite corners
 * to suggest a magical atmosphere — purely decorative, pointer-events-none.
 */
export function RuneDelveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rd-mode relative">
      {/* Decorative ambient motes — non-interactive */}
      <span className="rd-mote" aria-hidden style={{ top: '8%', left: '14%' }} />
      <span className="rd-mote rd-mote-2" aria-hidden style={{ top: '18%', right: '10%' }} />
      {children}
    </div>
  );
}
