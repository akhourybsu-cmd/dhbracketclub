// DH Lockbox Scoring System
// Centralized scoring constants and helpers

// ── Offense: Base crack + efficiency bonus ──
export const BASE_CRACK_POINTS = 6;
export const BEST_CRACK_BONUS = 2;

export function getEfficiencyBonus(totalAttempts: number): number {
  if (totalAttempts <= 5) return 4;
  if (totalAttempts <= 7) return 3;
  if (totalAttempts <= 9) return 2;
  if (totalAttempts <= 11) return 1;
  return 0;
}

export function getOffensePoints(totalAttempts: number, isBestCrack: boolean): number {
  return BASE_CRACK_POINTS + getEfficiencyBonus(totalAttempts) + (isBestCrack ? BEST_CRACK_BONUS : 0);
}

// ── Defense scoring based on best crack attempts ──
export const UNCRACKED_DEFENSE_POINTS = 8;

export function getDefensePoints(isCracked: boolean, bestCrackAttempts: number | null): number {
  if (!isCracked) return UNCRACKED_DEFENSE_POINTS;
  if (bestCrackAttempts === null) return 0;
  if (bestCrackAttempts >= 10) return 3;
  if (bestCrackAttempts >= 8) return 2;
  if (bestCrackAttempts >= 6) return 1;
  return 0;
}

// ── Maze bomb limits ──
export const MAX_BOMBS = 3;
export const MIN_BOMBS = 0;

// ── Scoring labels for UI ──
export const EFFICIENCY_TIERS = [
  { range: '≤5 attempts', bonus: '+4' },
  { range: '6–7 attempts', bonus: '+3' },
  { range: '8–9 attempts', bonus: '+2' },
  { range: '10–11 attempts', bonus: '+1' },
  { range: '12+ attempts', bonus: '+0' },
];

export const DEFENSE_TIERS = [
  { condition: 'Uncracked', points: `+${UNCRACKED_DEFENSE_POINTS}` },
  { condition: 'Best crack ≥10', points: '+3' },
  { condition: 'Best crack 8–9', points: '+2' },
  { condition: 'Best crack 6–7', points: '+1' },
  { condition: 'Best crack ≤5', points: '+0' },
];

// ── Best crack tiebreaker logic ──
export function sortCracksForBest(attempts: any[]): any[] {
  return [...attempts].filter((a: any) => a.is_solved).sort((a: any, b: any) => {
    // 1. Fewest total attempts
    if (a.total_attempts !== b.total_attempts) return a.total_attempts - b.total_attempts;
    // 2. Fastest completion time (solved_at - started_at)
    const aDuration = new Date(a.solved_at).getTime() - new Date(a.started_at).getTime();
    const bDuration = new Date(b.solved_at).getTime() - new Date(b.started_at).getTime();
    if (aDuration !== bDuration) return aDuration - bDuration;
    // 3. Earliest finish
    return new Date(a.solved_at).getTime() - new Date(b.solved_at).getTime();
  });
}
