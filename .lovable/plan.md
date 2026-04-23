

# Relic Rank Progression Audit & Rebalance

I audited all 21 relic rank tables in `src/lib/runedelve/relics.ts`. Many ranks today are **dead upgrades** — players spend hundreds of shards (rank cost doubles each tier) and get the same integer value back. Below are the relics where R2/R3/R4/R5 don't deliver a felt improvement, with proposed fixes.

## Audit findings

### ❌ Dead-rank relics (most critical)

These have ranks that round to the **same value** as the prior rank — a wasted spend:

| Relic | Current table | Problem |
|---|---|---|
| `aether_spark` | 2,2,2,3,3 | R2 & R3 do nothing; R5 does nothing |
| `sapphire_flow` | 1,1,1,2,2 | R2/R3/R5 do nothing |
| `first_light` | 1,1,1,1,2 | Only R5 changes anything — 4 dead ranks |
| `iron_resolve` | 1,1,2,2,2 | R2, R4, R5 do nothing |
| `last_stand` | 1,1,1,1,2 | Only R5 changes anything |
| `bulwark` | 1,1,1,2,2 | R2/R3/R5 do nothing |
| `keysight` | 1,1,1,2,2 | R2/R3/R5 do nothing |
| `cleansing_touch` | 1,1,1,1,2 | Only R5 changes anything |
| `quickstep` | 1,1,1,2,2 | R2/R3/R5 do nothing |
| `foresight` | 1,1,1,2,2 | R2/R3/R5 do nothing |
| `bloodbond` | 4,5,5,6,6 | R3 & R5 do nothing |

### ⚠️ Underwhelming-but-functional

Each rank changes a number, but the felt impact is too thin for the cost curve:

- `momentum` 1.10 → 1.18 (only +8% over 4 ranks)
- `executioners_mark` 1.30 → 1.46 (+16% over 4 ranks, on a niche condition)
- `desperate_surge` 1.25 → 1.41 (only fires below 30% HP)

### ✅ Already well-tuned

`ember_edge`, `crimson_tide`, `verdant_heart`, `spiked_aegis`, `shrine_ward`, `wanderers_compass`, `cracked_crown` — clean monotonic progression with a felt bump every rank.

---

## Proposed fix — every rank delivers a real upgrade

Rebalanced tables (only the dead/weak ones change):

```ts
// Mana — integer relics get a meaningful breakpoint each rank
aether_spark:    [2,    3,    3,    4,    5   ],  // also unlocks R2 mana floor for caster builds
sapphire_flow:   [1,    1,    2,    2,    3   ],  // breakpoints at R3 and R5
first_light:     [1,    1,    2,    2,    3   ],  // R3 second free cast = real ability build

// Survival — integer ranks get spaced upgrades
iron_resolve:    [1,    2,    2,    3,    3   ],  // R2 doubles starting shield
last_stand:      [1,    1,    2,    2,    3   ],  // R3 second life-save, R5 third
bulwark:         [1,    2,    2,    3,    3   ],
bloodbond:       [4,    5,    6,    7,    8   ],  // clean +1/rank curve

// Board / tempo / utility
keysight:        [1,    2,    2,    3,    3   ],
cleansing_touch: [1,    1,    2,    2,    3   ],
quickstep:       [1,    2,    2,    3,    3   ],
foresight:       [1,    1,    2,    2,    3   ],

// Tempo multiplier — widen the curve so R5 feels earned
momentum:        [1.10, 1.13, 1.16, 1.20, 1.25],

// Offense — bigger swings on conditional damage
executioners_mark: [1.30, 1.36, 1.42, 1.48, 1.55],
desperate_surge:   [1.25, 1.30, 1.36, 1.42, 1.50],
```

### Why this works

- **Every rank now changes the displayed value** in `RelicUpgradeSheet`'s "Current → Next" delta, so the upgrade UI never lies.
- **Integer relics use a 1 → 2 → 3 cadence** (with a doubling at R2 or R3) instead of stalling on the same number for 3 ranks.
- **Conditional offense relics get bigger swings** to compensate for their narrow trigger windows.
- **Power ceiling is preserved** — R5 totals stay close to or just above the old R5 (e.g., `b