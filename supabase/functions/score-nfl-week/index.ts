// Edge function: score a single NFL week and recompute season standings
// Idempotent — safe to run multiple times.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: must be admin
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { week_id } = await req.json();
    if (!week_id) {
      return new Response(JSON.stringify({ error: 'week_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch week, games, picks, tiebreakers
    const { data: week } = await supabase.from('nfl_weeks').select('*').eq('id', week_id).single();
    if (!week) throw new Error('Week not found');
    const { data: games } = await supabase.from('nfl_games').select('*').eq('week_id', week_id);
    const { data: picks } = await supabase.from('nfl_picks').select('*').eq('week_id', week_id);
    const { data: tbs } = await supabase.from('nfl_tiebreakers').select('*').eq('week_id', week_id);

    if (!games || !picks) throw new Error('Missing data');

    const finalGames = games.filter((g: any) => g.status === 'final' && g.winner_team_id);
    const featured = games.find((g: any) => g.id === week.featured_game_id);
    const featuredFinal = featured && featured.status === 'final';
    const featuredTotal = featuredFinal ? (featured.away_score ?? 0) + (featured.home_score ?? 0) : null;

    // 1. Score every pick whose game is final
    const pickUpdates: any[] = [];
    for (const p of picks) {
      const game = finalGames.find((g: any) => g.id === p.game_id);
      if (!game) continue;
      const correct = p.picked_team_id === game.winner_team_id;
      pickUpdates.push({ ...p, is_correct: correct, points_awarded: correct ? 1 : 0 });
    }
    if (pickUpdates.length > 0) {
      // Bulk update via individual upserts (safe for unique key)
      for (const u of pickUpdates) {
        await supabase.from('nfl_picks').update({
          is_correct: u.is_correct, points_awarded: u.points_awarded,
        }).eq('id', u.id);
      }
    }

    // 2. Update tiebreakers
    if (featuredFinal && featuredTotal != null) {
      for (const tb of tbs || []) {
        const delta = Math.abs(featuredTotal - tb.predicted_total);
        await supabase.from('nfl_tiebreakers').update({
          actual_total: featuredTotal, delta,
        }).eq('id', tb.id);
      }
    }

    // 3. Build weekly standings: aggregate per-user
    const userIds = new Set<string>(picks.map((p: any) => p.user_id));
    const weeklyRows: any[] = [];
    for (const uid of userIds) {
      const userPicks = picks.filter((p: any) => p.user_id === uid);
      const correct = userPicks.filter((p: any) => p.is_correct === true).length;
      const totalScored = userPicks.filter((p: any) => p.is_correct !== null).length;
      const acc = totalScored > 0 ? correct / totalScored : 0;
      const tb = (tbs || []).find((t: any) => t.user_id === uid);
      weeklyRows.push({
        user_id: uid, week_id, season_id: week.season_id,
        correct_picks: correct, total_picks: totalScored, accuracy: acc,
        tiebreak_delta: tb?.delta ?? null,
      });
    }
    // Sort to assign rank: correct desc → tiebreak_delta asc (nulls last)
    weeklyRows.sort((a, b) => {
      if (b.correct_picks !== a.correct_picks) return b.correct_picks - a.correct_picks;
      const ad = a.tiebreak_delta ?? Infinity;
      const bd = b.tiebreak_delta ?? Infinity;
      return ad - bd;
    });
    weeklyRows.forEach((r, i) => { r.rank = i + 1; });

    // Upsert weekly standings
    for (const row of weeklyRows) {
      await supabase.from('nfl_weekly_standings').upsert(row, { onConflict: 'user_id,week_id' });
    }

    // 4. Mark week scored if all games are final
    const allFinal = games.length > 0 && games.every((g: any) => g.status === 'final');
    if (allFinal) {
      await supabase.from('nfl_weeks').update({ status: 'scored' }).eq('id', week_id);
    }

    // 5. Recompute season standings for ALL users in season
    const { data: allSeasonPicks } = await supabase.from('nfl_picks').select('user_id, is_correct').eq('season_id', week.season_id);
    const { data: allWeekly } = await supabase.from('nfl_weekly_standings').select('*').eq('season_id', week.season_id);

    const seasonUsers = new Set<string>((allSeasonPicks || []).map((p: any) => p.user_id));
    const seasonRows: any[] = [];
    for (const uid of seasonUsers) {
      const ps = (allSeasonPicks || []).filter((p: any) => p.user_id === uid);
      const correct = ps.filter((p: any) => p.is_correct === true).length;
      const totalScored = ps.filter((p: any) => p.is_correct !== null).length;
      const ws = (allWeekly || []).filter((w: any) => w.user_id === uid);
      const wins = ws.filter((w: any) => w.rank === 1).length;
      const ranks = ws.map((w: any) => w.rank).filter((r: any) => r != null);
      const avgRank = ranks.length > 0 ? ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length : null;
      seasonRows.push({
        user_id: uid, season_id: week.season_id,
        total_correct: correct, total_picked: totalScored,
        accuracy: totalScored > 0 ? correct / totalScored : 0,
        weekly_wins: wins, avg_weekly_rank: avgRank,
      });
    }
    // Rank: total_correct desc → avg_weekly_rank asc (nulls last) → weekly_wins desc
    seasonRows.sort((a, b) => {
      if (b.total_correct !== a.total_correct) return b.total_correct - a.total_correct;
      const ar = a.avg_weekly_rank ?? Infinity;
      const br = b.avg_weekly_rank ?? Infinity;
      if (ar !== br) return ar - br;
      return b.weekly_wins - a.weekly_wins;
    });
    seasonRows.forEach((r, i) => { r.rank = i + 1; });

    for (const row of seasonRows) {
      await supabase.from('nfl_season_standings').upsert(row, { onConflict: 'user_id,season_id' });
    }

    return new Response(JSON.stringify({
      ok: true,
      scored_picks: pickUpdates.length,
      scored_users: weeklyRows.length,
      week_status: allFinal ? 'scored' : week.status,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('score-nfl-week error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
