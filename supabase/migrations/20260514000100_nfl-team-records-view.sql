-- ═══════════════════════════════════════════════════════════════════
-- DH Club — NFL team records view
--
-- Aggregates final nfl_games rows into per-team-per-season W/L/T tallies
-- so the pick UI can show "BUF 5-2" / "KC 6-1" next to each team —
-- helping users make informed picks without leaving the page.
--
-- Cheap to query (small dataset: 32 teams × ~18 weeks × current games).
-- RLS-permissive read (authenticated) since the source rows are already
-- public-read.
-- ═══════════════════════════════════════════════════════════════════

create or replace view public.nfl_team_records as
with played as (
  -- One row per team appearance in a final game, with own/opp scores and result
  select
    g.season_id,
    g.home_team_id as team_id,
    g.away_team_id as opp_team_id,
    coalesce(g.home_score, 0) as own_score,
    coalesce(g.away_score, 0) as opp_score,
    case
      when g.winner_team_id is null              then 'T'
      when g.winner_team_id = g.home_team_id     then 'W'
      else 'L'
    end as result,
    g.kickoff_at
  from public.nfl_games g
  where g.status = 'final'
  union all
  select
    g.season_id,
    g.away_team_id as team_id,
    g.home_team_id as opp_team_id,
    coalesce(g.away_score, 0) as own_score,
    coalesce(g.home_score, 0) as opp_score,
    case
      when g.winner_team_id is null              then 'T'
      when g.winner_team_id = g.away_team_id     then 'W'
      else 'L'
    end as result,
    g.kickoff_at
  from public.nfl_games g
  where g.status = 'final'
)
select
  team_id,
  season_id,
  count(*) filter (where result = 'W') as wins,
  count(*) filter (where result = 'L') as losses,
  count(*) filter (where result = 'T') as ties,
  count(*) as games_played,
  coalesce(round(
    avg(own_score - opp_score)::numeric, 1
  ), 0) as point_diff_avg,
  -- Last-5 form as a compact string like "WWLWL" (newest left, max 5)
  (
    select string_agg(result, '' order by kickoff_at desc)
    from (
      select result, kickoff_at
      from played p2
      where p2.team_id = played.team_id
        and p2.season_id = played.season_id
      order by kickoff_at desc
      limit 5
    ) as recent
  ) as recent_form
from played
group by team_id, season_id;

-- Allow public/authenticated read (matches nfl_games policy)
grant select on public.nfl_team_records to authenticated;
grant select on public.nfl_team_records to anon;
