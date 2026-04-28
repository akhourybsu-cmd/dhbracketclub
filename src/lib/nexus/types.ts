// Nexus Defense — shared type definitions

export type TowerKind = 'pulse' | 'arc' | 'cryo' | 'rail';
export type AbilityKind = 'orbital' | 'emp';
export type EnemyKind = 'drone' | 'walker' | 'shielded' | 'stealth' | 'boss';

export interface TowerDef {
  kind: TowerKind;
  name: string;
  tagline: string;
  cost: number;
  damage: number;          // per shot
  range: number;           // grid cells
  fireRate: number;        // shots per second
  splash?: number;         // AoE radius (cells), 0/undefined = single
  chain?: number;          // arc: extra targets
  slow?: number;           // 0..1 slow strength
  slowDuration?: number;   // seconds
  armorPierce?: number;    // flat reduction of enemy armor
  upgradeCost: number;
  upgradeMultiplier: number; // damage scaling per level
  color: string;           // tailwind hsl token used for styling
  glyph: string;           // 1-2 char symbol drawn on the tower
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;           // cells per second
  armor: number;           // flat damage reduction
  shield?: number;         // hp absorbed before main hp
  bounty: number;          // energy granted on kill
  damage: number;          // base hp dealt to nexus on leak
  stealth?: boolean;       // invisible to non-detector towers
  color: string;
  glyph: string;
}

export interface WaveSpawn {
  enemy: EnemyKind;
  count: number;
  intervalMs: number;
  delayMs?: number;        // delay before this group starts
}

export interface Wave {
  index: number;
  spawns: WaveSpawn[];
  rewardEnergy: number;
}

export interface MissionDef {
  id: number;
  name: string;
  sector: string;
  startEnergy: number;
  baseHp: number;
  waves: Wave[];
  /** Legacy single label — superseded by `modifierIds`. Kept for backwards compat. */
  modifier?: { label: string; description: string };
  /** Modifier ids resolved from src/lib/nexus/modifiers.ts */
  modifierIds?: string[];
  isBoss?: boolean;
  rewardCores: number;
}

export interface AbilityDef {
  kind: AbilityKind;
  name: string;
  tagline: string;
  cooldownMs: number;
  glyph: string;
  color: string;
}

// Runtime types
export interface PlacedTower {
  id: string;
  kind: TowerKind;
  level: number;            // 1, 2, 3
  cell: { col: number; row: number };
  cooldownMs: number;
  totalDamage: number;
  kills: number;
}

export interface ActiveEnemy {
  id: string;
  kind: EnemyKind;
  hp: number;
  shield: number;
  pathIndex: number;         // along the path cells
  progress: number;          // 0..1 between pathIndex and next
  slowMs: number;            // remaining ms slowed
  slowFactor: number;        // 0..1
  stunnedMs: number;
}

export interface AbilityRuntime {
  kind: AbilityKind;
  cooldownMs: number;        // remaining
}

export interface BattleState {
  tickMs: number;            // ms per tick
  elapsedMs: number;
  energy: number;
  baseHp: number;
  baseHpMax: number;
  waveIndex: number;         // 0-based, -1 = pre-wave
  totalWaves: number;        // from mission
  waveTimeMs: number;        // ms inside current wave
  spawnQueues: Array<{ enemy: EnemyKind; remaining: number; nextSpawnIn: number; intervalMs: number; }>;
  enemies: ActiveEnemy[];
  towers: PlacedTower[];
  abilities: AbilityRuntime[];
  status: 'pre' | 'in_wave' | 'between' | 'victory' | 'defeat';
  betweenWaveMs: number;     // countdown to next wave
  score: number;
  killedThisRun: number;
  events: BattleEvent[];     // recent visual events for UI
  // ---- telemetry counters (cheap, in-memory, sent on run end) ----
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerSells: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  energyStarvedMs: number;   // ms spent unable to afford the cheapest tower during a wave
  leaks: number;             // count of enemies that reached the nexus
  // ---- calibration mods (applied at spawn / per-tick) ----
  enemyHpMult: Record<EnemyKind, number>;
  enemyShieldMult: Record<EnemyKind, number>;
  enemySpeedMult: number;
}

export type BattleEvent =
  | { type: 'shot'; from: { col: number; row: number }; to: { x: number; y: number }; tower: TowerKind; t: number }
  | { type: 'leak'; t: number }
  | { type: 'ability'; ability: AbilityKind; t: number }
  | { type: 'kill'; at: { x: number; y: number }; t: number };
