// DH Club — Narrative RPG · Chronicle Ruleset
//
// The Chronicle Ruleset is the lightweight game system that powers every
// Narrative RPG campaign in DH Club. Five stats, 1d20 + stat + modifier,
// four outcome bands. Designed for mobile + async play — every concept
// must fit on a phone screen and require no rulebook lookup.
//
// All campaign templates use this ruleset by default. Future templates
// can swap in alternative rulesets without touching the chat / character
// / GM-console UI as long as they implement the same shape.

export type ChronicleStat = 'grit' | 'charm' | 'cunning' | 'chaos' | 'focus';

export interface ChronicleStatMeta {
  id: ChronicleStat;
  label: string;
  /** One-line tagline for the character creator + roll picker. */
  tagline: string;
  /** Three example uses — helps players pick the right stat. */
  examples: [string, string, string];
  /** Lucide icon name (looked up at render time). */
  iconKey: string;
  /** Accent HSL components for chips/cards (used by StatusPill `accent` prop). */
  accent: string;
}

export const CHRONICLE_STATS: ChronicleStatMeta[] = [
  {
    id: 'grit',
    label: 'Grit',
    tagline: 'Force, toughness, intimidation, pushing through danger.',
    examples: ['Kick down a door', 'Take a hit and keep moving', 'Stare down a thug'],
    iconKey: 'Shield',
    accent: '0 75% 58%',
  },
  {
    id: 'charm',
    label: 'Charm',
    tagline: 'Persuasion, deception, performance, social finesse.',
    examples: ['Sweet-talk the doorman', 'Sell a wild lie', 'Captivate a crowd'],
    iconKey: 'Sparkles',
    accent: '320 75% 65%',
  },
  {
    id: 'cunning',
    label: 'Cunning',
    tagline: 'Sneaking, planning, investigation, noticing details.',
    examples: ['Read a room', 'Lift a wallet', 'Spot the wire'],
    iconKey: 'Eye',
    accent: '270 70% 65%',
  },
  {
    id: 'chaos',
    label: 'Chaos',
    tagline: 'Wild stunts, improvisation, luck, reckless plans.',
    examples: ['Surf down the staircase', 'Bluff your way past with a fire extinguisher', 'Throw the wrench'],
    iconKey: 'Flame',
    accent: '38 100% 58%',
  },
  {
    id: 'focus',
    label: 'Focus',
    tagline: 'Precision, discipline, patience, keeping cool.',
    examples: ['Pick a difficult lock', 'Sit through an interrogation', 'Sniper-grade aim'],
    iconKey: 'Target',
    accent: '195 85% 55%',
  },
];

/** Lookup helper — returns the meta for a given stat id or null. */
export function getStatMeta(id: ChronicleStat | null | undefined): ChronicleStatMeta | null {
  if (!id) return null;
  return CHRONICLE_STATS.find(s => s.id === id) ?? null;
}

/* ── Character creation rules ───────────────────────────────────── */

export const CHARACTER_CREATION = {
  /** Starting value for every stat before distribution. */
  startingValue: 0,
  /** Points the player gets to distribute across stats. */
  totalPoints: 6,
  /** Max value any single stat can start at. */
  maxStartingStat: 3,
  /** Min stat value (allowing a single negative if the campaign wants flaws). */
  minStartingStat: 0,
};

/** Compute the points spent across a character's stats. */
export function pointsSpent(stats: Record<ChronicleStat, number>): number {
  return CHRONICLE_STATS.reduce((sum, s) => sum + (stats[s.id] ?? 0), 0);
}

/** Validate a starting stat block against the creation rules. Returns an
 *  array of human-readable issues, empty when valid. */
export function validateStartingStats(stats: Record<ChronicleStat, number>): string[] {
  const issues: string[] = [];
  const spent = pointsSpent(stats);
  if (spent > CHARACTER_CREATION.totalPoints) {
    issues.push(`You've spent ${spent} of ${CHARACTER_CREATION.totalPoints} points — drop ${spent - CHARACTER_CREATION.totalPoints}.`);
  }
  for (const s of CHRONICLE_STATS) {
    const v = stats[s.id] ?? 0;
    if (v > CHARACTER_CREATION.maxStartingStat) {
      issues.push(`${s.label} can't start above ${CHARACTER_CREATION.maxStartingStat}.`);
    }
    if (v < CHARACTER_CREATION.minStartingStat) {
      issues.push(`${s.label} can't start below ${CHARACTER_CREATION.minStartingStat}.`);
    }
  }
  return issues;
}

/* ── Roll system ────────────────────────────────────────────────── */

export type RollOutcome = 'failure' | 'mixed' | 'success' | 'crit';
export type RollAdvantage = 'none' | 'advantage' | 'disadvantage';

export interface RollResult {
  d20: number;
  /** Final total used to determine outcome (d20 + stat + modifier). */
  total: number;
  /** Outcome band — drives the result card styling + GM resolution prompt. */
  outcome: RollOutcome;
  /** Description of the band. */
  outcomeLabel: string;
  /** Color HSL components for the band, used by StatusPill `accent`. */
  outcomeAccent: string;
  /** Optional secondary d20 used for advantage/disadvantage. */
  secondaryD20?: number;
}

/** Map a final total to its outcome band. */
export function bandForTotal(total: number): { outcome: RollOutcome; label: string; accent: string } {
  if (total <= 6)  return { outcome: 'failure', label: 'Failure',         accent: '0 75% 55%' };
  if (total <= 11) return { outcome: 'mixed',   label: 'Mixed Success',   accent: '38 95% 50%' };
  if (total <= 17) return { outcome: 'success', label: 'Success',         accent: '152 65% 45%' };
  return                      { outcome: 'crit',    label: 'Critical Success', accent: '45 95% 50%' };
}

interface RollInput {
  stat: ChronicleStat | 'none';
  statValue: number;
  modifier?: number;
  difficulty?: number;
  advantage?: RollAdvantage;
}

/** Roll 1d20 + stat + modifier, returning a structured result.
 *  Pure function — does not write to the DB. */
export function rollChronicle({
  statValue,
  modifier = 0,
  difficulty = 0,
  advantage = 'none',
}: RollInput): RollResult {
  const d1 = 1 + Math.floor(Math.random() * 20);
  let d20 = d1;
  let secondary: number | undefined;
  if (advantage !== 'none') {
    const d2 = 1 + Math.floor(Math.random() * 20);
    secondary = d2;
    d20 = advantage === 'advantage' ? Math.max(d1, d2) : Math.min(d1, d2);
  }
  // Difficulty raises the threshold — we represent it as a subtraction from
  // the total. (e.g. difficulty 3 means a roll of 12 effectively reads as 9.)
  const total = d20 + statValue + modifier - difficulty;
  const band = bandForTotal(total);
  return {
    d20,
    secondaryD20: secondary,
    total,
    outcome: band.outcome,
    outcomeLabel: band.label,
    outcomeAccent: band.accent,
  };
}

/* ── Outcome guidance for the GM ────────────────────────────────── */

export const OUTCOME_GUIDANCE: Record<RollOutcome, string> = {
  failure:  'The action fails. Introduce a major complication, lost resource, or escalating consequence.',
  mixed:    'Partial success — they get what they want, but with a cost: suspicion, injury, time pressure, attention.',
  success:  'They succeed as intended. Narrate cleanly and keep momentum.',
  crit:     'Cinematic success. Add a bonus: extra info, improved position, free narrative move, advantage on the next roll.',
};
