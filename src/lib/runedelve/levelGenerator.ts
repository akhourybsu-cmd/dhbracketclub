// Deterministic level generator. Same level number → same level for everyone.
import { mulberry32, rngInt } from './prng';
import type { Enemy } from './dungeonGenerator';
import { mechanicsForLevel, introMechanicForLevel, type MechanicId } from './mechanics';

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
  modifiers: {
    mechanics?: MechanicId[];
    intro_mechanic?: MechanicId | null;
    [k: string]: unknown;
  };
}

const ENEMY_TEMPLATES: Array<{ name: string; emoji: string; hp: number; damage: number; tier: number }> = [
  { name: 'Cave Bat',       emoji: '🦇', hp: 45,  damage: 4, tier: 1 },
  { name: 'Goblin Scout',   emoji: '👹', hp: 60,  damage: 5, tier: 1 },
  { name: 'Slime',          emoji: '🟢', hp: 90,  damage: 3, tier: 1 },
  { name: 'Skeleton',       emoji: '💀', hp: 70,  damage: 6, tier: 2 },
  { name: 'Shadow Imp',     emoji: '😈', hp: 55,  damage: 6, tier: 2 },
  { name: 'Crystal Spider', emoji: '🕷️', hp: 75,  damage: 5, tier: 2 },
  { name: 'Rune Wraith',    emoji: '👻', hp: 80,  damage: 7, tier: 3 },
  { name: 'Stone Golem',    emoji: '🗿', hp: 130, damage: 8, tier: 3 },
];

// New chapter archetypes unlock as the campaign deepens.
const CHAPTER_2_TEMPLATES = [
  { name: 'Frost Revenant', emoji: '🧊', hp: 110, damage: 7, tier: 3 },
  { name: 'Cursed Knight',  emoji: '⚔️', hp: 140, damage: 9, tier: 4 },
];
const CHAPTER_3_TEMPLATES = [
  { name: 'Voidspawn',      emoji: '🌑', hp: 160, damage: 10, tier: 4 },
  { name: 'Ancient Drake',  emoji: '🐉', hp: 220, damage: 12, tier: 5 },
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
function turnLimitFor(level: number): number {
  if (level <= 10) return 12;
  if (level <= 25) return 11;
  if (level <= 50) return 10;
  if (level <= 100) return 9;
  return 8;
}

// Enemy count grows from 2 → 4, capped at 4 to keep mobile UX clean.
function enemyCountFor(level: number, rng: () => number): number {
  if (level <= 5) return 2;
  if (level <= 25) return 2 + rngInt(rng, 2);     // 2-3
  if (level <= 75) return 3;                       // 3
  return 3 + rngInt(rng, 2);                       // 3-4
}

// HP/damage scaling — gentle ramp, exponential past chapter 2.
function scaleEnemy(base: { hp: number; damage: number }, level: number) {
  const hpMul   = 1 + (level - 1) * 0.04;          // ~+4% per level
  const dmgMul  = 1 + (level - 1) * 0.025;         // ~+2.5% per level
  return {
    hp: Math.round(base.hp * hpMul),
    damage: Math.max(base.damage, Math.round(base.damage * dmgMul)),
  };
}

function pickTemplate(level: number, rng: () => number) {
  const chapter = chapterFor(level);
  // Pool grows with chapters, mirroring the "new mechanic" milestones.
  let pool = [...ENEMY_TEMPLATES];
  if (chapter >= 2) pool = pool.concat(CHAPTER_2_TEMPLATES);
  if (chapter >= 3) pool = pool.concat(CHAPTER_3_TEMPLATES);
  // Bias early levels to lower-tier templates.
  const maxTier = Math.min(5, 1 + Math.floor(level / 8));
  pool = pool.filter(t => t.tier <= maxTier);
  return pool[rngInt(rng, pool.length)];
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

  for (let i = 0; i < enemyCount; i++) {
    const t = pickTemplate(level, rng);
    let { hp, damage } = scaleEnemy(t, level);
    // Elite levels: last enemy is a beefier boss.
    const isElite = objective.type === 'defeat_elite' && i === enemyCount - 1;
    if (isElite) {
      hp = Math.round(hp * 1.6);
      damage = Math.round(damage * 1.2);
    }
    enemies.push({
      id: `e${i}`,
      name: isElite ? `Elite ${t.name}` : t.name,
      emoji: t.emoji,
      hp,
      maxHp: hp,
      damage,
    });
  }

  return {
    level_number: level,
    chapter: chapterFor(level),
    difficulty_tier: difficultyTierFor(level),
    generation_seed: seed,
    board_size: 5,
    enemy_config: enemies,
    turn_limit: turnLimitFor(level),
    objective_type: objective.type,
    objective_target: objective.target,
    modifiers: {},
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
