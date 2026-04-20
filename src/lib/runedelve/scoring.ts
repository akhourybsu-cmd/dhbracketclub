export interface ScoreInputs {
  totalDamage: number;
  enemiesDefeated: number;
  hpRemaining: number;
  turnsRemaining: number;
  longestChain: number;
  cleared: boolean;
  rogueBonus?: boolean; // applies +50% if rogue and chain>=5 was used
}

export interface ScoreBreakdown {
  damage: number;
  enemiesPts: number;
  hpPts: number;
  turnsPts: number;
  chainPts: number;
  clearBonus: number;
  rogueBonus: number;
  total: number;
}

export function calculateScore(i: ScoreInputs): ScoreBreakdown {
  const damage = i.totalDamage;
  const enemiesPts = i.enemiesDefeated * 200;
  const hpPts = Math.max(0, i.hpRemaining) * 5;
  const turnsPts = Math.max(0, i.turnsRemaining) * 50;
  const chainPts = i.longestChain * 25;
  const clearBonus = i.cleared ? 500 : 0;
  let total = damage + enemiesPts + hpPts + turnsPts + chainPts + clearBonus;
  const rogueBonus = i.rogueBonus ? Math.round(total * 0.05) : 0;
  total += rogueBonus;
  return { damage, enemiesPts, hpPts, turnsPts, chainPts, clearBonus, rogueBonus, total };
}

// XP earned scales with score, capped to keep progression gentle.
export function xpForRun(score: number, cleared: boolean): number {
  const base = Math.min(120, Math.floor(score / 30));
  return base + (cleared ? 20 : 0);
}
