-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Birthdays & Milestones plugin (Celebrations)
--
-- 1. Register the platform asset so it appears in the Asset Library.
-- 2. member_birthdays: per-club per-user birthday data (privacy-respecting).
-- 3. club_milestones: per-club celebratory milestones (admin-managed by default).
-- 4. club_celebration_settings: per-club plugin configuration.
--
-- Privacy notes:
--   • Birth year is OPTIONAL and only displayed when the member explicitly
--     opts in via show_age. All UI defaults show "Month Day".
--   • visibility = 'club' | 'admins_only' | 'hidden' on both tables.
--   • RLS gates which rows a caller can see based on visibility + role.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Asset Library entry ──────────────────────────────────────────

insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order)
values
  ('Birthdays & Milestones', 'birthdays-milestones', 'events',
   'Track birthdays and club milestones so your group never misses a celebration.',
   'Keep track of birthdays, club anniversaries, and important member milestones. Members add their own birthday with privacy controls; admins create club-wide milestones; everyone sees friendly reminders on Home and in a dedicated Celebrations page.',
   'PartyPopper', 'community', false, false, 160)
on conflict (slug) do update set
  name                   = excluded.name,
  short_description      = excluded.short_description,
  full_description       = excluded.full_description,
  icon_name              = excluded.icon_name,
  category               = excluded.category,
  placement_area         = excluded.placement_area,
  requires_configuration = excluded.requires_configuration,
  sort_order             = excluded.sort_order,
  is_active              = true;

-- ── 2. Member birthdays ────────────────────────────────────────────

create table if not exists public.member_birthdays (
  id              uuid          primary key default gen_random_uuid(),
  club_id         uuid          not null references public.clubs(id) on delete cascade,
  user_id         uuid          not null references auth.users(id)  on delete cascade,
  birth_month     int           not null,
  birth_day       int           not null,
  birth_year      int,
  show_age        boolean       not null default false,
  visibility      text          not null default 'club',
  reminder_opt_in boolean       not null default true,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  constraint member_birthdays_visibility_chk
    check (visibility in ('club', 'admins_only', 'hidden')),
  constraint member_birthdays_month_chk check (birth_month between 1 and 12),
  constraint member_birthdays_day_chk   check (birth_day between 1 and 31),
  constraint member_birthdays_year_chk  check (birth_year is null or birth_year between 1900 and extract(year from now())::int),
  -- One birthday row per (club, user). Joining another club gets its own row.
  unique (club_id, user_id)
);

create index if not exists member_birthdays_club_idx on public.member_birthdays (club_id);
create index if not exists member_birthdays_month_day_idx on public.member_birthdays (birth_month, birth_day);

-- ── 3. Club milestones ─────────────────────────────────────────────

create table if not exists public.club_milestones (
  id             uuid          primary key default gen_random_uuid(),
  club_id        uuid          not null references public.clubs(id) on delete cascade,
  user_id        uuid          references auth.users(id) on delete set null, -- nullable: club-level milestones
  title          text          not null,
  description    text,
  milestone_date date          not null,
  recurrence     text          not null default 'none',
  type           text          not null default 'custom',
  created_by     uuid          not null references auth.users(id) on delete set null,
  visibility     text          not null default 'club',
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),
  constraint club_milestones_visibility_chk
    check (visibility in ('club', 'admins_only', 'hidden')),
  constraint club_milestones_recurrence_chk
    check (recurrence in ('none', 'yearly')),
  constraint club_milestones_type_chk
    check (type in ('club_anniversary', 'member_anniversary', 'achievement', 'custom'))
);

create index if not exists club_milestones_club_date_idx on public.club_milestones (club_id, milestone_date);

-- ── 4. Plugin settings per club ────────────────────────────────────

create table if not exists public.club_celebration_settings (
  club_id                          uuid        primary key references public.clubs(id) on delete cascade,
  show_on_home                     boolean     not null default true,
  show_in_connect                  boolean     not null default true,
  show_on_profiles                 boolean     not null default true,
  reminder_days_before             int         not null default 7,
  day_of_reminder                  boolean     not null default true,
  allow_members_to_add_birthdays   boolean     not null default true,
  allow_members_to_create_milestones boolean   not null default false,
  admins_can_manage_all            boolean     not null default true,
  auto_generate_connect_prompts    boolean     not null default true,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  constraint club_celebration_settings_reminder_days_chk
    check (reminder_days_before between 0 and 60)
);

-- ── 5. Triggers ────────────────────────────────────────────────────

-- The existing set_updated_at() function is defined in the asset-library
-- migration. Reusing it here.

drop trigger if exists trg_member_birthdays_updated_at on public.member_birthdays;
create trigger trg_member_birthdays_updated_at
  before update on public.member_birthdays
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_club_milestones_updated_at on public.club_milestones;
create trigger trg_club_milestones_updated_at
  before update on public.club_milestones
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_club_celebration_settings_updated_at on public.club_celebration_settings;
create trigger trg_club_celebration_settings_updated_at
  before update on public.club_celebration_settings
  for each row execute procedure public.set_updated_at();

-- ── 6. RLS ─────────────────────────────────────────────────────────

alter table public.member_birthdays           enable row level security;
alter table public.club_milestones            enable row level security;
alter table public.club_celebration_settings  enable row level security;

-- Helper: is the caller a member of the given club?
-- (Same pattern as the asset library RLS — duplicated here for clarity.)

-- ▌ member_birthdays
drop policy if exists "Read visible birthdays"          on public.member_birthdays;
drop policy if exists "Manage own birthday"             on public.member_birthdays;
drop policy if exists "Admins manage all birthdays"     on public.member_birthdays;

create policy "Read visible birthdays"
  on public.member_birthdays for select to authenticated
  using (
    -- Self can always read own
    user_id = auth.uid()
    -- Club members can read 'club' visibility rows for their own club
    or (
      visibility = 'club'
      and exists (
        select 1 from public.club_members
        where club_id = member_birthdays.club_id and user_id = auth.uid()
      )
    )
    -- Club admins can read 'admins_only' rows for their club
    or (
      visibility = 'admins_only'
      and exists (
        select 1 from public.club_members
        where club_id = member_birthdays.club_id and user_id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "Manage own birthday"
  on public.member_birthdays for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins manage all birthdays"
  on public.member_birthdays for all to authenticated
  using (
    exists (
      select 1 from public.club_members
      where club_id = member_birthdays.club_id and user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.club_members
      where club_id = member_birthdays.club_id and user_id = auth.uid() and role = 'admin'
    )
  );

-- ▌ club_milestones
drop policy if exists "Read visible milestones"      on public.club_milestones;
drop policy if exists "Members create milestones"    on public.club_milestones;
drop policy if exists "Manage own milestones"        on public.club_milestones;
drop policy if exists "Admins manage all milestones" on public.club_milestones;

create policy "Read visible milestones"
  on public.club_milestones for select to authenticated
  using (
    -- Club visibility — any member of the same club
    (
      visibility = 'club'
      and exists (
        select 1 from public.club_members
        where club_id = club_milestones.club_id and user_id = auth.uid()
      )
    )
    -- Admins only — must be admin in same club
    or (
      visibility = 'admins_only'
      and exists (
        select 1 from public.club_members
        where club_id = club_milestones.club_id and user_id = auth.uid() and role = 'admin'
      )
    )
    -- Author can always read their own (even hidden) — used for drafts/preview
    or created_by = auth.uid()
  );

create policy "Members create milestones"
  on public.club_milestones for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.club_members cm
      where cm.club_id = club_milestones.club_id and cm.user_id = auth.uid()
    )
    and (
      -- Admins can always create
      exists (
        select 1 from public.club_members
        where club_id = club_milestones.club_id and user_id = auth.uid() and role = 'admin'
      )
      -- Or settings allow member-created milestones
      or exists (
        select 1 from public.club_celebration_settings ccs
        where ccs.club_id = club_milestones.club_id and ccs.allow_members_to_create_milestones = true
      )
    )
  );

create policy "Manage own milestones"
  on public.club_milestones for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Admins manage all milestones"
  on public.club_milestones for all to authenticated
  using (
    exists (
      select 1 from public.club_members
      where club_id = club_milestones.club_id and user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.club_members
      where club_id = club_milestones.club_id and user_id = auth.uid() and role = 'admin'
    )
  );

-- ▌ club_celebration_settings
drop policy if exists "Members read celebration settings" on public.club_celebration_settings;
drop policy if exists "Admins manage celebration settings" on public.club_celebration_settings;

create policy "Members read celebration settings"
  on public.club_celebration_settings for select to authenticated
  using (
    exists (
      select 1 from public.club_members
      where club_id = club_celebration_settings.club_id and user_id = auth.uid()
    )
  );

create policy "Admins manage celebration settings"
  on public.club_celebration_settings for all to authenticated
  using (
    exists (
      select 1 from public.club_members
      where club_id = club_celebration_settings.club_id and user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.club_members
      where club_id = club_celebration_settings.club_id and user_id = auth.uid() and role = 'admin'
    )
  );
