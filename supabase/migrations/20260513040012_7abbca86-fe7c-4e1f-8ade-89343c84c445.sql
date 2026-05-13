
-- Birthdays & Milestones plugin tables

create table if not exists public.club_celebration_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  show_on_home boolean not null default true,
  show_in_connect boolean not null default true,
  show_on_profiles boolean not null default true,
  reminder_days_before integer not null default 7,
  day_of_reminder boolean not null default true,
  allow_members_to_add_birthdays boolean not null default true,
  allow_members_to_create_milestones boolean not null default false,
  admins_can_manage_all boolean not null default true,
  auto_generate_connect_prompts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_birthdays (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null,
  birth_month integer not null check (birth_month between 1 and 12),
  birth_day integer not null check (birth_day between 1 and 31),
  birth_year integer,
  show_age boolean not null default false,
  visibility text not null default 'club' check (visibility in ('club','admins_only','hidden')),
  reminder_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table if not exists public.club_milestones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid,
  title text not null,
  description text,
  milestone_date date not null,
  recurrence text not null default 'none' check (recurrence in ('none','yearly')),
  type text not null default 'custom' check (type in ('club_anniversary','member_anniversary','achievement','custom')),
  created_by uuid not null,
  visibility text not null default 'club' check (visibility in ('club','admins_only','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_birthdays_club on public.member_birthdays(club_id);
create index if not exists idx_club_milestones_club on public.club_milestones(club_id);

alter table public.club_celebration_settings enable row level security;
alter table public.member_birthdays enable row level security;
alter table public.club_milestones enable row level security;

-- updated_at triggers
drop trigger if exists trg_ccs_updated on public.club_celebration_settings;
create trigger trg_ccs_updated before update on public.club_celebration_settings
  for each row execute function public.set_updated_at();
drop trigger if exists trg_mb_updated on public.member_birthdays;
create trigger trg_mb_updated before update on public.member_birthdays
  for each row execute function public.set_updated_at();
drop trigger if exists trg_cm_updated on public.club_milestones;
create trigger trg_cm_updated before update on public.club_milestones
  for each row execute function public.set_updated_at();

-- ── club_celebration_settings policies ────────────────────────────
drop policy if exists ccs_select on public.club_celebration_settings;
create policy ccs_select on public.club_celebration_settings
  for select to authenticated
  using (
    exists (select 1 from public.club_members m
            where m.club_id = club_celebration_settings.club_id
              and m.user_id = auth.uid())
    or public.is_app_admin(auth.uid())
  );

drop policy if exists ccs_admin_write on public.club_celebration_settings;
create policy ccs_admin_write on public.club_celebration_settings
  for all to authenticated
  using (public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()))
  with check (public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

-- ── member_birthdays policies ─────────────────────────────────────
drop policy if exists mb_select on public.member_birthdays;
create policy mb_select on public.member_birthdays
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_app_admin(auth.uid())
    or (
      exists (select 1 from public.club_members m
              where m.club_id = member_birthdays.club_id
                and m.user_id = auth.uid())
      and (
        visibility = 'club'
        or (visibility = 'admins_only' and public.is_club_admin(auth.uid(), club_id))
      )
    )
  );

drop policy if exists mb_insert_self on public.member_birthdays;
create policy mb_insert_self on public.member_birthdays
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members m
                where m.club_id = member_birthdays.club_id
                  and m.user_id = auth.uid())
  );

drop policy if exists mb_update_self on public.member_birthdays;
create policy mb_update_self on public.member_birthdays
  for update to authenticated
  using (user_id = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

drop policy if exists mb_delete_self on public.member_birthdays;
create policy mb_delete_self on public.member_birthdays
  for delete to authenticated
  using (user_id = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

-- ── club_milestones policies ──────────────────────────────────────
drop policy if exists cm_select on public.club_milestones;
create policy cm_select on public.club_milestones
  for select to authenticated
  using (
    public.is_app_admin(auth.uid())
    or (
      exists (select 1 from public.club_members m
              where m.club_id = club_milestones.club_id
                and m.user_id = auth.uid())
      and (
        visibility = 'club'
        or (visibility = 'admins_only' and public.is_club_admin(auth.uid(), club_id))
        or created_by = auth.uid()
      )
    )
  );

drop policy if exists cm_insert on public.club_milestones;
create policy cm_insert on public.club_milestones
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.club_members m
                where m.club_id = club_milestones.club_id
                  and m.user_id = auth.uid())
    and (
      public.is_club_admin(auth.uid(), club_id)
      or public.is_app_admin(auth.uid())
      or coalesce(
           (select allow_members_to_create_milestones
              from public.club_celebration_settings
             where club_id = club_milestones.club_id),
           false
         )
    )
  );

drop policy if exists cm_update on public.club_milestones;
create policy cm_update on public.club_milestones
  for update to authenticated
  using (created_by = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()))
  with check (created_by = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

drop policy if exists cm_delete on public.club_milestones;
create policy cm_delete on public.club_milestones
  for delete to authenticated
  using (created_by = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));
