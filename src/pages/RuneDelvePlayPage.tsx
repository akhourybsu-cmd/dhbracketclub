import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, HelpCircle, Trophy, Skull, Hourglass } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress, useUpdateClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useLevel, useMyLevelRun, useSubmitLevelRun, useAdvanceProgress, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { mulberry32 } from '@/lib/runedelve/prng';
import { generateBoard, type RuneType, type Enemy } from '@/lib/runedelve/dungeonGenerator';
import { isValidChain, resolveBoard, type Cell } from '@/lib/runedelve/boardEngine';
import { applyChain, enemiesAttack, endTurn, initialCombat, isRunOver, useAbility, type CombatState } from '@/lib/runedelve/combatEngine';
import { calculateScore, xpForRun } from '@/lib/runedelve/scoring';
import { levelFromXp, newTitleUnlocked, titleForLevel } from '@/lib/runedelve/classConfig';
import { useLoadout } from '@/hooks/useLoadout';
import { useEarnShards, useFailureRow, useBumpFailure, useResetFailure, useRuneWallet, useUnlockSlot } from '@/hooks/useRuneShards';
import { useRecordDefeats } from '@/hooks/useBestiary';
import { rosterById } from '@/lib/runedelve/enemyRoster';
import { useRelicCollection, rankMapFromOwned } from '@/hooks/useRelicCollection';
import {
  buildActive,
  getStartingMana,
  getStartingShieldTurns,
  has,
  onEnemyKilled,
  tryLastStand,
  computeChainMods,
  abilityFreeFirstUse,
  shrineWardTurn1Mult,
  bossRuleSoften,
  momentumScoreBonusMult,
  compassShardBonus,
  getTelegraphReadyEarly,
  getSealedTilesSpeedup,
  type ActiveRelics,
} from '@/lib/runedelve/relicEffects';
import { MAX_MANA } from '@/lib/runedelve/combatEngine';
import { computeClearShards, computeFailureShards, slotsForClassLevels } from '@/lib/runedelve/shardEconomy';

import { objectiveLabel, type ObjectiveType } from '@/lib/runedelve/levelGenerator';
import {
  mechanicsForLevel,
  introMechanicForLevel,
  seenMechanicKey,
  type MechanicId,
} from '@/lib/runedelve/mechanics';
import { buildInitialSeals, sealsBrokenByChain } from '@/lib/runedelve/sealedTiles';
import { applyInitialIntents } from '@/lib/runedelve/telegraph';
import {
  buildInitialCorruption,
  spreadCorruption,
  resolveChainAgainstCorruption,
  emptyCorruption,
  type CorruptionState,
} from '@/lib/runedelve/corruptedTiles';
import { secondaryMet, secondaryShort, secondaryLabel, type SecondaryObjective } from '@/lib/runedelve/layeredGoals';
import { getBossRule, type BossRuleId } from '@/lib/runedelve/bossRules';
import { Crown, Target } from 'lucide-react';
import { RuneBoard } from '@/components/runedelve/RuneBoard';
import { EnemyDisplay } from '@/components/runedelve/EnemyDisplay';
import { HeroStatusBar } from '@/components/runedelve/HeroStatusBar';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { MechanicIntroSheet } from '@/components/runedelve/MechanicIntroSheet';
import { MechanicBanner } from '@/components/runedelve/MechanicBanner';
import { CombatLog, type CombatLogEntry } from '@/components/runedelve/CombatLog';
import { format } from 'date-fns';

const RUNE_LABEL: Record<RuneType, string> = {
  red: 'Crimson',
  blue: 'Azure',
  green: 'Verdant',
  gold: 'Radiant',
};

// Module-level monotonic counter for log entry IDs. Stable, sortable, and
// avoids a Math.random() inside every setState updater.
let logSeq = 0;
const nextLogId = () => `l-${++logSeq}`;

export default function RuneDelvePlayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);

  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress();
  const { data: level } = useLevel(levelNumber);
  const { data: existingRun } = useMyLevelRun(level?.id);
  const { data: classTracks } = useAllClassProgress();
  const submit = useSubmitLevelRun();
  const advance = useAdvanceProgress();
  const updateHero = useUpdateHero();
  const updateClass = useUpdateClassProgress();
  const { data: loadout } = useLoadout(hero?.class);
  const { data: ownedRelics } = useRelicCollection();
  const { data: wallet } = useRuneWallet();
  const { data: failureRow } = useFailureRow(level?.level_number ?? null);
  const earnShards = useEarnShards();
  const recordDefeats = useRecordDefeats();
  const bumpFailure = useBumpFailure();
  const resetFailure = useResetFailure();
  const unlockSlot = useUnlockSlot();

  const [grid, setGrid] = useState<RuneType[][] | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [seals, setSeals] = useState<Set<string>>(new Set());
  const [rngTick, setRngTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [introMechanic, setIntroMechanic] = useState<MechanicId | null>(null);
  const [endState, setEndState] = useState<null | { cleared: boolean; reason: 'cleared' | 'defeated' | 'timeout'; score: number; isNewBest: boolean; shards: number; improvedChain?: boolean; improvedTurns?: boolean; improvedHp?: boolean; firstClear?: boolean }>(null);
  // Counter (not boolean) — Last Stand at R5 grants 2 saves per run.
  const [lastStandUsed, setLastStandUsed] = useState(0);
  // Bonus-move rebalance: only one free turn per enemy cycle. Resets whenever
  // the enemy phase actually runs (i.e. a non-bonus chain or ability resolves).
  const [bonusUsedThisCycle, setBonusUsedThisCycle] = useState(false);
  const [corruption, setCorruption] = useState<CorruptionState>(emptyCorruption);
  const [log, setLog] = useState<CombatLogEntry[]>([]);

  // Per-run defeat ledger keyed by archetypeId. Submitted to the Bestiary on
  // run-end. Using a ref keeps writes O(1) and avoids extra renders.
  const defeatedArchetypesRef = useRef<Map<string, number>>(new Map());
  const recordKill = (archetypeId: string | undefined) => {
    if (!archetypeId) return;
    const m = defeatedArchetypesRef.current;
    m.set(archetypeId, (m.get(archetypeId) ?? 0) + 1);
  };

  // Per-run relic-effect counters (drive Ember Edge / Crimson Tide / Quickstep /
  // First Light / Cleansing Touch / Shrine Ward turn-1 detection).
  const [redChainCount, setRedChainCount] = useState(0);
  const [chainCountTotal, setChainCountTotal] = useState(0);
  const [abilityUsedCount, setAbilityUsedCount] = useState(0);
  const [corruptCleansedCount, setCorruptCleansedCount] = useState(0);
  // Snapshot the active relic loadout at run-start so toggling/upgrading
  // relics mid-run can never reset the board state.
  const [activeRelicsSnapshot, setActiveRelicsSnapshot] = useState<ActiveRelics | null>(null);

  // Append a single entry; trim to a small ring so memory stays tidy.
  const pushLog = (entry: Omit<CombatLogEntry, 'id'>) => {
    setLog(prev => {
      const next = [...prev, { ...entry, id: nextLogId() }];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };
  const pushLogs = (entries: Array<Omit<CombatLogEntry, 'id'>>) => {
    if (!entries.length) return;
    setLog(prev => {
      const stamped = entries.map(e => ({ ...e, id: nextLogId() }));
      const next = [...prev, ...stamped];
      return next.length > 30 ? next.slice(-30) : next;
    });
  };

  // Active relic loadout for this run (rank-aware).
  const activeRelics = useMemo(() => {
    const ranks = rankMapFromOwned(ownedRelics);
    return buildActive([loadout?.slot_1, loadout?.slot_2, loadout?.slot_3], ranks);
  }, [loadout, ownedRelics]);

  // Resolve mechanics for this level. Prefer the persisted row, fall back
  // to the deterministic helper so legacy/transient rows still work.
  const activeMechanics = useMemo<MechanicId[]>(() => {
    const stored = (level?.modifiers as any)?.mechanics as MechanicId[] | undefined;
    if (stored?.length) return stored;
    return level ? mechanicsForLevel(level.level_number) : [];
  }, [level]);
  const sealedTilesActive = activeMechanics.includes('sealed_tiles');
  const telegraphActive = activeMechanics.includes('telegraphed_attacks');
  const corruptionActive = activeMechanics.includes('corrupted_tiles');
  const secondaryObjective = ((level?.modifiers as any)?.secondary_objective ?? null) as SecondaryObjective | null;
  const bossRule = ((level?.modifiers as any)?.boss_rule ?? null) as BossRuleId | null;

  // Build deterministic state. Snapshots `activeRelics` once at run-start so
  // mid-run relic toggles or rank changes can never reset the board.
  useEffect(() => {
    if (!level || !hero) return;
    const relics = activeRelics; // snapshot
    const rng = mulberry32(level.generation_seed);
    setGrid(generateBoard(rng));
    let initialSeals = buildInitialSeals(level.generation_seed, sealedTilesActive);
    // Keysight: pre-shatter the requested number of seals at run start so
    // the player effectively gets a head-start clearing them.
    const keysightTurns = getSealedTilesSpeedup(relics);
    if (keysightTurns > 0 && initialSeals.size > 0) {
      const keys = Array.from(initialSeals).slice(0, keysightTurns);
      const next = new Set(initialSeals);
      keys.forEach(k => next.delete(k));
      initialSeals = next;
    }
    setSeals(initialSeals);
    setCorruption(buildInitialCorruption(level.generation_seed, corruptionActive, level.level_number, initialSeals));
    let enemies: Enemy[] = (level.enemy_config ?? []).map((e: any, i: number) => ({
      id: e.id ?? `e${i}`, name: e.name, emoji: e.emoji, hp: e.hp, maxHp: e.maxHp ?? e.hp, damage: e.damage,
      archetypeId: e.archetypeId, family: e.family, role: e.role,
      ability: e.ability, abilityCooldown: e.abilityCooldown, abilityCooldownMax: e.abilityCooldownMax ?? e.abilityCooldown,
      telegraphLabel: e.telegraphLabel,
    }));
    if (telegraphActive) {
      enemies = applyInitialIntents(enemies, level.generation_seed, level.level_number);
      // Foresight: reveal telegraphed intents N turns earlier by ticking
      // each enemy's intent down at run start.
      const earlyTurns = getTelegraphReadyEarly(relics);
      if (earlyTurns > 0) {
        enemies = enemies.map(e => (
          e.intent != null ? { ...e, intent: Math.max(1, e.intent - earlyTurns) } : e
        ));
      }
    }
    // Apply pre-run relic effects: starting mana + starting shield.
    const initial = initialCombat(enemies, level.turn_limit);
    initial.mana = Math.min(MAX_MANA, initial.mana + getStartingMana(relics));
    initial.shieldTurns = Math.max(initial.shieldTurns, getStartingShieldTurns(relics));
    setCombat(initial);
    setActiveRelicsSnapshot(relics);
    setLastStandUsed(0);
    setRedChainCount(0);
    setChainCountTotal(0);
    setAbilityUsedCount(0);
    setCorruptCleansedCount(0);
    setBonusUsedThisCycle(false);
    defeatedArchetypesRef.current = new Map();
    setLog([{ id: nextLogId(), kind: 'info', text: `You enter Level ${level.level_number}. The runes hum.` }]);
    // NOTE: `activeRelics` intentionally OMITTED from deps — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, hero, sealedTilesActive, telegraphActive, corruptionActive]);

  // One-time intro modal for any brand-new mechanic taught at this level.
  useEffect(() => {
    if (!level || !hero) return;
    const intro = (level.modifiers as any)?.intro_mechanic ?? introMechanicForLevel(level.level_number);
    if (!intro) return;
    try {
      if (!localStorage.getItem(seenMechanicKey(intro))) setIntroMechanic(intro);
    } catch {}
  }, [level, hero]);

  const refillRng = useMemo(() => {
    if (!level) return null;
    return mulberry32(level.generation_seed + 1000 + rngTick);
  }, [level, rngTick]);

  // Lock guard: if user navigates to a locked level via URL.
  if (progress && levelNumber > progress.highest_unlocked_level) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <h2 className="font-extrabold text-base">Level Locked</h2>
          <p className="text-xs text-muted-foreground">Clear Level {progress.highest_unlocked_level} first.</p>
          <button onClick={() => navigate(`/rune-delve/play/${progress.highest_unlocked_level}`)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press">
            Go to Level {progress.highest_unlocked_level}
          </button>
        </div>
      </div>
    );
  }

  if (!hero || !level || !grid || !combat || !refillRng) {
    return <div className="h-64 rounded-2xl skeleton-shimmer" />;
  }

  const objType = level.objective_type as ObjectiveType;

  const handleChain = (chain: Cell[]) => {
    if (!isValidChain(grid, chain, seals)) return;
    const type = grid[chain[0].r][chain[0].c];
    // Tiered chain bonus: 6=heavy strike (no free turn), 7=+30% & free turn,
    // 8+=+40% & free turn. Only ONE free turn per enemy cycle.
    const tierFor = (len: number) =>
      len >= 8 ? { dmgMult: 1.4, bonus: true as const }
      : len >= 7 ? { dmgMult: 1.3, bonus: true as const }
      : len >= 6 ? { dmgMult: 1.2, bonus: false as const }
      : { dmgMult: 1, bonus: false as const };
    const tier = tierFor(chain.length);
    // Snapshot relics for this run (falls back to live for first chain).
    const relics = activeRelicsSnapshot ?? activeRelics;
    // Per-chain counters BEFORE applying — drives Ember Edge / Crimson Tide / Quickstep.
    const isFirstChainOfRun = chainCountTotal === 0;
    const redCountAfter = type === 'red' ? redChainCount + 1 : redChainCount;
    // Compute relic chain mods (Ember Edge, Crimson Tide, Executioner's Mark,
    // Desperate Surge, Sapphire Flow, Verdant Heart, Bulwark, Quickstep).
    const targetEnemyForCtx = combat.enemies.find(e => e.hp > 0);
    const enemyHpRatio = targetEnemyForCtx ? targetEnemyForCtx.hp / Math.max(1, targetEnemyForCtx.maxHp) : 1;
    const chainMods = computeChainMods(relics, {
      chainType: type,
      length: chain.length,
      redChainCountSoFar: type === 'red' ? redCountAfter : 0,
      isFirstChainOfRun,
      hpRatio: combat.hp / Math.max(1, combat.maxHp),
      enemyHpRatioBeforeHit: enemyHpRatio,
    });
    // Momentum (rogue): chain bonus threshold drops from 5 → 4.
    const rogueBonusThreshold = hero.class === 'rogue' && has(relics, 'momentum') ? 4 : 5;
    const { next, resolution } = applyChain(combat, type, chain.length, hero.class, bossRule, rogueBonusThreshold);
    // Apply relic damage multiplier for red chains (composes with tier mult).
    if (type === 'red' && chainMods.bonusDamageMult > 1 && resolution.damageDealt > 0) {
      const baseDmg = resolution.damageDealt;
      const boostedDmg = Math.round(baseDmg * chainMods.bonusDamageMult);
      const extra = boostedDmg - baseDmg;
      if (extra > 0) {
        const target = next.enemies.find(e => e.hp > 0) ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      }
    }
    // Mana / heal / shield bonuses.
    if (chainMods.bonusManaFlat > 0) {
      next.mana = Math.min(MAX_MANA, next.mana + chainMods.bonusManaFlat);
      resolution.manaGained += chainMods.bonusManaFlat;
    }
    if (chainMods.bonusHealFlat > 0) {
      const heal = Math.min(chainMods.bonusHealFlat, next.maxHp - next.hp);
      if (heal > 0) {
        next.hp += heal;
        resolution.hpHealed += heal;
      }
    }
    if (chainMods.bonusShieldTurns > 0) {
      next.shieldTurns += chainMods.bonusShieldTurns;
      resolution.guardGained += chainMods.bonusShieldTurns;
    }
    // Quickstep: first chain of run counts as +N length. Apply by adding the
    // per-rune effect of the chain type (an extra "phantom" rune's worth) for
    // every length bonus point. Also lifts the longest-chain stat for scoring.
    if (chainMods.effectiveLengthBonus > 0) {
      const bonusLen = chainMods.effectiveLengthBonus;
      next.longestChain = Math.max(next.longestChain, chain.length + bonusLen);
      if (type === 'red') {
        // 8 dmg per rune base, scaled by warrior passive (matches applyChain).
        const perRune = hero.class === 'warrior' ? Math.round(8 * 1.25) : 8;
        const extra = perRune * bonusLen;
        const target = next.enemies.find(e => e.hp > 0)
          ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      } else if (type === 'green') {
        const perRune = hero.class === 'cleric' ? Math.round(6 * 1.5) : 6;
        const extra = Math.min(perRune * bonusLen, next.maxHp - next.hp);
        if (extra > 0) {
          next.hp += extra;
          resolution.hpHealed += extra;
        }
      } else if (type === 'blue') {
        // Push the chain over the 5+ mana threshold if it wasn't already.
        if (chain.length < 5 && chain.length + bonusLen >= 5 && next.mana < MAX_MANA) {
          next.mana = Math.min(MAX_MANA, next.mana + 1);
          resolution.manaGained += 1;
        }
      } else if (type === 'gold') {
        // Gold scales shield turns by floor(length/3) — only push if it crosses a threshold.
        const beforeT = Math.floor(chain.length / 3);
        const afterT = Math.floor((chain.length + bonusLen) / 3);
        const extraTurns = afterT - beforeT;
        if (extraTurns > 0) {
          next.shieldTurns += extraTurns;
          resolution.guardGained += extraTurns;
        }
      }
    }
    // Update per-run counters.
    setChainCountTotal(c => c + 1);
    if (type === 'red') setRedChainCount(redCountAfter);
    // Scale red-chain damage by the tier multiplier; route the extra HP into
    // the same target that applyChain already hit. Round to whole HP.
    if (tier.dmgMult > 1 && type === 'red' && resolution.damageDealt > 0) {
      const baseDmg = resolution.damageDealt;
      const boostedDmg = Math.round(baseDmg * tier.dmgMult);
      const extra = boostedDmg - baseDmg;
      if (extra > 0) {
        const target = next.enemies.find(e => e.hp > 0 && e.hp < e.maxHp)
          ?? next.enemies.find(e => resolution.enemyKills.includes(e.id));
        if (target) {
          const applied = Math.min(extra, Math.max(target.hp, 0));
          if (applied > 0) {
            target.hp -= applied;
            resolution.damageDealt += applied;
            next.totalDamage += applied;
            if (target.hp <= 0 && !resolution.enemyKills.includes(target.id)) {
              next.enemiesDefeated += 1;
              resolution.enemyKills.push(target.id);
            }
          }
        }
      }
    }
    if (resolution.enemyKills.length) setFlashId(resolution.enemyKills[0]);

    // Build the per-turn log batch as we go so the order matches the events.
    const turnLogs: Array<Omit<CombatLogEntry, 'id'>> = [];
    const runeLabel = RUNE_LABEL[type] ?? type;

    // Chain summary line — always logged.
    if (type === 'red' && resolution.damageDealt > 0) {
      const target = combat.enemies.find(e => resolution.enemyKills[0] ? e.id === resolution.enemyKills[0] : e.hp > 0);
      const targetName = target?.name ?? 'the foe';
      turnLogs.push({
        kind: 'damage',
        text: `${runeLabel} chain x${chain.length} struck ${targetName}`,
        amount: resolution.damageDealt,
      });
    } else if (type === 'green' && resolution.hpHealed > 0) {
      turnLogs.push({ kind: 'heal', text: `${runeLabel} chain x${chain.length} mended your wounds`, amount: resolution.hpHealed });
    } else if (type === 'blue' && resolution.manaGained > 0) {
      turnLogs.push({ kind: 'mana', text: `${runeLabel} chain x${chain.length} channeled mana`, amount: resolution.manaGained });
    } else if (type === 'gold') {
      turnLogs.push({ kind: 'shield', text: `${runeLabel} chain x${chain.length} raised your guard`, amount: resolution.guardGained });
    } else {
      // Red chain that hit a shielded boss → no damage applied.
      turnLogs.push({ kind: 'info', text: `${runeLabel} chain x${chain.length} fizzled` });
    }
    for (const killId of resolution.enemyKills) {
      const killed = combat.enemies.find(e => e.id === killId);
      recordKill(killed?.archetypeId);
      turnLogs.push({ kind: 'kill', text: `${killed?.name ?? 'A foe'} was vanquished!` });
    }

    // Last Stand feedback: red chain landed but the boss is shielded → 0 dmg.
    if (
      bossRule === 'last_stand' &&
      type === 'red' &&
      resolution.damageDealt === 0 &&
      combat.enemies.some(e => e.hp > 0)
    ) {
      toast('🛡️ Boss is shielded — defeat the others first', { duration: 1600 });
    }

    // Apply corruption: HP cost for matching corrupted cells, then strip them.
    // Cleansing Touch: first N corrupt-source clears each run cost no HP.
    let nextCorruption = corruption;
    if (corruptionActive && corruption.cells.size) {
      const r = resolveChainAgainstCorruption(corruption, chain);
      let hpCost = r.hpCost;
      if (r.sourcesCleared > 0 && has(relics, 'cleansing_touch')) {
        // effectValue returns max free clears (1..2). We've already consumed
        // `corruptCleansedCount` of them.
        const freeRemaining = Math.max(
          0,
          (relics.ranks.get('cleansing_touch') ?? 1) >= 5 ? 2 - corruptCleansedCount : 1 - corruptCleansedCount,
        );
        if (freeRemaining > 0 && hpCost > 0) {
          hpCost = 0;
          turnLogs.push({ kind: 'info', text: '✨ Cleansing Touch — corruption cost waived' });
        }
        setCorruptCleansedCount(c => c + r.sourcesCleared);
      }
      if (hpCost > 0) {
        next.hp = Math.max(0, next.hp - hpCost);
        toast.error(`☠️ -${hpCost} HP from corruption`, { duration: 1100 });
        turnLogs.push({ kind: 'corruption', text: 'Corrupted runes burned you', amount: hpCost });
      }
      if (r.sourcesCleared > 0) {
        toast.success(r.sourcesCleared > 1 ? `Sources cleansed!` : `Source cleansed!`, { duration: 1200 });
        turnLogs.push({ kind: 'info', text: r.sourcesCleared > 1 ? 'Corruption sources cleansed' : 'Corruption source cleansed' });
      }
      nextCorruption = r.next;
    }

    // Bonus move (rebalanced): only chains of 7+ grant a free action, AND only
    // once per enemy cycle. Chain-6 still gets a damage bump (handled above)
    // but the enemy phase still runs.
    const enemiesAlive = next.enemies.some(e => e.hp > 0);
    const grantsBonusMove = tier.bonus && !bonusUsedThisCycle && enemiesAlive;

    // Capture pre-attack HP + shield to derive damage taken / mitigated.
    const hpBefore = next.hp;
    const hadShield = next.shieldTurns > 0;
    const rawIncoming = next.enemies.reduce(
      (s, e) => s + (e.hp > 0 ? Math.round(e.damage) : 0),
      0,
    );

    // enemiesAttack already runs applyBossTurnEffects internally — do NOT call it again here.
    // On a bonus-move chain, we skip the enemy phase entirely (no turn consumed, no retaliation).
    // Shrine Ward (turn 1) and Cracked Crown (boss-rule levels) reduce incoming
    // damage by scaling each enemy's `damage` field in-place before the call,
    // then restoring it after — mirrors the enrager pattern in combatEngine.
    const isTurnOne = combat.turnsRemaining === level.turn_limit;
    const wardMult = shrineWardTurn1Mult(relics, isTurnOne);
    const crownMult = bossRule ? bossRuleSoften(relics) : 1;
    const incomingMult = wardMult * crownMult;
    let afterEnemies: CombatState & { heavyFired?: boolean; abilityLogs?: Array<Omit<CombatLogEntry, 'id'>>; abilityEffects?: any[] };
    if (grantsBonusMove) {
      afterEnemies = next;
    } else if (enemiesAlive) {
      const originalDamage = next.enemies.map(e => e.damage);
      if (incomingMult !== 1) {
        next.enemies.forEach(e => { e.damage = Math.max(0, Math.round(e.damage * incomingMult)); });
      }
      // Count minions already on the board so summon_minion respects its cap.
      const summonsSoFar = next.enemies.filter(e => e.archetypeId === 'bone_husk').length;
      afterEnemies = enemiesAttack(next, telegraphActive, bossRule, summonsSoFar);
      // Restore damage on the post-attack array so future turns aren't permanently softened.
      afterEnemies.enemies = afterEnemies.enemies.map((e, i) => ({ ...e, damage: originalDamage[i] ?? e.damage }));
      // Apply ability side-effects (corrupt/seal/spawn) to the page-level state.
      const effects = afterEnemies.abilityEffects ?? [];
      for (const eff of effects) {
        if (eff.kind === 'spawn_minion') {
          afterEnemies = { ...afterEnemies, enemies: [...afterEnemies.enemies, eff.enemy] };
        } else if (eff.kind === 'corrupt_tile' && corruptionActive) {
          // Drop one corrupted cell on a random non-sealed, non-corrupted square.
          setCorruption(prev => {
            const cells = new Set(prev.cells);
            for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
              const k = `${r}-${c}`;
              if (!cells.has(k) && !seals.has(k)) { cells.add(k); return { cells, sources: prev.sources }; }
            }
            return prev;
          });
        } else if (eff.kind === 'seal_tile') {
          setSeals(prev => {
            const next = new Set(prev);
            for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
              const k = `${r}-${c}`;
              if (!next.has(k)) { next.add(k); return next; }
            }
            return next;
          });
        }
      }
      // Push enemy ability logs (heavy_strike / shield_self / heal_ally / etc).
      if (afterEnemies.abilityLogs?.length) turnLogs.push(...afterEnemies.abilityLogs);
    } else {
      afterEnemies = endTurn(next);
    }
    if (grantsBonusMove) {
      setBonusUsedThisCycle(true);
      toast.success(`✨ Bonus move! Chain x${chain.length}`, { duration: 1400 });
      turnLogs.push({ kind: 'info', text: `Chain x${chain.length} — bonus move! Enemies hesitate.` });
    } else if (tier.bonus && enemiesAlive) {
      if (chain.length >= 8) toast.success(`💥 Massive chain x${chain.length}!`, { duration: 1300 });
      turnLogs.push({ kind: 'info', text: `Chain x${chain.length} — massive damage! (bonus already used this cycle)` });
    } else if (chain.length === 6 && enemiesAlive) {
      turnLogs.push({ kind: 'info', text: `Chain x6 — heavy strike!` });
    }
    if (!grantsBonusMove && enemiesAlive) {
      setBonusUsedThisCycle(false);
    }

    if ((afterEnemies as any).heavyFired) {
      toast.error('⚡ Heavy strike!', { duration: 1200 });
      turnLogs.push({ kind: 'heavy', text: 'A telegraphed heavy strike landed!' });
    }

    // Damage taken / mitigated lines.
    const hpLost = Math.max(0, hpBefore - afterEnemies.hp);
    if (hpLost > 0) {
      turnLogs.push({ kind: 'taken', text: 'Enemies retaliated', amount: hpLost });
    } else if (next.enemies.some(e => e.hp > 0) && rawIncoming > 0) {
      turnLogs.push({ kind: 'info', text: 'You weathered the assault' });
    }
    if (hadShield && rawIncoming > hpLost) {
      const mitigated = rawIncoming - hpLost;
      if (mitigated > 0) turnLogs.push({ kind: 'mitigated', text: 'Your guard absorbed the blow', amount: mitigated });
    }

    // Relic: Last Stand — survive lethal at 1 HP. R1–R4: 1 use; R5: 2 uses.
    if (afterEnemies.hp <= 0) {
      const ls = tryLastStand(relics, afterEnemies.hp, lastStandUsed);
      if (ls.saved) {
        afterEnemies = { ...afterEnemies, hp: ls.hp };
        setLastStandUsed(c => c + 1);
        toast.success('💔 Last Stand! Survived at 1 HP', { duration: 1800 });
        turnLogs.push({ kind: 'laststand', text: 'Last Stand! You survived at 1 HP' });
      }
    }

    // Relic: Bloodbond — heal per kill this turn (rank-aware: 4–6 HP).
    if (resolution.enemyKills.length && has(relics, 'bloodbond')) {
      const beforeHeal = afterEnemies.hp;
      let healed = afterEnemies;
      for (let i = 0; i < resolution.enemyKills.length; i++) healed = onEnemyKilled(relics, healed);
      afterEnemies = { ...afterEnemies, hp: healed.hp };
      const gained = afterEnemies.hp - beforeHeal;
      if (gained > 0) turnLogs.push({ kind: 'heal', text: 'Bloodbond drew vigor from the slain', amount: gained });
    }

    const newGrid = resolveBoard(grid, chain, refillRng, seals);

    // Break any seals adjacent to the matched cells.
    if (seals.size) {
      const broken = sealsBrokenByChain(seals, chain);
      if (broken.length) {
        const nextSeals = new Set(seals);
        broken.forEach(k => nextSeals.delete(k));
        setSeals(nextSeals);
        turnLogs.push({ kind: 'info', text: broken.length > 1 ? `${broken.length} seals shattered` : 'A seal shattered' });
      }
    }

    // Spread corruption AFTER the chain resolves (player's turn ended).
    // On a bonus-move chain the turn does NOT end, so corruption holds too.
    if (corruptionActive && nextCorruption.sources.size && !grantsBonusMove) {
      nextCorruption = spreadCorruption(nextCorruption, rngTick, level.generation_seed, seals);
    }
    setCorruption(nextCorruption);

    setRngTick(t => t + 1);
    setGrid(newGrid);
    setCombat(afterEnemies);
    pushLogs(turnLogs);

    const status = checkObjective(afterEnemies, level.turn_limit, objType, level.objective_target, secondaryObjective);
    if (status.over) void finalize(afterEnemies, status.cleared);
  };

  const handleAbility = () => {
    const relics = activeRelicsSnapshot ?? activeRelics;
    // First Light: first N ability casts skip the mana cost. We restore the
    // mana after useAbility() consumes it so the cast still resolves normally.
    const isFreeCast = abilityFreeFirstUse(relics, abilityUsedCount);
    const manaBefore = combat.mana;
    const { next, ok } = useAbility(combat, hero.class, bossRule);
    if (!ok) {
      toast.info('Ability not ready — fill mana orbs first.');
      return;
    }
    const turnLogs: Array<Omit<CombatLogEntry, 'id'>> = [];
    const ABILITY_LABEL: Record<string, string> = {
      warrior: 'Cleave swept the battlefield',
      mage: 'Arcane bolt crashed home',
      rogue: 'Shadowstep — next strike doubled',
      cleric: 'Sanctuary mended you',
    };
    const dealt = next.totalDamage - combat.totalDamage;
    const killed = next.enemiesDefeated - combat.enemiesDefeated;
    const healed = Math.max(0, next.hp - combat.hp);
    // Track which archetypes died from this ability for the Bestiary.
    if (killed > 0) {
      const newlyDeadIds = next.enemies
        .filter(e => e.hp <= 0 && combat.enemies.find(o => o.id === e.id && o.hp > 0))
        .map(e => e.archetypeId)
        .filter((id): id is string => !!id);
      newlyDeadIds.forEach(recordKill);
    }
    turnLogs.push({
      kind: 'ability',
      text: ABILITY_LABEL[hero.class] ?? 'Ability unleashed',
      amount: dealt > 0 ? dealt : healed > 0 ? healed : undefined,
    });
    if (killed > 0) turnLogs.push({ kind: 'kill', text: killed > 1 ? `${killed} foes vanquished!` : 'A foe was vanquished!' });
    turnLogs.push({ kind: 'info', text: 'Free action — your turn continues.' });
    toast.success('✨ Ability — free action!', { duration: 1200 });

    // First Light: refund the mana that useAbility() just spent.
    const finalNext: CombatState = isFreeCast ? { ...next, mana: manaBefore } : next;
    if (isFreeCast) {
      turnLogs.push({ kind: 'info', text: '🌅 First Light — mana refunded' });
      toast.success('🌅 First Light — free!', { duration: 1100 });
    }
    setAbilityUsedCount(c => c + 1);

    // Abilities are now FREE actions: no enemy retaliation, no turn consumed,
    // no corruption spread. Player keeps their turn to chain again.
    setCombat(finalNext);
    pushLogs(turnLogs);
    const status = checkObjective(finalNext, level.turn_limit, objType, level.objective_target, secondaryObjective);
    if (status.over) void finalize(finalNext, status.cleared);
  };

  async function finalize(final: CombatState, cleared: boolean) {
    if (submitting || !level || !hero) return;
    setSubmitting(true);
    const turnsUsed = level.turn_limit - final.turnsRemaining;
    const relicsForFinal = activeRelicsSnapshot ?? activeRelics;
    const rawBreakdown = calculateScore({
      totalDamage: final.totalDamage,
      enemiesDefeated: final.enemiesDefeated,
      hpRemaining: final.hp,
      turnsRemaining: final.turnsRemaining,
      longestChain: final.longestChain,
      cleared,
      rogueBonus: final.rogueBonusTriggered && hero.class === 'rogue',
      secondaryBonus: cleared && secondaryObjective
        ? secondaryMet(secondaryObjective, final, level.turn_limit)
        : false,
    });
    // Momentum: scale final score when longest chain >= 4.
    const momentumMult = momentumScoreBonusMult(relicsForFinal, final.longestChain);
    const breakdown = momentumMult > 1
      ? { ...rawBreakdown, total: Math.round(rawBreakdown.total * momentumMult) }
      : rawBreakdown;
    const xp = xpForRun(breakdown.total, cleared);
    const reason: 'cleared' | 'defeated' | 'timeout' = cleared ? 'cleared' : final.hp <= 0 ? 'defeated' : 'timeout';
    const isNewBest = !existingRun || breakdown.total > (existingRun.score ?? 0);

    // ── Rune Shards reward ────────────────────────────────────────────────
    const compassEquipped = has(relicsForFinal, 'wanderers_compass');
    const compassMultiplier = compassShardBonus(relicsForFinal);
    const isFirstClear = cleared && (!existingRun || !existingRun.dungeon_cleared);
    const bossClear = cleared && level.level_number % 25 === 0;
    const totalEnemies = (level.enemy_config?.length ?? final.enemies.length) || 1;
    let shardsAwarded = 0;
    try {
      if (cleared) {
        const breakdownShards = computeClearShards({
          levelNumber: level.level_number,
          isFirstClear,
          bossClear,
          chapterCleared: false,
          compassEquipped,
          compassMultiplier,
        });
        shardsAwarded = breakdownShards.total;
      } else {
        const nextFailureCount = (failureRow?.failure_count ?? 0) + 1;
        const breakdownShards = computeFailureShards({
          levelNumber: level.level_number,
          failureCount: nextFailureCount,
          enemiesKilled: final.enemiesDefeated,
          totalEnemies,
          turnsUsed,
          turnLimit: level.turn_limit,
          bossPhaseReached: 0,
          bossHasRule: !!bossRule,
          compassEquipped,
          compassMultiplier,
        });
        shardsAwarded = breakdownShards.total;
      }
    } catch { shardsAwarded = 0; }
    setEndState({ cleared, reason, score: breakdown.total, isNewBest, shards: shardsAwarded });
    try {
      // Don't submit transient levels (admin hasn't seeded them yet).
      if (!level.id.startsWith('transient-')) {
        // Signal to the results page that a run was just submitted, so
        // useMyLevelRun knows to briefly retry instead of showing the
        // "No run yet" empty state if Postgrest hasn't caught up.
        try {
          sessionStorage.setItem(
            `rd-just-submitted-${level.level_number}`,
            String(Date.now()),
          );
        } catch { /* sessionStorage may be unavailable */ }
        await submit.mutateAsync({
          level_id: level.id,
          level_number: level.level_number,
          score: breakdown.total,
          enemies_defeated: final.enemiesDefeated,
          dungeon_cleared: cleared,
          turns_used: turnsUsed,
          total_damage: final.totalDamage,
          longest_chain: final.longestChain,
          hp_remaining: final.hp,
          xp_earned: xp,
          ability_used: final.abilityUsed,
          hero_class: hero.class,
        });
        if (cleared) await advance.mutateAsync(level.level_number);
      }
      // Hero progression — XP only on new best to keep grinding fair.
      if (isNewBest) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd');
        const continued = hero.last_run_date === yesterday;
        const newStreak = continued ? hero.current_streak + 1 : hero.last_run_date === today ? hero.current_streak : 1;

        // ── Per-class progression ──────────────────────────────────────
        // XP, level, and class title belong to the ACTIVE CLASS track only.
        // Other classes' saved progress is untouched.
        const activeTrack = classTracks?.find(t => t.class === hero.class);
        const prevClassXp = activeTrack?.xp ?? hero.xp;
        const prevClassLevel = activeTrack?.level ?? hero.level;
        const newClassXp = prevClassXp + xp;
        const newClassLevel = levelFromXp(newClassXp).level;
        const equippedClassTitle = titleForLevel(newClassLevel, hero.class) ?? activeTrack?.cosmetic_title ?? null;
        const titleUnlock = newTitleUnlocked(hero.class, prevClassLevel, newClassLevel);

        await updateClass.mutateAsync({
          cls: hero.class,
          patch: {
            xp: newClassXp,
            level: newClassLevel,
            cosmetic_title: equippedClassTitle,
            lifetime_runs: (activeTrack?.lifetime_runs ?? 0) + 1,
            lifetime_score: (activeTrack?.lifetime_score ?? 0) + breakdown.total,
          },
        });

        // Hero record holds persistent identity + global lifetime totals only.
        // Mirror the active class's level/xp/title so legacy leaderboard
        // queries that read from `rune_delve_heroes` still show the right
        // active-class snapshot.
        await updateHero.mutateAsync({
          xp: newClassXp,
          level: newClassLevel,
          cosmetic_title: equippedClassTitle,
          current_streak: newStreak,
          best_streak: Math.max(hero.best_streak, newStreak),
          lifetime_runs: hero.lifetime_runs + 1,
          lifetime_score: hero.lifetime_score + breakdown.total,
          last_run_date: today,
        } as any);

        if (titleUnlock) {
          toast.success(`✨ New Title Unlocked — ${titleUnlock.next}`, {
            description: titleUnlock.previous
              ? `From ${titleUnlock.previous} · ${hero.class} Lv ${newClassLevel}`
              : `Equipped at ${hero.class} Lv ${newClassLevel}`,
            duration: 6000,
          });
        }
      }

      // ── Award Rune Shards & track failure curve ─────────────────────────
      try {
        if (shardsAwarded > 0) await earnShards.mutateAsync(shardsAwarded);
        if (cleared) {
          await resetFailure.mutateAsync(level.level_number);
        } else {
          await bumpFailure.mutateAsync(level.level_number);
        }
        // Auto-unlock 3rd slot when ANY class hits L50.
        const tracks = classTracks ?? [];
        const maxClassLevel = Math.max(
          hero.level,
          ...tracks.map(t => t.level),
          isNewBest ? 1 : 0,
        );
        const desired = slotsForClassLevels(maxClassLevel);
        if ((wallet?.slots_unlocked ?? 2) < desired) {
          await unlockSlot.mutateAsync(desired);
          toast.success('🔓 3rd Relic Slot Unlocked!', { duration: 4500 });
        }
      } catch { /* shards are best-effort */ }

      // ── Bestiary: record defeats from this run ─────────────────────────
      try {
        const defeats = Array.from(defeatedArchetypesRef.current.entries()).map(
          ([archetypeId, count]) => ({ archetypeId, count, levelNumber: level.level_number }),
        );
        if (defeats.length > 0) {
          const { newlyDiscovered } = await recordDefeats.mutateAsync(defeats);
          if (newlyDiscovered.length > 0) {
            const allNames = newlyDiscovered.map(id => rosterById(id)?.name ?? 'Unknown');
            // Battle Chronicle: one discovery line per newly-logged foe so the
            // post-run log mirrors what the toast announces.
            pushLogs(allNames.map(name => ({
              kind: 'info' as const,
              text: `📖 Bestiary updated: ${name}`,
            })));
            const names = allNames.slice(0, 3);
            const more = newlyDiscovered.length - names.length;
            toast.success(
              newlyDiscovered.length === 1
                ? `📖 Bestiary: ${names[0]} discovered!`
                : `📖 Bestiary: ${names.join(', ')}${more > 0 ? ` +${more} more` : ''}`,
              { duration: 4000 },
            );
          }
        }
      } catch { /* bestiary write is best-effort */ }

      setTimeout(() => navigate(`/rune-delve/results/${level.level_number}`), 2500);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save run');
      setSubmitting(false);
      setEndState(null);
    }
  }

  const status = checkObjective(combat, level.turn_limit, objType, level.objective_target, secondaryObjective);
  const turnDisplay = Math.min(
    level.turn_limit,
    Math.max(1, level.turn_limit - combat.turnsRemaining + (status.over ? 0 : 1)),
  );

  const equippedCount = [loadout?.slot_1, loadout?.slot_2, loadout?.slot_3].filter(Boolean).length;

  return (
    <div className="space-y-2 pb-2 relative">
      {/* Compact combined HUD: turn counter + objective on a single row */}
      <div
        className="rd-carved rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ borderRadius: '0.75rem' }}
      >
        <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary px-1.5 py-0.5 rounded bg-primary/20 shrink-0">
          L{level.level_number}
        </span>
        <span className="text-[11px] font-extrabold tabular-nums text-foreground/95 shrink-0">
          T{turnDisplay}/{level.turn_limit}
        </span>
        <span className="h-3 w-px bg-foreground/15 shrink-0" />
        <span className="text-[11px] font-bold flex-1 min-w-0 truncate text-foreground/95">
          {objectiveLabel(objType)}
          {objType === 'reach_score' && (
            <span className="text-foreground/60"> · {level.objective_target.toLocaleString()}</span>
          )}
        </span>
        {existingRun && (
          <span className="text-[10px] font-mono font-extrabold tabular-nums text-foreground/70 shrink-0">
            ★{existingRun.score.toLocaleString()}
          </span>
        )}
        {equippedCount > 0 && (
          <Link
            to="/rune-delve/armory"
            aria-label={`${equippedCount} relics equipped`}
            className="inline-flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[10px] font-extrabold tabular-nums btn-press shrink-0"
            style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))' }}
          >
            🛡️{equippedCount}
          </Link>
        )}
        <button
          onClick={() => setHelpOpen(true)}
          aria-label="How to play"
          className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-foreground/70 hover:text-primary btn-press shrink-0"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Active mechanics strip — only when this level uses any mechanic */}
      {activeMechanics.length > 0 && <MechanicBanner mechanics={activeMechanics} />}

      {/* Layered Goals — secondary objective pill (Band 4). */}
      {secondaryObjective && (() => {
        const met = secondaryMet(secondaryObjective, combat, level.turn_limit);
        return (
          <div
            className="glass-card px-3 py-2 flex items-center gap-2"
            style={{ borderColor: met ? 'hsl(var(--primary) / 0.45)' : undefined }}
          >
            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: 'hsl(var(--accent) / 0.22)', color: 'hsl(var(--accent))', border: '1px solid hsl(var(--accent) / 0.35)' }}>
              <Target className="w-3 h-3" /> Bonus
            </span>
            <span className="text-[12px] font-extrabold flex-1 truncate text-foreground/95">{secondaryLabel(secondaryObjective)}</span>
            <span className={`text-[10px] font-extrabold tabular-nums ${met ? 'text-primary' : 'text-muted-foreground'}`}>
              {met ? '✓ Met' : secondaryShort(secondaryObjective)}
            </span>
          </div>
        );
      })()}

      {/* Boss-rule banner — Band 5 milestone levels. */}
      {bossRule && (
        <div
          className="glass-card px-3 py-2 flex items-start gap-2"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.14), hsl(var(--gold) / 0.08))',
            borderColor: 'hsl(var(--destructive) / 0.4)',
          }}
        >
          <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 mt-0.5"
            style={{ background: 'hsl(var(--destructive) / 0.2)', color: 'hsl(var(--destructive))' }}>
            <Crown className="w-3 h-3" /> {getBossRule(bossRule).label}
          </span>
          <span className="text-[11px] font-semibold flex-1 min-w-0 leading-snug">{getBossRule(bossRule).rule}</span>
        </div>
      )}
      <EnemyDisplay enemies={combat.enemies} flashId={flashId} />
      <HeroStatusBar state={combat} cls={hero.class} onAbility={handleAbility} />

      <RuneBoard
        grid={grid}
        disabled={status.over || submitting}
        onChainComplete={handleChain}
        seals={seals}
        corruptedCells={corruption.cells}
        corruptionSources={corruption.sources}
        effectOverride={{
          // Class-aware previews. Tier bonus shows when chain hits 6+.
          red: (n) => {
            const base = n * 8;
            const cls = hero.class === 'warrior' ? Math.round(base * 1.25) : base;
            const tier = n >= 8 ? 1.4 : n >= 7 ? 1.3 : n >= 6 ? 1.2 : 1;
            const total = Math.round(cls * tier);
            return tier > 1 ? `${total} dmg ⚡` : `${total} dmg`;
          },
          blue: (n) => {
            let mana = hero.class === 'mage' ? 2 : 1;
            if (n >= 5) mana += 1;
            return `+${mana} orb${mana > 1 ? 's' : ''}`;
          },
          green: (n) => {
            const base = n * 6;
            const heal = hero.class === 'cleric' ? Math.round(base * 1.5) : base;
            return `+${heal} HP`;
          },
        }}
      />

      {/* Compact single-line combat stats strip — keeps the board above the fold. */}
      <div
        className="flex items-center justify-around gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: 'hsl(var(--rd-stone-edge) / 0.6)',
          border: '1px solid hsl(var(--gold) / 0.12)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">DMG</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.totalDamage}</span>
        </div>
        <span className="h-3 w-px bg-foreground/25" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">KILLS</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.enemiesDefeated}</span>
        </div>
        <span className="h-3 w-px bg-foreground/25" />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/80">CHAIN</span>
          <span className="text-[12px] font-extrabold tabular-nums text-foreground">{combat.longestChain}</span>
        </div>
      </div>

      {/* Animated battle chronicle — turn-by-turn flavor feed. */}
      <CombatLog entries={log} />

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />

      {/* One-time intro for a brand-new mechanic taught at this level. */}
      {introMechanic && (
        <MechanicIntroSheet
          open={!!introMechanic}
          onOpenChange={(o) => { if (!o) setIntroMechanic(null); }}
          mechanicId={introMechanic}
          levelNumber={level.level_number}
          onBegin={() => {
            try { localStorage.setItem(seenMechanicKey(introMechanic), '1'); } catch {}
            setIntroMechanic(null);
          }}
        />
      )}

      {endState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-background/70 animate-in fade-in"
          // Don't allow tap-outside to navigate while the run is still being saved —
          // prevents an orphaned in-flight write and a missed leaderboard update.
          onClick={() => { if (!submitting) navigate(`/rune-delve/results/${level.level_number}`); }}
        >
          <div className="glass-card p-6 max-w-sm w-full text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center">
              {endState.reason === 'cleared' && <Trophy className="w-12 h-12" style={{ color: 'hsl(var(--gold))' }} />}
              {endState.reason === 'defeated' && <Skull className="w-12 h-12 text-destructive" />}
              {endState.reason === 'timeout' && <Hourglass className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {endState.reason === 'cleared' && `Level ${level.level_number} Cleared!`}
                {endState.reason === 'defeated' && 'Defeated'}
                {endState.reason === 'timeout' && 'Out of Turns'}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {endState.reason === 'cleared' && (endState.isNewBest ? 'New best score!' : 'Run complete.')}
                {endState.reason === 'defeated' && 'Your hero fell in battle.'}
                {endState.reason === 'timeout' && 'Try a different chain strategy.'}
              </p>
            </div>
            <div className="py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final Score</p>
              <p className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                {endState.score.toLocaleString()}
              </p>
              {endState.shards > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold"
                  style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                  💠 +{endState.shards} Rune Shards
                </div>
              )}
            </div>
            <button
              onClick={() => navigate(`/rune-delve/results/${level.level_number}`)}
              className="w-full h-11 rounded-xl font-extrabold text-sm btn-press"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                color: 'white',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              View Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Objective-aware end check. Layered goals (Band 4) require BOTH primary and
// secondary to be satisfied for a clear; primary failure is still a fail.
function checkObjective(
  state: CombatState,
  maxTurns: number,
  type: ObjectiveType,
  target: number,
  secondary: SecondaryObjective | null,
) {
  const wrap = (r: { over: boolean; cleared: boolean }) => {
    if (!r.over || !r.cleared || !secondary) return r;
    return { over: true, cleared: secondaryMet(secondary, state, maxTurns) };
  };
  const base = isRunOver(state);
  if (type === 'survive') {
    // Defeat is defeat (HP gone). Surviving the full turn budget = clear.
    // ALSO: if the player happens to wipe every enemy, that's a clear too —
    // otherwise the run drags on with nothing to do.
    if (state.hp <= 0) return { over: true, cleared: false };
    if (state.enemies.every(e => e.hp <= 0)) return wrap({ over: true, cleared: true });
    if (state.turnsRemaining <= 0) return wrap({ over: true, cleared: true });
    return { over: false, cleared: false };
  }
  if (type === 'reach_score') {
    // Use the same shape as calculateScore (without clear/secondary/rogue
    // bonuses, which only apply at finalize time). Keeps the in-play check
    // honest with the score the player actually sees on the results screen.
    const liveScore =
      state.totalDamage +
      state.enemiesDefeated * 200 +
      Math.max(0, state.hp) * 5 +
      Math.max(0, state.turnsRemaining) * 50 +
      state.longestChain * 25;
    if (liveScore >= target) {
      return wrap({ over: true, cleared: true });
    }
    return wrap(base);
  }
  return wrap(base);
}
