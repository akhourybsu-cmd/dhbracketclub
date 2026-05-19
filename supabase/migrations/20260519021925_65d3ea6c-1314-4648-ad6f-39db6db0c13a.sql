-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Narrative RPG plugin (Chronicle Engine)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Asset Library entry ──────────────────────────────────────────

insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order)
values
  ('Narrative RPG', 'narrative-rpg', 'social',
   'Run cinematic text-based RPG campaigns with Game Master tools, character sheets, dice rolls, clues, inventory, factions, campaign memory, and AI-assisted narration.',
   'Create and manage club-based narrative campaigns where members roleplay through story scenes, make decisions, roll dice, collect clues, track inventory, interact with factions, and build a living campaign history. Game Masters control the story while AI assists with narration, summaries, NPC dialogue, consequences, and structured state suggestions.',
   'ScrollText', 'community', false, false, 170)
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

-- ── 2. Core campaigns table ─────────────────────────────────────────

create table if not exists public.narrative_campaigns (
  id                  uuid          primary key default gen_random_uuid(),
  club_id             uuid          not null references public.clubs(id)        on delete cascade,
  title               text          not null,
  slug                text,
  pitch               text,
  description         text,
  template_key        text          not null default 'blank',
  status              text          not null default 'draft',
  visibility          text          not null default 'club_visible',
  play_mode           text          not null default 'both',
  tone_profile        text,
  content_notes       text,
  opening_premise     text,
  player_limit        int,
  spectators_allowed  boolean       not null default false,
  schedule_note       text,
  created_by          uuid          not null references auth.users(id) on delete cascade,
  proposed_gm_id      uuid          references auth.users(id) on delete set null,
  gm_id               uuid          references auth.users(id) on delete set null,
  approved_by         uuid          references auth.users(id) on delete set null,
  approval_notes      text,
  submitted_at        timestamptz,
  approved_at         timestamptz,
  current_chapter_id  uuid,
  current_scene_id    uuid,
  live_session_id     uuid,
  live_started_at     timestamptz,
  memory_summary      text,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint narrative_campaigns_status_chk
    check (status in ('draft', 'pending_approval', 'needs_changes', 'rejected', 'active', 'paused', 'completed', 'archived')),
  constraint narrative_campaigns_visibility_chk
    check (visibility in ('invite_only', 'club_visible', 'club_public')),
  constraint narrative_campaigns_play_mode_chk
    check (play_mode in ('async', 'live', 'both')),
  constraint narrative_campaigns_template_chk
    check (template_key in ('blank', 'flamingo_protocol'))
);

create index if not exists narrative_campaigns_club_idx     on public.narrative_campaigns (club_id);
create index if not exists narrative_campaigns_status_idx   on public.narrative_campaigns (club_id, status);
create index if not exists narrative_campaigns_gm_idx       on public.narrative_campaigns (gm_id);
create index if not exists narrative_campaigns_created_by_idx on public.narrative_campaigns (created_by);

drop trigger if exists narrative_campaigns_updated_at on public.narrative_campaigns;
create trigger narrative_campaigns_updated_at
  before update on public.narrative_campaigns
  for each row execute function public.set_updated_at();

-- ── 3. Campaign members ─────────────────────────────────────────────

create table if not exists public.narrative_campaign_members (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.narrative_campaigns(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         text        not null default 'player',
  status       text        not null default 'active',
  joined_at    timestamptz not null default now(),
  invited_by   uuid        references auth.users(id) on delete set null,
  constraint narrative_members_role_chk   check (role in ('game_master', 'player', 'spectator')),
  constraint narrative_members_status_chk check (status in ('invited', 'active', 'removed', 'pending')),
  unique (campaign_id, user_id)
);
create index if not exists narrative_members_campaign_idx on public.narrative_campaign_members (campaign_id);
create index if not exists narrative_members_user_idx     on public.narrative_campaign_members (user_id);

-- ── 4. Characters (Chronicle Ruleset) ───────────────────────────────

create table if not exists public.narrative_characters (
  id              uuid          primary key default gen_random_uuid(),
  campaign_id     uuid          not null references public.narrative_campaigns(id) on delete cascade,
  owner_id        uuid          not null references auth.users(id) on delete cascade,
  name            text          not null,
  pronouns        text,
  avatar_url      text,
  archetype       text,
  backstory       text,
  personality     text,
  goal            text,
  flaw            text,
  signature_move  text,
  stat_grit       int           not null default 0,
  stat_charm      int           not null default 0,
  stat_cunning    int           not null default 0,
  stat_chaos      int           not null default 0,
  stat_focus      int           not null default 0,
  inventory       jsonb         not null default '[]'::jsonb,
  conditions      jsonb         not null default '[]'::jsonb,
  notes_public    text,
  notes_private   text,
  is_retired      boolean       not null default false,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  constraint narrative_characters_stats_chk check (
    stat_grit between -2 and 5 and
    stat_charm between -2 and 5 and
    stat_cunning between -2 and 5 and
    stat_chaos between -2 and 5 and
    stat_focus between -2 and 5
  )
);
create index if not exists narrative_characters_campaign_idx on public.narrative_characters (campaign_id);
create index if not exists narrative_characters_owner_idx    on public.narrative_characters (owner_id);

drop trigger if exists narrative_characters_updated_at on public.narrative_characters;
create trigger narrative_characters_updated_at
  before update on public.narrative_characters
  for each row execute function public.set_updated_at();

-- ── 5. Chapters + Scenes ────────────────────────────────────────────

create table if not exists public.narrative_chapters (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.narrative_campaigns(id) on delete cascade,
  title        text        not null,
  description  text,
  status       text        not null default 'active',
  position     int         not null default 0,
  created_at   timestamptz not null default now(),
  constraint narrative_chapters_status_chk check (status in ('upcoming', 'active', 'completed'))
);
create index if not exists narrative_chapters_campaign_idx on public.narrative_chapters (campaign_id);

create table if not exists public.narrative_scenes (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.narrative_campaigns(id) on delete cascade,
  chapter_id      uuid        references public.narrative_chapters(id) on delete set null,
  title           text        not null,
  location        text,
  stakes          text,
  objective       text,
  public_notes    text,
  gm_notes        text,
  status          text        not null default 'active',
  position        int         not null default 0,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  created_by      uuid        references auth.users(id) on delete set null,
  constraint narrative_scenes_status_chk check (status in ('active', 'paused', 'completed'))
);
create index if not exists narrative_scenes_campaign_idx on public.narrative_scenes (campaign_id);
create index if not exists narrative_scenes_chapter_idx  on public.narrative_scenes (chapter_id);

-- ── 6. Story chat messages ──────────────────────────────────────────

create table if not exists public.narrative_messages (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.narrative_campaigns(id) on delete cascade,
  scene_id      uuid        references public.narrative_scenes(id) on delete set null,
  sender_id     uuid        references auth.users(id) on delete set null,
  character_id  uuid        references public.narrative_characters(id) on delete set null,
  npc_id        uuid,
  message_type  text        not null default 'player',
  body          text,
  visibility    text        not null default 'public',
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  constraint narrative_messages_visibility_chk check (visibility in ('public', 'gm_only', 'private')),
  constraint narrative_messages_type_chk check (message_type in (
    'player', 'character_action', 'gm_narration', 'npc_dialogue', 'ooc',
    'dice_roll', 'scene_card', 'clue_discovered', 'inventory_update',
    'faction_update', 'clock_update', 'system', 'campaign_summary',
    'chapter_transition', 'gm_private', 'ai_suggestion'
  ))
);
create index if not exists narrative_messages_campaign_idx on public.narrative_messages (campaign_id, created_at);
create index if not exists narrative_messages_scene_idx    on public.narrative_messages (scene_id, created_at);

-- ── 7. NPCs / Locations / Items / Clues / Factions ──────────────────

create table if not exists public.narrative_npcs (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name          text        not null,
  role          text,
  description   text,
  location      text,
  visibility    text        not null default 'public',
  relationship  text,
  secrets       text,
  motives       text,
  voice_notes   text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint narrative_npcs_visibility_chk check (visibility in ('public', 'gm_only'))
);
create index if not exists narrative_npcs_campaign_idx on public.narrative_npcs (campaign_id);

drop trigger if exists narrative_npcs_updated_at on public.narrative_npcs;
create trigger narrative_npcs_updated_at
  before update on public.narrative_npcs
  for each row execute function public.set_updated_at();

create table if not exists public.narrative_locations (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name          text        not null,
  description   text,
  region        text,
  visibility    text        not null default 'public',
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint narrative_locations_visibility_chk check (visibility in ('public', 'gm_only'))
);
create index if not exists narrative_locations_campaign_idx on public.narrative_locations (campaign_id);

create table if not exists public.narrative_items (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name            text        not null,
  description     text,
  owner_character_id uuid     references public.narrative_characters(id) on delete set null,
  visibility      text        not null default 'public',
  use_notes       text,
  related_scene_id uuid       references public.narrative_scenes(id) on delete set null,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint narrative_items_visibility_chk check (visibility in ('public', 'gm_only'))
);
create index if not exists narrative_items_campaign_idx on public.narrative_items (campaign_id);

create table if not exists public.narrative_clues (
  id              uuid        primary key default gen_random_uuid(),
  campaign_id     uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name            text        not null,
  description     text,
  discovered_by   uuid        references auth.users(id) on delete set null,
  visibility      text        not null default 'public',
  importance      text        not null default 'normal',
  status          text        not null default 'discovered',
  related_npc_id  uuid        references public.narrative_npcs(id) on delete set null,
  related_faction_id uuid,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint narrative_clues_visibility_chk check (visibility in ('public', 'gm_only')),
  constraint narrative_clues_status_chk     check (status in ('discovered', 'partial', 'solved', 'false_lead'))
);
create index if not exists narrative_clues_campaign_idx on public.narrative_clues (campaign_id);

create table if not exists public.narrative_factions (
  id                  uuid        primary key default gen_random_uuid(),
  campaign_id         uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name                text        not null,
  description         text,
  relationship_score  int         not null default 0,
  suspicion_score     int         not null default 0,
  attitude            text,
  visibility          text        not null default 'public',
  public_notes        text,
  gm_notes            text,
  metadata            jsonb       not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint narrative_factions_visibility_chk check (visibility in ('public', 'gm_only')),
  constraint narrative_factions_relationship_chk check (relationship_score between -100 and 100),
  constraint narrative_factions_suspicion_chk    check (suspicion_score between 0 and 100)
);
create index if not exists narrative_factions_campaign_idx on public.narrative_factions (campaign_id);

drop trigger if exists narrative_factions_updated_at on public.narrative_factions;
create trigger narrative_factions_updated_at
  before update on public.narrative_factions
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'narrative_clues_related_faction_fkey'
  ) then
    alter table public.narrative_clues
      add constraint narrative_clues_related_faction_fkey
        foreign key (related_faction_id) references public.narrative_factions(id) on delete set null;
  end if;
end $$;

-- ── 8. Clocks ───────────────────────────────────────────────────────

create table if not exists public.narrative_clocks (
  id                 uuid        primary key default gen_random_uuid(),
  campaign_id        uuid        not null references public.narrative_campaigns(id) on delete cascade,
  name               text        not null,
  description        text,
  current_value      int         not null default 0,
  max_value          int         not null default 6,
  clock_type         text        not null default 'danger',
  visibility         text        not null default 'public',
  related_faction_id uuid        references public.narrative_factions(id) on delete set null,
  related_npc_id     uuid        references public.narrative_npcs(id) on delete set null,
  related_location_id uuid       references public.narrative_locations(id) on delete set null,
  history            jsonb       not null default '[]'::jsonb,
  created_by         uuid        references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint narrative_clocks_visibility_chk check (visibility in ('public', 'gm_only')),
  constraint narrative_clocks_type_chk check (clock_type in ('danger', 'opportunity', 'mystery', 'faction', 'custom')),
  constraint narrative_clocks_value_chk check (current_value >= 0 and current_value <= max_value),
  constraint narrative_clocks_max_chk   check (max_value between 2 and 20)
);
create index if not exists narrative_clocks_campaign_idx on public.narrative_clocks (campaign_id);

drop trigger if exists narrative_clocks_updated_at on public.narrative_clocks;
create trigger narrative_clocks_updated_at
  before update on public.narrative_clocks
  for each row execute function public.set_updated_at();

-- ── 9. Memory + Summaries ───────────────────────────────────────────

create table if not exists public.narrative_memory (
  campaign_id      uuid        primary key references public.narrative_campaigns(id) on delete cascade,
  current_state    text,
  current_location text,
  current_objective text,
  active_characters jsonb     not null default '[]'::jsonb,
  active_npcs      jsonb       not null default '[]'::jsonb,
  major_decisions  jsonb       not null default '[]'::jsonb,
  running_jokes    jsonb       not null default '[]'::jsonb,
  important_quotes jsonb       not null default '[]'::jsonb,
  unresolved       jsonb       not null default '[]'::jsonb,
  canon_locks      jsonb       not null default '[]'::jsonb,
  tone_guide       text,
  gm_only_notes    text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid        references auth.users(id) on delete set null
);

create table if not exists public.narrative_summaries (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.narrative_campaigns(id) on delete cascade,
  scene_id     uuid        references public.narrative_scenes(id) on delete set null,
  chapter_id   uuid        references public.narrative_chapters(id) on delete set null,
  title        text,
  body         text        not null,
  visibility   text        not null default 'public',
  generated_by_ai boolean   not null default false,
  approved_by  uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint narrative_summaries_visibility_chk check (visibility in ('public', 'gm_only'))
);
create index if not exists narrative_summaries_campaign_idx on public.narrative_summaries (campaign_id, created_at);

-- ── 10. Dice rolls ──────────────────────────────────────────────────

create table if not exists public.narrative_rolls (
  id             uuid        primary key default gen_random_uuid(),
  campaign_id    uuid        not null references public.narrative_campaigns(id) on delete cascade,
  scene_id       uuid        references public.narrative_scenes(id) on delete set null,
  message_id     uuid        references public.narrative_messages(id) on delete set null,
  roller_id      uuid        references auth.users(id) on delete set null,
  character_id   uuid        references public.narrative_characters(id) on delete set null,
  stat           text        not null,
  modifier       int         not null default 0,
  difficulty     int         not null default 0,
  advantage      text        not null default 'none',
  d20            int         not null,
  total          int         not null,
  outcome        text        not null,
  reason         text,
  resolution     text,
  visibility     text        not null default 'public',
  created_at     timestamptz not null default now(),
  constraint narrative_rolls_stat_chk    check (stat in ('grit', 'charm', 'cunning', 'chaos', 'focus', 'none')),
  constraint narrative_rolls_outcome_chk check (outcome in ('failure', 'mixed', 'success', 'crit')),
  constraint narrative_rolls_advantage_chk check (advantage in ('none', 'advantage', 'disadvantage')),
  constraint narrative_rolls_visibility_chk check (visibility in ('public', 'gm_only')),
  constraint narrative_rolls_d20_chk     check (d20 between 1 and 20)
);
create index if not exists narrative_rolls_campaign_idx on public.narrative_rolls (campaign_id, created_at);

-- ── 11. AI suggestions queue ────────────────────────────────────────

create table if not exists public.narrative_ai_suggestions (
  id                     uuid        primary key default gen_random_uuid(),
  campaign_id            uuid        not null references public.narrative_campaigns(id) on delete cascade,
  scene_id               uuid        references public.narrative_scenes(id) on delete set null,
  created_by             uuid        references auth.users(id) on delete set null,
  suggestion_type        text        not null,
  prompt_context         text,
  suggested_content      text,
  suggested_state_updates jsonb      not null default '[]'::jsonb,
  status                 text        not null default 'pending',
  reviewed_by            uuid        references auth.users(id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  constraint narrative_ai_suggestions_status_chk check (status in ('pending', 'approved', 'rejected', 'edited'))
);
create index if not exists narrative_ai_suggestions_campaign_idx on public.narrative_ai_suggestions (campaign_id, status, created_at);

-- ── 12. Approval audit log ──────────────────────────────────────────

create table if not exists public.narrative_approval_events (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.narrative_campaigns(id) on delete cascade,
  actor_id     uuid        references auth.users(id) on delete set null,
  event_type   text        not null,
  from_status  text,
  to_status    text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists narrative_approval_events_campaign_idx on public.narrative_approval_events (campaign_id, created_at);

-- ── 13. GM-only private notes ───────────────────────────────────────

create table if not exists public.narrative_gm_notes (
  id           uuid        primary key default gen_random_uuid(),
  campaign_id  uuid        not null references public.narrative_campaigns(id) on delete cascade,
  scene_id     uuid        references public.narrative_scenes(id) on delete set null,
  author_id    uuid        references auth.users(id) on delete set null,
  title        text,
  body         text        not null,
  pinned       boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists narrative_gm_notes_campaign_idx on public.narrative_gm_notes (campaign_id);

drop trigger if exists narrative_gm_notes_updated_at on public.narrative_gm_notes;
create trigger narrative_gm_notes_updated_at
  before update on public.narrative_gm_notes
  for each row execute function public.set_updated_at();

-- ── 14. Helper functions ────────────────────────────────────────────

create or replace function public.narrative_is_member(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.narrative_campaign_members
    where campaign_id = _campaign and user_id = _user and status = 'active'
  );
$$;

create or replace function public.narrative_role_in(_campaign uuid, _user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.narrative_campaign_members
  where campaign_id = _campaign and user_id = _user and status = 'active'
  limit 1;
$$;

create or replace function public.narrative_is_gm(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.narrative_campaigns
    where id = _campaign and gm_id = _user
  ) or exists (
    select 1 from public.narrative_campaign_members
    where campaign_id = _campaign and user_id = _user
      and role = 'game_master' and status = 'active'
  );
$$;

create or replace function public.narrative_is_club_admin(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.narrative_campaigns c
    join public.club_members m on m.club_id = c.club_id
    where c.id = _campaign and m.user_id = _user and m.role = 'admin'
  ) or public.is_app_admin(_user);
$$;

create or replace function public.narrative_has_pending_invite(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.narrative_campaign_members
    where campaign_id = _campaign and user_id = _user and status = 'invited'
  );
$$;

create or replace function public.narrative_can_see_campaign(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  with c as (
    select * from public.narrative_campaigns where id = _campaign
  )
  select case
    when (select count(*) from c) = 0 then false
    when (select club_id from c) <> public.current_user_club_id() and not public.is_app_admin(_user) then false
    when (select created_by from c) = _user then true
    when (select proposed_gm_id from c) = _user then true
    when (select gm_id from c) = _user then true
    when public.narrative_is_club_admin(_campaign, _user) then true
    when (select status from c) in ('draft', 'pending_approval', 'needs_changes', 'rejected') then false
    when (select visibility from c) = 'invite_only' then
      public.narrative_is_member(_campaign, _user)
      or public.narrative_has_pending_invite(_campaign, _user)
    when (select visibility from c) in ('club_visible', 'club_public') then
      exists (select 1 from public.club_members m where m.club_id = (select club_id from c) and m.user_id = _user)
    else false
  end;
$$;

-- ── 15. Enable RLS + policies ───────────────────────────────────────

alter table public.narrative_campaigns          enable row level security;
alter table public.narrative_campaign_members   enable row level security;
alter table public.narrative_characters         enable row level security;
alter table public.narrative_chapters           enable row level security;
alter table public.narrative_scenes             enable row level security;
alter table public.narrative_messages           enable row level security;
alter table public.narrative_npcs               enable row level security;
alter table public.narrative_locations          enable row level security;
alter table public.narrative_items              enable row level security;
alter table public.narrative_clues              enable row level security;
alter table public.narrative_factions           enable row level security;
alter table public.narrative_clocks             enable row level security;
alter table public.narrative_memory             enable row level security;
alter table public.narrative_summaries          enable row level security;
alter table public.narrative_rolls              enable row level security;
alter table public.narrative_ai_suggestions     enable row level security;
alter table public.narrative_approval_events    enable row level security;
alter table public.narrative_gm_notes           enable row level security;

drop policy if exists narrative_campaigns_select on public.narrative_campaigns;
create policy narrative_campaigns_select on public.narrative_campaigns for select
  using (public.narrative_can_see_campaign(id, auth.uid()));

drop policy if exists narrative_campaigns_insert on public.narrative_campaigns;
create policy narrative_campaigns_insert on public.narrative_campaigns for insert
  with check (
    created_by = auth.uid()
    and club_id = public.current_user_club_id()
  );

drop policy if exists narrative_campaigns_update on public.narrative_campaigns;
create policy narrative_campaigns_update on public.narrative_campaigns for update
  using (
    created_by = auth.uid()
    or gm_id = auth.uid()
    or public.narrative_is_club_admin(id, auth.uid())
  );

drop policy if exists narrative_campaigns_delete on public.narrative_campaigns;
create policy narrative_campaigns_delete on public.narrative_campaigns for delete
  using (public.narrative_is_club_admin(id, auth.uid()));

drop policy if exists narrative_members_select on public.narrative_campaign_members;
create policy narrative_members_select on public.narrative_campaign_members for select
  using (public.narrative_can_see_campaign(campaign_id, auth.uid()));

drop policy if exists narrative_members_insert on public.narrative_campaign_members;
create policy narrative_members_insert on public.narrative_campaign_members for insert
  with check (
    public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists narrative_members_update on public.narrative_campaign_members;
create policy narrative_members_update on public.narrative_campaign_members for update
  using (
    public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists narrative_members_delete on public.narrative_campaign_members;
create policy narrative_members_delete on public.narrative_campaign_members for delete
  using (
    public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );

drop policy if exists narrative_characters_select on public.narrative_characters;
create policy narrative_characters_select on public.narrative_characters for select
  using (public.narrative_can_see_campaign(campaign_id, auth.uid()));

drop policy if exists narrative_characters_insert on public.narrative_characters;
create policy narrative_characters_insert on public.narrative_characters for insert
  with check (
    owner_id = auth.uid()
    and public.narrative_is_member(campaign_id, auth.uid())
  );

drop policy if exists narrative_characters_update on public.narrative_characters;
create policy narrative_characters_update on public.narrative_characters for update
  using (
    owner_id = auth.uid()
    or public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );

drop policy if exists narrative_characters_delete on public.narrative_characters;
create policy narrative_characters_delete on public.narrative_characters for delete
  using (
    owner_id = auth.uid()
    or public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );

drop policy if exists narrative_chapters_select on public.narrative_chapters;
create policy narrative_chapters_select on public.narrative_chapters for select
  using (public.narrative_can_see_campaign(campaign_id, auth.uid()));
drop policy if exists narrative_chapters_write on public.narrative_chapters;
create policy narrative_chapters_write on public.narrative_chapters for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_scenes_select on public.narrative_scenes;
create policy narrative_scenes_select on public.narrative_scenes for select
  using (public.narrative_can_see_campaign(campaign_id, auth.uid()));
drop policy if exists narrative_scenes_write on public.narrative_scenes;
create policy narrative_scenes_write on public.narrative_scenes for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_messages_select on public.narrative_messages;
create policy narrative_messages_select on public.narrative_messages for select
  using (
    public.narrative_can_see_campaign(campaign_id, auth.uid())
    and (
      visibility = 'public'
      or public.narrative_is_gm(campaign_id, auth.uid())
      or public.narrative_is_club_admin(campaign_id, auth.uid())
      or (visibility = 'private' and sender_id = auth.uid())
    )
  );

drop policy if exists narrative_messages_insert on public.narrative_messages;
create policy narrative_messages_insert on public.narrative_messages for insert
  with check (
    sender_id = auth.uid()
    and public.narrative_is_member(campaign_id, auth.uid())
    and (
      public.narrative_role_in(campaign_id, auth.uid()) <> 'spectator'
      or message_type in ('ooc')
    )
  );

drop policy if exists narrative_messages_update on public.narrative_messages;
create policy narrative_messages_update on public.narrative_messages for update
  using (
    sender_id = auth.uid()
    or public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );

drop policy if exists narrative_messages_delete on public.narrative_messages;
create policy narrative_messages_delete on public.narrative_messages for delete
  using (
    sender_id = auth.uid()
    or public.narrative_is_gm(campaign_id, auth.uid())
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );

do $$
declare
  t text;
  tables text[] := array['narrative_npcs', 'narrative_locations', 'narrative_items', 'narrative_clues', 'narrative_factions'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_visibility_select', t);
    execute format($f$
      create policy %I on public.%I for select
        using (
          public.narrative_can_see_campaign(campaign_id, auth.uid())
          and (visibility = 'public'
               or public.narrative_is_gm(campaign_id, auth.uid())
               or public.narrative_is_club_admin(campaign_id, auth.uid()))
        )
    $f$, t || '_visibility_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_gm_write', t);
    execute format($f$
      create policy %I on public.%I for all
        using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
        with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
    $f$, t || '_gm_write', t);
  end loop;
end $$;

drop policy if exists narrative_clocks_select on public.narrative_clocks;
create policy narrative_clocks_select on public.narrative_clocks for select
  using (
    public.narrative_can_see_campaign(campaign_id, auth.uid())
    and (visibility = 'public'
         or public.narrative_is_gm(campaign_id, auth.uid())
         or public.narrative_is_club_admin(campaign_id, auth.uid()))
  );
drop policy if exists narrative_clocks_write on public.narrative_clocks;
create policy narrative_clocks_write on public.narrative_clocks for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_memory_select on public.narrative_memory;
create policy narrative_memory_select on public.narrative_memory for select
  using (public.narrative_can_see_campaign(campaign_id, auth.uid()));
drop policy if exists narrative_memory_write on public.narrative_memory;
create policy narrative_memory_write on public.narrative_memory for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_summaries_select on public.narrative_summaries;
create policy narrative_summaries_select on public.narrative_summaries for select
  using (
    public.narrative_can_see_campaign(campaign_id, auth.uid())
    and (visibility = 'public'
         or public.narrative_is_gm(campaign_id, auth.uid())
         or public.narrative_is_club_admin(campaign_id, auth.uid()))
  );
drop policy if exists narrative_summaries_write on public.narrative_summaries;
create policy narrative_summaries_write on public.narrative_summaries for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_rolls_select on public.narrative_rolls;
create policy narrative_rolls_select on public.narrative_rolls for select
  using (
    public.narrative_can_see_campaign(campaign_id, auth.uid())
    and (visibility = 'public'
         or public.narrative_is_gm(campaign_id, auth.uid())
         or public.narrative_is_club_admin(campaign_id, auth.uid()))
  );
drop policy if exists narrative_rolls_insert on public.narrative_rolls;
create policy narrative_rolls_insert on public.narrative_rolls for insert
  with check (
    roller_id = auth.uid()
    and public.narrative_is_member(campaign_id, auth.uid())
    and public.narrative_role_in(campaign_id, auth.uid()) <> 'spectator'
  );
drop policy if exists narrative_rolls_update on public.narrative_rolls;
create policy narrative_rolls_update on public.narrative_rolls for update
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_ai_suggestions_all on public.narrative_ai_suggestions;
create policy narrative_ai_suggestions_all on public.narrative_ai_suggestions for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

drop policy if exists narrative_approval_events_select on public.narrative_approval_events;
create policy narrative_approval_events_select on public.narrative_approval_events for select
  using (
    exists (select 1 from public.narrative_campaigns c where c.id = campaign_id
      and (c.created_by = auth.uid() or c.gm_id = auth.uid() or c.proposed_gm_id = auth.uid()))
    or public.narrative_is_club_admin(campaign_id, auth.uid())
  );
drop policy if exists narrative_approval_events_insert on public.narrative_approval_events;
create policy narrative_approval_events_insert on public.narrative_approval_events for insert
  with check (
    actor_id = auth.uid()
    and (
      public.narrative_is_club_admin(campaign_id, auth.uid())
      or exists (select 1 from public.narrative_campaigns c where c.id = campaign_id and c.created_by = auth.uid())
    )
  );

drop policy if exists narrative_gm_notes_all on public.narrative_gm_notes;
create policy narrative_gm_notes_all on public.narrative_gm_notes for all
  using (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()))
  with check (public.narrative_is_gm(campaign_id, auth.uid()) or public.narrative_is_club_admin(campaign_id, auth.uid()));

-- ── 16. Realtime publication ────────────────────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.narrative_messages;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.narrative_clocks;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.narrative_scenes;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.narrative_campaigns;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.narrative_ai_suggestions; exception when duplicate_object then null; end;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- Atomic create + transition RPCs
-- ═══════════════════════════════════════════════════════════════════

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

  if not public.narrative_is_club_admin(_campaign_id, _caller) then
    if _next_status = 'pending_approval'
       and (_prev.created_by = _caller or _prev.gm_id = _caller or _prev.proposed_gm_id = _caller)
       and _prev.status in ('draft', 'needs_changes')
    then
      null;
    elsif _next_status = 'archived'
          and (_prev.created_by = _caller or _prev.gm_id = _caller)
          and _prev.status in ('draft', 'needs_changes', 'rejected', 'completed', 'active', 'paused')
    then
      null;
    else
      raise exception 'not authorized to transition campaign to %', _next_status using errcode = '42501';
    end if;
  end if;

  if _next_status = 'archived' and _prev.status = 'pending_approval' then
    raise exception 'cannot archive a pending_approval campaign — reject or request changes first'
      using errcode = '42501';
  end if;

  update public.narrative_campaigns
     set status = _next_status,
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