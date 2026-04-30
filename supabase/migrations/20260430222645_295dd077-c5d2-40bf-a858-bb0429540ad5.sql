-- Fix Mission Workshop Apply Live: prior version assigned bigint row_count
-- to a boolean variable, throwing on every operation Apply Live.
create or replace function public.apply_mission_draft_live(_draft_id uuid, _also_update_active_op boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller uuid := auth.uid();
  d record;
  archived_id uuid;
  op_updated boolean := false;
  row_n integer := 0;
  p1 integer;
  p2 integer;
  p3 integer;
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
    if p1 is not null and p2 is not null and p3 is not null then
      update public.nexus_operations
         set phase1_target = p1, phase2_target = p2, phase3_target = p3
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
$function$;