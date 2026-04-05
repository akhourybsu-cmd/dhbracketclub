/** Utility functions for draft season display */

const SEASON_LABELS: Record<string, string> = {
  winter: '❄️ Winter',
  spring: '⚡ Spring',
  summer: '☀️ Summer',
  fall: '🍂 Fall',
};

export function getSeasonDisplayName(label: string, year: number): string {
  return `${SEASON_LABELS[label] || label} ${year}`;
}

export function getSeasonEmoji(label: string): string {
  const emojis: Record<string, string> = { winter: '❄️', spring: '🌸', summer: '☀️', fall: '🍂' };
  return emojis[label] || '🏆';
}

export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getWeekLabel(week: number, totalRegular: number): string {
  if (week <= totalRegular) return `Week ${week}`;
  if (week === totalRegular + 1) return 'Play-In Round';
  if (week === totalRegular + 2) return 'Semifinals';
  return 'Championship';
}

const SEASON_POINTS_TABLE: Record<number, number> = {
  1: 10, 2: 7, 3: 5, 4: 3, 5: 2,
};

export function formatSeasonPoints(rank: number): string {
  return `${SEASON_POINTS_TABLE[rank] || 1} pts`;
}

export function getPlayoffSeedLabel(seed: number): string {
  return `#${seed} Seed`;
}
