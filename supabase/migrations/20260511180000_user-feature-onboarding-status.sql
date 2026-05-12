-- ═══════════════════════════════════════════════════════════════════
-- DH Club — User feature-onboarding status tracking (optional)
--
-- The onboarding framework ships with a localStorage primary store so
-- everything works without this table. Apply this migration when you
-- want cross-device sync of onboarding completion / dismissal.
--
-- One row per (user, club, feature_key, onboarding_type). Importantly,
-- there is no unique constraint on `feature_version` so a version bump
-- can re-insert a new row for the same user/feature without colliding.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.user_feature_onboarding_status (
  id                  uuid          primary key default gen_random_uuid(),
  club_id             uuid          not null references public.clubs(id) on delete cascade,
  user_id             uuid          not null references auth.users(id)  on delete cascade,
  feature_key         text          not null,
  feature_version     integer       not null default 1,
  onboarding_type     text          not null,  -- 'club_intro' | 'new_feature' | 'feature_update'
  status              text          not null,  -- 'not_started' | 'seen' | 'completed' | 'dismissed' | 'remind_later'
  first_seen_at       timestamptz,
  completed_at        timestamptz,
  dismissed_at        timestamptz,
  remind_later_at     timestamptz,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  -- Permitted status values
  constraint user_feature_onboarding_status_status_chk
    check (status in ('not_started', 'seen', 'completed', 'dismissed', 'remind_later')),
  -- Permitted onboarding types
  constraint user_feature_onboarding_status_type_chk
    check (onboarding_type in ('club_intro', 'new_feature', 'feature_update')),
  -- One row per (user, club, feature_key, type) — version is part of the
  -- payload, not the key, so we can update in place on version bumps.
  unique (user_id, club_id, feature_key, onboarding_type)
);

create index if not exists user_feature_onboarding_status_user_club_idx
  on public.user_feature_onboarding_status (user_id, club_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_user_feature_onboarding_status_updated_at on public.user_feature_onboarding_status;
create trigger trg_user_feature_onboarding_status_updated_at
  before update on public.user_feature_onboarding_status
  for each row execute procedure public.set_updated_at();

-- RLS — users may only see + mutate their own rows.
alter table public.user_feature_onboarding_status enable row level security;

drop policy if exists "Read own onboarding status"   on public.user_feature_onboarding_status;
drop policy if exists "Insert own onboarding status" on public.user_feature_onboarding_status;
drop policy if exists "Update own onboarding status" on public.user_feature_onboarding_status;
drop policy if exists "Delete own onboarding status" on public.user_feature_onboarding_status;

create policy "Read own onboarding status"
  on public.user_feature_onboarding_status for select to authenticated
  using (user_id = auth.uid());

create policy "Insert own onboarding status"
  on public.user_feature_onboarding_status for insert to authenticated
  with check (user_id = auth.uid());

create policy "Update own onboarding status"
  on public.user_feature_onboarding_status for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Delete own onboarding status"
  on public.user_feature_onboarding_status for delete to authenticated
  using (user_id = auth.uid());
