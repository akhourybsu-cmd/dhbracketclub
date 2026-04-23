/** Single source of truth for playoff visual treatment across surfaces. */

/** Every playoff draft (Play-In, Semis, Finals G1–G3, Bronze) uses this round count. */
export const PLAYOFF_DRAFT_ROUNDS = 5;

export type PlayoffRound = 'qf' | 'sf' | 'final' | 'third_place' | string;

/** Short uppercase label for round chips. */
export function getPlayoffRoundShort(round: PlayoffRound): string {
  switch (round) {
    case 'qf': return 'PLAY-IN';
    case 'sf': return 'SEMIFINAL';
    case 'final': return 'FINALS';
    case 'third_place': return 'BRONZE';
    default: return 'PLAYOFF';
  }
}

/** Mid-length round name used for headers/metadata rows. */
export function getPlayoffRoundName(round: PlayoffRound): string {
  switch (round) {
    case 'qf': return 'Play-In';
    case 'sf': return 'Semifinal';
    case 'final': return 'Finals';
    case 'third_place': return 'Bronze Match';
    default: return 'Playoff';
  }
}

/** Combined "Round · Game N" label (Finals get game numbers; others usually don't). */
export function getPlayoffGameLabel(round: PlayoffRound, matchNumber?: number | null): string {
  const base = getPlayoffRoundName(round);
  if (round === 'final' && matchNumber && matchNumber > 0) {
    return `${base} · Game ${matchNumber}`;
  }
  return base;
}

/** Round-specific accent glyph. */
export function getPlayoffGlyph(round: PlayoffRound): string {
  switch (round) {
    case 'qf': return '✦';
    case 'sf': return '⚔︎';
    case 'final': return '🏆';
    case 'third_place': return '🥉';
    default: return '✦';
  }
}

/** Format finals series score (e.g. "1–1"). Returns null if not applicable. */
export function formatSeriesScore(
  round: PlayoffRound,
  finalsWins: Record<string, number> | null | undefined,
  userA: string | null | undefined,
  userB: string | null | undefined,
): string | null {
  if (round !== 'final' || !finalsWins) return null;
  const a = (userA && finalsWins[userA]) || 0;
  const b = (userB && finalsWins[userB]) || 0;
  if (a === 0 && b === 0) return null;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return `${hi}–${lo}`;
}
