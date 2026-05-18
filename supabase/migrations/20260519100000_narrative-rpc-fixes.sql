-- DH Club — Narrative RPG · Atomic create + transition RPCs
--
-- Review pass found that the campaign proposal flow does three separate
-- inserts (campaign + GM member + audit event) without a transaction,
-- and the transition flow does the campaign update + audit insert
-- separately. If any of the trailing inserts fail we end up with
-- orphaned rows or missing audit trails.
--
-- This migration adds two SECURITY DEFINER RPCs that wrap each flow in
-- a single transaction:
--   • create_narrative_campaign  — campaign + GM member + 'created_draft'
--     /'submitted' audit row.
--   • transition_narrative_campaign — status change + audit row + the
--     side-effect columns that depend on the next status (approved_at /
--     approved_by / gm_id on approval, submitted_at on submission, etc).
--
-- Both functions enforce caller authorization with the same RLS helpers
-- the table policies use, so they're safe to call from the client.

-- ──────────────────────────────────────────────────────────────────────
-- create_narrative_campaign
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.create_narrative_campaign(
  _club_id            uuid,
  _title              text,
  _pitch              text,
  _description        text,
  _template_key       text,
  _tone_profile       text,
  _play_mode          text,
  _visibility         text,
  _player_limit       int,
  _spectators_allowed boolean,
  _content_notes      text,
  _opening_premise    text,
  _schedule_note      text,
  _proposed_gm_id     uuid,
  _submit             boolean
)
returns public.narrative_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _row    public.narrative_campaigns;
  _gm     uuid := coalesce(_proposed_gm_id, _caller);
  _status text := case when _submit then 'pending_approval' else 'draft' end;
begin
  if _caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Caller must belong to the target club (or be an app admin). Drafts
  -- still require club membership.
  if not exists (
    select 1 from public.club_members
     where club_id = _club_id and user_id = _caller
  ) and not public.is_app_admin(_caller) then
    raise exception 'caller is not a member of club %', _club_id using errcode = '42501';
  end if;

  if coalesce(btrim(_title), '') = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  insert into public.narrative_campaigns (
    club_id, title, pitch, description, template_key,
    tone_profile, play_mode, visibility, player_limit,
    spectators_allowed, content_notes, opening_premise,
    schedule_note, created_by, proposed_gm_id, status,
    submitted_at
  ) values (
    _club_id, btrim(_title), nullif(btrim(_pitch), ''),
    nullif(btrim(_description), ''), coalesce(_template_key, 'blank'),
    nullif(btrim(_tone_profile), ''),
    coalesce(_play_mode, 'both'),
    coalesce(_visibility, 'club_visible'),
    _player_limit,
    coalesce(_spectators_allowed, false),
    nullif(btrim(_content_notes), ''),
    nullif(btrim(_opening_premise), ''),
    nullif(btrim(_schedule_note), ''),
    _caller,
    _gm,
    _status,
    case when _submit then now() else null end
  )
  returning * into _row;

  -- GM membership row (idempotent on unique (campaign_id, user_id))
  insert into public.narrative_campaign_members (
    campaign_id, user_id, role, status, invited_by
  ) values (
    _row.id, _gm, 'game_master', 'active', _caller
  )
  on conflict (campaign_id, user_id) do update
    set role = excluded.role,
        status = excluded.status;

  insert into public.narrative_approval_events (
    campaign_id, actor_id, event_type, from_status, to_status
  ) values (
    _row.id,
    _caller,
    case when _submit then 'submitted' else 'created_draft' end,
    null,
    _row.status
  );

  return _row;
end;
$$;

grant execute on function public.create_narrative_campaign(
  uuid, text, text, text, text, text, text, text, int, boolean,
  text, text, text, uuid, boolean
) to authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- transition_narrative_campaign
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.transition_narrative_campaign(
  _campaign_id  uuid,
  _next_status  text,
  _event_type   text,
  _notes        text
)
returns public.narrative_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  _caller uuid := auth.uid();
  _prev   public.narrative_campaigns;
  _row    public.narrative_campaigns;
begin
  if _caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into _prev from public.narrative_campaigns where id = _campaign_id;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;

  -- Authorization. Admins (and app admins) can run any transition.
  -- The campaign's GM/creator can submit_for_approval + archive their
  -- own draft. Everything else (approve / reject / request_changes) is
  -- admin-only.
  if not public.narrative_is_club_admin(_campaign_id, _caller) then
    if _next_status = 'pending_approval'
       and (_prev.created_by = _caller or _prev.gm_id = _caller or _prev.proposed_gm_id = _caller)
       and _prev.status in ('draft', 'needs_changes')
    then
      -- ok — owner can submit/resubmit own proposal
      null;
    elsif _next_status = 'archived'
          and (_prev.created_by = _caller or _prev.gm_id = _caller)
          and _prev.status in ('draft', 'needs_changes', 'rejected', 'completed', 'active', 'paused')
    then
      -- ok — owner can archive own campaign
      null;
    else
      raise exception 'not authorized to transition campaign to %', _next_status using errcode = '42501';
    end if;
  end if;

  -- Guard archive from pending_approval (review bug #10): admins must
  -- explicitly reject or request changes first.
  if _next_status = 'archived' and _prev.status = 'pending_approval' then
    raise exception 'cannot archive a pending_approval campaign — reject or request changes first'
      using errcode = '42501';
  end if;

  update public.narrative_campaigns
     set status = _next_status,
         -- Clear stale approval_notes on approval (bug #9). For other
         -- transitions, write the caller-supplied notes when provided,
         -- otherwise preserve.
         approval_notes = case
           when _next_status = 'active' then null
           when _notes is not null then _notes
           else approval_notes
         end,
         submitted_at = case
           when _next_status = 'pending_approval' then now()
           else submitted_at
         end,
         approved_at = case
           when _next_status = 'active' then now()
           else approved_at
         end,
         approved_by = case
           when _next_status = 'active' then _caller
           else approved_by
         end,
         -- Lock in the GM on approval (bug #1).
         gm_id = case
           when _next_status = 'active' then coalesce(gm_id, proposed_gm_id)
           else gm_id
         end
   where id = _campaign_id
  returning * into _row;

  insert into public.narrative_approval_events (
    campaign_id, actor_id, event_type, from_status, to_status, notes
  ) values (
    _campaign_id, _caller, _event_type, _prev.status, _next_status, _notes
  );

  return _row;
end;
$$;

grant execute on function public.transition_narrative_campaign(uuid, text, text, text) to authenticated;
