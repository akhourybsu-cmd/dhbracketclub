import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ───────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────────
interface NormalizedGame {
  externalGameId: string;
  roundNumber: number;
  roundName: string;
  region: string;
  gameSlot: number;
  team1ExternalId?: string;
  team2ExternalId?: string;
  team1Score?: number | null;
  team2Score?: number | null;
  winnerExternalId?: string | null;
  status: "scheduled" | "in_progress" | "final";
  liveClock?: string | null;
  livePeriod?: string | null;
  scheduledAt?: string | null;
  sourceLastUpdatedAt?: string | null;
  sourcePayload?: Record<string, unknown> | null;
}

interface NormalizedTeam {
  externalTeamId: string;
  schoolName: string;
  shortName: string;
  seed: number;
  region: string;
}

interface ProviderSyncResult {
  games: NormalizedGame[];
  teams: NormalizedTeam[];
  metadata: {
    provider: string;
    fetchedAt: string;
    gamesCount: number;
    teamsCount: number;
  };
}

interface SyncRequest {
  tournamentId: string;
  providerName?: string;
  syncType?: "full" | "scores_only";
  initiatedByUserId?: string;
}

// ─── Provider Adapter Interface ─────────────────────────────────────
interface SportDataProvider {
  name: string;
  fetchTournamentData(
    tournamentId: string,
    config: ProviderConfig,
    syncType: "full" | "scores_only"
  ): Promise<ProviderSyncResult>;
}

interface ProviderConfig {
  providerName: string;
  enabled: boolean;
  baseUrl: string | null;
  sport: string;
  tournamentScope: string;
  apiKey?: string;
}

// ─── Stub Provider (replace with real implementation) ───────────────
// This scaffold demonstrates the full adapter pattern.
// To add a real provider:
//   1. Implement SportDataProvider
//   2. Map raw API response → NormalizedGame[] / NormalizedTeam[]
//   3. Register in PROVIDER_REGISTRY below

const stubProvider: SportDataProvider = {
  name: "stub",
  async fetchTournamentData(_tournamentId, _config, _syncType) {
    // In a real implementation:
    //   const apiKey = Deno.env.get("SPORTS_DATA_API_KEY");
    //   const res = await fetch(`${config.baseUrl}/games?season=2025`, {
    //     headers: { "Authorization": `Bearer ${apiKey}` }
    //   });
    //   const raw = await res.json();
    //   return normalize(raw);
    return {
      games: [],
      teams: [],
      metadata: {
        provider: "stub",
        fetchedAt: new Date().toISOString(),
        gamesCount: 0,
        teamsCount: 0,
      },
    };
  },
};

const PROVIDER_REGISTRY: Record<string, SportDataProvider> = {
  stub: stubProvider,
};

// ─── Normalization Layer ────────────────────────────────────────────
// The provider already returns NormalizedGame/NormalizedTeam shapes.
// This layer applies final validation and defaults.

function validateNormalizedGame(g: NormalizedGame): NormalizedGame {
  return {
    ...g,
    status: ["scheduled", "in_progress", "final"].includes(g.status)
      ? g.status
      : "scheduled",
    team1Score: g.team1Score ?? null,
    team2Score: g.team2Score ?? null,
    winnerExternalId: g.status === "final" ? g.winnerExternalId : null,
    liveClock: g.status === "in_progress" ? g.liveClock : null,
    livePeriod: g.status === "in_progress" ? g.livePeriod : null,
  };
}

// ─── Upsert Service ─────────────────────────────────────────────────
async function upsertGameResults(
  supabase: ReturnType<typeof createClient>,
  tournamentId: string,
  normalizedGames: NormalizedGame[],
  providerName: string,
  syncRunId: string
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  // Load external mappings for this provider + tournament
  const { data: mappings } = await supabase
    .from("game_external_mappings")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("provider_name", providerName);

  const mappingByExtId = new Map(
    (mappings || []).map((m: any) => [m.external_game_id, m])
  );

  for (const ng of normalizedGames) {
    try {
      const validated = validateNormalizedGame(ng);
      const mapping = mappingByExtId.get(validated.externalGameId);

      if (!mapping) {
        // Log unmapped game but don't fail the sync
        await supabase.from("sync_events").insert({
          sync_run_id: syncRunId,
          entity_type: "game",
          event_type: "unmapped",
          status: "skipped",
          details: { external_game_id: validated.externalGameId },
        });
        continue;
      }

      const gameId = mapping.game_id;

      // Fetch current game state for history tracking
      const { data: currentGame } = await supabase
        .from("games")
        .select("status, winner_team_id, team1_score, team2_score")
        .eq("id", gameId)
        .single();

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        status: validated.status,
        team1_score: validated.team1Score,
        team2_score: validated.team2Score,
        live_clock: validated.liveClock,
        live_period: validated.livePeriod,
        source_last_updated_at: validated.sourceLastUpdatedAt || new Date().toISOString(),
        source_payload: validated.sourcePayload,
        is_result_final: validated.status === "final",
      };

      // Resolve winner by external ID → internal team ID if final
      if (validated.status === "final" && validated.winnerExternalId) {
        // For now, the winner mapping would need to be resolved
        // through team external mappings (future enhancement).
        // If winnerExternalId matches a team1/team2 external ID,
        // we can resolve it here.
      }

      const { error: updateError } = await supabase
        .from("games")
        .update(updatePayload)
        .eq("id", gameId);

      if (updateError) {
        errors.push(`Game ${gameId}: ${updateError.message}`);
        await supabase.from("sync_events").insert({
          sync_run_id: syncRunId,
          entity_type: "game",
          entity_id: gameId,
          event_type: "update_failed",
          status: "error",
          details: { error: updateError.message },
        });
        continue;
      }

      // Record state history if something changed
      if (
        currentGame &&
        (currentGame.status !== validated.status ||
          currentGame.team1_score !== validated.team1Score ||
          currentGame.team2_score !== validated.team2Score)
      ) {
        await supabase.from("game_state_history").insert({
          game_id: gameId,
          previous_status: currentGame.status,
          new_status: validated.status,
          previous_winner_team_id: currentGame.winner_team_id,
          new_winner_team_id: updatePayload.winner_team_id || currentGame.winner_team_id,
          previous_score: {
            team1: currentGame.team1_score,
            team2: currentGame.team2_score,
          },
          new_score: {
            team1: validated.team1Score,
            team2: validated.team2Score,
          },
          changed_by_source: `sync:${providerName}`,
          sync_run_id: syncRunId,
        });
      }

      await supabase.from("sync_events").insert({
        sync_run_id: syncRunId,
        entity_type: "game",
        entity_id: gameId,
        event_type: "updated",
        status: "success",
      });

      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Game ${ng.externalGameId}: ${msg}`);
    }
  }

  return { updated, errors };
}

// ─── Standings Recalculation ────────────────────────────────────────
async function recalculateStandings(
  supabase: ReturnType<typeof createClient>,
  tournamentId: string,
  syncRunId: string
): Promise<number> {
  // Find all pools using this tournament
  const { data: pools } = await supabase
    .from("pools")
    .select("id")
    .eq("tournament_id", tournamentId);

  if (!pools || pools.length === 0) return 0;

  const { data: allGames } = await supabase
    .from("games")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (!allGames) return 0;

  let totalRecalculated = 0;

  for (const pool of pools) {
    const { data: scoringRules } = await supabase
      .from("scoring_rules")
      .select("round_number, points_per_correct_pick")
      .eq("pool_id", pool.id);

    const scoring: Record<number, number> = {};
    scoringRules?.forEach((r: any) => {
      scoring[r.round_number] = r.points_per_correct_pick;
    });
    // Fallback to defaults
    if (Object.keys(scoring).length === 0) {
      Object.assign(scoring, { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 });
    }

    const { data: brackets } = await supabase
      .from("brackets")
      .select("id, user_id")
      .eq("pool_id", pool.id);

    if (!brackets) continue;

    const standingsData: Array<{
      pool_id: string;
      user_id: string;
      total_points: number;
      correct_picks: number;
      possible_points_remaining: number;
    }> = [];

    for (const bracket of brackets) {
      const { data: picks } = await supabase
        .from("bracket_picks")
        .select("game_id, picked_team_id, picked_in_round")
        .eq("bracket_id", bracket.id);

      if (!picks) continue;

      let totalPoints = 0;
      let correctPicks = 0;
      let possiblePointsRemaining = 0;

      const decidedGames = new Map(
        allGames
          .filter((g: any) => g.winner_team_id)
          .map((g: any) => [g.id, g])
      );

      for (const pick of picks) {
        const pts = scoring[pick.picked_in_round] || 0;
        const decided = decidedGames.get(pick.game_id);

        if (decided) {
          if (decided.winner_team_id === pick.picked_team_id) {
            correctPicks++;
            totalPoints += pts;
          }
        } else {
          // Check if team is eliminated
          const isEliminated = allGames.some(
            (g: any) =>
              g.winner_team_id !== null &&
              g.winner_team_id !== pick.picked_team_id &&
              (g.team1_id === pick.picked_team_id || g.team2_id === pick.picked_team_id)
          );
          if (!isEliminated) {
            possiblePointsRemaining += pts;
          }
        }
      }

      standingsData.push({
        pool_id: pool.id,
        user_id: bracket.user_id,
        total_points: totalPoints,
        correct_picks: correctPicks,
        possible_points_remaining: possiblePointsRemaining,
      });
    }

    // Sort and assign ranks
    standingsData.sort((a, b) => b.total_points - a.total_points);
    let rank = 1;
    for (let i = 0; i < standingsData.length; i++) {
      if (i > 0 && standingsData[i].total_points < standingsData[i - 1].total_points) {
        rank = i + 1;
      }
      await supabase.from("standings").upsert(
        {
          ...standingsData[i],
          rank,
        },
        { onConflict: "pool_id,user_id" }
      );

      // Snapshot
      await supabase.from("standings_snapshots").insert({
        pool_id: standingsData[i].pool_id,
        user_id: standingsData[i].user_id,
        total_points: standingsData[i].total_points,
        correct_picks: standingsData[i].correct_picks,
        possible_points_remaining: standingsData[i].possible_points_remaining,
        rank,
        source: "sync",
      });

      totalRecalculated++;
    }
  }

  return totalRecalculated;
}

// ─── Sync Orchestrator ──────────────────────────────────────────────
async function orchestrateSync(
  supabase: ReturnType<typeof createClient>,
  request: SyncRequest
): Promise<{ syncRunId: string; summary: Record<string, unknown> }> {
  const providerName = request.providerName || "stub";
  const syncType = request.syncType || "full";

  // 1. Create sync run record
  const { data: syncRun, error: runError } = await supabase
    .from("sync_runs")
    .insert({
      provider_name: providerName,
      sync_type: syncType,
      status: "running",
      initiated_by_user_id: request.initiatedByUserId || null,
    })
    .select("id")
    .single();

  if (runError || !syncRun) {
    throw new Error(`Failed to create sync run: ${runError?.message}`);
  }

  const syncRunId = syncRun.id;

  try {
    // 2. Load provider config
    const { data: providerConfig } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("provider_name", providerName)
      .single();

    if (!providerConfig || !providerConfig.enabled) {
      throw new Error(`Provider '${providerName}' is not configured or not enabled`);
    }

    // 3. Resolve provider adapter
    const provider = PROVIDER_REGISTRY[providerName];
    if (!provider) {
      throw new Error(`No adapter registered for provider '${providerName}'`);
    }

    // 4. Fetch from provider
    const result = await provider.fetchTournamentData(
      request.tournamentId,
      {
        providerName: providerConfig.provider_name,
        enabled: providerConfig.enabled,
        baseUrl: providerConfig.base_url,
        sport: providerConfig.sport,
        tournamentScope: providerConfig.tournament_scope,
      },
      syncType
    );

    // 5. Upsert game results
    const upsertResult = await upsertGameResults(
      supabase,
      request.tournamentId,
      result.games,
      providerName,
      syncRunId
    );

    // 6. Recalculate standings if any games were updated
    let standingsRecalculated = 0;
    if (upsertResult.updated > 0) {
      standingsRecalculated = await recalculateStandings(
        supabase,
        request.tournamentId,
        syncRunId
      );
    }

    // 7. Update tournament sync status
    await supabase
      .from("tournaments")
      .update({
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", request.tournamentId);

    // 8. Finalize sync run
    const summary = {
      provider: providerName,
      syncType,
      gamesFromProvider: result.metadata.gamesCount,
      gamesUpdated: upsertResult.updated,
      errors: upsertResult.errors,
      standingsRecalculated,
    };

    await supabase
      .from("sync_runs")
      .update({
        status: upsertResult.errors.length > 0 ? "completed_with_errors" : "completed",
        finished_at: new Date().toISOString(),
        raw_summary: summary,
      })
      .eq("id", syncRunId);

    return { syncRunId, summary };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: errorMsg,
      })
      .eq("id", syncRunId);

    throw err;
  }
}

// ─── Edge Function Handler ──────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for DB operations (bypasses RLS for sync writes)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the calling user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Parse request body
    const body = await req.json() as SyncRequest;
    if (!body.tournamentId) {
      return new Response(
        JSON.stringify({ error: "tournamentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    body.initiatedByUserId = userId;

    // Run sync
    const result = await orchestrateSync(supabase, body);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Sync error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
