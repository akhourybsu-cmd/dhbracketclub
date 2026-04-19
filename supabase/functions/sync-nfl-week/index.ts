// Sync an NFL week from ESPN's public scoreboard API.
// Idempotent: upserts games keyed on (week_id, external_id).
// After sync, if any games are final, invokes score-nfl-week to refresh standings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type SyncBody = {
  season_year?: number;
  week_number?: number;
  seasontype?: number; // 1=preseason, 2=regular, 3=postseason. Default 2.
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    // Admin-only
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden' }, 403);

    const body: SyncBody = await req.json().catch(() => ({}));
    const seasontype = body.seasontype ?? 2;
    if (!body.season_year || !body.week_number) {
      return json({ error: 'season_year and week_number required' }, 400);
    }

    // Resolve season
    const { data: season, error: seasonErr } = await admin
      .from('nfl_seasons')
      .select('id, year, current_week')
      .eq('year', body.season_year)
      .maybeSingle();
    if (seasonErr || !season) return json({ error: `No season for year ${body.season_year}` }, 404);

    // Fetch ESPN scoreboard for this week
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=${seasontype}&week=${body.week_number}&dates=${body.season_year}`;
    const r = await fetch(espnUrl);
    if (!r.ok) return json({ error: `ESPN fetch failed: ${r.status}` }, 502);
    const data = await r.json();

    const events: any[] = data?.events ?? [];
    if (events.length === 0) return json({ message: 'No games on ESPN for this week', games: 0 });

    // Resolve/create the nfl_week row using ESPN's week boundaries
    let weekStart: string | null = null;
    let weekEnd: string | null = null;
    for (const ev of events) {
      const dt = ev?.date as string | undefined;
      if (!dt) continue;
      if (!weekStart || dt < weekStart) weekStart = dt;
      if (!weekEnd || dt > weekEnd) weekEnd = dt;
    }
    weekStart ??= new Date().toISOString();
    weekEnd ??= weekStart;
    // pad end by 4h so trigger sees the slate as fully past after Sunday/Monday games end
    weekEnd = new Date(new Date(weekEnd).getTime() + 4 * 60 * 60 * 1000).toISOString();

    const { data: existingWeek } = await admin
      .from('nfl_weeks')
      .select('id, status')
      .eq('season_id', season.id)
      .eq('week_number', body.week_number)
      .maybeSingle();

    let weekId: string;
    if (existingWeek) {
      weekId = existingWeek.id;
      // refresh boundaries (don't downgrade scored)
      await admin.from('nfl_weeks').update({ starts_at: weekStart, ends_at: weekEnd }).eq('id', weekId);
    } else {
      const { data: newWeek, error: weekErr } = await admin
        .from('nfl_weeks')
        .insert({
          season_id: season.id,
          week_number: body.week_number,
          label: `Week ${body.week_number}`,
          starts_at: weekStart,
          ends_at: weekEnd,
          status: 'upcoming',
        })
        .select('id')
        .single();
      if (weekErr || !newWeek) return json({ error: weekErr?.message ?? 'Failed to create week' }, 500);
      weekId = newWeek.id;
    }

    // Load team mapping (espn_id → uuid)
    const { data: teams } = await admin
      .from('nfl_teams')
      .select('id, external_id')
      .eq('external_provider', 'espn');
    const teamByEspnId = new Map<string, string>();
    for (const t of teams ?? []) {
      if (t.external_id) teamByEspnId.set(String(t.external_id), t.id);
    }

    let upserts = 0;
    let finals = 0;
    let skipped = 0;

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) { skipped++; continue; }
      const competitors = comp.competitors ?? [];
      const homeC = competitors.find((c: any) => c.homeAway === 'home');
      const awayC = competitors.find((c: any) => c.homeAway === 'away');
      if (!homeC || !awayC) { skipped++; continue; }

      const homeId = teamByEspnId.get(String(homeC.team?.id));
      const awayId = teamByEspnId.get(String(awayC.team?.id));
      if (!homeId || !awayId) { skipped++; continue; }

      const stateRaw = comp.status?.type?.state ?? ev.status?.type?.state;
      const completed = comp.status?.type?.completed ?? ev.status?.type?.completed;
      const status = completed ? 'final' : stateRaw === 'in' ? 'in_progress' : 'scheduled';

      const homeScore = homeC.score != null ? Number(homeC.score) : null;
      const awayScore = awayC.score != null ? Number(awayC.score) : null;
      const winnerId =
        status === 'final' && homeScore != null && awayScore != null
          ? homeScore > awayScore
            ? homeId
            : awayScore > homeScore
              ? awayId
              : null
          : null;

      const externalId = String(ev.id);
      const kickoff = ev.date ?? comp.date;

      // Try update first by external_id
      const { data: existingGame } = await admin
        .from('nfl_games')
        .select('id')
        .eq('week_id', weekId)
        .eq('external_provider', 'espn')
        .eq('external_id', externalId)
        .maybeSingle();

      if (existingGame) {
        const { error: updErr } = await admin
          .from('nfl_games')
          .update({
            kickoff_at: kickoff,
            status,
            home_score: homeScore,
            away_score: awayScore,
            winner_team_id: winnerId,
          })
          .eq('id', existingGame.id);
        if (!updErr) upserts++;
      } else {
        const { error: insErr } = await admin.from('nfl_games').insert({
          season_id: season.id,
          week_id: weekId,
          home_team_id: homeId,
          away_team_id: awayId,
          kickoff_at: kickoff,
          status,
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id: winnerId,
          external_id: externalId,
          external_provider: 'espn',
        });
        if (!insErr) upserts++;
      }
      if (status === 'final') finals++;
    }

    // If any games are final, kick off scoring
    let scored: any = null;
    if (finals > 0) {
      const { data: scoreRes } = await admin.functions.invoke('score-nfl-week', {
        body: { week_id: weekId },
      });
      scored = scoreRes;
    }

    return json({
      ok: true,
      week_id: weekId,
      events: events.length,
      upserts,
      finals,
      skipped,
      scored,
    });
  } catch (e) {
    console.error('sync-nfl-week error', e);
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
