// DH Club — Narrative RPG · Flamingo Protocol shell
//
// Wraps a Flamingo Protocol campaign's detail page in the cinematic
// neon backdrop: deep-midnight base, pink + cyan glows top-left /
// bottom-right, a faint film-grain layer over everything, and a thin
// pink top-edge rule. Children render on top of it. The shell only
// applies inside campaign routes — generic Narrative RPG surfaces
// continue to use the calm-shell default.

import { ReactNode } from 'react';
import { FLAMINGO, FLAMINGO_BG, FLAMINGO_GRAIN_URL } from '@/lib/narrative/flamingoTheme';

interface Props {
  children: ReactNode;
  /** When set, the shell is non-blocking (won't try to fill the
   *  viewport) — used inside flex/grid parents where the page already
   *  manages its own height. */
  fill?: boolean;
}

export function FlamingoCampaignShell({ children, fill = true }: Props) {
  return (
    <div
      className={fill ? 'relative flex flex-col flex-1 min-h-0 overflow-hidden' : 'relative'}
      style={{
        background: FLAMINGO_BG,
        color: `hsl(${FLAMINGO.paper})`,
      }}
    >
      {/* Top neon edge rule — only visible against the dark backdrop. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
        style={{
          background: `linear-gradient(90deg, transparent, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}), transparent)`,
          opacity: 0.65,
        }}
      />
      {/* Film-grain / VHS texture layer — kept subtle so it never hurts
          readability. Blend-mode overlay so it interacts with the glows
          instead of looking like a flat noise stamp. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0 mix-blend-overlay"
        style={{
          backgroundImage: FLAMINGO_GRAIN_URL,
          opacity: 0.18,
        }}
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
