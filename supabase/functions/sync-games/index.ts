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
  poolId?: string;
}

interface NormalizedTeam {
  externalTeamId: string;
  schoolName: string;
  shortName: string;
  seed: number; // from ESPN seed field, used for display only — NOT for reconciliation
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
  parseConfidence: "high" | "medium" | "low";
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

// ═══════════════════════════════════════════════════════════════════
//  ESPN PROVIDER
// ═══════════════════════════════════════════════════════════════════

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

const ESPN_REGION_MAP: Record<string, string> = {
  "midwest region": "Midwest",
  "west region": "West",
  "south region": "South",
  "east region": "East",
  "midwest regional": "Midwest",
  "west regional": "West",
  "south regional": "South",
  "east regional": "East",
  "midwest": "Midwest",
  "west": "West",
  "south": "South",
  "east": "East",
};

const ESPN_ROUND_PATTERNS: Array<{ pattern: RegExp; roundNumber: number; roundName: string }> = [
  { pattern: /first\s*four|play[-\s]*in/i, roundNumber: 0, roundName: "First Four" },
  { pattern: /round\s*of\s*64|first\s*round|1st\s*round/i, roundNumber: 1, roundName: "Round of 64" },
  { pattern: /round\s*of\s*32|second\s*round|2nd\s*round/i, roundNumber: 2, roundName: "Round of 32" },
  { pattern: /sweet\s*16|sweet\s*sixteen|regional\s*semi\s*final/i, roundNumber: 3, roundName: "Sweet 16" },
  { pattern: /elite\s*8|elite\s*eight|regional\s*final/i, roundNumber: 4, roundName: "Elite 8" },
  { pattern: /final\s*four|national\s*semi\s*final/i, roundNumber: 5, roundName: "Final Four" },
  { pattern: /national\s*championship|title\s*game|championship/i, roundNumber: 6, roundName: "Championship" },
];

function parseEspnStatus(statusName: string): "scheduled" | "in_progress" | "final" {
  if (!statusName) return "scheduled";
  const s = statusName.toUpperCase();
  if (s.includes("FINAL") || s.includes("COMPLETE")) return "final";
  if (s.includes("IN_PROGRESS") || s.includes("HALFTIME") || s.includes("END_PERIOD")) return "in_progress";
  return "scheduled";
}

function extractRoundAndRegion(event: any): {
  roundNumber: number;
  roundName: string;
  region: string;
  confidence: "high" | "medium" | "low";
} {
  const comp = event.competitions?.[0];
  const notes: any[] = comp?.notes || [];

  const textBlobs: string[] = [
    event.name || "",
    event.shortName || "",
    comp?.name || "",
    comp?.type?.text || "",
    ...notes.map((n: any) => n?.headline || ""),
    ...notes.map((n: any) => n?.detail || ""),
  ].filter(Boolean);

  const combinedText = textBlobs.join(" | ").toLowerCase();

  const round = ESPN_ROUND_PATTERNS.find((entry) => entry.pattern.test(combinedText));
  if (!round) {
    return { roundNumber: -1, roundName: "Unknown Round", region: "Unknown", confidence: "low" };
  }

  let regionText = "";
  for (const blob of textBlobs) {
    const lc = blob.toLowerCase();
    for (const [key, value] of Object.entries(ESPN_REGION_MAP)) {
      if (lc.includes(key)) {
        regionText = value;
        break;
      }
    }
    if (regionText) break;
  }

  // Final Four and Championship don't need region
  if (round.roundNumber === 5) regionText = "Final Four";
  if (round.roundNumber === 6) regionText = "Championship";

  let confidence: "high" | "medium" | "low" = "medium";
  if (round.roundNumber >= 5) {
    confidence = "high"; // Final Four and Championship are unambiguous structurally
  } else if (regionText && regionText !== "Unknown") {
    confidence = "high";
  } else {
    confidence = "low";
  }

  return { roundNumber: round.roundNumber, roundName: round.roundName, region: regionText || "Unknown", confidence };
}

// ─── ESPN Fetch Helpers ─────────────────────────────────────────

const espnCache = new Map<number, any[]>();

async function fetchEspnScoreboard(seasonYear: number, dates?: string): Promise<any[]> {
  if (!dates && espnCache.has(seasonYear)) {
    console.log(`[espn] Using cached scoreboard for ${seasonYear} (${espnCache.get(seasonYear)!.length} events)`);
    return espnCache.get(seasonYear)!;
  }

  const allEvents: any[] = [];
  const dateRanges = dates ? [dates] : generateTournamentDates(seasonYear);

  for (const dateStr of dateRanges) {
    const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=100&groups=100&seasontype=3`;
    console.log(`[espn] Fetching: ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[espn] HTTP ${res.status} for date=${dateStr}`);
        await res.text();
        continue;
      }
      const data = await res.json();
      const events = data.events || [];
      allEvents.push(...events);
    } catch (err) {
      console.warn(`[espn] Fetch failed for date=${dateStr}:`, err);
    }
  }

  const seen = new Set<string>();
  const deduped = allEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  if (!dates) espnCache.set(seasonYear, deduped);
  return deduped;
}

function generateTournamentDates(year: number): string[] {
  const dates: string[] = [];
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

// ─── ESPN Event Parsing ─────────────────────────────────────────

function parseEspnEvent(event: any): NormalizedGame | null {
  const comp = event.competitions?.[0];
  if (!comp || !comp.competitors || comp.competitors.length < 2) return null;

  const { roundNumber, roundName, region, confidence } = extractRoundAndRegion(event);
  if (roundNumber < 0) return null;

  const statusType = comp.status?.type?.name || "";
  const status = parseEspnStatus(statusType);

  const competitors = comp.competitors;
  const away = competitors.find((c: any) => c.homeAway === "away") || competitors[0];
  const home = competitors.find((c: any) => c.homeAway === "home") || competitors[1];

  // DO NOT use curatedRank.current — it's AP ranking, not tournament seed
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
    externalGameId: event.id,
    roundNumber,
    roundName,
    region,
    gameSlot: 0, // computed by assignGameSlots
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
    parseConfidence: confidence,
  };
}

/** Compute game_slot hint (global per round). Used as reconciliation fallback only. */
function assignGameSlots(games: NormalizedGame[]): NormalizedGame[] {
  const byRound = new Map<number, NormalizedGame[]>();
  for (const game of games) {
    if (!byRound.has(game.roundNumber)) byRound.set(game.roundNumber, []);
    byRound.get(game.roundNumber)!.push(game);
  }

  const regionOrderByRound: Record<number, string[]> = {
    0: ["Midwest", "West", "South", "East"],
    1: ["East", "West", "South", "Midwest"],
    2: ["East", "West", "South", "Midwest"],
    3: ["East", "West", "South", "Midwest"],
    4: ["East", "West", "South", "Midwest"],
    5: ["Final Four"],
    6: ["Championship"],
  };

  const assigned: NormalizedGame[] = [];

  for (const [roundNumber, roundGames] of byRound.entries()) {
    const regionOrder = regionOrderByRound[roundNumber] || [];

    roundGames.sort((a, b) => {
      const regionA = regionOrder.indexOf(a.region);
      const regionB = regionOrder.indexOf(b.region);
      const regionIdxA = regionA === -1 ? Number.MAX_SAFE_INTEGER : regionA;
      const regionIdxB = regionB === -1 ? Number.MAX_SAFE_INTEGER : regionB;
      if (regionIdxA !== regionIdxB) return regionIdxA - regionIdxB;

      const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;

      return a.externalGameId.localeCompare(b.externalGameId);
    });

    roundGames.forEach((game, index) => {
      assigned.push({ ...game, gameSlot: index + 1 });
    });
  }

  return assigned;
}

/** Extract unique teams from ESPN events — seed from ESPN's seed field, NOT curatedRank */
function extractTeamsFromEvents(events: any[]): NormalizedTeam[] {
  const teamMap = new Map<string, NormalizedTeam>();

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors) continue;

    const roundInfo = extractRoundAndRegion(event);
    if (roundInfo.roundNumber < 0) continue;

    for (const c of comp.competitors) {
      const id = c.team?.id;
      if (!id) continue;

      // Use ESPN's seed field (string like "1"), NOT curatedRank which is AP ranking
      const seedStr = typeof c.seed === "string" ? c.seed : typeof c.seed === "number" ? String(c.seed) : "";
      const seed = parseInt(seedStr, 10) || 0;

      const incoming: NormalizedTeam = {
        externalTeamId: id,
        schoolName: c.team.displayName || c.team.name || "",
        shortName: c.team.shortDisplayName || c.team.abbreviation || c.team.name || "",
        seed,
        region: roundInfo.region || "Unknown",
      };

      const existing = teamMap.get(id);
      if (!existing) {
        teamMap.set(id, incoming);
        continue;
      }

      // Upgrade region/seed if we have better info from a later round
      const shouldUpgradeRegion = existing.region === "Unknown" && incoming.region !== "Unknown";
      const shouldUpgradeSeed = (!existing.seed || existing.seed === 0) && incoming.seed > 0;

      if (shouldUpgradeRegion || shouldUpgradeSeed) {
        teamMap.set(id, {
          ...existing,
          region: shouldUpgradeRegion ? incoming.region : existing.region,
          seed: shouldUpgradeSeed ? incoming.seed : existing.seed,
          schoolName: incoming.schoolName || existing.schoolName,
          shortName: incoming.shortName || existing.shortName,
        });
      }
    }
  }

  return Array.from(teamMap.values());
}

const espnProvider: SportDataProvider = {
  name: "espn",

  async fetchTeams(tournamentId: string, config: ProviderConfig): Promise<NormalizedTeam[]> {
    const year = config.seasonYear;
    console.log(`[espn] fetchTeams for season ${year}`);
    const events = await fetchEspnScoreboard(year);
    return extractTeamsFromEvents(events);
  },

  async fetchGames(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]> {
    const year = config.seasonYear;
    console.log(`[espn] fetchGames for season ${year}`);
    const events = await fetchEspnScoreboard(year);

    const games: NormalizedGame[] = [];
    for (const event of events) {
      const parsed = parseEspnEvent(event);
      if (parsed) games.push(parsed);
    }

    return assignGameSlots(games);
  },

  async fetchResults(tournamentId: string, config: ProviderConfig): Promise<NormalizedGame[]> {
    const year = config.seasonYear;
    const events = await fetchEspnScoreboard(year);

    const games: NormalizedGame[] = [];
    for (const event of events) {
      const parsed = parseEspnEvent(event);
      if (parsed) games.push(parsed);
    }

    return assignGameSlots(games);
  },

  async fetchTournamentMeta(tournamentId: string, config: ProviderConfig) {
    const year = config.seasonYear;
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

function normalizeTeamName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[_\s]+/g, " ")         // normalize whitespace
    .replace(/[^a-z0-9 ]/g, "")     // keep spaces for word boundaries
    .replace(/\b(university|univ)\b/g, "") // only strip university, NOT "st"
    .replace(/\s+/g, "")             // collapse to single string for comparison
    .trim();
}

function validateGame(g: NormalizedGame): NormalizedGame {
  const validStatuses = ["scheduled", "in_progress", "final"];
  const status = validStatuses.includes(g.status) ? g.status : "scheduled";
  return {
    ...g,
    status: status as NormalizedGame["status"],
    team1Score: g.team1Score ?? null,
    team2Score: g.team2Score ?? null,
    winnerExternalId: status === "final" ? (g.winnerExternalId ?? null) : null,
    isResultFinal: status === "final" && g.isResultFinal !== false,
    liveClock: status === "in_progress" ? (g.liveClock ?? null) : null,
    livePeriod: status === "in_progress" ? (g.livePeriod ?? null) : null,
  };
}

/** Helper: create/upsert an external mapping */
async function createExternalMapping(
  db: SupabaseClient,
  tournamentId: string,
  gameId: string,
  providerName: string,
  ng: NormalizedGame
) {
  await db.from("game_external_mappings").upsert(
    {
      tournament_id: tournamentId,
      game_id: gameId,
      provider_name: providerName,
      external_game_id: ng.externalGameId,
      external_round_name: ng.roundName,
      external_region: ng.region,
    },
    { onConflict: "provider_name,external_game_id" }
  );
}

/**
 * Resolve an internal game ID for an external game.
 * Strategy (in order):
 *   1. Explicit mapping in game_external_mappings
 *   2. Participant-based match (both teams must resolve)
 *   3. Championship singleton (round 6, only 1 game)
 *   4. Final Four by slot (round 5, only 2 games)
 *   5. Deterministic round+region+slot (high confidence only)
 *   6. Fallback round+slot (low confidence)
 */
async function resolveGameId(
  db: SupabaseClient,
  tournamentId: string,
  providerName: string,
  ng: NormalizedGame,
  teamLookup: Map<string, string>
): Promise<{ gameId: string | null; matchMethod: string; matchConfidence: string }> {

  // 1. Explicit mapping (highest confidence)
  const { data: mapping } = await db
    .from("game_external_mappings")
    .select("game_id")
    .eq("provider_name", providerName)
    .eq("external_game_id", ng.externalGameId)
    .maybeSingle();

  if (mapping) return { gameId: mapping.game_id, matchMethod: "explicit_mapping", matchConfidence: "high" };

  // 2. Participant-based match (both ESPN teams must resolve to internal teams)
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
      await createExternalMapping(db, tournamentId, teamMatch.id, providerName, ng);
      return { gameId: teamMatch.id, matchMethod: "participant_match", matchConfidence: "high" };
    }
  }

  // 3. Championship singleton: round 6 has exactly 1 game
  if (ng.roundNumber === 6) {
    const { data: champGame } = await db
      .from("games")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round_number", 6)
      .eq("game_slot", 1)
      .maybeSingle();

    if (champGame) {
      await createExternalMapping(db, tournamentId, champGame.id, providerName, ng);
      return { gameId: champGame.id, matchMethod: "championship_singleton", matchConfidence: "high" };
    }
  }

  // 4. Final Four: round 5, only 2 games — match by slot
  if (ng.roundNumber === 5 && ng.gameSlot > 0 && ng.gameSlot <= 2) {
    const { data: f4Match } = await db
      .from("games")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round_number", 5)
      .eq("game_slot", ng.gameSlot)
      .maybeSingle();

    if (f4Match) {
      await createExternalMapping(db, tournamentId, f4Match.id, providerName, ng);
      return { gameId: f4Match.id, matchMethod: "final_four_slot", matchConfidence: "medium" };
    }
  }

  // 5. Deterministic: round + region + slot (only when region is known)
  if (ng.region && ng.region !== "Unknown" && ng.gameSlot > 0 && ng.roundNumber >= 0 && ng.roundNumber <= 4) {
    const { data: slotMatch } = await db
      .from("games")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round_number", ng.roundNumber)
      .eq("region", ng.region)
      .eq("game_slot", ng.gameSlot)
      .maybeSingle();

    if (slotMatch) {
      await createExternalMapping(db, tournamentId, slotMatch.id, providerName, ng);
      return { gameId: slotMatch.id, matchMethod: "round_region_slot", matchConfidence: ng.parseConfidence === "high" ? "medium" : "low" };
    }
  }

  // 6. Fallback: round + slot (no region) — low confidence
  if (ng.gameSlot > 0) {
    const { data: rsMatch } = await db
      .from("games")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round_number", ng.roundNumber)
      .eq("game_slot", ng.gameSlot)
      .maybeSingle();

    if (rsMatch) {
      await createExternalMapping(db, tournamentId, rsMatch.id, providerName, ng);
      return { gameId: rsMatch.id, matchMethod: "round_slot_fallback", matchConfidence: "low" };
    }
  }

  return { gameId: null, matchMethod: "unmatched", matchConfidence: "none" };
}

/**
 * Build external→internal team ID lookup.
 * Uses NAME matching only. Does NOT use seed+region to avoid First Four collisions.
 * Play-in teams with play_in_group are handled separately via positional matching.
 */
async function buildTeamLookup(
  db: SupabaseClient,
  tournamentId: string,
  externalTeams: NormalizedTeam[]
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();

  const { data: internalTeams } = await db
    .from("teams")
    .select("id, school_name, short_name, seed, region, play_in_group")
    .eq("tournament_id", tournamentId);

  if (!internalTeams || internalTeams.length === 0) return lookup;

  const internalIndex = internalTeams.map((t) => ({
    ...t,
    normalizedSchool: normalizeTeamName(t.school_name),
    normalizedShort: normalizeTeamName(t.short_name),
  }));

  // Separate non-play-in and play-in teams
  const nonPlayIn = internalIndex.filter(t => !t.play_in_group);
  const playInTeams = internalIndex.filter(t => !!t.play_in_group);

  const usedInternalIds = new Set<string>();

  // Pass 1: strict name match against non-play-in teams only
  // (play-in teams are matched positionally in syncGames/syncGameResults)
  for (const ext of externalTeams) {
    const normSchool = normalizeTeamName(ext.schoolName);
    const normShort = normalizeTeamName(ext.shortName);

    const match = nonPlayIn.find(
      (t) =>
        !usedInternalIds.has(t.id) &&
        (
          t.normalizedSchool === normSchool ||
          t.normalizedShort === normShort ||
          t.normalizedSchool === normShort ||
          t.normalizedShort === normSchool
        )
    );

    if (match) {
      lookup.set(ext.externalTeamId, match.id);
      usedInternalIds.add(match.id);
    }
  }

  // Pass 2: relaxed name containment for non-play-in teams only
  for (const ext of externalTeams) {
    if (lookup.has(ext.externalTeamId)) continue;

    const normSchool = normalizeTeamName(ext.schoolName);
    const normShort = normalizeTeamName(ext.shortName);

    // Skip very short names to avoid false matches
    if (normSchool.length < 4 && normShort.length < 4) continue;

    const relaxed = nonPlayIn.find(
      (t) =>
        !usedInternalIds.has(t.id) &&
        (
          (normSchool.length >= 4 && (t.normalizedSchool.includes(normSchool) || normSchool.includes(t.normalizedSchool))) ||
          (normShort.length >= 4 && (t.normalizedShort.includes(normShort) || normShort.includes(t.normalizedShort)))
        )
    );

    if (relaxed) {
      lookup.set(ext.externalTeamId, relaxed.id);
      usedInternalIds.add(relaxed.id);
    }
  }

  // NO seed+region fallback — removed to prevent First Four collisions

  console.log(`[team-lookup] Matched ${lookup.size}/${externalTeams.length} ESPN teams to internal teams (${playInTeams.length} play-in teams deferred to positional matching)`);

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
//  VALIDATION PASS
// ═══════════════════════════════════════════════════════════════════

async function runPreSyncValidation(
  db: SupabaseClient,
  tournamentId: string,
  syncRunId: string
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // 1. Check 67 internal games
  const { data: games } = await db
    .from("games")
    .select("id, round_number, game_slot, region, team1_id, team2_id")
    .eq("tournament_id", tournamentId);

  const totalGames = games?.length || 0;
  if (totalGames !== 67) {
    issues.push(`Expected 67 games, found ${totalGames}`);
  }

  // 2. Check First Four structure
  const ffGames = games?.filter(g => g.round_number === 0) || [];
  if (ffGames.length !== 4) {
    issues.push(`Expected 4 First Four games, found ${ffGames.length}`);
  }
  for (const ff of ffGames) {
    if (!ff.team1_id || !ff.team2_id) {
      issues.push(`First Four game slot ${ff.game_slot} missing team(s)`);
    }
  }

  // 3. No self-matches (team1_id == team2_id)
  for (const g of (games || [])) {
    if (g.team1_id && g.team2_id && g.team1_id === g.team2_id) {
      issues.push(`Game R${g.round_number} S${g.game_slot} has same team on both sides: ${g.team1_id}`);
    }
  }

  // 4. No duplicate external mappings for same provider pointing to different internal games
  const { data: mappings } = await db
    .from("game_external_mappings")
    .select("game_id, external_game_id, provider_name")
    .eq("tournament_id", tournamentId);

  const extIdToGameIds = new Map<string, Set<string>>();
  for (const m of (mappings || [])) {
    const key = `${m.provider_name}:${m.external_game_id}`;
    if (!extIdToGameIds.has(key)) extIdToGameIds.set(key, new Set());
    extIdToGameIds.get(key)!.add(m.game_id);
  }
  for (const [key, gameIds] of extIdToGameIds) {
    if (gameIds.size > 1) {
      issues.push(`External ID ${key} maps to ${gameIds.size} different internal games`);
    }
  }

  // Check for multiple external IDs pointing to same internal game
  const gameIdToExtIds = new Map<string, string[]>();
  for (const m of (mappings || [])) {
    if (!gameIdToExtIds.has(m.game_id)) gameIdToExtIds.set(m.game_id, []);
    gameIdToExtIds.get(m.game_id)!.push(m.external_game_id);
  }
  for (const [gameId, extIds] of gameIdToExtIds) {
    if (extIds.length > 1) {
      issues.push(`Internal game ${gameId} has ${extIds.length} external mappings: ${extIds.join(", ")}`);
    }
  }

  await logSyncEvent(db, syncRunId, "validation", null, "pre_sync_validation",
    issues.length > 0 ? "warning" : "success",
    { issues, gamesCount: totalGames, ffCount: ffGames.length, mappingsCount: mappings?.length || 0 }
  );

  if (issues.length > 0) {
    console.warn(`[validation] Pre-sync validation found ${issues.length} issue(s):`, issues);
  } else {
    console.log(`[validation] Pre-sync validation passed (${totalGames} games, ${mappings?.length} mappings)`);
  }

  return { valid: issues.length === 0, issues };
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
//  ACTION: syncGames (schedule/structure — ESPN updates existing games only)
// ═══════════════════════════════════════════════════════════════════

async function syncGames(
  db: SupabaseClient,
  provider: SportDataProvider,
  config: ProviderConfig,
  tournamentId: string,
  syncRunId: string
) {
  // Run validation first
  const validation = await runPreSyncValidation(db, tournamentId, syncRunId);

  const externalTeams = await provider.fetchTeams(tournamentId, config);
  const teamLookup = await buildTeamLookup(db, tournamentId, externalTeams);

  // Build external team map for name lookups
  const extTeamMap = new Map<string, NormalizedTeam>();
  for (const t of externalTeams) extTeamMap.set(t.externalTeamId, t);

  const externalGames = await provider.fetchGames(tournamentId, config);

  // Sort by round (FF first) so play-in positional matching populates teamLookup
  // before later rounds need those teams for participant-based matching
  const sortedGames = [...externalGames].sort((a, b) => a.roundNumber - b.roundNumber);

  let matched = 0;
  let unmatched = 0;
  let updated = 0;
  let ffTeamsAnchored = 0;
  const errors: string[] = [];
  const skipReasons: Record<string, number> = {};

  // NOTE: Bulk team name updates removed — they caused cross-region name corruption
  // via loose name matching. Team names are set during initial seeding.
  // Play-in team names are updated only via FF positional anchoring below.
  const teamsUpdated = 0;

  for (const rawGame of sortedGames) {
    const ng = validateGame(rawGame);
    const { gameId, matchMethod, matchConfidence } = await resolveGameId(db, tournamentId, config.providerName, ng, teamLookup);

    if (!gameId) {
      unmatched++;
      const reason = ng.roundNumber < 0 ? "unknown_round"
        : ng.region === "Unknown" && ng.roundNumber < 5 ? "unknown_region"
        : ng.parseConfidence === "low" ? "low_parse_confidence"
        : "no_slot_match";
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;

      await logSyncEvent(db, syncRunId, "game", null, "unmatched", "skipped", {
        external_game_id: ng.externalGameId,
        round: ng.roundNumber,
        roundName: ng.roundName,
        region: ng.region,
        slot: ng.gameSlot,
        parseConfidence: ng.parseConfidence,
        skipReason: reason,
        team1Ext: ng.team1ExternalId,
        team2Ext: ng.team2ExternalId,
      });
      continue;
    }

    matched++;

    // ─── First Four positional team anchoring ─────────────────────
    // For matched FF games, anchor ESPN team IDs to internal team positions.
    // This ONLY populates the teamLookup for later round matching.
    // Team names are updated here since play-in teams may have placeholder names.
    if (ng.roundNumber === 0) {
      const { data: ffGame } = await db
        .from("games")
        .select("team1_id, team2_id")
        .eq("id", gameId)
        .single();

      if (ffGame) {
        if (ng.team1ExternalId && ffGame.team1_id && !teamLookup.has(ng.team1ExternalId)) {
          teamLookup.set(ng.team1ExternalId, ffGame.team1_id);
          ffTeamsAnchored++;
          // Update play-in team name from ESPN (these may have placeholder names)
          const ext = extTeamMap.get(ng.team1ExternalId);
          if (ext?.schoolName) {
            await db.from("teams").update({
              school_name: ext.schoolName,
              short_name: ext.shortName || ext.schoolName,
            }).eq("id", ffGame.team1_id);
          }
        }
        if (ng.team2ExternalId && ffGame.team2_id && !teamLookup.has(ng.team2ExternalId)) {
          teamLookup.set(ng.team2ExternalId, ffGame.team2_id);
          ffTeamsAnchored++;
          const ext = extTeamMap.get(ng.team2ExternalId);
          if (ext?.schoolName) {
            await db.from("teams").update({
              school_name: ext.schoolName,
              short_name: ext.shortName || ext.schoolName,
            }).eq("id", ffGame.team2_id);
          }
        }
      }

      await logSyncEvent(db, syncRunId, "game", gameId, "ff_teams_anchored", "success", {
        matchMethod, matchConfidence,
        team1Ext: ng.team1ExternalId,
        team2Ext: ng.team2ExternalId,
      });
    }

    // Update schedule info only (not team assignments or scores)
    const schedulePayload: Record<string, unknown> = {
      source_last_updated_at: ng.sourceLastUpdatedAt || new Date().toISOString(),
    };
    if (ng.scheduledAt) schedulePayload.scheduled_at = ng.scheduledAt;

    // NEVER overwrite R1 team IDs — they are structural bracket assignments.
    // R2+ team assignments are handled by winner advancement in syncGameResults.
    // syncGames only updates schedule metadata.

    const { error } = await db.from("games").update(schedulePayload).eq("id", gameId);
    if (error) {
      errors.push(`${gameId}: ${error.message}`);
      await logSyncEvent(db, syncRunId, "game", gameId, "schedule_update_failed", "error", { error: error.message });
    } else {
      updated++;
      await logSyncEvent(db, syncRunId, "game", gameId, "schedule_synced", "success", {
        matchMethod, matchConfidence,
      });
    }
  }

  return {
    matched, unmatched, updated, errors,
    teamsResolved: teamLookup.size,
    teamsUpdated,
    ffTeamsAnchored,
    skipReasons,
    validationIssues: validation.issues,
  };
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

  // Anchor FF teams positionally (same logic as syncGames)
  const { data: ffGames } = await db
    .from("games")
    .select("id, team1_id, team2_id, game_slot, region")
    .eq("tournament_id", tournamentId)
    .eq("round_number", 0);

  const externalResults = await provider.fetchResults(tournamentId, config);

  // Find FF ESPN events and anchor teams
  for (const ng of externalResults) {
    if (ng.roundNumber !== 0) continue;
    const { gameId } = await resolveGameId(db, tournamentId, config.providerName, ng, teamLookup);
    if (!gameId) continue;
    const ffGame = ffGames?.find(g => g.id === gameId);
    if (!ffGame) continue;
    if (ng.team1ExternalId && ffGame.team1_id) teamLookup.set(ng.team1ExternalId, ffGame.team1_id);
    if (ng.team2ExternalId && ffGame.team2_id) teamLookup.set(ng.team2ExternalId, ffGame.team2_id);
  }

  // Sort by round for consistent processing
  const sortedResults = [...externalResults].sort((a, b) => a.roundNumber - b.roundNumber);

  let resultUpdated = 0;
  let skippedFinal = 0;
  let skippedUnmatched = 0;
  let newFinals = 0;
  const errors: string[] = [];
  const affectedGameIds: string[] = [];
  const skipReasons: Record<string, number> = {};

  for (const rawGame of sortedResults) {
    const ng = validateGame(rawGame);
    const { gameId, matchMethod, matchConfidence } = await resolveGameId(db, tournamentId, config.providerName, ng, teamLookup);

    if (!gameId) {
      skippedUnmatched++;
      const reason = ng.roundNumber < 0 ? "unknown_round"
        : ng.parseConfidence === "low" ? "low_parse_confidence"
        : "no_match";
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;

      await logSyncEvent(db, syncRunId, "game", null, "result_unmatched", "skipped", {
        external_game_id: ng.externalGameId,
        roundNumber: ng.roundNumber,
        roundName: ng.roundName,
        region: ng.region,
        parseConfidence: ng.parseConfidence,
        skipReason: reason,
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

    // ─── Never overwrite admin-finalized results ────────────────
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

    // Resolve winner ONLY when final
    let winnerChanged = false;
    if (ng.status === "final" && ng.winnerExternalId) {
      const winnerInternal = teamLookup.get(ng.winnerExternalId);
      if (winnerInternal) {
        updatePayload.winner_team_id = winnerInternal;
        updatePayload.is_result_final = true;
        winnerChanged = current.winner_team_id !== winnerInternal;
      } else {
        // Infer from scores as last resort
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
          matchMethod, matchConfidence,
        });
      }
    } else if (ng.status !== "final") {
      // Don't set winner for non-final games
      updatePayload.is_result_final = false;
    }

    // Track newly finalized game
    if (ng.status === "final" && current.status !== "final") {
      newFinals++;
    }

    // Advance winner to next round's game slot
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
      resultUpdated++;
      await logSyncEvent(db, syncRunId, "game", gameId, "result_synced", "success", {
        matchMethod, matchConfidence,
        status: ng.status,
        hasWinner: !!updatePayload.winner_team_id,
        winnerChanged,
      });
    }
  }

  return { updated: resultUpdated, skippedFinal, skippedUnmatched, newFinals, errors, affectedGameIds, skipReasons };
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
  let poolQuery = db.from("pools").select("id").eq("tournament_id", tournamentId);
  if (poolIdFilter) poolQuery = poolQuery.eq("id", poolIdFilter);
  const { data: pools } = await poolQuery;
  if (!pools || pools.length === 0) return { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };

  const { data: allGames } = await db.from("games").select("*").eq("tournament_id", tournamentId);
  if (!allGames) return { poolsProcessed: 0, bracketsScored: 0, standingsChanged: 0 };

  const decidedGames = new Map(
    allGames.filter((g: any) => g.winner_team_id).map((g: any) => [g.id, g])
  );

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

async function orchestrate(db: SupabaseClient, req: SyncRequest, userId: string, seasonYear: number) {
  const providerName = req.providerName || "stub";

  const { data: providerConfig } = await db
    .from("provider_configs")
    .select("*")
    .eq("provider_name", providerName)
    .maybeSingle();

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
        seasonYear,
      }
    : { providerName, enabled: true, baseUrl: null, sport: "basketball", tournamentScope: "mens", seasonYear };

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

    await db.from("tournaments").update({ last_synced_at: new Date().toISOString() }).eq("id", req.tournamentId);

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Server misconfigured", 500);
    }

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

    const db = createClient(supabaseUrl, serviceRoleKey);

    const { data: tournament } = await db
      .from("tournaments")
      .select("id, season_year")
      .eq("id", body.tournamentId)
      .maybeSingle();
    if (!tournament) {
      return errorResponse("Tournament not found", 404);
    }

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

    console.log(`[sync-games] action=${body.action} tournament=${body.tournamentId} season=${tournament.season_year} user=${userId} provider=${body.providerName || "stub"}`);

    const result = await orchestrate(db, body, userId, tournament.season_year);

    return jsonResponse({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sync-games] FAILED:`, message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
