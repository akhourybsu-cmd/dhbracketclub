import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NflTeam = {
  id: string;
  abbr: string;
  name: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
  primary_color: string | null;
  logo_url: string | null;
};

export type NflSeason = {
  id: string;
  year: number;
  name: string;
  status: 'upcoming' | 'active' | 'complete';
  current_week: number;
  starts_at: string;
  ends_at: string;
};

export type NflWeek = {
  id: string;
  season_id: string;
  week_number: number;
  label: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'open' | 'partially_locked' | 'closed' | 'scored';
  featured_game_id: string | null;
};

export type NflGame = {
  id: string;
  season_id: string;
  week_id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  status: 'scheduled' | 'live' | 'final';
  away_score: number | null;
  home_score: number | null;
  winner_team_id: string | null;
  away_team?: NflTeam;
  home_team?: NflTeam;
};

export type NflPick = {
  id: string;
  user_id: string;
  game_id: string;
  week_id: string;
  season_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  points_awarded: number;
};

export type NflWeeklyStanding = {
  id: string;
  user_id: string;
  week_id: string;
  season_id: string;
  correct_picks: number;
  total_picks: number;
  accuracy: number;
  tiebreak_delta: number | null;
  rank: number | null;
  profiles?: { display_name: string; avatar_url: string | null };
};

export type NflSeasonStanding = {
  id: string;
  user_id: string;
  season_id: string;
  total_correct: number;
  total_picked: number;
  accuracy: number;
  weekly_wins: number;
  avg_weekly_rank: number | null;
  rank: number | null;
  profiles?: { display_name: string; avatar_url: string | null };
};

/* Active season */
export function useActiveSeason() {
  const [season, setSeason] = useState<NflSeason | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    // Prefer 'active', fall back to most recent 'upcoming'
    const { data: active } = await (supabase as any)
      .from('nfl_seasons')
      .select('*')
      .eq('status', 'active')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) {
      setSeason(active);
      setLoading(false);
      return;
    }
    const { data: upcoming } = await (supabase as any)
      .from('nfl_seasons')
      .select('*')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSeason(upcoming || null);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { season, loading, refetch };
}

/* All teams (cached after first call) */
export function useTeams() {
  const [teams, setTeams] = useState<NflTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).from('nfl_teams').select('*').order('abbr').then(({ data }: any) => {
      setTeams(data || []);
      setLoading(false);
    });
  }, []);

  return { teams, loading };
}

/* All weeks for a season */
export function useSeasonWeeks(seasonId?: string) {
  const [weeks, setWeeks] = useState<NflWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!seasonId) { setWeeks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weeks')
      .select('*')
      .eq('season_id', seasonId)
      .order('week_number');
    setWeeks(data || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { weeks, loading, refetch };
}

/* Current week (matches season.current_week) */
export function useCurrentWeek(season?: NflSeason | null) {
  const [week, setWeek] = useState<NflWeek | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!season) { setWeek(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weeks')
      .select('*')
      .eq('season_id', season.id)
      .eq('week_number', season.current_week)
      .maybeSingle();
    setWeek(data || null);
    setLoading(false);
  }, [season]);

  useEffect(() => { refetch(); }, [refetch]);
  return { week, loading, refetch };
}

/* Games for a specific week, with team objects joined */
export function useWeekGames(weekId?: string) {
  const [games, setGames] = useState<NflGame[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId) { setGames([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: gamesData }, { data: teamsData }] = await Promise.all([
      (supabase as any).from('nfl_games').select('*').eq('week_id', weekId).order('kickoff_at'),
      (supabase as any).from('nfl_teams').select('*'),
    ]);
    const teamMap = new Map<string, NflTeam>((teamsData || []).map((t: NflTeam) => [t.id, t]));
    const enriched = (gamesData || []).map((g: NflGame) => ({
      ...g,
      away_team: teamMap.get(g.away_team_id),
      home_team: teamMap.get(g.home_team_id),
    }));
    setGames(enriched);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime: refresh on game updates for this week
  useEffect(() => {
    if (!weekId) return;
    const channel = supabase.channel(`nfl-games-${weekId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_games', filter: `week_id=eq.${weekId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekId, refetch]);

  return { games, loading, refetch };
}

/* User's picks for a week */
export function useMyWeekPicks(weekId?: string) {
  const { user } = useAuth();
  const [picks, setPicks] = useState<NflPick[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId || !user) { setPicks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_picks')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', user.id);
    setPicks(data || []);
    setLoading(false);
  }, [weekId, user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { picks, loading, refetch };
}

/* User's tiebreaker for a week */
export function useMyTiebreaker(weekId?: string) {
  const { user } = useAuth();
  const [tiebreaker, setTiebreaker] = useState<any>(null);

  const refetch = useCallback(async () => {
    if (!weekId || !user) { setTiebreaker(null); return; }
    const { data } = await (supabase as any)
      .from('nfl_tiebreakers')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .maybeSingle();
    setTiebreaker(data || null);
  }, [weekId, user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { tiebreaker, refetch };
}

/* Save / upsert a pick */
export async function savePick(args: {
  user_id: string; game_id: string; week_id: string; season_id: string; picked_team_id: string;
}) {
  const { data, error } = await (supabase as any)
    .from('nfl_picks')
    .upsert(args, { onConflict: 'user_id,game_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveTiebreaker(args: {
  user_id: string; week_id: string; season_id: string; predicted_total: number;
}) {
  const { data, error } = await (supabase as any)
    .from('nfl_tiebreakers')
    .upsert(args, { onConflict: 'user_id,week_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Weekly standings (for a week) */
export function useWeeklyStandings(weekId?: string) {
  const [standings, setStandings] = useState<NflWeeklyStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weekly_standings')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('week_id', weekId)
      .order('rank', { ascending: true, nullsFirst: false });
    setStandings(data || []);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!weekId) return;
    const channel = supabase.channel(`nfl-week-stand-${weekId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_weekly_standings', filter: `week_id=eq.${weekId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekId, refetch]);

  return { standings, loading, refetch };
}

/* Season standings */
export function useSeasonStandings(seasonId?: string) {
  const [standings, setStandings] = useState<NflSeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!seasonId) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_season_standings')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('season_id', seasonId)
      .order('rank', { ascending: true, nullsFirst: false });
    setStandings(data || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!seasonId) return;
    const channel = supabase.channel(`nfl-season-stand-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_season_standings', filter: `season_id=eq.${seasonId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [seasonId, refetch]);

  return { standings, loading, refetch };
}

/* Helpers */
export function deriveWeekStatus(games: NflGame[]): NflWeek['status'] {
  if (games.length === 0) return 'upcoming';
  const now = Date.now();
  const kicked = games.filter((g) => new Date(g.kickoff_at).getTime() <= now || g.status !== 'scheduled');
  const finals = games.filter((g) => g.status === 'final');
  if (kicked.length === 0) return 'open';
  if (finals.length === games.length) return 'closed';
  return 'partially_locked';
}

export function isGameLocked(game: NflGame): boolean {
  return new Date(game.kickoff_at).getTime() <= Date.now() || game.status !== 'scheduled';
}
