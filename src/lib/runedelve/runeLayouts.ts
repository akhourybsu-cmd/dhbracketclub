// Rune Delve — Chamber Layout Catalog
//
// Visual / metadata layer for the dungeon, hub, and level-map screens.
// Every chamber layout supplies:
//   • a stylised mini-map shape (rendered by <RuneLayoutPreview/> as inline SVG)
//   • a short briefing line and a longer flavor description
//   • a category (path / vault / sanctum / boss) so screens can filter/style
//   • engine-ready zone metadata (entry/exit points, rune slots, hazards,
//     treasure, locked doors) — these are NOT yet read by the play engine,
//     but the structure is in place so a future engine pass can consume
//     them without breaking the data shape.
//
// Adding a new layout: append an entry here and (optionally) reference it
// from chamberAssignment.ts so a band of levels deploys on it.

export type ChamberCategory = 'path' | 'vault' | 'sanctum' | 'boss';

export type RuneLayoutId =
  | 'ancient_gate'
  | 'split_passage'
  | 'spiral_sanctum'
  | 'rune_crossroads'
  | 'cursed_vault'
  | 'ember_hollow'
  | 'crystal_archive'
  | 'forgotten_catacomb'
  | 'shadow_reliquary'
  | 'final_seal_chamber';

/**
 * Canonical shape of a chamber layout's preview metadata. The play engine
 * could later use entryPoints, runeSlots, hazardZones, treasureZones, and
 * lockedZones to drive the actual board layout — for now they're stored
 * for future use and surface on briefing cards.
 */
export interface ChamberPreview {
  /** Path / shape identifier — picked up by RuneLayoutPreview to render the mini-map. */
  shape:
    | 'gate'         // simple bend through an archway
    | 'split'        // diverging passages
    | 'spiral'       // inward winding sanctum
    | 'crossroads'   // 4-way intersection
    | 'vault'        // central locked chamber
    | 'hollow'       // open arena with side alcoves
    | 'archive'      // shelf-grid lined corridors
    | 'catacomb'     // multi-corridor chambered network
    | 'reliquary'    // ritual circle with relics around the rim
    | 'seal';        // boss room funnel into a sealed core
  /** Primary accent color (HSL parts) used for glow + theming. */
  accent: string;
  /** Secondary accent (HSL parts) — used for subtle highlights. */
  accent2?: string;
  /** Atmosphere keyword — drives mood text + subtle treatment. */
  atmosphere: 'torchlit' | 'mossy' | 'crystalline' | 'embered' | 'cursed' | 'sealed' | 'abyssal';
  /** Number of enemy/wave entry points. */
  entryPoints: number;
  /** Number of available exits (may equal 1 for boss rooms). */
  exitPoints: number;
  /** Approximate rune-slot count this chamber supports. */
  runeSlots: number;
  /** Number of hazard zones (corrupted/eclipse/sealed tiles, magma, etc). */
  hazardZones: number;
  /** Number of treasure / relic alcoves. */
  treasureZones: number;
  /** Number of locked doors / sealed sub-chambers. */
  lockedZones: number;
}

export interface RuneLayout {
  id: RuneLayoutId;
  name: string;
  /** Short one-liner for briefing cards & lists. */
  tagline: string;
  /** Longer narrative used on dedicated briefing surfaces. */
  briefing: string;
  category: ChamberCategory;
  /** 1–5 difficulty modifier — multiplied into the level's existing difficulty tier. */
  difficultyModifier: 1 | 2 | 3 | 4 | 5;
  preview: ChamberPreview;
  /** Tags shown as small chips on briefing cards. */
  tags: string[];
  /** Suggested loadout / play-style hint shown on briefing screens. */
  recommendedStrategy: string;
}

export const RUNE_LAYOUTS: Record<RuneLayoutId, RuneLayout> = {
  ancient_gate: {
    id: 'ancient_gate',
    name: 'Ancient Gate',
    tagline: 'A torchlit entrance hall — your descent begins here.',
    briefing:
      'Stone columns bear the marks of forgotten kings. The runes in this chamber are weathered but stable — perfect to test a fresh hero before the deeper corridors open.',
    category: 'path',
    difficultyModifier: 1,
    preview: {
      shape: 'gate',
      accent: '38 95% 60%',
      accent2: '45 100% 70%',
      atmosphere: 'torchlit',
      entryPoints: 1,
      exitPoints: 1,
      runeSlots: 4,
      hazardZones: 0,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['Onboarding', 'Single Path', 'Stable'],
    recommendedStrategy: 'Walk the wards. Linear chains, no surprises.',
  },
  split_passage: {
    id: 'split_passage',
    name: 'Split Passage',
    tagline: 'Two corridors fork around a buried shrine.',
    briefing:
      'A cave-in long ago split this passage in half. Hostiles can press from either branch — keep your runes balanced or one flank will collapse before the other.',
    category: 'path',
    difficultyModifier: 2,
    preview: {
      shape: 'split',
      accent: '195 80% 65%',
      accent2: '38 95% 60%',
      atmosphere: 'mossy',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 1,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['Two Branches', 'Adaptive', 'Mossy'],
    recommendedStrategy: 'Mirror your runes — both branches must hold.',
  },
  spiral_sanctum: {
    id: 'spiral_sanctum',
    name: 'Spiral Sanctum',
    tagline: 'A coiling shrine — long path, slow approach, no shortcuts.',
    briefing:
      'The original wardens built this sanctum as a meditation spiral. Long path means more rune procs, but a single mistake near the center cascades outward fast.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'spiral',
      accent: '270 70% 65%',
      accent2: '195 80% 65%',
      atmosphere: 'mossy',
      entryPoints: 1,
      exitPoints: 1,
      runeSlots: 8,
      hazardZones: 1,
      treasureZones: 2,
      lockedZones: 1,
    },
    tags: ['Long Path', 'Meditative', 'Compounding'],
    recommendedStrategy: 'Stack chains — distance favors patient runes.',
  },
  rune_crossroads: {
    id: 'rune_crossroads',
    name: 'Rune Crossroads',
    tagline: 'Four-way intersection where converging lines empower runes.',
    briefing:
      'Crossroads runes resonate when struck from opposing angles. Place wisely — the center tile activates twice if both axes fire on the same turn.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'crossroads',
      accent: '210 80% 60%',
      accent2: '270 70% 65%',
      atmosphere: 'crystalline',
      entryPoints: 4,
      exitPoints: 1,
      runeSlots: 7,
      hazardZones: 2,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['Cross-Axis', 'Resonance', 'Volume'],
    recommendedStrategy: 'Center-cast: every cross-axis match doubles.',
  },
  cursed_vault: {
    id: 'cursed_vault',
    name: 'Cursed Vault',
    tagline: 'A buried treasury sealed by malformed wards.',
    briefing:
      'Greedy hands stripped this vault long ago — what remains is bound by curses. Hazard zones mar half the floor; the surviving treasures are worth the wounds.',
    category: 'vault',
    difficultyModifier: 4,
    preview: {
      shape: 'vault',
      accent: '350 75% 60%',
      accent2: '38 95% 60%',
      atmosphere: 'cursed',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 3,
      treasureZones: 3,
      lockedZones: 2,
    },
    tags: ['Hazardous', 'Treasure-Rich', 'Cursed'],
    recommendedStrategy: 'Cleanse hazards before you go for relics.',
  },
  ember_hollow: {
    id: 'ember_hollow',
    name: 'Ember Hollow',
    tagline: 'A magma-warmed cavern lit by drifting embers.',
    briefing:
      'Heat pulses through this chamber on a slow rhythm. Hazard zones cycle between dim and active — time your matches with the embers and the path opens.',
    category: 'path',
    difficultyModifier: 3,
    preview: {
      shape: 'hollow',
      accent: '15 95% 60%',
      accent2: '38 100% 65%',
      atmosphere: 'embered',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 2,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['Hazard Cycle', 'Tempo', 'Warmlit'],
    recommendedStrategy: 'Match on the dim beat; the embers will harvest themselves.',
  },
  crystal_archive: {
    id: 'crystal_archive',
    name: 'Crystal Archive',
    tagline: 'Shelved corridors of resonant glass — every match echoes.',
    briefing:
      'A cathedral of crystal pillars and lore-shelves. Sound carries unnaturally — even minor chains ring across multiple alcoves, but so do the wraith-screams.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'archive',
      accent: '195 90% 65%',
      accent2: '270 70% 70%',
      atmosphere: 'crystalline',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 9,
      hazardZones: 1,
      treasureZones: 2,
      lockedZones: 1,
    },
    tags: ['Resonance', 'Wide Field', 'Lore'],
    recommendedStrategy: 'Loud chains favor archive shelves — go big.',
  },
  forgotten_catacomb: {
    id: 'forgotten_catacomb',
    name: 'Forgotten Catacomb',
    tagline: 'Burial corridors with secret sub-chambers behind sealed doors.',
    briefing:
      'A network of crypt corridors — most are direct, a few hide beneath sealed doors. Carry the right runes and the locks open mid-run.',
    category: 'path',
    difficultyModifier: 3,
    preview: {
      shape: 'catacomb',
      accent: '152 35% 50%',
      accent2: '195 70% 60%',
      atmosphere: 'mossy',
      entryPoints: 2,
      exitPoints: 2,
      runeSlots: 7,
      hazardZones: 2,
      treasureZones: 2,
      lockedZones: 2,
    },
    tags: ['Sealed Doors', 'Multi-Exit', 'Crypt'],
    recommendedStrategy: 'Crack a seal early — the relic inside flips the run.',
  },
  shadow_reliquary: {
    id: 'shadow_reliquary',
    name: 'Shadow Reliquary',
    tagline: 'A ritual circle where the relics watch back.',
    briefing:
      'Twelve relic alcoves rim a stone circle. Ancient magic still binds them — disturb the wrong one and shadows answer in waves. Disturb the right one and the path narrows toward the prize.',
    category: 'vault',
    difficultyModifier: 4,
    preview: {
      shape: 'reliquary',
      accent: '270 80% 70%',
      accent2: '350 75% 65%',
      atmosphere: 'abyssal',
      entryPoints: 3,
      exitPoints: 1,
      runeSlots: 12,
      hazardZones: 2,
      treasureZones: 4,
      lockedZones: 1,
    },
    tags: ['Relic-Heavy', 'Ritual', 'Shadowed'],
    recommendedStrategy: 'Identify the false relic; the rest reward you.',
  },
  final_seal_chamber: {
    id: 'final_seal_chamber',
    name: 'Final Seal Chamber',
    tagline: 'The boss vault — a single funnel into a sealed core.',
    briefing:
      'The end of the chapter. Hostiles funnel through three converging corridors into the core where the wardstone waits. Break it and the seal lifts; fail and you start the chapter again.',
    category: 'boss',
    difficultyModifier: 5,
    preview: {
      shape: 'seal',
      accent: '0 85% 60%',
      accent2: '45 100% 65%',
      atmosphere: 'sealed',
      entryPoints: 3,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 3,
      treasureZones: 1,
      lockedZones: 1,
    },
    tags: ['Boss', 'Funnel', 'Wardstone'],
    recommendedStrategy: 'Bring your strongest chain — one shot at the seal.',
  },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getLayout(id: RuneLayoutId | undefined | null): RuneLayout | undefined {
  if (!id) return undefined;
  return RUNE_LAYOUTS[id];
}

export function getLayoutsByCategory(category: ChamberCategory): RuneLayout[] {
  return Object.values(RUNE_LAYOUTS).filter(l => l.category === category);
}

export const ALL_LAYOUTS: RuneLayout[] = Object.values(RUNE_LAYOUTS);

/** Default fallback used when no layout has been assigned to a level. */
export const DEFAULT_LAYOUT: RuneLayoutId = 'ancient_gate';
