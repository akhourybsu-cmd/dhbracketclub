// One-shot backfill: credits historical mini-boss / boss kills to variant
// archetype ids in `rune_delve_bestiary` so the journal retroactively shows
// the gold-ringed slots players already earned. Idempotent — re-running it
// recomputes counts from scratch and upserts.
//
// Scan: every cleared `rune_delve_runs` row whose level is a boss tier.
// Credit: one defeat on `<base>__mini` (mini) or `<base>__boss` (mid + chapter).
// Base archetype: deterministic — replays the level generator's seed + pool
// filter + picker just enough to identify the FINAL slot's roster id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Mirrored deterministic helpers from src/lib/runedelve ──────────────────
type BossKind = 'mini' | 'mid' | 'chapter' | null;
const LEGACY_MILESTONES: Record<number, true> = { 130: true, 140: true };
function bossKindForLevel(level: number): BossKind {
  if (level <= 0) return null;
  if (LEGACY_MILESTONES[level]) return 'chapter';
  if (level === 50 || level === 100 || level === 150) return 'chapter';
  if (level === 25 || level === 75 || level === 125) return 'mid';
  if (level % 10 === 0) return 'mini';
  return null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}
function seedFor(level: number): number {
  let h = level | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}
function enemyCountFor(level: number, rng: () => number): number {
  if (level <= 15) return 2;
  if (level <= 22) return rng() < 0.6 ? 2 : 3;
  if (level <= 30) return rng() < 0.35 ? 2 : 3;
  if (level <= 75) return 3;
  return 3 + rngInt(rng, 2);
}

// Roster (id + chapter + tier + baseDamage + ability flag) — only the fields
// the picker reads. Kept in sync with src/lib/runedelve/enemyRoster.ts.
type RosterEntry = { id: string; chapter: 1 | 2 | 3; tier: number; baseDamage: number; ability?: boolean };
const ROSTER: RosterEntry[] = [
  // Chapter 1
  { id: 'cave_bat', chapter: 1, tier: 1, baseDamage: 4 },
  { id: 'goblin_scout', chapter: 1, tier: 1, baseDamage: 5 },
  { id: 'ember_slime', chapter: 1, tier: 1, baseDamage: 3 },
  { id: 'shadow_imp', chapter: 1, tier: 2, baseDamage: 7 },
  { id: 'crystal_spider', chapter: 1, tier: 2, baseDamage: 5 },
  { id: 'ember_rat', chapter: 1, tier: 1, baseDamage: 4 },
  { id: 'tunnel_kobold', chapter: 1, tier: 1, baseDamage: 6 },
  { id: 'cave_lizard', chapter: 1, tier: 1, baseDamage: 5 },
  { id: 'mossback_toad', chapter: 1, tier: 2, baseDamage: 3 },
  { id: 'lantern_moth', chapter: 1, tier: 1, baseDamage: 4 },
  { id: 'goblin_brute', chapter: 1, tier: 2, baseDamage: 5 },
  { id: 'cave_crab', chapter: 1, tier: 2, baseDamage: 4 },
  { id: 'ember_pup', chapter: 1, tier: 2, baseDamage: 7 },
  { id: 'dust_wisp', chapter: 1, tier: 1, baseDamage: 3 },
  { id: 'feral_imp', chapter: 1, tier: 2, baseDamage: 7 },
  // Chapter 2
  { id: 'skeleton_warrior', chapter: 2, tier: 2, baseDamage: 7 },
  { id: 'rune_wraith', chapter: 2, tier: 3, baseDamage: 6, ability: true },
  { id: 'frost_revenant', chapter: 2, tier: 3, baseDamage: 7 },
  { id: 'cult_warden', chapter: 2, tier: 3, baseDamage: 4, ability: true },
  { id: 'cult_chanter', chapter: 2, tier: 3, baseDamage: 4, ability: true },
  { id: 'stone_golem', chapter: 2, tier: 4, baseDamage: 8 },
  { id: 'frost_acolyte', chapter: 2, tier: 3, baseDamage: 7 },
  { id: 'bone_archer', chapter: 2, tier: 3, baseDamage: 9 },
  { id: 'crystal_construct', chapter: 2, tier: 4, baseDamage: 7 },
  { id: 'glacial_imp', chapter: 2, tier: 3, baseDamage: 8 },
  { id: 'cult_seer', chapter: 2, tier: 3, baseDamage: 4, ability: true },
  { id: 'revenant_thrall', chapter: 2, tier: 2, baseDamage: 5 },
  { id: 'hollow_shrieker', chapter: 2, tier: 3, baseDamage: 4, ability: true },
  { id: 'quartz_serpent', chapter: 2, tier: 4, baseDamage: 9 },
  { id: 'frost_warden', chapter: 2, tier: 4, baseDamage: 7, ability: true },
  { id: 'whisper_witch', chapter: 2, tier: 4, baseDamage: 6, ability: true },
  // Chapter 3
  { id: 'cursed_knight', chapter: 3, tier: 4, baseDamage: 9, ability: true },
  { id: 'voidspawn', chapter: 3, tier: 4, baseDamage: 8, ability: true },
  { id: 'bone_summoner', chapter: 3, tier: 4, baseDamage: 5, ability: true },
  { id: 'shadow_assassin', chapter: 3, tier: 4, baseDamage: 12 },
  { id: 'arcane_caster', chapter: 3, tier: 5, baseDamage: 9, ability: true },
  { id: 'ancient_drake', chapter: 3, tier: 5, baseDamage: 12 },
  { id: 'void_acolyte', chapter: 3, tier: 4, baseDamage: 9 },
  { id: 'wraith_lord', chapter: 3, tier: 5, baseDamage: 8, ability: true },
  { id: 'sundered_titan', chapter: 3, tier: 5, baseDamage: 8 },
  { id: 'void_stalker', chapter: 3, tier: 5, baseDamage: 13 },
  { id: 'dread_summoner', chapter: 3, tier: 5, baseDamage: 6, ability: true },
  { id: 'arcane_warden', chapter: 3, tier: 4, baseDamage: 7, ability: true },
  { id: 'bone_juggernaut', chapter: 3, tier: 5, baseDamage: 9 },
  { id: 'void_seer', chapter: 3, tier: 4, baseDamage: 5, ability: true },
  { id: 'gloom_wisp', chapter: 3, tier: 4, baseDamage: 6 },
  { id: 'vault_revenant', chapter: 3, tier: 5, baseDamage: 11 },
];

function chapterCapForLevel(level: number): 1 | 2 | 3 {
  return level <= 50 ? 1 : level <= 100 ? 2 : 3;
}
function maxTierForLevel(level: number): number {
  return Math.min(5, 1 + Math.floor(level / 8));
}
function rosterPool(level: number): RosterEntry[] {
  const c = chapterCapForLevel(level);
  const t = maxTierForLevel(level);
  return ROSTER.filter(e => e.chapter <= c && e.tier <= t);
}
function rosterPoolNextChapter(level: number): RosterEntry[] {
  const c = Math.min(3, chapterCapForLevel(level) + 1) as 1 | 2 | 3;
  const t = maxTierForLevel(level);
  return ROSTER.filter(e => e.chapter <= c && e.tier <= t);
}

function pickTemplate(level: number, rng: () => number): RosterEntry {
  const useNext = level >= 36 && level <= 50 && rng() < 0.25;
  let pool = useNext ? rosterPoolNextChapter(level) : rosterPool(level);
  if (level <= 30) pool = pool.filter(e => !e.ability);
  if (level <= 15) {
    const soft = pool.filter(e => e.baseDamage <= 6);
    if (soft.length && rng() < 0.7) pool = soft;
  }
  if (pool.length === 0) pool = rosterPool(Math.max(1, level));
  return pool[rngInt(rng, pool.length)];
}

// Replays the generator's RNG sequence enough to identify the boss archetype
// for a given level. Mirrors `generateLevel()` exactly through the picker
// loop — secondary objectives + waves don't change roll order beyond it.
function bossArchetypeForLevel(level: number): { archetypeId: string; variant: 'mini' | 'boss' } | null {
  const kind = bossKindForLevel(level);
  if (!kind) return null;
  const seed = seedFor(level);
  const rng = mulberry32(seed);
  const enemyCount = enemyCountFor(level, rng);
  const isChapter = kind === 'chapter';
  const wave1Count = isChapter ? 2 : enemyCount;

  let bossPick: RosterEntry | null = null;
  for (let i = 0; i < wave1Count; i++) {
    const t = pickTemplate(level, rng);
    if (!isChapter && i === wave1Count - 1) bossPick = t;
  }
  if (isChapter) {
    // Chapter boss spawns in wave 2 — single dramatic pick (one more roll).
    bossPick = pickTemplate(level, rng);
  }
  if (!bossPick) return null;
  return {
    archetypeId: bossPick.id,
    variant: kind === 'mini' ? 'mini' : 'boss',
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Page through cleared runs (Supabase default 1000-row cap).
    type Run = { user_id: string; level_number: number | null; completed_at: string | null };
    const all: Run[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('rune_delve_runs')
        .select('user_id, level_number, completed_at')
        .eq('dungeon_cleared', true)
        .not('level_number', 'is', null)
        .order('completed_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as Run[];
      all.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    // Aggregate per (user_id, variantId).
    type Agg = { count: number; first: string; last: string; highest: number };
    const ledger = new Map<string, Map<string, Agg>>();
    for (const r of all) {
      if (r.level_number == null) continue;
      const boss = bossArchetypeForLevel(r.level_number);
      if (!boss) continue;
      const variantId = `${boss.archetypeId}__${boss.variant}`;
      const ts = r.completed_at ?? new Date().toISOString();
      let perUser = ledger.get(r.user_id);
      if (!perUser) { perUser = new Map(); ledger.set(r.user_id, perUser); }
      const prev = perUser.get(variantId);
      if (!prev) {
        perUser.set(variantId, { count: 1, first: ts, last: ts, highest: r.level_number });
      } else {
        prev.count += 1;
        if (ts < prev.first) prev.first = ts;
        if (ts > prev.last) prev.last = ts;
        if (r.level_number > prev.highest) prev.highest = r.level_number;
      }
    }

    // Upsert. We OVERWRITE counts to the recomputed total — idempotent.
    let upserts = 0;
    for (const [userId, byVariant] of ledger.entries()) {
      const rows = Array.from(byVariant.entries()).map(([archetype_id, a]) => ({
        user_id: userId,
        archetype_id,
        defeat_count: a.count,
        first_defeated_at: a.first,
        last_defeated_at: a.last,
        highest_level_defeated: a.highest,
      }));
      const { error } = await supabase
        .from('rune_delve_bestiary')
        .upsert(rows, { onConflict: 'user_id,archetype_id' });
      if (error) throw error;
      upserts += rows.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      runs_scanned: all.length,
      players_credited: ledger.size,
      variant_rows_upserted: upserts,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
