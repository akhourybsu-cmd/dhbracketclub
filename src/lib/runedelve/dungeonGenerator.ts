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
