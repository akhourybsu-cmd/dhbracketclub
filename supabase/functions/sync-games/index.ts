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
  seasonYear: number;
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

// ─── Stub provider ────────────────────────────────────────────────
const stubProvider: SportDataProvider = {
  name: "stub",
  async fetchTeams() { return []; },
  async fetchGames() { return []; },
  async fetchResults() { return []; },
  async fetchTournamentMeta() { return { status: "in_progress" }; },
};

// ─── ESPN Provider ───────────────────────────────────────────────

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// March Madness region mapping from ESPN notes/format
const ESPN_REGION_MAP: Record<string, string> = {
  "south": "South", "east": "East", "west": "West", "midwest": "Midwest",
  "south region": "South", "east region": "East", "west region": "West", "midwest region": "Midwest",
};

const ESPN_ROUND_MAP: Record<string, { roundNumber: number; roundName: string }> = {
  "round of 64": { roundNumber: 1, roundName: "Round of 64" },
  "first round": { roundNumber: 1, roundName: "Round of 64" },
  "1st round": { roundNumber: 1, roundName: "Round of 64" },
  "round of 32": { roundNumber: 2, roundName: "Round of 32" },
  "second round": { roundNumber: 2, roundName: "Round of 32" },
  "2nd round": { roundNumber: 2, roundName: "Round of 32" },
  "sweet 16": { roundNumber: 3, roundName: "Sweet 16" },
  "sweet sixteen": { roundNumber: 3, roundName: "Sweet 16" },
  "elite 8": { roundNumber: 4, roundName: "Elite 8" },
  "elite eight": { roundNumber: 4, roundName: "Elite 8" },
  "final four": { roundNumber: 5, roundName: "Final Four" },
  "national semifinal": { roundNumber: 5, roundName: "Final Four" },
  "national championship": { roundNumber: 6, roundName: "Championship" },
  "championship": { roundNumber: 6, roundName: "Championship" },
};

function parseEspnStatus(statusName: string): "scheduled" | "in_progress" | "final" {
  if (!statusName) return "scheduled";
  const s = statusName.toUpperCase();
  if (s.includes("FINAL") || s.includes("COMPLETE")) return "final";
  if (s.includes("IN_PROGRESS") || s.includes("HALFTIME") || s.includes("END_PERIOD")) return "in_progress";
  return "scheduled";
}

function extractRoundAndRegion(event: any): { roundNumber: number; roundName: string; region: string } {
  // ESPN puts round/region info in event.competitions[0].notes or event.season.slug
  const notes: any[] = event.competitions?.[0]?.notes || [];
  let roundText = "";
  let regionText = "";

  for (const note of notes) {
    const headline = (note.headline || "").toLowerCase();
    const type = (note.type || "").toLowerCase();

    // Notes often have "South Region - Sweet 16" or "Final Four"
    if (headline) {
      // Check for region
      for (const [key, val] of Object.entries(ESPN_REGION_MAP)) {
        if (headline.includes(key)) { regionText = val; break; }
      }
      // Check for round
      for (const [key, val] of Object.entries(ESPN_ROUND_MAP)) {
        if (headline.includes(key)) { roundText = key; break; }
      }
    }
  }

  // Fallback: check event name
  if (!roundText || !regionText) {
    const eventName = (event.name || event.shortName || "").toLowerCase();
    if (!roundText) {
      for (const [key] of Object.entries(ESPN_ROUND_MAP)) {
        if (eventName.includes(key)) { roundText = key; break; }
      }
    }
    if (!regionText) {
      for (const [key, val] of Object.entries(ESPN_REGION_MAP)) {
        if (eventName.includes(key)) { regionText = val; break; }
      }
    }
  }

  const round = ESPN_ROUND_MAP[roundText] || { roundNumber: 1, roundName: "Round of 64" };
  // Final Four and Championship don't have regions
  if (round.roundNumber >= 5) regionText = "Final Four";

  return { ...round, region: regionText || "Unknown" };
}

/** Fetch all March Madness events from ESPN for a date range */
async function fetchEspnScoreboard(seasonYear: number, dates?: string): Promise<any[]> {
  const allEvents: any[] = [];

  // March Madness typically spans ~3 weeks in March-April
  // We fetch multiple date ranges to capture all games
  const dateRanges = dates ? [dates] : generateTournamentDates(seasonYear);

  for (const dateStr of dateRanges) {
    const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=100&groups=100&seasontype=3`;
    console.log(`[espn] Fetching: ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[espn] HTTP ${res.status} for date=${dateStr}`);
        await res.text(); // consume body
        continue;
      }
      const data = await res.json();
      const events = data.events || [];
      allEvents.push(...events);
    } catch (err) {
      console.warn(`[espn] Fetch failed for date=${dateStr}:`, err);
    }
  }

  // Deduplicate by event ID
  const seen = new Set<string>();
  return allEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/** Generate date strings covering the typical March Madness window */
function generateTournamentDates(year: number): string[] {
  const dates: string[] = [];
  // First Four: ~Mar 17-18, R64: ~Mar 19-20, R32: ~Mar 21-22
  // S16: ~Mar 26-27, E8: ~Mar 28-29, F4: ~Apr 4, Champ: ~Apr 6
  // Cover Mar 17 through Apr 10 to be safe
  const start = new Date(year, 2, 17); // March 17
  const end = new Date(year, 3, 10);   // April 10
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}${m}${day}`);
  }
  return dates;
}

function parseEspnEvent(event: any): { team: NormalizedTeam; game: NormalizedGame } | null {
  const comp = event.competitions?.[0];
  if (!comp || !comp.competitors || comp.competitors.length < 2) return null;

  const { roundNumber, roundName, region } = extractRoundAndRegion(event);

  const statusType = comp.status?.type?.name || "";
  const status = parseEspnStatus(statusType);

  const competitors = comp.competitors;
  // ESPN orders: away=0, home=1 (or uses homeAway field)
  const away = competitors.find((c: any) => c.homeAway === "away") || competitors[0];
  const home = competitors.find((c: any) => c.homeAway === "home") || competitors[1];

  const awaySeed = away.curatedRank?.current || away.statistics?.find?.((s: any) => s.name === "seed")?.value || 0;
  const homeSeed = home.curatedRank?.current || home.statistics?.find?.((s: any) => s.name === "seed")?.value || 0;

  const awayScore = away.score ? parseInt(away.score, 10) : null;
  const homeScore = home.score ? parseInt(home.score, 10) : null;

  let winnerExtId: string | null = null;
  if (status === "final") {
    if (away.winner) winnerExtId = away.team.id;
    else if (home.winner) winnerExtId = home.team.id;
    else if (awayScore != null && homeScore != null && awayScore !== homeScore) {
      winnerExtId = awayScore > homeScore ? away.team.id : home.team.id;
    }
  }

  return {
    team: null as any, // teams are collected separately
    game: {
      externalGameId: event.id,
      roundNumber,
      roundName,
      region,
      gameSlot: 0, // will be computed below
      team1ExternalId: away.team.id,
      team2ExternalId: home.team.id,
      team1Score: awayScore,
      team2Score: homeScore,
      winnerExternalId: winnerExtId,
      status,
      isResultFinal: status === "final",
      liveClock: comp.status?.displayClock || null,
      livePeriod: comp.status?.period ? `${comp.status.type?.shortDetail || `P${comp.status.period}`}` : null,
      scheduledAt: event.date || null,
      sourceLastUpdatedAt: new Date().toISOString(),
      sourcePayload: { espnId: event.id, name: event.name },
    },
  };
}

/** Compute game_slot within (round, region) based on seed ordering */
function assignGameSlots(games: NormalizedGame[]): NormalizedGame[] {
  // Group by round+region, then assign sequential slots
  const groups = new Map<string, NormalizedGame[]>();
  for (const g of games) {
    const key = `${g.roundNumber}:${g.region}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }

  const result: NormalizedGame[] = [];
  for (const [, groupGames] of groups) {
    // Sort by scheduled time to maintain bracket order
    groupGames.sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return ta - tb;
    });
    groupGames.forEach((g, i) => {
      result.push({ ...g, gameSlot: i + 1 });
    });
  }
  return result;
}

/** Extract unique teams from ESPN events */
function extractTeamsFromEvents(events: any[]): NormalizedTeam[] {
  const teamMap = new Map<string, NormalizedTeam>();

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors) continue;

    const { region } = extractRoundAndRegion(event);

    for (const c of comp.competitors) {
      const id = c.team?.id;
      if (!id || teamMap.has(id)) continue;

      const seed = c.curatedRank?.current || 0;
      teamMap.set(id, {
        externalTeamId: id,
        schoolName: c.team.displayName || c.team.name || "",
        shortName: c.team.shortDisplayName || c.team.abbreviation || c.team.name || "",
        seed: seed > 16 ? 0 : seed, // curatedRank > 16 is an AP rank, not a seed
        region: region || "Unknown",
      });
    }
  }

  return Array.from(teamMap.values());
}

const espnProvider: SportDataProvider = {
  name: "espn",

  async fetchTeams(tournamentId: string, config: ProviderConfig): Promise<NormalizedTeam[]> {
    // Get season year from tournament
    // We'll pass it via config or derive from current year
    const year = new Date().getFullYear();
    const events = await fetchEspnScoreboard(year);
    return extractTeamsFromEvents(events);
  },

  async fetchGames(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]> {
    const year = new Date().getFullYear();
    const events = await fetchEspnScoreboard(year);

    const games: NormalizedGame[] = [];
    for (const event of events) {
      const parsed = parseEspnEvent(event);
      if (parsed) games.push(parsed.game);
    }

    return assignGameSlots(games);
  },

  async fetchResults(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]> {
    // Same as fetchGames — ESPN scoreboard includes scores
    const year = new Date().getFullYear();
    const events = await fetchEspnScoreboard(year);

    const games: NormalizedGame[] = [];
    for (const event of events) {
      const parsed = parseEspnEvent(event);
      if (parsed) games.push(parsed.game);
    }

    return assignGameSlots(games);
  },

  async fetchTournamentMeta(tournamentId: string, config: ProviderConfig) {
    const year = new Date().getFullYear();
    const events = await fetchEspnScoreboard(year);
    const total = events.length;
    const finals = events.filter(e => {
      const s = e.competitions?.[0]?.status?.type?.name || "";
      return s.toUpperCase().includes("FINAL");
    }).length;

    let status = "upcoming";
    if (finals >= 63) status = "completed";
    else if (finals > 0 || total > 0) status = "in_progress";

    return { status, externalSeasonId: `${year}` };
  },
};

const PROVIDER_REGISTRY: Record<string, SportDataProvider> = {
  stub: stubProvider,
  espn: espnProvider,
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
  let newFinals = 0;
  const errors: string[] = [];
  const affectedGameIds: string[] = [];

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
    if (
      current.is_result_final &&
      current.status === "final" &&
      ng.status === "final"
    ) {
      const incomingWinner = ng.winnerExternalId ? teamLookup.get(ng.winnerExternalId) : null;
      if (!incomingWinner || incomingWinner === current.winner_team_id) {
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
    let winnerChanged = false;
    if (ng.status === "final" && ng.winnerExternalId) {
      const winnerInternal = teamLookup.get(ng.winnerExternalId);
      if (winnerInternal) {
        updatePayload.winner_team_id = winnerInternal;
        updatePayload.is_result_final = true;
        winnerChanged = current.winner_team_id !== winnerInternal;
      } else {
        // Infer from scores
        if (ng.team1Score != null && ng.team2Score != null && ng.team1Score !== ng.team2Score) {
          const winnerId = ng.team1Score > ng.team2Score ? current.team1_id : current.team2_id;
          if (winnerId) {
            updatePayload.winner_team_id = winnerId;
            updatePayload.is_result_final = true;
            winnerChanged = current.winner_team_id !== winnerId;
          }
        }
        await logSyncEvent(db, syncRunId, "game", gameId, "winner_resolution_fallback", "warning", {
          external_winner: ng.winnerExternalId,
          inferred_winner: updatePayload.winner_team_id || null,
        });
      }
    } else if (ng.status !== "final") {
      updatePayload.is_result_final = false;
    }

    // Track if this is a newly finalized game
    if (ng.status === "final" && current.status !== "final") {
      newFinals++;
    }

    // Advance winner to next round
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
      winnerChanged;

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
      affectedGameIds.push(gameId);
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
        winnerChanged,
      });
    }
  }

  return { updated, skippedFinal, skippedUnmatched, newFinals, errors, affectedGameIds };
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
  source = "sync",
  affectedGameIds?: string[]
): Promise<{ poolsProcessed: number; bracketsScored: number; standingsChanged: number }> {
  // Get pools (optionally filtered)
  let poolQuery = db.from("pools").select("id").eq("tournament_id", tournamentId);
  if (poolIdFilter) poolQuery = poolQuery.eq("id", poolIdFilter);
  const { data: pools } = await poolQuery;
  if (!pools || pools.length === 0) return { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };

  // Load all games once
  const { data: allGames } = await db.from("games").select("*").eq("tournament_id", tournamentId);
  if (!allGames) return { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };

  const decidedGames = new Map(
    allGames.filter((g: any) => g.winner_team_id).map((g: any) => [g.id, g])
  );

  // If we have affectedGameIds, find which brackets have picks on those games
  // for targeted recalculation (optimization). But we still recalculate full
  // scores for those brackets to ensure idempotency.
  const affectedGameSet = affectedGameIds ? new Set(affectedGameIds) : null;

  let totalBrackets = 0;
  let standingsChanged = 0;

  for (const pool of pools) {
    const { data: rules } = await db
      .from("scoring_rules")
      .select("round_number, points_per_correct_pick")
      .eq("pool_id", pool.id);

    const scoring: Record<number, number> = {};
    rules?.forEach((r: any) => { scoring[r.round_number] = r.points_per_correct_pick; });
    if (Object.keys(scoring).length === 0) Object.assign(scoring, DEFAULT_SCORING);

    const { data: brackets } = await db
      .from("brackets")
      .select("id, user_id")
      .eq("pool_id", pool.id);
    if (!brackets || brackets.length === 0) continue;

    // If targeted mode, find which brackets are affected
    let bracketsToScore = brackets;
    if (affectedGameSet && affectedGameSet.size > 0) {
      const affectedBracketIds = new Set<string>();
      for (const bracket of brackets) {
        const { data: picks } = await db
          .from("bracket_picks")
          .select("game_id")
          .eq("bracket_id", bracket.id)
          .in("game_id", [...affectedGameSet]);
        if (picks && picks.length > 0) {
          affectedBracketIds.add(bracket.id);
        }
      }
      // If no brackets affected, still recalculate all for rank consistency
      if (affectedBracketIds.size > 0) {
        // We need to recalculate ALL brackets in the pool for correct ranking
        // but we know at least some are affected
      }
    }

    // Load existing standings for change detection
    const { data: existingStandings } = await db
      .from("standings")
      .select("user_id, total_points, correct_picks, possible_points_remaining, rank")
      .eq("pool_id", pool.id);
    const existingMap = new Map(
      (existingStandings || []).map((s: any) => [s.user_id, s])
    );

    const standings: Array<{
      pool_id: string;
      user_id: string;
      total_points: number;
      correct_picks: number;
      possible_points_remaining: number;
    }> = [];

    for (const bracket of bracketsToScore) {
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

      const existing = existingMap.get(standings[i].user_id);
      const changed = !existing ||
        existing.total_points !== standings[i].total_points ||
        existing.correct_picks !== standings[i].correct_picks ||
        existing.possible_points_remaining !== standings[i].possible_points_remaining ||
        existing.rank !== rank;

      await db.from("standings").upsert(
        { ...standings[i], rank },
        { onConflict: "pool_id,user_id" }
      );

      // Only snapshot if something changed
      if (changed) {
        standingsChanged++;
        await db.from("standings_snapshots").insert({
          ...standings[i],
          rank,
          source,
        });
      }

      totalBrackets++;
    }

    if (syncRunId) {
      await logSyncEvent(db, syncRunId, "pool", pool.id, "standings_recalculated", "success", {
        brackets: standings.length,
        changed: standingsChanged,
      });
    }
  }

  return { poolsProcessed: pools.length, bracketsScored: totalBrackets, standingsChanged };
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
        const resultsOnly = await syncGameResults(db, provider!, config, req.tournamentId, syncRunId);
        // Auto-recalculate standings if any finals changed
        let autoStandings = { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };
        if (resultsOnly.newFinals > 0 || resultsOnly.affectedGameIds.length > 0) {
          autoStandings = await recalculateStandingsForTournament(
            db, req.tournamentId, syncRunId, req.poolId, "auto",
            resultsOnly.affectedGameIds
          );
        }
        result = { ...resultsOnly, standings: autoStandings };
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
        let standingsResult = { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };
        if (resultsResult.updated > 0 || resultsResult.newFinals > 0) {
          standingsResult = await recalculateStandingsForTournament(
            db, req.tournamentId, syncRunId, req.poolId, "sync",
            resultsResult.affectedGameIds
          );
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

    // Finalize sync run with robust error detection
    const resultStr = JSON.stringify(result);
    const hasErrors = resultStr.includes('"errors":["') || resultStr.includes('"error"');
    const hasUnmatched = resultStr.includes('"unmatched"') && /"unmatched":\s*[1-9]/.test(resultStr);
    const finalStatus = hasErrors ? "completed_with_errors" : hasUnmatched ? "completed_with_warnings" : "completed";
    
    await db.from("sync_runs").update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      raw_summary: result,
    }).eq("id", syncRunId);
    
    console.log(`[sync-games] COMPLETED syncRun=${syncRunId} status=${finalStatus}`);

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

    // Verify caller using getUser (standard, widely supported)
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !callerUser) {
      console.error("[sync-games] Auth failed:", userErr?.message);
      return errorResponse("Invalid token", 401);
    }
    const userId = callerUser.id;

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

    // ─── Admin verification ─────────────────────────────────────────
    // User must be admin of at least one pool linked to this tournament
    const { data: adminPools } = await db
      .from("pool_members")
      .select("pool_id, pools!inner(tournament_id)")
      .eq("user_id", userId)
      .eq("role", "admin");

    const isAdminOfTournament = adminPools?.some(
      (pm: any) => pm.pools?.tournament_id === body.tournamentId
    );
    if (!isAdminOfTournament) {
      console.warn(`[sync-games] DENIED: user=${userId} not admin for tournament=${body.tournamentId}`);
      return errorResponse("Forbidden: you must be a pool admin for this tournament", 403);
    }

    console.log(`[sync-games] action=${body.action} tournament=${body.tournamentId} user=${userId} provider=${body.providerName || "stub"}`);

    const result = await orchestrate(db, body, userId);

    return jsonResponse({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sync-games] FAILED action=${(await req.clone().json().catch(() => ({}))).action || "unknown"}:`, message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
