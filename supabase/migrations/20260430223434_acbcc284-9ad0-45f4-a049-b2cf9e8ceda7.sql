-- 1) apply_mission_draft_live: also sync operation name/flavor to active op
create or replace function public.apply_mission_draft_live(_draft_id uuid, _also_update_active_op boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  d record;
  archived_id uuid;
  op_updated boolean := false;
  row_n integer := 0;
  p1 integer; p2 integer; p3 integer;
  op_name text; op_flavor text;
begin
  if caller is null then raise exception 'Not authenticated'; end if;
  if not public.is_app_admin(caller) then raise exception 'Admin only'; end if;

  select * into d from public.nexus_mission_drafts where id = _draft_id for update;
  if not found then raise exception 'Draft not found'; end if;
  if d.status = 'live' then
    return jsonb_build_object('ok', true, 'already_live', true, 'draft_id', d.id);
  end if;
  if d.status = 'archived' then
    raise exception 'Cannot promote an archived draft. Duplicate it first.';
  end if;

  update public.nexus_mission_drafts
     set status = 'archived', archived_at = now()
   where kind = d.kind and status = 'live'
   returning id into archived_id;

  update public.nexus_mission_drafts
     set status = 'live', applied_at = now(), updated_at = now()
   where id = d.id;

  if d.kind = 'operation' and coalesce(_also_update_active_op, true) then
    p1 := nullif(d.config->'phaseTargets'->>'phase1', '')::integer;
    p2 := nullif(d.config->'phaseTargets'->>'phase2', '')::integer;
    p3 := nullif(d.config->'phaseTargets'->>'phase3', '')::integer;
    op_name := nullif(d.config->>'name', '');
    op_flavor := nullif(d.config->>'flavor', '');
    if p1 is not null and p2 is not null and p3 is not null then
      update public.nexus_operations
         set phase1_target = p1,
             phase2_target = p2,
             phase3_target = p3,
             name = coalesce(op_name, name),
             flavor = coalesce(op_flavor, flavor),
             updated_at = now()
       where status = 'active';
      get diagnostics row_n = row_count;
      op_updated := row_n > 0;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'draft_id', d.id,
    'kind', d.kind,
    'archived_id', archived_id,
    'active_operation_updated', op_updated
  );
end;
$$;

-- 2) award_endless_rewards: read milestone rewards from live endless draft if present
create or replace function public.award_endless_rewards(_run_id uuid, _wave_reached integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  awarded jsonb := '[]'::jsonb;
  tokens_total integer := 0;
  tokens_step integer;
  granted boolean;
  salvage_mult numeric := 1.0;
  boost_cfg jsonb;
  live_cfg jsonb;
  milestones jsonb;
  m jsonb;
  m_wave integer;
  m_tokens integer;
  m_sigil text;
begin
  if caller is null then raise exception 'Not authenticated'; end if;
  if _wave_reached is null or _wave_reached < 1 then
    return jsonb_build_object('sigils', awarded, 'tokens', 0);
  end if;

  -- Salvage magnet boost
  select b.effect_config into boost_cfg
    from public.nexus_user_boosts ub
    join public.nexus_boosts b on b.id = ub.boost_id
   where ub.user_id = caller and ub.consumed_run_id = _run_id;
  if boost_cfg is not null and (boost_cfg ? 'salvageMult') then
    salvage_mult := coalesce((boost_cfg->>'salvageMult')::numeric, 1.0);
  end if;

  -- Try live endless draft for tunable milestones: config.endlessRewards.milestones = [{wave, tokens, sigilCode?}, ...]
  select config into live_cfg
    from public.nexus_mission_drafts
   where kind = 'endless' and status = 'live'
   limit 1;
  if live_cfg is not null then
    milestones := live_cfg->'endlessRewards'->'milestones';
  end if;

  if milestones is not null and jsonb_typeof(milestones) = 'array' then
    for m in select * from jsonb_array_elements(milestones)
    loop
      m_wave := nullif(m->>'wave','')::integer;
      m_tokens := coalesce(nullif(m->>'tokens','')::integer, 0);
      m_sigil := nullif(m->>'sigilCode','');
      if m_wave is not null and _wave_reached >= m_wave then
        if m_sigil is not null then
          granted := public._grant_sigil(caller, m_sigil, _run_id::text);
          if granted then
            awarded := awarded || jsonb_build_object('code', m_sigil, 'first_time', true);
          end if;
        end if;
        if m_tokens > 0 then
          tokens_step := floor(m_tokens * salvage_mult);
          tokens_total := tokens_total + tokens_step;
        end if;
      end if;
    end loop;
  else
    -- Fallback to hardcoded 10/20/30 milestones
    if _wave_reached >= 10 then
      granted := public._grant_sigil(caller, 'endless_wave_10', _run_id::text);
      tokens_step := floor(10 * salvage_mult);
      if granted then awarded := awarded || jsonb_build_object('code','endless_wave_10','first_time',true); end if;
      tokens_total := tokens_total + tokens_step;
    end if;
    if _wave_reached >= 20 then
      granted := public._grant_sigil(caller, 'endless_wave_20', _run_id::text);
      tokens_step := floor(20 * salvage_mult);
      if granted then awarded := awarded || jsonb_build_object('code','endless_wave_20','first_time',true); end if;
      tokens_total := tokens_total + tokens_step;
    end if;
    if _wave_reached >= 30 then
      granted := public._grant_sigil(caller, 'endless_wave_30', _run_id::text);
      tokens_step := floor(40 * salvage_mult);
      if granted then awarded := awarded || jsonb_build_object('code','endless_wave_30','first_time',true); end if;
      tokens_total := tokens_total + tokens_step;
    end if;
  end if;

  if tokens_total > 0 then
    perform public._credit_salvage(caller, tokens_total, 'endless_milestone', _run_id, 'wave_'||_wave_reached);
  end if;

  return jsonb_build_object('sigils', awarded, 'tokens', tokens_total, 'salvage_mult', salvage_mult);
end;
$$;