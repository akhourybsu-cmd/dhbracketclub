-- DH Club — Narrative RPG · Atomic clock advance
--
-- Closes a race-condition bug: previously both the GM Console and the
-- AI state-update applier did read-then-write on narrative_clocks
-- (read current_value, clamp delta, write next). Two simultaneous
-- advances each saw the same starting value and one delta was lost.
--
-- This RPC does the clamp + append-to-history + write in a single
-- statement so concurrent advances accumulate correctly. The function
-- runs as security definer to bypass RLS for the read-modify-write —
-- it explicitly checks the caller is a GM/admin of the campaign first.

create or replace function public.advance_narrative_clock(
  _campaign_id uuid,
  _clock_id    uuid,
  _delta       int,
  _note        text default null
)
returns public.narrative_clocks
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _row    public.narrative_clocks;
begin
  if _caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Authorization: only GM or club admin may advance.
  if not (
    public.narrative_is_gm(_campaign_id, _caller)
    or public.narrative_is_club_admin(_campaign_id, _caller)
  ) then
    raise exception 'not authorized to advance clocks for campaign %', _campaign_id
      using errcode = '42501';
  end if;

  -- Atomic clamp + history append. The RETURNING captures the
  -- post-update row so the caller can render the new value without a
  -- follow-up SELECT.
  update public.narrative_clocks
     set current_value = greatest(0, least(max_value, current_value + _delta)),
         history       = coalesce(history, '[]'::jsonb)
                      || jsonb_build_array(jsonb_build_object(
                           'at',    now(),
                           'delta', _delta,
                           'to',    greatest(0, least(max_value, current_value + _delta)),
                           'note',  _note
                         ))
   where id = _clock_id
     and campaign_id = _campaign_id
  returning * into _row;

  if not found then
    raise exception 'clock % not found in campaign %', _clock_id, _campaign_id
      using errcode = 'P0002';
  end if;

  return _row;
end;
$$;

grant execute on function public.advance_narrative_clock(uuid, uuid, int, text) to authenticated;
