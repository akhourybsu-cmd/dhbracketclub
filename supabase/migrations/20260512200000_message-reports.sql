-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Message reports
--
-- Lightweight moderation: any authenticated user can flag a chat
-- message; admins can review. One report per (message, reporter).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.message_reports (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        not null references public.messages(id) on delete cascade,
  reporter_id uuid        not null references auth.users(id)      on delete cascade,
  reason      text        not null,
  status      text        not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid        references auth.users(id),
  constraint message_reports_status_chk check (status in ('pending', 'reviewed', 'dismissed')),
  constraint message_reports_reason_len check (char_length(reason) between 1 and 500),
  unique (message_id, reporter_id)
);

create index if not exists message_reports_message_idx on public.message_reports (message_id);
create index if not exists message_reports_status_idx  on public.message_reports (status);

alter table public.message_reports enable row level security;

-- Reporters can insert their own report.
drop policy if exists message_reports_insert_own on public.message_reports;
create policy message_reports_insert_own
  on public.message_reports for insert
  with check (auth.uid() = reporter_id);

-- Reporters can read their own reports.
drop policy if exists message_reports_select_own on public.message_reports;
create policy message_reports_select_own
  on public.message_reports for select
  using (auth.uid() = reporter_id);

-- App admins can read & update all reports.
drop policy if exists message_reports_admin_select on public.message_reports;
create policy message_reports_admin_select
  on public.message_reports for select
  using (public.is_app_admin(auth.uid()));

drop policy if exists message_reports_admin_update on public.message_reports;
create policy message_reports_admin_update
  on public.message_reports for update
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));
