-- Combined: apply 3 pending migrations
-- 1) NFL team records view
create or replace view public.nfl_team_records as
with played as (
  select g.season_id, g.home_team_id as team_id, g.away_team_id as opp_team_id,
    coalesce(g.home_score,0) as own_score, coalesce(g.away_score,0) as opp_score,
    case when g.winner_team_id is null then 'T'
         when g.winner_team_id = g.home_team_id then 'W' else 'L' end as result,
    g.kickoff_at
  from public.nfl_games g where g.status = 'final'
  union all
  select g.season_id, g.away_team_id as team_id, g.home_team_id as opp_team_id,
    coalesce(g.away_score,0) as own_score, coalesce(g.home_score,0) as opp_score,
    case when g.winner_team_id is null then 'T'
         when g.winner_team_id = g.away_team_id then 'W' else 'L' end as result,
    g.kickoff_at
  from public.nfl_games g where g.status = 'final'
)
select team_id, season_id,
  count(*) filter (where result='W') as wins,
  count(*) filter (where result='L') as losses,
  count(*) filter (where result='T') as ties,
  count(*) as games_played,
  coalesce(round(avg(own_score - opp_score)::numeric, 1), 0) as point_diff_avg,
  (select string_agg(result, '' order by kickoff_at desc)
     from (select result, kickoff_at from played p2
            where p2.team_id = played.team_id and p2.season_id = played.season_id
            order by kickoff_at desc limit 5) as recent) as recent_form
from played group by team_id, season_id;

grant select on public.nfl_team_records to authenticated;
grant select on public.nfl_team_records to anon;

-- 2) Atomic clock advance RPC
create or replace function public.advance_narrative_clock(
  _campaign_id uuid, _clock_id uuid, _delta int, _note text default null
) returns public.narrative_clocks
language plpgsql security definer set search_path = public as $$
declare _caller uuid := auth.uid(); _row public.narrative_clocks;
begin
  if _caller is null then raise exception 'not authenticated' using errcode='28000'; end if;
  if not (public.narrative_is_gm(_campaign_id,_caller) or public.narrative_is_club_admin(_campaign_id,_caller)) then
    raise exception 'not authorized to advance clocks for campaign %', _campaign_id using errcode='42501';
  end if;
  update public.narrative_clocks
     set current_value = greatest(0, least(max_value, current_value + _delta)),
         history = coalesce(history,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'at', now(), 'delta', _delta,
           'to', greatest(0, least(max_value, current_value + _delta)), 'note', _note))
   where id = _clock_id and campaign_id = _campaign_id
  returning * into _row;
  if not found then
    raise exception 'clock % not found in campaign %', _clock_id, _campaign_id using errcode='P0002';
  end if;
  return _row;
end; $$;

grant execute on function public.advance_narrative_clock(uuid, uuid, int, text) to authenticated;

-- 3) Narrative campaign persistence columns
alter table public.narrative_campaigns
  add column if not exists canon_locks jsonb not null default '[]'::jsonb;
alter table public.narrative_campaigns
  add column if not exists waiting_on_state jsonb not null default '{}'::jsonb;
create index if not exists narrative_campaigns_waiting_idx
  on public.narrative_campaigns ((waiting_on_state->>'mode'))
  where waiting_on_state ? 'mode';