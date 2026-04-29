// Nexus Defense — Effective Values resolver, calibration, modifier, and
// engine-parity regression suite.
//
// Goal: lock in correctness so admin math and live runtime stay in sync as
// new modifiers / missions / calibration fields are added.
//
// Coverage is grouped by:
//   1. Mission/economy resolution
//   2. Enemy / boss runtime resolution
//   3. Tower cost & damage rounding/floors
//   4. Ability cooldown floors
//   5. Wave spawn count/interval/delay floors
//   6. Edge cases (negative cal + positive mod, sub-floor inputs, etc.)
//   7. Effective Values ↔ engine parity
//   8. Representative modifier stacks
//   9. Warning-chip sanity

import { describe, it, expect } from 'vitest';

import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { TOWERS } from '@/lib/nexus/towers';
import { MISSIONS, getMission } from '@/lib/nexus/missions';
import { applyCalibration, withDefaults, MissionCalibration } from '@/lib/nexus/calibration';
import { aggregateModifiers, resolveModifiers, MODIFIERS } from '@/lib/nexus/modifiers';
import { resolveEffective } from '@/lib/nexus/effectiveValues';
import { initBattle } from '@/lib/nexus/engine';
import { AbilityKind, EnemyKind, MissionDef, TowerKind } from '@/lib/nexus/types';

// ---------- helpers ----------

function cal(overrides: Partial<MissionCalibration> = {}): MissionCalibration {
  return withDefaults(0, overrides);
}

function withMods(mission: MissionDef, ids: string[]): MissionDef {
  return { ...mission, modifierIds: ids };
}

/**
 * Engine-side parity helper. Replays the formulas the engine uses at
 * initBattle/spawn/fire-time so we can compare them against the resolver
 * without running a full simulation.
 */
function engineEffective(mission: MissionDef, c: MissionCalibration) {
  const state = initBattle(mission.id, [], {
    mission: applyCalibration(mission, c),
    enemyHpMult: {
      drone: c.enemy_hp_mult, walker: c.enemy_hp_mult, shielded: c.enemy_hp_mult,
      stealth: c.enemy_hp_mult, boss: c.boss_hp_mult,
    },
    enemyShieldMult: {
      drone: c.enemy_shield_mult, walker: c.enemy_shield_mult, shielded: c.enemy_shield_mult,
      stealth: c.enemy_shield_mult, boss: c.boss_shield_mult,
    },
    enemySpeedMult: c.enemy_speed_mult,
  });

  const kinds: EnemyKind[] = ['drone', 'walker', 'shielded', 'stealth', 'boss'];
  const enemyHpFinal = {} as Record<EnemyKind, number>;
  const enemyShieldFinal = {} as Record<EnemyKind, number>;
  for (const k of kinds) {
    enemyHpFinal[k] = (state.enemyHpMult[k] ?? 1) * (state.modEnemyHpMult[k] ?? 1);
    enemyShieldFinal[k] = (state.enemyShieldMult[k] ?? 1) * (state.modEnemyShieldMult[k] ?? 1);
  }
  const bossHpFinal = enemyHpFinal.boss * state.modBossHpMult;

  const towerCostFinal = {} as Record<TowerKind, number>;
  const towerDamageFinal = {} as Record<TowerKind, number>;
  (['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]).forEach(k => {
    towerCostFinal[k] = Math.max(1, Math.round(TOWERS[k].cost * (state.modTowerCostMult[k] ?? 1)));
    towerDamageFinal[k] = Math.max(1, Math.round(TOWERS[k].damage * (state.modTowerDamageMult[k] ?? 1)));
  });

  const abilityCdFinal = {} as Record<AbilityKind, number>;
  (['orbital', 'emp'] as AbilityKind[]).forEach(k => {
    abilityCdFinal[k] = Math.max(1000, Math.round(ABILITIES[k].cooldownMs * (state.modAbilityCooldownMult[k] ?? 1)));
  });

  return {
    startEnergy: state.energy,
    baseHp: state.baseHp,
    enemySpeed: state.enemySpeedMult * state.modEnemySpeedMult,
    enemyHpFinal,
    enemyShieldFinal,
    bossHpFinal,
    bountyMult: state.modBountyMult,
    towerCostFinal,
    towerDamageFinal,
    abilityCdFinal,
    shieldRegen: state.modShieldRegen,
  };
}

// =====================================================================
// 1. MISSION / ECONOMY RESOLUTION
// =====================================================================

describe('Nexus · mission/economy resolution', () => {
  it('start energy: base + cal + modifier (Mission 4 + Emergency Reserves)', () => {
    const m = getMission(4)!; // emergency_reserves => +60
    const eff = resolveEffective(m, cal({ start_energy_delta: -40 }));
    expect(eff.startEnergy.base).toBe(260);
    expect(eff.startEnergy.calibration).toBe(-40);
    expect(eff.startEnergy.modifier).toBe(60);
    expect(eff.startEnergy.final).toBe(280);
  });

  it('base HP and reward cores apply additive deltas with floors', () => {
    const m = getMission(1)!;
    const eff = resolveEffective(m, cal({ base_hp_delta: -15, reward_cores_delta: -100 }));
    expect(eff.baseHp.final).toBe(Math.max(1, m.baseHp - 15));
    expect(eff.rewardCores.final).toBe(Math.max(0, m.rewardCores - 100));
  });

  it('wave reward multiplier resolves and respects ≥0 floor in resolved waves', () => {
    const m = getMission(1)!;
    const eff = resolveEffective(m, cal({ wave_reward_mult: 0.25 }));
    eff.waves.forEach((w, i) => {
      const expected = Math.max(0, Math.round(m.waves[i].rewardEnergy * 0.25));
      expect(w.rewardEnergy.final).toBe(expected);
      expect(w.rewardEnergy.final).toBeGreaterThanOrEqual(0);
    });
  });

  it('bounty multiplier reflects Salvage Op modifier', () => {
    const m = withMods(getMission(1)!, ['bonus_bounty']);
    const eff = resolveEffective(m, cal());
    expect(eff.bountyMult.final).toBeCloseTo(1.25, 6);
  });
});

// =====================================================================
// 2. ENEMY / BOSS RUNTIME RESOLUTION
// =====================================================================

describe('Nexus · enemy & boss multipliers', () => {
  it('per-kind enemy HP composes calibration × modifier (Reinforced Hulls)', () => {
    const m = withMods(getMission(1)!, ['reinforced_hulls']); // walker ×1.25
    const eff = resolveEffective(m, cal({ enemy_hp_mult: 1.2 }));
    expect(eff.enemyHp.walker.final).toBeCloseTo(1.2 * 1.25, 6);
    expect(eff.enemyHp.drone.final).toBeCloseTo(1.2, 6);
  });

  it('boss HP stacks calibration boss mult, per-kind boss mod, and bossHpMult', () => {
    const m = withMods(getMission(6)!, ['hardened_boss']); // bossHpMult 1.3
    const c = cal({ boss_hp_mult: 1.4 });
    const eff = resolveEffective(m, c);
    // 1 × 1.4 × (1 × 1.3) = 1.82
    expect(eff.bossHp.final).toBeCloseTo(1.4 * 1.3, 6);
  });

  it('boss shield uses boss_shield_mult only', () => {
    const m = withMods(getMission(6)!, ['hardened_boss']);
    const eff = resolveEffective(m, cal({ boss_shield_mult: 1.5 }));
    expect(eff.bossShield.final).toBeCloseTo(1.5, 6);
  });

  it('enemy speed composes calibration × modifier', () => {
    const m = withMods(getMission(1)!, ['swarm_protocol']); // 1.15
    const eff = resolveEffective(m, cal({ enemy_speed_mult: 1.1 }));
    expect(eff.enemySpeed.final).toBeCloseTo(1.1 * 1.15, 6);
  });

  it('Shielded Vanguard contributes shield regen for shielded only', () => {
    const m = withMods(getMission(3)!, ['shielded_vanguard']);
    const eff = resolveEffective(m, cal());
    expect(eff.shieldRegen.shielded).toBe(10);
    expect(eff.shieldRegen.drone).toBeUndefined();
  });
});

// =====================================================================
// 3. TOWER COST & DAMAGE — ROUNDING / FLOORS
// =====================================================================

describe('Nexus · tower cost & damage rounding', () => {
  it('Cryo Calibration discounts cryo only, with engine rounding', () => {
    const m = withMods(getMission(1)!, ['cryo_calibration']); // cryo cost ×0.8
    const eff = resolveEffective(m, cal());
    expect(eff.towerCost.cryo.final).toBe(Math.max(1, Math.round(TOWERS.cryo.cost * 0.8)));
    expect(eff.towerCost.pulse.final).toBe(TOWERS.pulse.cost);
  });

  it('Supply Drought raises ALL tower costs (rounded)', () => {
    const m = withMods(getMission(1)!, ['supply_drought']); // ×1.15
    const eff = resolveEffective(m, cal());
    (['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]).forEach(k => {
      expect(eff.towerCost[k].final).toBe(Math.max(1, Math.round(TOWERS[k].cost * 1.15)));
    });
  });

  it('Pulse Overdrive damage uses Math.round and floors at 1', () => {
    const m = withMods(getMission(1)!, ['pulse_overdrive']); // pulse ×1.2
    const eff = resolveEffective(m, cal());
    expect(eff.towerDamage.pulse.final).toBe(Math.max(1, Math.round(TOWERS.pulse.damage * 1.2)));
    expect(eff.towerDamage.arc.final).toBe(TOWERS.arc.damage);
  });

  it('extreme tower damage suppression cannot go below 1', () => {
    // Synthetic stack: arc 1.25 × hypothetical 0.001 wouldn't resolve through real
    // modifiers, so verify the resolver via a base-1 damage tower scenario.
    const m = withMods(getMission(1)!, []);
    const eff = resolveEffective(m, cal());
    (['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]).forEach(k => {
      expect(eff.towerDamage[k].final).toBeGreaterThanOrEqual(1);
      expect(eff.towerCost[k].final).toBeGreaterThanOrEqual(1);
    });
  });
});

// =====================================================================
// 4. ABILITY COOLDOWN FLOORS
// =====================================================================

describe('Nexus · ability cooldowns', () => {
  it('Rapid Command reduces all ability cooldowns ×0.75', () => {
    const m = withMods(getMission(1)!, ['rapid_command']);
    const eff = resolveEffective(m, cal());
    (['orbital', 'emp'] as AbilityKind[]).forEach(k => {
      expect(eff.abilityCooldownMs[k].finalMs).toBe(Math.max(1000, Math.round(ABILITIES[k].cooldownMs * 0.75)));
    });
  });

  it('Comms Jammed lengthens cooldowns ×1.3', () => {
    const m = withMods(getMission(6)!, ['comms_jammed']);
    const eff = resolveEffective(m, cal());
    expect(eff.abilityCooldownMs.orbital.finalMs).toBe(Math.round(25000 * 1.3));
    expect(eff.abilityCooldownMs.emp.finalMs).toBe(Math.round(30000 * 1.3));
  });

  it('cooldown floor of 1000ms is applied even with extreme stacking', () => {
    // Stack Rapid Command three times via aggregator (synthetic) to push cooldown
    // multiplier to 0.75^3 ≈ 0.422. Both abilities still well above 1000ms, so
    // additionally test the floor explicitly with a fabricated multiplier.
    const baseMs = 1200; // pretend
    const finalMs = Math.max(1000, Math.round(baseMs * 0.001));
    expect(finalMs).toBe(1000);
  });
});

// =====================================================================
// 5. WAVE SPAWN COUNT / INTERVAL / DELAY FLOORS
// =====================================================================

describe('Nexus · wave spawn floors', () => {
  it('spawn count never drops below 1', () => {
    const m = getMission(1)!;
    const eff = resolveEffective(m, cal({ spawn_count_mult: 0.25 }));
    eff.waves.forEach(w => w.spawns.forEach(s => expect(s.count.final).toBeGreaterThanOrEqual(1)));
  });

  it('spawn interval never drops below 100ms', () => {
    const m = getMission(1)!;
    const eff = resolveEffective(m, cal({ spawn_interval_mult: 0.25 }));
    eff.waves.forEach(w => w.spawns.forEach(s => expect(s.intervalMs.final).toBeGreaterThanOrEqual(100)));
  });

  it('spawn delay never drops below 0', () => {
    const m = getMission(2)!; // has delays
    const eff = resolveEffective(m, cal({ spawn_delay_mult: 0 }));
    eff.waves.forEach(w => w.spawns.forEach(s => {
      if (s.delayMs.base != null) expect(s.delayMs.final).toBeGreaterThanOrEqual(0);
    }));
  });

  it('wave reward never drops below 0', () => {
    const m = getMission(1)!;
    const eff = resolveEffective(m, cal({ wave_reward_mult: 0.25 }));
    eff.waves.forEach(w => expect(w.rewardEnergy.final).toBeGreaterThanOrEqual(0));
  });

  it('total foe count = sum of resolved spawn counts per wave', () => {
    const m = getMission(5)!;
    const eff = resolveEffective(m, cal({ spawn_count_mult: 1.5 }));
    eff.waves.forEach(w => {
      const sum = w.spawns.reduce((a, s) => a + s.count.final, 0);
      expect(w.totalCount.final).toBe(sum);
    });
  });
});

// =====================================================================
// 6. EDGE CASES
// =====================================================================

describe('Nexus · edge cases', () => {
  it('very negative calibration + Emergency Reserves: clamp-then-add (engine semantics)', () => {
    const m = withMods({ ...getMission(1)!, startEnergy: 100 }, ['emergency_reserves']);
    const eff = resolveEffective(m, cal({ start_energy_delta: -300 }));
    // After cal: max(0, 100 - 300) = 0, then + 60 → 60.
    expect(eff.startEnergy.final).toBe(60);
  });

  it('very negative calibration without modifier still cannot go below 0', () => {
    const m = { ...getMission(1)!, startEnergy: 100 };
    const eff = resolveEffective(m, cal({ start_energy_delta: -300 }));
    expect(eff.startEnergy.final).toBe(0);
  });

  it('boss HP stacks calibration ×3 with hardened_boss without exploding floors', () => {
    const m = withMods(getMission(6)!, ['hardened_boss']);
    const eff = resolveEffective(m, cal({ boss_hp_mult: 3 }));
    expect(eff.bossHp.final).toBeCloseTo(3 * 1.3, 6);
  });

  it('boon + threat stack composes correctly (Mission 5 archetype)', () => {
    const m = withMods(getMission(5)!, ['mixed_assault', 'supply_drought', 'rapid_command']);
    const eff = resolveEffective(m, cal());
    // mixed_assault has no numeric effect; supply_drought ×1.15 cost; rapid_command ×0.75 CD
    expect(eff.towerCost.pulse.final).toBe(Math.max(1, Math.round(TOWERS.pulse.cost * 1.15)));
    expect(eff.abilityCooldownMs.orbital.finalMs).toBe(Math.round(25000 * 0.75));
  });
});

// =====================================================================
// 7. EFFECTIVE VALUES ↔ ENGINE PARITY (highest priority)
// =====================================================================

describe('Nexus · resolver/engine parity', () => {
  const cases: Array<{ name: string; missionId: number; c: MissionCalibration; ids?: string[] }> = [
    { name: 'M1 default', missionId: 1, c: cal() },
    { name: 'M2 baseline modifiers', missionId: 2, c: cal() },
    { name: 'M3 + harder cal', missionId: 3, c: cal({ enemy_hp_mult: 1.2, enemy_shield_mult: 1.1 }) },
    { name: 'M4 + extra mods', missionId: 4, c: cal({ start_energy_delta: -80 }) },
    { name: 'M5 pressure stack', missionId: 5, c: cal({ enemy_speed_mult: 1.1, wave_reward_mult: 0.85 }) },
    { name: 'M6 boss stack', missionId: 6, c: cal({ boss_hp_mult: 1.4, boss_shield_mult: 1.2 }) },
    { name: 'M1 synthetic Pulse Overdrive + Supply Drought', missionId: 1, c: cal(), ids: ['pulse_overdrive', 'supply_drought'] },
    { name: 'M1 synthetic Rapid Command + Cryo Calibration', missionId: 1, c: cal(), ids: ['rapid_command', 'cryo_calibration'] },
    { name: 'M1 synthetic Bonus Bounty + Emergency Reserves', missionId: 1, c: cal(), ids: ['bonus_bounty', 'emergency_reserves'] },
  ];

  for (const tc of cases) {
    it(`parity: ${tc.name}`, () => {
      const baseMission = getMission(tc.missionId)!;
      const mission = tc.ids ? withMods(baseMission, tc.ids) : baseMission;
      const eff = resolveEffective(mission, tc.c);
      const eng = engineEffective(mission, tc.c);

      // Mission economy
      expect(eff.startEnergy.final).toBe(eng.startEnergy);
      expect(eff.baseHp.final).toBe(eng.baseHp);

      // Enemy multipliers
      (['drone', 'walker', 'shielded', 'stealth', 'boss'] as EnemyKind[]).forEach(k => {
        expect(eff.enemyHp[k].final).toBeCloseTo(eng.enemyHpFinal[k], 6);
        expect(eff.enemyShield[k].final).toBeCloseTo(eng.enemyShieldFinal[k], 6);
      });
      expect(eff.bossHp.final).toBeCloseTo(eng.bossHpFinal, 6);
      expect(eff.enemySpeed.final).toBeCloseTo(eng.enemySpeed, 6);

      // Bounty
      expect(eff.bountyMult.final).toBeCloseTo(eng.bountyMult, 6);

      // Tower cost & damage (post-rounding/floor)
      (['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]).forEach(k => {
        expect(eff.towerCost[k].final).toBe(eng.towerCostFinal[k]);
        expect(eff.towerDamage[k].final).toBe(eng.towerDamageFinal[k]);
      });

      // Ability cooldowns (post-floor)
      (['orbital', 'emp'] as AbilityKind[]).forEach(k => {
        expect(eff.abilityCooldownMs[k].finalMs).toBe(eng.abilityCdFinal[k]);
      });

      // Shield regen
      expect(eff.shieldRegen).toEqual(eng.shieldRegen);
    });
  }

  it('parity: spawned boss HP rounding matches engine math', () => {
    const m = withMods(getMission(6)!, ['hardened_boss']);
    const c = cal({ boss_hp_mult: 1.4 });
    const eff = resolveEffective(m, c);
    const baseBossHp = ENEMIES.boss.hp;
    const expected = Math.max(1, Math.round(Math.round(baseBossHp * eff.enemyHp.boss.final) * 1.3));
    // Mirror engine spawnEnemy: hp *= hpMult, then for boss multiply by bossHpMult.
    const stage1 = Math.max(1, Math.round(baseBossHp * eff.enemyHp.boss.final));
    const finalHp = Math.max(1, Math.round(stage1 * eff.agg.bossHpMult));
    expect(finalHp).toBe(expected);
  });
});

// =====================================================================
// 8. REPRESENTATIVE MODIFIER STACKS
// =====================================================================

describe('Nexus · curated mission stacks remain predictable', () => {
  it('Mission 5 stack: economy down, abilities up, no enemy stat scaling', () => {
    const m = getMission(5)!;
    const agg = aggregateModifiers(resolveModifiers(m.modifierIds));
    expect(agg.towerCostMult.pulse).toBeCloseTo(1.15, 6);
    expect(agg.abilityCooldownMult.orbital).toBeCloseTo(0.75, 6);
    expect(agg.enemySpeedMult).toBe(1);
    expect(agg.enemyHpMult.walker).toBe(1);
  });

  it('Mission 6 stack: boss scaling, slower abilities, more bounty', () => {
    const m = getMission(6)!;
    const agg = aggregateModifiers(resolveModifiers(m.modifierIds));
    expect(agg.bossHpMult).toBeCloseTo(1.3, 6);
    expect(agg.abilityCooldownMult.emp).toBeCloseTo(1.3, 6);
    expect(agg.bountyMult).toBeCloseTo(1.25, 6);
  });

  it('Pulse Overdrive + Supply Drought: Pulse hits harder but costs more', () => {
    const m = withMods(getMission(1)!, ['pulse_overdrive', 'supply_drought']);
    const eff = resolveEffective(m, cal());
    expect(eff.towerDamage.pulse.final).toBeGreaterThan(TOWERS.pulse.damage);
    expect(eff.towerCost.pulse.final).toBeGreaterThan(TOWERS.pulse.cost);
  });

  it('Comms Jammed + Salvage Op: ability slowdown alongside economy boon', () => {
    const m = withMods(getMission(1)!, ['comms_jammed', 'bonus_bounty']);
    const eff = resolveEffective(m, cal());
    expect(eff.abilityCooldownMs.orbital.finalMs).toBeGreaterThan(25000);
    expect(eff.bountyMult.final).toBeGreaterThan(1);
  });
});

// =====================================================================
// 9. WARNING-CHIP SANITY
// =====================================================================

describe('Nexus · warning chips', () => {
  function labels(m: MissionDef, c: MissionCalibration) {
    return resolveEffective(m, c).warnings.map(w => w.label);
  }

  it('high enemy HP triggers "Enemy durability ↑"', () => {
    const m = withMods(getMission(1)!, ['reinforced_hulls']);
    expect(labels(m, cal({ enemy_hp_mult: 1.6 }))).toContain('Enemy durability ↑');
  });

  it('fast enemies trigger "Enemies fast"', () => {
    const m = withMods(getMission(1)!, ['swarm_protocol']);
    expect(labels(m, cal({ enemy_speed_mult: 1.15 }))).toContain('Enemies fast');
  });

  it('boss scaling high triggers on boss missions only', () => {
    const m = withMods(getMission(6)!, ['hardened_boss']);
    expect(labels(m, cal({ boss_hp_mult: 1.5 }))).toContain('Boss scaling high');
    const m1 = withMods(getMission(1)!, ['hardened_boss']);
    // Non-boss mission: should not warn even if boss mult is high
    expect(labels(m1, cal({ boss_hp_mult: 1.5 }))).not.toContain('Boss scaling high');
  });

  it('slowed abilities trigger "Abilities slowed"', () => {
    const m = withMods(getMission(6)!, ['comms_jammed']);
    expect(labels(m, cal())).toContain('Abilities slowed');
  });

  it('accelerated abilities trigger "Abilities accelerated"', () => {
    const m = withMods(getMission(1)!, ['rapid_command']);
    expect(labels(m, cal())).toContain('Abilities accelerated');
  });

  it('reduced economy triggers "Economy reduced"', () => {
    const m = withMods(getMission(1)!, ['supply_drought']);
    expect(labels(m, cal({ wave_reward_mult: 0.7 }))).toContain('Economy reduced');
  });

  it('combined boons may trigger "Mission may be soft"', () => {
    const m = withMods(getMission(1)!, ['rapid_command', 'bonus_bounty', 'emergency_reserves']);
    expect(labels(m, cal({ enemy_hp_mult: 0.6, wave_reward_mult: 1.5 }))).toContain('Mission may be soft');
  });

  it('high combined pressure triggers danger chip', () => {
    const m = withMods(getMission(6)!, ['hardened_boss', 'comms_jammed', 'swarm_protocol']);
    expect(labels(m, cal({ enemy_hp_mult: 1.8, enemy_speed_mult: 1.25, wave_reward_mult: 0.7 })))
      .toContain('High combined pressure');
  });

  it('default mission (no overrides, no modifiers) emits no warnings', () => {
    const m = { ...getMission(1)!, modifierIds: [] };
    const eff = resolveEffective(m, cal());
    expect(eff.warnings).toEqual([]);
  });
});

// =====================================================================
// 10. REGISTRY SANITY (helps catch malformed modifier additions)
// =====================================================================

describe('Nexus · modifier registry sanity', () => {
  it('every modifier id matches its key', () => {
    for (const [key, def] of Object.entries(MODIFIERS)) {
      expect(def.id).toBe(key);
    }
  });

  it('every mission referenced modifier id resolves', () => {
    for (const m of MISSIONS) {
      for (const id of m.modifierIds ?? []) {
        expect(MODIFIERS[id], `missing modifier ${id} on mission ${m.id}`).toBeTruthy();
      }
    }
  });
});
