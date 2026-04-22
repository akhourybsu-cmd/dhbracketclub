import { mulberry32, rngInt, type Rng } from './prng';

export type RuneType = 'red' | 'blue' | 'green' | 'gold';
export const RUNE_TYPES: RuneType[] = ['red', 'blue', 'green', 'gold'];
export const BOARD_SIZE = 5;

export interface Enemy {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  damage: number;
  /** Telegraphed Attacks (Band 2). Turns until this enemy unleashes a heavy strike. */
  intent?: number;
  /** Max charge — what intent resets to after firing. */
  intentMax?: number;
  // ── Roster metadata (added in the enemy-system pass) ───────────────────
  // All optional so legacy enemy_config rows keep working unchanged.
  /** Archetype id from enemyRoster.ts — stable key for combat-log templates. */
  archetypeId?: string;
  /** Creature family (undead, beast, corrupted, cave, magical, cultist, elite, boss). */
  family?: string;
  /** Combat role (striker, tank, swarm, support, summoner, corrupter, caster, defender, controller). */
  role?: string;
  /** Optional special ability id from enemyAbilities.ts. Fires on its own cooldown. */
  ability?: string;
  /** Turns until ability fires next. Decrements with the enemy phase. */
  abilityCooldown?: number;
  /** Cooldown reset value after ability fires. */
  abilityCooldownMax?: number;
  /** Flat damage reduction granted by `shield_self`. Decays each turn. */
  armor?: number;
  /** Short label shown above the enemy when an ability is about to fire. */
  telegraphLabel?: string;
  /** Boss-tier label used by EnemyDisplay (mini / boss). Optional — legacy enemies have none. */
  tier?: 'mini' | 'boss';
  // ── Boss-rule transient flags (Band 5 + new mid-cadence rules) ────────
  /** Phase Lock: turns remaining of immunity after a damage threshold trigger. */
  phaseLockTurns?: number;
  /** Phase Lock: cumulative HP loss already credited to a phase trigger. */
  phaseLockNextAt?: number;
  /** Splitter: true once this boss has split (prevents repeat triggers). */
  hasSplit?: boolean;
}

export interface DungeonConfig {
  seed: number;
  maxTurns: number;
  enemies: Enemy[];
}

const ENEMY_TEMPLATES: Array<Omit<Enemy, 'id' | 'hp' | 'maxHp'> & { hp: number }> = [
  { name: 'Goblin Scout',   emoji: '👹', hp: 60,  damage: 5 },
  { name: 'Cave Bat',       emoji: '🦇', hp: 45,  damage: 4 },
  { name: 'Skeleton',       emoji: '💀', hp: 70,  damage: 6 },
  { name: 'Slime',          emoji: '🟢', hp: 90,  damage: 3 },
  { name: 'Rune Wraith',    emoji: '👻', hp: 80,  damage: 7 },
  { name: 'Stone Golem',    emoji: '🗿', hp: 130, damage: 8 },
  { name: 'Shadow Imp',     emoji: '😈', hp: 55,  damage: 6 },
  { name: 'Crystal Spider', emoji: '🕷️', hp: 75,  damage: 5 },
];

// Build today's dungeon deterministically from a seed.
export function generateDungeon(seed: number, maxTurns = 10): DungeonConfig {
  const rng = mulberry32(seed);
  const enemyCount = 2 + rngInt(rng, 2); // 2 or 3
  const enemies: Enemy[] = [];
  const used = new Set<number>();
  for (let i = 0; i < enemyCount; i++) {
    let idx = rngInt(rng, ENEMY_TEMPLATES.length);
    let guard = 0;
    while (used.has(idx) && guard < 10) {
      idx = rngInt(rng, ENEMY_TEMPLATES.length);
      guard++;
    }
    used.add(idx);
    const t = ENEMY_TEMPLATES[idx];
    enemies.push({
      id: `e${i}`,
      name: t.name,
      emoji: t.emoji,
      hp: t.hp,
      maxHp: t.hp,
      damage: t.damage,
    });
  }
  return { seed, maxTurns, enemies };
}

// Initial board grid filled deterministically.
export function generateBoard(rng: Rng): RuneType[][] {
  const grid: RuneType[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: RuneType[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)]);
    }
    grid.push(row);
  }
  return grid;
}

// Generate a fresh seed (used when creating today's dungeon if missing).
export function freshSeed(): number {
  // Use date-based default plus randomness so the daily seed is unique.
  return Math.floor(Math.random() * 2_000_000_000);
}
