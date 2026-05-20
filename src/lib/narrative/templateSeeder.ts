// DH Club — Narrative RPG · Template world seeder
//
// PERSISTENCE BOUNDARY: a campaign's playable world state must live in
// per-campaign DB rows, NOT in client-side template arrays. Otherwise
// the World tab would be empty after refresh, the GM couldn't edit
// starter content, and AI tools would see no context.
//
// This seeder instantiates a template's starter NPCs, locations,
// factions, clues, clocks, and opening scene into the target
// campaign's own DB rows. After creation, the campaign references its
// own rows — never the template arrays.
//
// The seeder is IDEMPOTENT by design:
//   • Existence is checked by `(campaign_id, name)` per table — so
//     re-running the seeder never duplicates starter content.
//   • Already-seeded campaigns can call the repair function safely;
//     missing rows get filled in, existing rows stay untouched.
//   • GM edits to starter content are preserved — we only INSERT new
//     rows that don't exist; we never UPDATE existing ones.
//
// Usage:
//   • createCampaign → seedCampaignFromTemplate(id, key) — called
//     once on creation. Toasts on partial failure but does not unwind
//     the campaign creation.
//   • detail page load → ensureCampaignWorldSeeded(id, key) — called
//     on every load by the GM/admin. No-op when the campaign is
//     already seeded. Backfills older Flamingo campaigns that were
//     created before this pass landed.
//
// IMPORTANT: seeding writes go through the same RLS-gated tables as
// regular GM mutations. The caller must be the GM, creator, or club
// admin or the writes will be rejected by Postgres. The detail page
// gates the call accordingly.

import { supabase } from '@/integrations/supabase/client';
import { getTemplate, type TemplateKey } from './templates';

export interface SeedReport {
  /** True if anything was inserted. False = already seeded, no-op. */
  changed: boolean;
  /** Per-category counts of newly-inserted rows. Existing rows skipped. */
  inserted: {
    locations: number;
    npcs: number;
    factions: number;
    clues: number;
    clocks: number;
    scenes: number;
  };
  /** Non-fatal errors per row — collected so the caller can surface
   *  a single "partial seed" toast instead of one toast per failure. */
  errors: string[];
}

const EMPTY_REPORT: SeedReport = {
  changed: false,
  inserted: { locations: 0, npcs: 0, factions: 0, clues: 0, clocks: 0, scenes: 0 },
  errors: [],
};

interface SeedOptions {
  /** When true, also instantiate starter NPCs / locations / factions /
   *  clues / clocks / opening scene as campaign rows. When false (the
   *  default — set by createCampaign), only the campaign-level metadata
   *  (tone_profile + canon_locks) is written. GMs explicitly opt into
   *  the starter-asset pack via the onboarding modal so they get a
   *  blank world to populate as they go.
   *
   *  Auto-repair on detail-page load passes this as false too — we
   *  don't want to surprise an existing campaign by inserting 28 new
   *  rows on next refresh. */
  includeStarterAssets?: boolean;
}

/**
 * Seeds a campaign's world from its template. Safe to call multiple
 * times — only inserts rows that don't already exist (matched by
 * `(campaign_id, name)`). Also writes the template's tone_profile and
 * canon_locks back to the campaign row if those are currently empty.
 *
 * Default behavior writes ONLY the campaign metadata (tone_profile +
 * canon_locks) so the campaign is a blank slate for the GM. Pass
 * `includeStarterAssets: true` to also instantiate the 28 starter
 * Flamingo entities — usually triggered from the GM onboarding modal.
 */
export async function seedCampaignFromTemplate(
  campaignId: string,
  templateKey: TemplateKey | string | null | undefined,
  options: SeedOptions = {},
): Promise<SeedReport> {
  const { includeStarterAssets = false } = options;
  const template = getTemplate(templateKey);
  // Blank campaigns have no starter content — short-circuit so we
  // don't run pointless SELECT queries on every detail page load.
  if (!template.starterNpcs?.length
      && !template.starterLocations?.length
      && !template.starterFactions?.length
      && !template.starterClues?.length
      && !template.starterClocks?.length
      && !template.starterScene) {
    return EMPTY_REPORT;
  }

  const sb = supabase as any;
  const report: SeedReport = {
    changed: false,
    inserted: { locations: 0, npcs: 0, factions: 0, clues: 0, clocks: 0, scenes: 0 },
    errors: [],
  };

  // When the caller hasn't opted into starter assets, skip the
  // existence pre-fetches entirely — we only need them for the asset
  // inserts below.
  let seenLoc = new Set<string>();
  let seenNpc = new Set<string>();
  let seenFaction = new Set<string>();
  let seenClue = new Set<string>();
  let seenClock = new Set<string>();
  let seenSceneTit = new Set<string>();

  if (includeStarterAssets) {
    const [
      { data: existingLocs },
      { data: existingNpcs },
      { data: existingFactions },
      { data: existingClues },
      { data: existingClocks },
      { data: existingScenes },
    ] = await Promise.all([
      sb.from('narrative_locations').select('name').eq('campaign_id', campaignId),
      sb.from('narrative_npcs').select('name').eq('campaign_id', campaignId),
      sb.from('narrative_factions').select('name').eq('campaign_id', campaignId),
      sb.from('narrative_clues').select('name').eq('campaign_id', campaignId),
      sb.from('narrative_clocks').select('name').eq('campaign_id', campaignId),
      sb.from('narrative_scenes').select('title').eq('campaign_id', campaignId),
    ]);
    seenLoc      = new Set((existingLocs ?? []).map((r: any) => r.name));
    seenNpc      = new Set((existingNpcs ?? []).map((r: any) => r.name));
    seenFaction  = new Set((existingFactions ?? []).map((r: any) => r.name));
    seenClue     = new Set((existingClues ?? []).map((r: any) => r.name));
    seenClock    = new Set((existingClocks ?? []).map((r: any) => r.name));
    seenSceneTit = new Set((existingScenes ?? []).map((r: any) => r.title));
  }

  // Helper: insert each missing row sequentially. We do NOT batch
  // because the per-row error surface is more useful than a single
  // all-or-nothing failure.
  const insertOne = async (
    table: string,
    payload: Record<string, unknown>,
    category: keyof SeedReport['inserted'],
    label: string,
  ) => {
    const { error } = await sb.from(table).insert(payload);
    if (error) {
      report.errors.push(`${table} "${label}": ${error.message}`);
      return;
    }
    report.inserted[category] += 1;
    report.changed = true;
  };

  // ─── Locations / NPCs / Factions / Clues / Clocks / Opening scene
  // ─── (gated on opt-in) ─────────────────────────────────────────
  if (includeStarterAssets) {
  for (const loc of template.starterLocations ?? []) {
    if (seenLoc.has(loc.name)) continue;
    await insertOne('narrative_locations', {
      campaign_id: campaignId,
      name: loc.name,
      description: loc.description ?? null,
      region: loc.region ?? null,
      visibility: loc.visibility,
    }, 'locations', loc.name);
  }

  // ─── NPCs
  for (const npc of template.starterNpcs ?? []) {
    if (seenNpc.has(npc.name)) continue;
    await insertOne('narrative_npcs', {
      campaign_id: campaignId,
      name: npc.name,
      role: npc.role ?? null,
      description: npc.description ?? null,
      visibility: npc.visibility,
      motives: npc.motives ?? null,
      secrets: npc.secrets ?? null,
      voice_notes: npc.voice_notes ?? null,
    }, 'npcs', npc.name);
  }

  // ─── Factions
  for (const fac of template.starterFactions ?? []) {
    if (seenFaction.has(fac.name)) continue;
    await insertOne('narrative_factions', {
      campaign_id: campaignId,
      name: fac.name,
      description: fac.description ?? null,
      attitude: fac.attitude ?? null,
      relationship_score: fac.relationship_score ?? 0,
      suspicion_score: fac.suspicion_score ?? 0,
      visibility: fac.visibility,
      public_notes: fac.public_notes ?? null,
      gm_notes: fac.gm_notes ?? null,
    }, 'factions', fac.name);
  }

  // ─── Clues
  for (const clue of template.starterClues ?? []) {
    if (seenClue.has(clue.name)) continue;
    await insertOne('narrative_clues', {
      campaign_id: campaignId,
      name: clue.name,
      description: clue.description ?? null,
      visibility: clue.visibility,
      importance: clue.importance,
      status: clue.status,
    }, 'clues', clue.name);
  }

  // ─── Clocks
  for (const clk of template.starterClocks ?? []) {
    if (seenClock.has(clk.name)) continue;
    await insertOne('narrative_clocks', {
      campaign_id: campaignId,
      name: clk.name,
      description: clk.description ?? null,
      current_value: clk.current_value,
      max_value: clk.max_value,
      clock_type: clk.clock_type,
      visibility: clk.visibility,
    }, 'clocks', clk.name);
  }

  // ─── Opening scene — only inserted if no scenes exist at all.
  // We don't want to add a duplicate "After-hours at the Pink Sand"
  // when the GM has already started Act II.
  if (template.starterScene && !seenSceneTit.has(template.starterScene.title) && seenSceneTit.size === 0) {
    const { data: scene, error: sceneErr } = await sb
      .from('narrative_scenes')
      .insert({
        campaign_id: campaignId,
        title: template.starterScene.title,
        location: template.starterScene.location ?? null,
        stakes: template.starterScene.stakes ?? null,
        objective: template.starterScene.objective ?? null,
        public_notes: template.starterScene.public_notes ?? null,
        gm_notes: template.starterScene.gm_notes ?? null,
        status: 'active',
        position: 0,
      })
      .select('id')
      .single();
    if (sceneErr) {
      report.errors.push(`narrative_scenes "${template.starterScene.title}": ${sceneErr.message}`);
    } else {
      report.inserted.scenes += 1;
      report.changed = true;
      // Point the campaign at the new starter scene (only if it
      // doesn't already have a current_scene_id).
      await sb.from('narrative_campaigns')
        .update({ current_scene_id: scene.id })
        .eq('id', campaignId)
        .is('current_scene_id', null);
    }
  }

  } // ← end of starter-asset opt-in guard

  // ─── Tone profile + canon_locks: write back to the campaign row
  // only when those fields are still empty so we never overwrite a
  // GM's customization. Always runs regardless of the opt-in flag
  // because tone + canon are setting metadata, not playable assets.
  const { data: campRow } = await sb
    .from('narrative_campaigns')
    .select('tone_profile, canon_locks')
    .eq('id', campaignId)
    .maybeSingle();
  const patch: Record<string, unknown> = {};
  if (campRow && !campRow.tone_profile && template.toneProfile) {
    patch.tone_profile = template.toneProfile;
  }
  if (campRow && (!Array.isArray(campRow.canon_locks) || campRow.canon_locks.length === 0) && template.canonLocks?.length) {
    patch.canon_locks = template.canonLocks;
  }
  if (Object.keys(patch).length > 0) {
    const { error: patchErr } = await sb.from('narrative_campaigns').update(patch).eq('id', campaignId);
    if (patchErr) {
      report.errors.push(`narrative_campaigns tone/canon: ${patchErr.message}`);
    } else {
      report.changed = true;
    }
  }

  return report;
}

/**
 * Wrapper that swallows any uncaught errors and converts them to
 * report-level errors. Use this from non-critical paths (e.g. detail
 * page auto-repair) so a network blip never crashes the page.
 */
export async function ensureCampaignWorldSeeded(
  campaignId: string,
  templateKey: TemplateKey | string | null | undefined,
  options: SeedOptions = {},
): Promise<SeedReport> {
  try {
    return await seedCampaignFromTemplate(campaignId, templateKey, options);
  } catch (e) {
    return {
      changed: false,
      inserted: { locations: 0, npcs: 0, factions: 0, clues: 0, clocks: 0, scenes: 0 },
      errors: [(e as Error).message ?? 'seed failed'],
    };
  }
}
