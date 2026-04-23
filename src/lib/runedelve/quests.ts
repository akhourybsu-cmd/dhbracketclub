// Quest System — daily/weekly objectives with bonus shard rewards.
// Definitions live in the DB (rune_delve_quest_definitions) and per-player
// rolled instances live in rune_delve_active_quests. This file is the pure
// helper layer: period keys, rolling logic, and progress event types.

import { mulberry32, rngInt } from './prng';
import type { HeroClass } from './classConfig';

export type QuestScope = 'daily' | 'weekly';
export type QuestStatus = 'active' | 'completed' | 'claimed';

/**
 * Objective types — keep this list in sync with the seeded
 * rune_delve_quest_definitions.objective_type column.
 */
export type QuestObjectiveType =
  | 'levels_cleared'
  | 'longest_chain'
  | 'no_damage_clear'
  | 'total_score'
  | 'enemies_defeated'
  | 'class_run_complete'
  | 'abilities_used'
  | 'daily_challenges_completed'
  | 'bosses_defeated'
  | 'shards_earned'
  | 'high_level_clears'
  | 'class_xp_earned';

export interface QuestDefinition {
  id: string;
  scope: QuestScope;
  title: string;
  description: string;
  objective_type: QuestObjectiveType;
  target_value: number;
  shard_reward: number;
  xp_reward: number;
  is_personal: boolean;
  hero_class: HeroClass | null;
  weight: number;
}

export interface ActiveQuest {
  id: string;
  user_id: string;
  quest_id: string;
  scope: QuestScope;
  period_key: string;
  progress: number;
  target_value: number;
  status: QuestStatus;
  claimed_at: string | null;
  /** Joined definition — populated by the hook layer. */
  definition?: QuestDefinition;
}

/** Today in UTC as YYYY-MM-DD. */
export function dailyPeriodKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Weekly period keyed by ISO week (Mon → Sun). Format: `YYYY-Www`.
 * Mirrors what most quest systems expect — "this week" stays consistent
 * regardless of when the player first opened the app.
 */
export function weeklyPeriodKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday-of-week trick gives ISO week year + number.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Hash a string to a stable 32-bit seed. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/**
 * Pick the daily quest set for a given period: 2 shared + 1 personal.
 * Deterministic per (period_key, user_id) so the same player gets the same
 * roll on every device.
 *
 * `recentlyUsedIds` is an optional set of quest definition ids that were
 * active in recent prior periods — we exclude them from this roll to
 * guarantee fresh quests every period. If the exclusion would starve the
 * pool below the desired count, we relax it (full catalog reopens).
 */
export function rollQuestSet(opts: {
  defs: QuestDefinition[];
  scope: QuestScope;
  periodKey: string;
  userId: string;
  heroClass: HeroClass | null;
  recentlyUsedIds?: Set<string>;
}): QuestDefinition[] {
  const { defs, scope, periodKey, userId, heroClass, recentlyUsedIds } = opts;
  const scoped = defs.filter(d => d.scope === scope);
  const filterRecent = <T extends { id: string }>(arr: T[], minNeeded: number): T[] => {
    if (!recentlyUsedIds || recentlyUsedIds.size === 0) return arr;
    const filtered = arr.filter(d => !recentlyUsedIds.has(d.id));
    return filtered.length >= minNeeded ? filtered : arr;
  };

  const sharedAll = scoped.filter(d => !d.is_personal);
  const personalAll = scoped.filter(d => d.is_personal && (!d.hero_class || d.hero_class === heroClass));
  const shared = filterRecent(sharedAll, 2);
  const personal = filterRecent(personalAll, 1);

  const sharedRng = mulberry32(hashSeed(`${scope}:${periodKey}:shared`));
  const personalRng = mulberry32(hashSeed(`${scope}:${periodKey}:${userId}`));

  const sharedPool = [...shared];
  const sharedPicks: QuestDefinition[] = [];
  while (sharedPicks.length < 2 && sharedPool.length > 0) {
    const idx = rngInt(sharedRng, sharedPool.length);
    sharedPicks.push(sharedPool.splice(idx, 1)[0]);
  }

  const personalPool = [...personal];
  const personalPicks: QuestDefinition[] = [];
  if (personalPool.length > 0) {
    const idx = rngInt(personalRng, personalPool.length);
    personalPicks.push(personalPool[idx]);
  }

  return [...sharedPicks, ...personalPicks];
}

/**
 * Progress event emitted by gameplay. Hooks fan these out to all matching
 * active quests for the player.
 */
export interface QuestProgressEvent {
  type: QuestObjectiveType;
  amount: number;
  /** Optional hero class context — used to filter class-tied personal quests. */
  heroClass?: HeroClass;
  /** Some objectives (longest_chain, high_level_clears) need extra context. */
  meta?: {
    levelNumber?: number;
    chainLength?: number;
    isBoss?: boolean;
  };
}

/**
 * Decide whether an event applies to a given active quest, and return the
 * delta to add to its progress counter. Pure — no state mutation.
 */
export function progressDelta(event: QuestProgressEvent, quest: ActiveQuest): number {
  const def = quest.definition;
  if (!def) return 0;
  if (def.objective_type !== event.type) return 0;
  if (quest.status !== 'active') return 0;

  // Class-tied personal quests only count when running that class.
  if (def.is_personal && def.hero_class && event.heroClass && def.hero_class !== event.heroClass) {
    return 0;
  }

  switch (event.type) {
    case 'longest_chain':
      // Track max, not cumulative.
      return Math.max(0, (event.meta?.chainLength ?? event.amount) - quest.progress);
    case 'high_level_clears':
      // Only counts if level >= 30.
      if ((event.meta?.levelNumber ?? 0) < 30) return 0;
      return event.amount;
    case 'bosses_defeated':
      if (!event.meta?.isBoss) return 0;
      return event.amount;
    default:
      return event.amount;
  }
}

/** Friendly label for the scope, used in toasts and headers. */
export function scopeLabel(scope: QuestScope): string {
  return scope === 'daily' ? 'Daily Quest' : 'Weekly Quest';
}
