import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DraftSeason {
  id: string;
  name: string;
  year: number;
  season_label: string;
  starts_at: string;
  ends_at: string;
  status: string;
  regular_season_weeks: number;
  playoff_weeks: number;
  best_of: number;
}

export interface SeasonStanding {
  id: string;
  season_id: string;
  user_id: string;
  season_points: number;
  drafts_played: number;
  wins: number;
  podiums: number;
  avg_finish: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
  consistency: number;
  rank: number | null;
  playoff_seed: number | null;
  is_eliminated: boolean;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface SeasonEntry {
  id: string;
  season_id: string;
  draft_id: string;
  week_number: number;
  is_playoff: boolean;
  season_points_awarded: Record<string, number>;
  drafts?: { topic: string; status: string };
}

export interface PlayoffMatch {
  id: string;
  season_id: string;
  round: string;
  match_number: number;
  seed_a: number;
  seed_b: number;
  user_a: string | null;
  user_b: string | null;
  draft_id: string | null;
  winner_user_id: string | null;
  status: string;
}

// Season points by placement
const SEASON_POINTS: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
  5: 2,
};
const PARTICIPATION_POINTS = 1;

export function getSeasonPointsForRank(rank: number): number {
  return SEASON_POINTS[rank] || PARTICIPATION_POINTS;
}

export function useCurrentSeason() {
  const [season, setSeason] = useState<DraftSeason | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Get active season (regular_season or playoffs), or most recent upcoming
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .in('status', ['regular_season', 'playoffs'])
        .order('starts_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setSeason(data[0] as unknown as DraftSeason);
      } else {
        // fallback: most recent season
        const { data: fallback } = await supabase
          .from('draft_seasons' as any)
          .select('*')
          .order('starts_at', { ascending: false })
          .limit(1);
        if (fallback && fallback.length > 0) {
          setSeason(fallback[0] as unknown as DraftSeason);
        }
      }
      setLoading(false);
    })();
  }, []);

  return { season, loading };
}

export function useSeasonStandings(seasonId: string | undefined) {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_season_standings' as any)
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('season_id', seasonId)
      .order('season_points', { ascending: false });
    setStandings((data || []) as unknown as SeasonStanding[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { standings, loading, refetch: fetch };
}

export function useSeasonEntries(seasonId: string | undefined) {
  const [entries, setEntries] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_season_entries' as any)
        .select('*, drafts:draft_id(topic, status)')
        .eq('season_id', seasonId)
        .order('week_number');
      setEntries((data || []) as unknown as SeasonEntry[]);
      setLoading(false);
    })();
  }, [seasonId]);

  return { entries, loading };
}

export function usePlayoffMatches(seasonId: string | undefined) {
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('season_id', seasonId)
        .order('round')
        .order('match_number');
      setMatches((data || []) as unknown as PlayoffMatch[]);
      setLoading(false);
    })();
  }, [seasonId]);

  return { matches, loading };
}

export function useAllSeasons() {
  const [seasons, setSeasons] = useState<DraftSeason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .order('starts_at', { ascending: false });
      setSeasons((data || []) as unknown as DraftSeason[]);
      setLoading(false);
    })();
  }, []);

  return { seasons, loading };
}

export function useLifetimeStats(userId: string | undefined) {
  const [stats, setStats] = useState<{
    totalSeasons: number;
    totalWins: number;
    totalPodiums: number;
    totalPlayoffs: number;
    totalChampionships: number;
    avgSeasonFinish: number;
    bestSeasonPoints: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data: allStandings } = await supabase
        .from('draft_season_standings' as any)
        .select('*')
        .eq('user_id', userId);

      const { data: playoffWins } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('winner_user_id', userId)
        .eq('round', 'final');

      const rows = (allStandings || []) as unknown as SeasonStanding[];
      const championships = ((playoffWins || []) as unknown as PlayoffMatch[]).length;

      if (rows.length === 0) {
        setStats(null);
      } else {
        const ranks = rows.filter(r => r.rank).map(r => r.rank!);
        setStats({
          totalSeasons: rows.length,
          totalWins: rows.reduce((s, r) => s + r.wins, 0),
          totalPodiums: rows.reduce((s, r) => s + r.podiums, 0),
          totalPlayoffs: rows.filter(r => r.playoff_seed !== null).length,
          totalChampionships: championships,
          avgSeasonFinish: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0,
          bestSeasonPoints: Math.max(...rows.map(r => r.season_points), 0),
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  return { stats, loading };
}

/** Recalculate season standings from draft_results for a given season */
export async function recalculateSeasonStandings(seasonId: string) {
  // 1. Get all season entries with their draft results
  const { data: entries } = await supabase
    .from('draft_season_entries' as any)
    .select('draft_id, week_number, is_playoff')
    .eq('season_id', seasonId)
    .eq('is_playoff', false);

  if (!entries || entries.length === 0) return;

  const draftIds = (entries as any[]).map(e => e.draft_id);
  const { data: results } = await supabase
    .from('draft_results' as any)
    .select('draft_id, user_id, rank, total_score, points_awarded')
    .in('draft_id', draftIds);

  if (!results) return;

  // Get season config
  const { data: seasonData } = await supabase
    .from('draft_seasons' as any)
    .select('best_of, regular_season_weeks')
    .eq('id', seasonId)
    .single();

  const bestOf = (seasonData as any)?.best_of || 6;

  // Group results by user
  const userResults = new Map<string, Array<{ rank: number; total_score: number; draft_id: string }>>();
  for (const r of results as any[]) {
    const arr = userResults.get(r.user_id) || [];
    arr.push({ rank: r.rank, total_score: Number(r.total_score), draft_id: r.draft_id });
    userResults.set(r.user_id, arr);
  }

  // Calculate standings per user
  const standingsUpdates: Array<{
    season_id: string;
    user_id: string;
    season_points: number;
    drafts_played: number;
    wins: number;
    podiums: number;
    avg_finish: number;
    avg_score: number;
    best_score: number;
    worst_score: number;
    consistency: number;
  }> = [];

  for (const [userId, drafts] of userResults) {
    // Sort by season points desc, take best N
    const withPoints = drafts.map(d => ({
      ...d,
      seasonPts: getSeasonPointsForRank(d.rank),
    }));
    withPoints.sort((a, b) => b.seasonPts - a.seasonPts);

    const counted = withPoints.slice(0, bestOf);
    const seasonPoints = counted.reduce((s, d) => s + d.seasonPts, 0);
    const wins = drafts.filter(d => d.rank === 1).length;
    const podiums = drafts.filter(d => d.rank <= 3).length;
    const avgFinish = drafts.reduce((s, d) => s + d.rank, 0) / drafts.length;
    const scores = drafts.map(d => d.total_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const mean = avgScore;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const consistency = Math.sqrt(variance);

    standingsUpdates.push({
      season_id: seasonId,
      user_id: userId,
      season_points: seasonPoints,
      drafts_played: drafts.length,
      wins,
      podiums,
      avg_finish: Math.round(avgFinish * 100) / 100,
      avg_score: Math.round(avgScore * 100) / 100,
      best_score: Math.round(bestScore * 100) / 100,
      worst_score: Math.round(worstScore * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
    });
  }

  // Sort by season points and assign ranks
  standingsUpdates.sort((a, b) => b.season_points - a.season_points);
  let rank = 1;
  for (let i = 0; i < standingsUpdates.length; i++) {
    if (i > 0 && standingsUpdates[i].season_points < standingsUpdates[i - 1].season_points) {
      rank = i + 1;
    }
    (standingsUpdates[i] as any).rank = rank;
    // All players get playoff seeds
    (standingsUpdates[i] as any).playoff_seed = i + 1;
  }

  // Upsert standings
  for (const s of standingsUpdates) {
    await supabase
      .from('draft_season_standings' as any)
      .upsert(s as any, { onConflict: 'season_id,user_id' });
  }

  // Update season_points_awarded on entries
  for (const entry of entries as any[]) {
    const entryResults = (results as any[]).filter(r => r.draft_id === entry.draft_id);
    const pointsMap: Record<string, number> = {};
    for (const r of entryResults) {
      pointsMap[r.user_id] = getSeasonPointsForRank(r.rank);
    }
    await supabase
      .from('draft_season_entries' as any)
      .update({ season_points_awarded: pointsMap })
      .eq('draft_id', entry.draft_id);
  }
}

/** Create a new season */
export async function createSeason(params: {
  name: string;
  year: number;
  seasonLabel: string;
  startsAt: string;
  endsAt: string;
}) {
  const { data, error } = await supabase
    .from('draft_seasons' as any)
    .insert({
      name: params.name,
      year: params.year,
      season_label: params.seasonLabel,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      status: 'regular_season',
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Assign a draft to the current season */
export async function assignDraftToSeason(seasonId: string, draftId: string, weekNumber: number, isPlayoff = false) {
  const { error } = await supabase
    .from('draft_season_entries' as any)
    .upsert({
      season_id: seasonId,
      draft_id: draftId,
      week_number: weekNumber,
      is_playoff: isPlayoff,
    } as any, { onConflict: 'draft_id' });

  if (error) throw error;
}
