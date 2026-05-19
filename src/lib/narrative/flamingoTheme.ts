// DH Club — Narrative RPG · Flamingo Protocol theme tokens
//
// One source of truth for the Flamingo Protocol visual identity. Every
// Flamingo-themed component reads from here so we can tune the palette
// in one place. Stored as raw HSL triples (no `hsl()` wrapper) so they
// compose cleanly into gradients, rgba alpha mixes, and shadows.
//
// The shell is conditional: components call `isFlamingoCampaign(key)`
// to decide whether to render the branded variant or fall through to
// the default Narrative RPG design. Everything else in the app —
// blank campaigns, generic narrative routes, list pages outside the
// detail shell — stays calm.

import type { TemplateKey } from './templates';

/** Canonical predicate used everywhere the conditional theme branches. */
export function isFlamingoCampaign(templateKey: string | null | undefined): boolean {
  return templateKey === 'flamingo_protocol';
}

/** Raw HSL triples — wrap with `hsl(${TOKEN})` or `hsl(${TOKEN} / 0.3)`. */
export const FLAMINGO = {
  // Brand
  pink:      '330 95% 62%',   // hot neon flamingo
  pinkDeep:  '328 85% 48%',   // ink/print pink for borders + heavier ink
  cyan:      '188 95% 58%',   // electric cyan accent
  violet:    '278 80% 62%',   // secondary glow
  gold:      '42 92% 62%',    // casino/VIP gold
  // Backdrop
  midnight:  '232 50% 4%',    // deep midnight base
  ink:       '228 38% 8%',    // panel / card base
  smoke:     '226 18% 14%',   // muted neutral card
  // Text
  paper:     '40 30% 96%',    // tape-white body text
  // Status
  danger:    '352 84% 60%',   // heat / threat
  clue:      '195 90% 60%',   // discovered evidence (~ cyan-blue)
  gmAmber:   '38 95% 60%',    // GM-only / private
  success:   '152 72% 50%',
} as const;

/** Backdrop gradient stack for FlamingoCampaignShell. */
export const FLAMINGO_BG = `
  radial-gradient(80% 60% at 15% 0%, hsl(${FLAMINGO.pink} / 0.18), transparent 65%),
  radial-gradient(70% 50% at 90% 100%, hsl(${FLAMINGO.cyan} / 0.14), transparent 70%),
  radial-gradient(50% 40% at 50% 50%, hsl(${FLAMINGO.violet} / 0.08), transparent 80%),
  linear-gradient(180deg, hsl(${FLAMINGO.midnight}), hsl(${FLAMINGO.ink}))
`;

/** A small inline-SVG film-grain — applied as a low-opacity overlay. */
export const FLAMINGO_GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.6  0 0 0 0 0.85  0 0 0 0.65 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/></svg>\")";

/** Per-tab metadata for the cinematic nav. Subtitle clarifies the flavor
 *  label so first-time users don't get lost. */
export const FLAMINGO_TAB_META = {
  story: {
    label: 'Story',
    subtitle: 'The current scene',
  },
  characters: {
    label: 'Cast',
    subtitle: 'Players & NPCs',
  },
  world: {
    label: 'City',
    subtitle: 'Velvetaine',
  },
  log: {
    label: 'Chronicle',
    subtitle: 'What happened',
  },
} as const;

export type FlamingoTabKey = keyof typeof FLAMINGO_TAB_META;

/** Cinematic copy for the campaign header + chrome. Keep it punchy. */
export const FLAMINGO_COPY = {
  brandBadge: 'Flamingo Protocol',
  enterCta:   'Enter Velvetaine',
  gmConsole:  'Run the chaos',
  gmShort:    'GM',
  liveLabel:  'Live from Velvetaine',
  waitingGm:  'The GM has the floor',
  waitingPlayers: 'Waiting on the crew',
} as const;

/** Status-pill style overrides used by FlamingoStatusPill. */
export const FLAMINGO_PILL_PALETTE = {
  live:      { bg: FLAMINGO.pink,   fg: FLAMINGO.paper, dot: FLAMINGO.pink },
  waiting:   { bg: FLAMINGO.gold,   fg: FLAMINGO.midnight, dot: FLAMINGO.gold },
  pending:   { bg: FLAMINGO.violet, fg: FLAMINGO.paper, dot: FLAMINGO.violet },
  success:   { bg: FLAMINGO.cyan,   fg: FLAMINGO.midnight, dot: FLAMINGO.cyan },
  danger:    { bg: FLAMINGO.danger, fg: FLAMINGO.paper, dot: FLAMINGO.danger },
  neutral:   { bg: FLAMINGO.smoke,  fg: FLAMINGO.paper, dot: FLAMINGO.paper },
  gm:        { bg: FLAMINGO.gmAmber, fg: FLAMINGO.midnight, dot: FLAMINGO.gmAmber },
} as const;

/** Convenience: ensures a TemplateKey is the Flamingo one (type guard). */
export function flamingoKey(): TemplateKey {
  return 'flamingo_protocol';
}
