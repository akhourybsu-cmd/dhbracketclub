// Lightweight detector for class-mastery unlocks. Pass it the previous
// class level and the new one — it returns the tier that was just earned
// (or null) so the play page can fire a celebratory toast + confetti.

import { masteryUnlockedAt, type MasteryTier } from '@/lib/runedelve/classMastery';
import type { HeroClass } from '@/lib/runedelve/classConfig';

export function detectMasteryUnlock(
  cls: HeroClass,
  prevLevel: number,
  newLevel: number,
): MasteryTier | null {
  return masteryUnlockedAt(cls, prevLevel, newLevel);
}
