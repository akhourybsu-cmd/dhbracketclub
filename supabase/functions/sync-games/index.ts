import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ───────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

type SyncAction =
  | "syncTournamentMetadata"
  | "syncGames"
  | "syncGameResults"
  | "recalculateStandings"
  | "runFullSync";

interface SyncRequest {
  action: SyncAction;
  tournamentId: string;
  providerName?: string;
  poolId?: string; // optional: scope recalculation to one pool
}

interface NormalizedTeam {
  externalTeamId: string;
  schoolName: string;
  shortName: string;
  seed: number;
  region: string;
}

interface NormalizedGame {
  externalGameId: string;
  roundNumber: number;
  roundName: string;
  region: string;
  gameSlot: number;
  team1ExternalId?: string | null;
  team2ExternalId?: string | null;
  team1Score?: number | null;
  team2Score?: number | null;
  winnerExternalId?: string | null;
  status: "scheduled" | "in_progress" | "final";
  isResultFinal?: boolean;
  liveClock?: string | null;
  livePeriod?: string | null;
  scheduledAt?: string | null;
  sourceLastUpdatedAt?: string | null;
  sourcePayload?: Record<string, unknown> | null;
}

interface ProviderConfig {
  providerName: string;
  enabled: boolean;
  baseUrl: string | null;
  sport: string;
  tournamentScope: string;
}

interface ProviderResult {
  teams: NormalizedTeam[];
  games: NormalizedGame[];
  tournamentMeta?: { name?: string; status?: string; externalSeasonId?: string };
  metadata: { provider: string; fetchedAt: string; rawCount: number };
}

// ═══════════════════════════════════════════════════════════════════
//  PROVIDER ADAPTER INTERFACE + REGISTRY
// ═══════════════════════════════════════════════════════════════════

interface SportDataProvider {
  name: string;
  fetchTeams(tournamentId: string, config: ProviderConfig): Promise<NormalizedTeam[]>;
  fetchGames(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]>;
  fetchResults(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]>;
  fetchTournamentMeta?(
    tournamentId: string,
    config: ProviderConfig
  ): Promise<{ name?: string; status?: string; externalSeasonId?: string }>;
}

// ─── Stub provider (scaffold — replace internals with real API) ────
const stubProvider: SportDataProvider = {
  name: "stub",
  async fetchTeams() {
    // Real impl: const key = Deno.env.get("SPORTS_API_KEY");
    //            const res = await fetch(`${config.baseUrl}/teams`, { headers: {...} });
    return [];
  },
  async fetchGames() {
    return [];
  },
  async fetchResults() {
    return [];
  },
  async fetchTournamentMeta() {
    return { status: "in_progress" };
  },
};

const PROVIDER_REGISTRY: Record<string, SportDataProvider> = {
  stub: stubProvider,
};

// ═══════════════════════════════════════════════════════════════════
//  NORMALIZATION & RECONCILIATION
// ═══════════════════════════════════════════════════════════════════

/** Normalize team name for fuzzy matching */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")        // strip non-alphanumeric
    .replace(/university|univ|st\b/g, "") // common abbreviations
    .trim();
}

/** Validate and sanitize a normalized game */
function validateGame(g: NormalizedGame): NormalizedGame {
  const validStatuses = ["scheduled", "in_progress", "final"];
  const status = validStatuses.includes(g.status) ? g.status : "scheduled";
  return {
    ...g,
    status: status as NormalizedGame["status"],
    team1Score: g.team1Score ?? null,
    team2Score: g.team2Score ?? null,
    // Only set winner when truly final
    winnerExternalId: status === "final" ? (g.winnerExternalId ?? null) : null,
    isResultFinal: status === "final" && g.isResultFinal !== false,
    liveClock: status === "in_progress" ? (g.liveClock ?? null) : null,
    livePeriod: status === "in_progress" ? (g.livePeriod ?? null) : null,
  };
}

/**
 * Resolve an internal game ID for an external game.
 * Strategy:
 *   1. Lookup explicit mapping in game_external_mappings
 *   2. Fallback: deterministic match by (tournament, round, region, slot)
 *   3. Fallback: match by (tournament, round, region, participating teams)
 */
async function resolveGameId(
  db: SupabaseClient,
  tournamentId: string,
  providerName: string,
  ng: NormalizedGame,
  teamLookup: Map<string, string> // externalTeamId → internal team id
): Promise<{ gameId: string | null; matchMethod: string }> {
  // 1. Explicit mapping
  const { data: mapping } = await db
    .from("game_external_mappings")
    .select("game_id")
    .eq("provider_name", providerName)
    .eq("external_game_id", ng.externalGameId)
    .maybeSingle();

  if (mapping) return { gameId: mapping.game_id, matchMethod: "explicit_mapping" };

  // 2. Deterministic: round + region + slot
  const { data: slotMatch } = await db
    .from("games")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("round_number", ng.roundNumber)
    .eq("region", ng.region)
    .eq("game_slot", ng.gameSlot)
    .maybeSingle();

  if (slotMatch) {
    // Auto-create mapping for future syncs
    await db.from("game_external_mappings").upsert(
      {
        tournament_id: tournamentId,
        game_id: slotMatch.id,
        provider_name: providerName,
        external_game_id: ng.externalGameId,
        external_round_name: ng.roundName,
        external_region: ng.region,
      },
      { onConflict: "provider_name,external_game_id" }
    );
    return { gameId: slotMatch.id, matchMethod: "round_region_slot" };
  }

  // 3. Fallback: match by participating teams
  const t1Internal = ng.team1ExternalId ? teamLookup.get(ng.team1ExternalId) : null;
  const t2Internal = ng.team2ExternalId ? teamLookup.get(ng.team2ExternalId) : null;

  if (t1Internal && t2Internal) {
    const { data: teamMatch } = await db
      .from("games")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round_number", ng.roundNumber)
      .or(`and(team1_id.eq.${t1Internal},team2_id.eq.${t2Internal}),and(team1_id.eq.${t2Internal},team2_id.eq.${t1Internal})`)
      .maybeSingle();

    if (teamMatch) {
      await db.from("game_external_mappings").upsert(
        {
          tournament_id: tournamentId,
          game_id: teamMatch.id,
          provider_name: providerName,
          external_game_id: ng.externalGameId,
          external_round_name: ng.roundName,
          external_region: ng.region,
        },
        { onConflict: "provider_name,external_game_id" }
      );
      return { gameId: teamMatch.id, matchMethod: "team_match" };
    }
  }

  return { gameId: null, matchMethod: "unmatched" };
}

/**
 * Resolve an external team ID to an internal team ID.
 * Uses fuzzy name matching as fallback.
 */
async function buildTeamLookup(
  db: SupabaseClient,
  tournamentId: string,
  externalTeams: NormalizedTeam[]
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>(); // externalId → internalId

  const { data: internalTeams } = await db
    .from("teams")
    .select("id, school_name, short_name, seed, region")
    .eq("tournament_id", tournamentId);

  if (!internalTeams || internalTeams.length === 0) return lookup;

  // Build normalized index of internal teams
  const internalIndex = internalTeams.map((t) => ({
    ...t,
    normalizedSchool: normalizeTeamName(t.school_name),
    normalizedShort: normalizeTeamName(t.short_name),
  }));

  for (const ext of externalTeams) {
    // Try exact seed+region match first (most reliable for March Madness)
    const seedRegionMatch = internalIndex.find(
      (t) => t.seed === ext.seed && t.region.toLowerCase() === ext.region.toLowerCase()
    );
    if (seedRegionMatch) {
      lookup.set(ext.externalTeamId, seedRegionMatch.id);
      continue;
    }

    // Fuzzy name match
    const normExt = normalizeTeamName(ext.schoolName);
    const normExtShort = normalizeTeamName(ext.shortName);
    const nameMatch = internalIndex.find(
      (t) =>
        t.normalizedSchool === normExt ||
        t.normalizedShort === normExtShort ||
        t.normalizedSchool === normExtShort ||
        t.normalizedShort === normExt
    );
    if (nameMatch) {
      lookup.set(ext.externalTeamId, nameMatch.id);
    }
  }

  return lookup;
}

// ═══════════════════════════════════════════════════════════════════
//  SYNC EVENT LOGGER
// ═══════════════════════════════════════════════════════════════════

async function logSyncEvent(
  db: SupabaseClient,
  syncRunId: string,
  entityType: string,
  entityId: string | null,
  eventType: string,
  status: string,
  details?: Record<string, unknown>
) {
  await db.from("sync_events").insert({
    sync_run_id: syncRunId,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    status,
    details: details || null,
  });
}

// ═══════════════════════════════════════════════════════════════════
//  ACTION: syncTournamentMetadata
// ═══════════════════════════════════════════════════════════════════

async function syncTournamentMetadata(
  db: SupabaseClient,
  provider: SportDataProvider,
  config: ProviderConfig,
  tournamentId: string,
  syncRunId: string
) {
  if (!provider.fetchTournamentMeta) {
    await logSyncEvent(db, syncRunId, "tournament", tournamentId, "skip", "success", {
      reason: "provider does not support tournament metadata",
    });
    return { updated: false };
  }

  const meta = await provider.fetchTournamentMeta(tournamentId, config);

  const updatePayload: Record<string, unknown> = {};
  if (meta.status) updatePayload.sync_status = meta.status;
  if (meta.externalSeasonId) updatePayload.external_season_id = meta.externalSeasonId;

  if (Object.keys(updatePayload).length > 0) {
    await db.from("tournaments").update(updatePayload).eq("id", tournamentId);
    await logSyncEvent(db, syncRunId, "tournament", tournamentId, "metadata_updated", "success", updatePayload);
  }

  return { updated: Object.keys(updatePayload).length > 0, meta };
}

// ═══════════════════════════════════════════════════════════════════
//  ACTION: syncGames (schedule/structure, not results)
// ═══════════════════════════════════════════════════════════════════

async function syncGames(
  db: SupabaseClient,
  provider: SportDataProvider,
  config: ProviderConfig,
  tournamentId: string,
  syncRunId: string
) {
  const externalTeams = await provider.fetchTeams(tournamentId, config);
  const teamLookup = await buildTeamLookup(db, tournamentId, externalTeams);
  const externalGames = await provider.fetchGames(tournamentId, config);

  let matched = 0;
  let unmatched = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const rawGame of externalGames) {
    const ng = validateGame(rawGame);
    const { gameId, matchMethod } = await resolveGameId(db, tournamentId, config.providerName, ng, teamLookup);

    if (!gameId) {
      unmatched++;
      await logSyncEvent(db, syncRunId, "game", null, "unmatched", "skipped", {
        external_game_id: ng.externalGameId,
        round: ng.roundNumber,
        region: ng.region,
        slot: ng.gameSlot,
      });
      continue;
    }

    matched++;

    // Update schedule info (not scores/results)
    const schedulePayload: Record<string, unknown> = {
      source_last_updated_at: ng.sourceLastUpdatedAt || new Date().toISOString(),
    };
    if (ng.scheduledAt) schedulePayload.scheduled_at = ng.scheduledAt;

    // Populate teams if known and not already set
    const t1 = ng.team1ExternalId ? teamLookup.get(ng.team1ExternalId) : null;
    const t2 = ng.team2ExternalId ? teamLookup.get(ng.team2ExternalId) : null;
    if (t1) schedulePayload.team1_id = t1;
    if (t2) schedulePayload.team2_id = t2;

    const { error } = await db.from("games").update(schedulePayload).eq("id", gameId);
    if (error) {
      errors.push(`${gameId}: ${error.message}`);
      await logSyncEvent(db, syncRunId, "game", gameId, "schedule_update_failed", "error", { error: error.message });
    } else {
      updated++;
      await logSyncEvent(db, syncRunId, "game", gameId, "schedule_synced", "success", { matchMethod });
    }
  }

  return { matched, unmatched, updated, errors, teamsResolved: teamLookup.size };
}

// ═══════════════════════════════════════════════════════════════════
//  ACTION: syncGameResults (scores + winners)
// ═══════════════════════════════════════════════════════════════════

async function syncGameResults(
  db: SupabaseClient,
  provider: SportDataProvider,
  config: ProviderConfig,
  tournamentId: string,
  syncRunId: string
) {
  const externalTeams = await provider.fetchTeams(tournamentId, config);
  const teamLookup = await buildTeamLookup(db, tournamentId, externalTeams);
  const externalResults = await provider.fetchResults(tournamentId, config);

  let updated = 0;
  let skippedFinal = 0;
  let skippedUnmatched = 0;
  const errors: string[] = [];

  for (const rawGame of externalResults) {
    const ng = validateGame(rawGame);
    const { gameId, matchMethod } = await resolveGameId(db, tournamentId, config.providerName, ng, teamLookup);

    if (!gameId) {
      skippedUnmatched++;
      await logSyncEvent(db, syncRunId, "game", null, "result_unmatched", "skipped", {
        external_game_id: ng.externalGameId,
      });
      continue;
    }

    // Fetch current state
    const { data: current } = await db
      .from("games")
      .select("status, winner_team_id, team1_id, team2_id, team1_score, team2_score, is_result_final")
      .eq("id", gameId)
      .single();

    if (!current) continue;

    // ─── RECONCILIATION: Never overwrite admin-finalized results ────
    // If the game is already final AND is_result_final is true AND the
    // incoming data doesn't change the winner, skip to prevent churn
    if (
      current.is_result_final &&
      current.status === "final" &&
      ng.status === "final"
    ) {
      // Check if winner is the same (or incoming has no winner)
      const incomingWinner = ng.winnerExternalId ? teamLookup.get(ng.winnerExternalId) : null;
      if (!incomingWinner || incomingWinner === current.winner_team_id) {
        // Only update scores if they changed (e.g., stat correction)
        if (current.team1_score === ng.team1Score && current.team2_score === ng.team2Score) {
          skippedFinal++;
          continue;
        }
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: ng.status,
      team1_score: ng.team1Score,
      team2_score: ng.team2Score,
      live_clock: ng.liveClock,
      live_period: ng.livePeriod,
      source_last_updated_at: ng.sourceLastUpdatedAt || new Date().toISOString(),
      source_payload: ng.sourcePayload,
    };

    // Resolve winner only when final
    if (ng.status === "final" && ng.winnerExternalId) {
      const winnerInternal = teamLookup.get(ng.winnerExternalId);
      if (winnerInternal) {
        updatePayload.winner_team_id = winnerInternal;
        updatePayload.is_result_final = true;
      } else {
        // Winner external ID doesn't map — try inferring from scores + team IDs
        if (
          ng.team1Score != null &&
          ng.team2Score != null &&
          ng.team1Score !== ng.team2Score
        ) {
          const winnerId =
            ng.team1Score > ng.team2Score ? current.team1_id : current.team2_id;
          if (winnerId) {
            updatePayload.winner_team_id = winnerId;
            updatePayload.is_result_final = true;
          }
        }
        await logSyncEvent(db, syncRunId, "game", gameId, "winner_resolution_fallback", "warning", {
          external_winner: ng.winnerExternalId,
          inferred_winner: updatePayload.winner_team_id || null,
        });
      }
    } else if (ng.status !== "final") {
      // Live game — do NOT set winner or is_result_final
      updatePayload.is_result_final = false;
    }

    // ─── Advance winner to next round game ──────────────────────────
    if (updatePayload.winner_team_id && updatePayload.is_result_final) {
      const { data: thisGame } = await db
        .from("games")
        .select("round_number, game_slot")
        .eq("id", gameId)
        .single();

      if (thisGame) {
        const nextRound = thisGame.round_number + 1;
        const nextSlot = Math.ceil(thisGame.game_slot / 2);
        const isTeam1Slot = thisGame.game_slot % 2 === 1;
        const field = isTeam1Slot ? "team1_id" : "team2_id";

        const { data: nextGame } = await db
          .from("games")
          .select("id")
          .eq("tournament_id", tournamentId)
          .eq("round_number", nextRound)
          .eq("game_slot", nextSlot)
          .maybeSingle();

        if (nextGame) {
          await db.from("games").update({ [field]: updatePayload.winner_team_id }).eq("id", nextGame.id);
          await logSyncEvent(db, syncRunId, "game", nextGame.id, "team_advanced", "success", {
            from_game: gameId,
            team_id: updatePayload.winner_team_id,
            slot: field,
          });
        }
      }
    }

    // Write game state history
    const hasChanges =
      current.status !== ng.status ||
      current.team1_score !== ng.team1Score ||
      current.team2_score !== ng.team2Score ||
      (updatePayload.winner_team_id && current.winner_team_id !== updatePayload.winner_team_id);

    if (hasChanges) {
      await db.from("game_state_history").insert({
        game_id: gameId,
        previous_status: current.status,
        new_status: ng.status,
        previous_winner_team_id: current.winner_team_id,
        new_winner_team_id: (updatePayload.winner_team_id as string) || current.winner_team_id,
        previous_score: { team1: current.team1_score, team2: current.team2_score },
        new_score: { team1: ng.team1Score, team2: ng.team2Score },
        changed_by_source: `sync:${config.providerName}`,
        sync_run_id: syncRunId,
      });
    }

    // Apply update
    const { error } = await db.from("games").update(updatePayload).eq("id", gameId);
    if (error) {
      errors.push(`${gameId}: ${error.message}`);
      await logSyncEvent(db, syncRunId, "game", gameId, "result_update_failed", "error", { error: error.message });
    } else {
      updated++;
      await logSyncEvent(db, syncRunId, "game", gameId, "result_synced", "success", {
        matchMethod,
        status: ng.status,
        hasWinner: !!updatePayload.winner_team_id,
      });
    }
  }

  return { updated, skippedFinal, skippedUnmatched, errors };
}

// ═══════════════════════════════════════════════════════════════════
//  ACTION: recalculateStandings
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_SCORING: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };

async function recalculateStandingsForTournament(
  db: SupabaseClient,
  tournamentId: string,
  syncRunId: string | null,
  poolIdFilter?: string,
  source = "sync"
): Promise<{ poolsProcessed: number; bracketsScored: number }> {
  // Get all pools (or one specific pool)
  let poolQuery = db.from("pools").select("id").eq("tournament_id", tournamentId);
  if (poolIdFilter) poolQuery = poolQuery.eq("id", poolIdFilter);
  const { data: pools } = await poolQuery;
  if (!pools || pools.length === 0) return { poolsProcessed: 0, bracketsScored: 0 };

  // Load all games once
  const { data: allGames } = await db.from("games").select("*").eq("tournament_id", tournamentId);
  if (!allGames) return { poolsProcessed: 0, bracketsScored: 0 };

  const decidedGames = new Map(
    allGames.filter((g: any) => g.winner_team_id).map((g: any) => [g.id, g])
  );

  let totalBrackets = 0;

  for (const pool of pools) {
    // Load scoring rules
    const { data: rules } = await db
      .from("scoring_rules")
      .select("round_number, points_per_correct_pick")
      .eq("pool_id", pool.id);

    const scoring: Record<number, number> = {};
    rules?.forEach((r: any) => { scoring[r.round_number] = r.points_per_correct_pick; });
    if (Object.keys(scoring).length === 0) Object.assign(scoring, DEFAULT_SCORING);

    // Load all brackets for pool
    const { data: brackets } = await db
      .from("brackets")
      .select("id, user_id")
      .eq("pool_id", pool.id);
    if (!brackets || brackets.length === 0) continue;

    const standings: Array<{
      pool_id: string;
      user_id: string;
      total_points: number;
      correct_picks: number;
      possible_points_remaining: number;
    }> = [];

    for (const bracket of brackets) {
      const { data: picks } = await db
        .from("bracket_picks")
        .select("game_id, picked_team_id, picked_in_round")
        .eq("bracket_id", bracket.id);
      if (!picks) continue;

      let totalPoints = 0;
      let correctPicks = 0;
      let possiblePointsRemaining = 0;

      for (const pick of picks) {
        const pts = scoring[pick.picked_in_round] || 0;
        const decided = decidedGames.get(pick.game_id);

        if (decided) {
          if (decided.winner_team_id === pick.picked_team_id) {
            correctPicks++;
            totalPoints += pts;
          }
        } else {
          // Team still alive?
          const eliminated = allGames.some(
            (g: any) =>
              g.winner_team_id !== null &&
              g.winner_team_id !== pick.picked_team_id &&
              (g.team1_id === pick.picked_team_id || g.team2_id === pick.picked_team_id)
          );
          if (!eliminated) possiblePointsRemaining += pts;
        }
      }

      standings.push({
        pool_id: pool.id,
        user_id: bracket.user_id,
        total_points: totalPoints,
        correct_picks: correctPicks,
        possible_points_remaining: possiblePointsRemaining,
      });
    }

    // Rank
    standings.sort((a, b) => b.total_points - a.total_points);
    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].total_points < standings[i - 1].total_points) rank = i + 1;

      await db.from("standings").upsert(
        { ...standings[i], rank },
        { onConflict: "pool_id,user_id" }
      );

      await db.from("standings_snapshots").insert({
        ...standings[i],
        rank,
        source,
      });

      totalBrackets++;
    }

    if (syncRunId) {
      await logSyncEvent(db, syncRunId, "pool", pool.id, "standings_recalculated", "success", {
        brackets: standings.length,
      });
    }
  }

  return { poolsProcessed: pools.length, bracketsScored: totalBrackets };
}

// ═══════════════════════════════════════════════════════════════════
//  ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

async function orchestrate(db: SupabaseClient, req: SyncRequest, userId: string) {
  const providerName = req.providerName || "stub";

  // Load provider config
  const { data: providerConfig } = await db
    .from("provider_configs")
    .select("*")
    .eq("provider_name", providerName)
    .maybeSingle();

  // For recalculateStandings, provider config is not required
  if (req.action !== "recalculateStandings") {
    if (!providerConfig || !providerConfig.enabled) {
      throw new Error(`Provider '${providerName}' is not configured or not enabled`);
    }
  }

  const provider = PROVIDER_REGISTRY[providerName];
  if (!provider && req.action !== "recalculateStandings") {
    throw new Error(`No adapter registered for provider '${providerName}'`);
  }

  const config: ProviderConfig = providerConfig
    ? {
        providerName: providerConfig.provider_name,
        enabled: providerConfig.enabled,
        baseUrl: providerConfig.base_url,
        sport: providerConfig.sport,
        tournamentScope: providerConfig.tournament_scope,
      }
    : { providerName, enabled: true, baseUrl: null, sport: "basketball", tournamentScope: "mens" };

  // Create sync run
  const { data: syncRun, error: runErr } = await db
    .from("sync_runs")
    .insert({
      provider_name: providerName,
      sync_type: req.action,
      status: "running",
      initiated_by_user_id: userId,
    })
    .select("id")
    .single();

  if (runErr || !syncRun) throw new Error(`Failed to create sync run: ${runErr?.message}`);
  const syncRunId = syncRun.id;

  try {
    let result: Record<string, unknown> = {};

    switch (req.action) {
      case "syncTournamentMetadata": {
        result = await syncTournamentMetadata(db, provider!, config, req.tournamentId, syncRunId);
        break;
      }
      case "syncGames": {
        result = await syncGames(db, provider!, config, req.tournamentId, syncRunId);
        break;
      }
      case "syncGameResults": {
        result = await syncGameResults(db, provider!, config, req.tournamentId, syncRunId);
        break;
      }
      case "recalculateStandings": {
        result = await recalculateStandingsForTournament(db, req.tournamentId, syncRunId, req.poolId, "manual");
        break;
      }
      case "runFullSync": {
        const metaResult = provider!.fetchTournamentMeta
          ? await syncTournamentMetadata(db, provider!, config, req.tournamentId, syncRunId)
          : { updated: false };
        const gamesResult = await syncGames(db, provider!, config, req.tournamentId, syncRunId);
        const resultsResult = await syncGameResults(db, provider!, config, req.tournamentId, syncRunId);

        // Recalculate standings if any results changed
        let standingsResult = { poolsProcessed: 0, bracketsScored: 0 };
        if (resultsResult.updated > 0) {
          standingsResult = await recalculateStandingsForTournament(db, req.tournamentId, syncRunId, req.poolId);
        }

        result = {
          metadata: metaResult,
          games: gamesResult,
          results: resultsResult,
          standings: standingsResult,
        };
        break;
      }
    }

    // Update tournament last_synced_at
    await db.from("tournaments").update({ last_synced_at: new Date().toISOString() }).eq("id", req.tournamentId);

    // Finalize sync run
    const hasErrors = JSON.stringify(result).includes('"errors":["');
    await db.from("sync_runs").update({
      status: hasErrors ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      raw_summary: result,
    }).eq("id", syncRunId);

    return { syncRunId, action: req.action, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from("sync_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: msg,
    }).eq("id", syncRunId);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EDGE FUNCTION HANDLER
// ═══════════════════════════════════════════════════════════════════

const VALID_ACTIONS: SyncAction[] = [
  "syncTournamentMetadata",
  "syncGames",
  "syncGameResults",
  "recalculateStandings",
  "runFullSync",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // ─── Auth ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Server misconfigured", 500);
    }

    // Verify caller
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return errorResponse("Invalid token", 401);
    }
    const userId = claims.claims.sub as string;

    // ─── Input Validation ────────────────────────────────────────────
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body");
    }

    if (!body.action || !VALID_ACTIONS.includes(body.action)) {
      return errorResponse(`Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`);
    }
    if (!body.tournamentId || typeof body.tournamentId !== "string" || body.tournamentId.length < 10) {
      return errorResponse("tournamentId is required (UUID)");
    }

    // Service-role client for DB writes (bypasses RLS)
    const db = createClient(supabaseUrl, serviceRoleKey);

    // Verify tournament exists
    const { data: tournament } = await db
      .from("tournaments")
      .select("id")
      .eq("id", body.tournamentId)
      .maybeSingle();
    if (!tournament) {
      return errorResponse("Tournament not found", 404);
    }

    console.log(`[sync-games] action=${body.action} tournament=${body.tournamentId} user=${userId}`);

    const result = await orchestrate(db, body, userId);

    return jsonResponse({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-games] Error:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
