-- ============================================================
-- Nexus Defense — Mission Workshop draft / live config storage
-- ============================================================

create table if not exists public.nexus_mission_drafts (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('endless','operation')),
  status        text not null default 'draft' check (status in ('draft','live','archived')),
  name          text not null,
  notes         text,
  config        jsonb not null default '{}'::jsonb,
  version       integer not null default 1,
  parent_id     uuid references public.nexus_mission_drafts(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  applied_at    timestamptz,
  archived_at   timestamptz
);

-- One live config per kind.
create unique index if not exists nexus_mission_drafts_one_live_per_kind
  on public.nexus_mission_drafts(kind)
  where status = 'live';

create index if not exists nexus_mission_drafts_kind_status_idx
  on public.nexus_mission_drafts(kind, status, updated_at desc);

create index if not exists nexus_mission_drafts_status_idx
  on public.nexus_mission_drafts(status);

alter table public.nexus_mission_drafts enable row level security;

-- Anyone signed-in can read live configs (engine reads them at run start).
create policy "drafts: read live"
  on public.nexus_mission_drafts
  for select
  to authenticated
  using (status = 'live');

-- Admins can read everything.
create policy "drafts: admin read all"
  on public.nexus_mission_drafts
  for select
  to authenticated
  using (public.is_app_admin(auth.uid()));

-- Admins can create, update, delete.
create policy "drafts: admin insert"
  on public.nexus_mission_drafts
  for insert
  to authenticated
  with check (public.is_app_admin(auth.uid()));

create policy "drafts: admin update"
  on public.nexus_mission_drafts
  for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));

create policy "drafts: admin delete"
  on public.nexus_mission_drafts
  for delete
  to authenticated
  using (public.is_app_admin(auth.uid()));

-- updated_at trigger
drop trigger if exists set_updated_at on public.nexus_mission_drafts;
create trigger set_updated_at
  before update on public.nexus_mission_drafts
  for each row
  execute function public.update_updated_at_column();

-- ----------------------------------------------------------------
-- apply_mission_draft_live(_draft_id, _also_update_active_op)
-- Atomically archives any current live config of the same kind and
-- promotes the chosen draft to live. For operations, optionally
-- pushes the new phase targets onto the currently-active operation
-- so subsequent contribution submissions use them.
-- ----------------------------------------------------------------
create or replace function public.apply_mission_draft_live(
  _draft_id uuid,
  _also_update_active_op boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  d record;
  archived_id uuid;
  op_updated boolean := false;
  p1 integer;
  p2 integer;
  p3 integer;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_app_admin(caller) then
    raise exception 'Admin only';
  end if;

  select * into d from public.nexus_mission_drafts where id = _draft_id for update;
  if not found then
    raise exception 'Draft not found';
  end if;
  if d.status = 'live' then
    return jsonb_build_object('ok', true, 'already_live', true, 'draft_id', d.id);
  end if;
  if d.status = 'archived' then
    raise exception 'Cannot promote an archived draft. Duplicate it first.';
  end if;

  -- Archive existing live row of the same kind.
  update public.nexus_mission_drafts
     set status = 'archived', archived_at = now()
   where kind = d.kind and status = 'live'
   returning id into archived_id;

  -- Promote selected draft.
  update public.nexus_mission_drafts
     set status = 'live', applied_at = now(), updated_at = now()
   where id = d.id;

  -- For operation kind: copy phase targets to the active operation row,
  -- so that newly-submitted contributions immediately use the new targets.
  if d.kind = 'operation' and coalesce(_also_update_active_op, true) then
    p1 := nullif(d.config->'phaseTargets'->>'phase1', '')::integer;
    p2 := nullif(d.config->'phaseTargets'->>'phase2', '')::integer;
    p3 := nullif(d.config->'phaseTargets'->>'phase3', '')::integer;
    if p1 is not null and p2 is not null and p3 is not null then
      update public.nexus_operations
         set phase1_target = p1,
             phase2_target = p2,
             phase3_target = p3
       where status = 'active';
      get diagnostics op_updated = row_count;
      op_updated := op_updated::int > 0;
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

revoke all on function public.apply_mission_draft_live(uuid, boolean) from public;
grant execute on function public.apply_mission_draft_live(uuid, boolean) to authenticated;
