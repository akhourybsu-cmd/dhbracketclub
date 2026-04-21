// Deterministic level generator. Same level number → same level for everyone.
import { mulberry32, rngInt } from './prng';
import type { Enemy } from './dungeonGenerator';
import { mechanicsForLevel, introMechanicForLevel, type MechanicId } from './mechanics';
import { rollSecondaryObjective, type SecondaryObjective } from './layeredGoals';
import { bossRuleForLevel, type BossRuleId } from './bossRules';
import { rosterPoolForLevel, type RosterEntry } from './enemyRoster';

export type ObjectiveType = 'defeat_all' | 'survive' | 'reach_score' | 'defeat_elite';

export interface LevelDefinition {
  level_number: number;
  chapter: number;
  difficulty_tier: number;
  generation_seed: number;
  board_size: number;
  enemy_config: Enemy[];
  turn_limit: number;
  objective_type: ObjectiveType;
  objective_target: number;
  /**
   * `modifiers` is the canonical place where mechanic tags live so the level
   * row in the database carries them. The shape is intentionally small and
   * forward-compatible — readers should fall back to the deterministic
   * `mechanicsForLevel(n)` helper when the column is missing or empty (true
   * for any level row that was created before the mechanic system existed).
   */
  modifiers: LevelModifiers;
}

/**
 * Canonical shape of `LevelDefinition.modifiers`. Exported so play/results
 * pages can cast `level.modifiers as LevelModifiers` instead of `as any`.
 */
export interface LevelModifiers {
  mechanics?: MechanicId[];
  intro_mechanic?: MechanicId | null;
  /** Band 4 — present on levels with the multi_objective mechanic. */
  secondary_objective?: SecondaryObjective | null;
  /** Band 5 — present on milestone boss levels (130, 140, 150). */
  boss_rule?: BossRuleId | null;
  [k: string]: unknown;
}

// Legacy template list — kept ONLY as a fallback safety net for any code path
// that still references the old shape. New picks go through `rosterPoolForLevel`.
const ENEMY_TEMPLATES: Array<{ name: string; emoji: string; hp: number; damage: number; tier: number }> = [
  { name: 'Cave Bat',       emoji: '🦇', hp: 45,  damage: 4, tier: 1 },
  { name: 'Goblin Scout',   emoji: '👹', hp: 60,  damage: 5, tier: 1 },
];

export function chapterFor(level: number): number {
  return Math.max(1, Math.ceil(level / 50));
}

// Fantasy chapter names — only used for flavor.
const CHAPTER_NAMES: Record<number, { name: string; subtitle: string }> = {
  1: { name: 'The Ember Caves',      subtitle: 'Where every delver begins.' },
  2: { name: 'The Crystal Hollow',   subtitle: 'Frost and cursed steel await.' },
  3: { name: 'The Shattered Vault',  subtitle: 'Ancient drakes stir below.' },
};
export function chapterMeta(chapter: number): { name: string; subtitle: string } {
  return CHAPTER_NAMES[chapter] ?? { name: `Depth ${chapter}`, subtitle: 'Uncharted runes.' };
}

// Milestone levels worth highlighting on the map (boss-like beats).
export function isMilestoneLevel(level: number): boolean {
  if (level === 1) return false;
  return level % 10 === 0 || level % 50 === 1; // every 10, plus chapter openers
}
export function isChapterOpener(level: number): boolean {
  return level > 1 && (level - 1) % 50 === 0;
}

// 1..5 difficulty tier — visible label for the player.
export function difficultyTierFor(level: number): number {
  if (level <= 10) return 1;
  if (level <= 25) return 2;
  if (level <= 50) return 3;
  if (level <= 100) return 4;
  return 5;
}

// Stable seed: same level number → same seed.
function seedFor(level: number): number {
  // Simple but well-distributed integer hash.
  let h = level | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  // Avoid 0 (mulberry32 treats it specially in some implementations).
  return h || 1;
}

// Tighten move budget as the campaign deepens — but keep it humane.
// Rebalance (data-driven): keep 12 turns through L15 so the L8 cliff softens.
function turnLimitFor(level: number): number {
  if (level <= 15) return 12;
  if (level <= 30) return 11;
  if (level <= 60) return 10;
  if (level <= 100) return 9;
  return 8;
}

// Enemy count ramp — Rebalance v2: smooth the L14 cliff. Playtest showed
// the 25% chance of 3 enemies at L14 paired with tanky Slime rolls created
// a 2.5× HP spike vs L13. We now keep 2 enemies through L15, then ramp.
function enemyCountFor(level: number, rng: () => number): number {
  if (level <= 15) return 2;                       // tutorial-friendly Chapter 1 opener
  if (level <= 22) return rng() < 0.6 ? 2 : 3;     // 60/40 split — gentle introduction
  if (level <= 30) return rng() < 0.35 ? 2 : 3;    // 35/65 — mostly 3
  if (level <= 75) return 3;
  return 3 + rngInt(rng, 2);                       // 3-4
}

// Per-template HP cap on early levels — keep the L14-15 area from rolling a
// triple-Slime/Stone-Golem wall before the player has any relics.
const EARLY_HP_CAP = 110;

// HP/damage scaling — softer ramp through L25, then resume original curve.
function scaleEnemy(base: { hp: number; damage: number }, level: number) {
  const hpRate  = level <= 25 ? 0.03  : 0.04;      // +3%/lvl early, +4% later
  const dmgRate = level <= 25 ? 0.02  : 0.025;     // +2%/lvl early, +2.5% later
  const hpMul   = 1 + (level - 1) * hpRate;
  const dmgMul  = 1 + (level - 1) * dmgRate;
  return {
    hp: Math.round(base.hp * hpMul),
    damage: Math.max(base.damage, Math.round(base.damage * dmgMul)),
  };
}

// Pick a roster archetype for this level. The roster's chapter/tier gating
// already mirrors the prior pool-growth logic, so we just bias early levels
// toward "soft" damage profiles to keep the L1-L15 ramp friendly.
function pickTemplate(level: number, rng: () => number): RosterEntry {
  let pool = rosterPoolForLevel(level);
  // Never seed an ability-bearing enemy in Chapter 1 — keeps intro readable.
  if (level <= 50) pool = pool.filter(e => !e.ability);
  // Per-enemy DPS cap on early levels — prefer tankier-but-softer templates.
  if (level <= 15) {
    const softPool = pool.filter(e => e.baseDamage <= 6);
    if (softPool.length && rng() < 0.7) pool = softPool;
  }
  // Hard fallback so the picker can never crash on an empty pool.
  if (pool.length === 0) pool = rosterPoolForLevel(Math.max(1, level));
  if (pool.length === 0) {
    const fb = ENEMY_TEMPLATES[0];
    return {
      id: 'fallback', name: fb.name, family: 'cave', role: 'striker',
      chapter: 1, tier: 1, emoji: fb.emoji, baseHp: fb.hp, baseDamage: fb.damage,
    };
  }
  return pool[rngInt(rng, pool.length)];
}

// Per-archetype scaling — same curve as before but reads from RosterEntry.
function scaleEnemy(base: RosterEntry, level: number) {
  const hpRate  = level <= 25 ? 0.03  : 0.04;
  const dmgRate = level <= 25 ? 0.02  : 0.025;
  const hpMul   = 1 + (level - 1) * hpRate;
  const dmgMul  = 1 + (level - 1) * dmgRate;
  return {
    hp: Math.round(base.baseHp * hpMul),
    damage: Math.max(base.baseDamage, Math.round(base.baseDamage * dmgMul)),
  };
}

// MVP objectives — gradually introduced.
function objectiveFor(level: number, rng: () => number): { type: ObjectiveType; target: number } {
  // Default everywhere: defeat all enemies.
  if (level < 15)  return { type: 'defeat_all', target: 0 };
  // From level 15: occasional survive levels.
  if (level % 13 === 0) return { type: 'survive', target: turnLimitFor(level) };
  // From level 30: occasional score targets.
  if (level >= 30 && level % 17 === 0) return { type: 'reach_score', target: 600 + level * 12 };
  // From chapter 2 (51+): elite levels every ~25.
  if (level >= 51 && level % 25 === 0) return { type: 'defeat_elite', target: 0 };
  return { type: 'defeat_all', target: 0 };
}

export function generateLevel(level: number): LevelDefinition {
  const seed = seedFor(level);
  const rng = mulberry32(seed);
  const enemyCount = enemyCountFor(level, rng);
  const enemies: Enemy[] = [];
  const objective = objectiveFor(level, rng);
  const turnLimit = turnLimitFor(level);
  const mechanics = mechanicsForLevel(level);
  const isBossLevel = bossRuleForLevel(level) != null;

  for (let i = 0; i < enemyCount; i++) {
    const t = pickTemplate(level, rng);
    let { hp, damage } = scaleEnemy(t, level);
    // Early-game HP cap: avoid triple-tank rolls (Slime/Stone Golem) before
    // relics exist. Bosses/elites bypass this so milestones still feel weighty.
    const isElite = objective.type === 'defeat_elite' && i === enemyCount - 1;
    const isFinalBossSlot = isBossLevel && i === enemyCount - 1;
    if (level <= 18 && !isElite && !isFinalBossSlot) {
      hp = Math.min(hp, EARLY_HP_CAP);
    }
    if (isElite) {
      hp = Math.round(hp * 1.6);
      damage = Math.round(damage * 1.2);
    }
    // Boss-rule levels: meaningfully beef up the final enemy so the rule lands.
    if (isFinalBossSlot) {
      hp = Math.round(hp * 1.8);
      damage = Math.round(damage * 1.15);
    }
    enemies.push({
      id: `e${i}`,
      name: isFinalBossSlot
        ? `Boss ${t.name}`
        : isElite ? `Elite ${t.name}` : t.name,
      emoji: t.emoji,
      hp,
      maxHp: hp,
      damage,
    });
  }

  // Layered Goals (Band 4): only when the multi_objective mechanic is active
  // AND the primary isn't already a stretch target — keep them composable.
  const wantsSecondary = mechanics.includes('multi_objective')
    && (objective.type === 'defeat_all' || objective.type === 'defeat_elite');
  const secondary = wantsSecondary ? rollSecondaryObjective(seed, level, turnLimit) : null;

  return {
    level_number: level,
    chapter: chapterFor(level),
    difficulty_tier: difficultyTierFor(level),
    generation_seed: seed,
    board_size: 5,
    enemy_config: enemies,
    turn_limit: turnLimit,
    objective_type: objective.type,
    objective_target: objective.target,
    modifiers: {
      mechanics,
      intro_mechanic: introMechanicForLevel(level),
      secondary_objective: secondary,
      boss_rule: bossRuleForLevel(level),
    },
  };
}

export function objectiveLabel(o: ObjectiveType): string {
  switch (o) {
    case 'defeat_all':   return 'Defeat all enemies';
    case 'survive':      return 'Survive every turn';
    case 'reach_score':  return 'Reach the score target';
    case 'defeat_elite': return 'Defeat the Elite';
  }
}

// Star rating for results — score-based, with bonus for clearing under move budget.
export function starsFor(score: number, level: number, cleared: boolean): 0 | 1 | 2 | 3 {
  if (!cleared) return 0;
  const baseTarget = 600 + level * 30;
  if (score >= baseTarget * 1.5) return 3;
  if (score >= baseTarget) return 2;
  return 1;
}
