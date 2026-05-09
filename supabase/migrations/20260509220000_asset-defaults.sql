-- ═══════════════════════════════════════════════════════════════════
-- Asset defaults: backward-compat pre-install + new-club trigger
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Pre-install ALL active assets for every EXISTING club ────────
-- This preserves full navigation for Dry Horse and any other clubs
-- created before the asset library was introduced.
insert into public.club_installed_assets (club_id, asset_id, enabled, visible_to_members)
select c.id, a.id, true, true
from   public.clubs          c
cross join public.platform_assets a
where  a.is_active = true
on conflict (club_id, asset_id) do nothing;

-- ── 2. Trigger: auto-install default assets for NEW clubs ───────────
-- New clubs only get Chat, Feed, and Events out of the box.
-- All other features must be added via the Asset Library.
create or replace function public.auto_install_default_assets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_installed_assets (club_id, asset_id, enabled, visible_to_members)
  select new.id, id, true, true
  from   public.platform_assets
  where  slug    in ('chat', 'feed', 'events')
    and  is_active = true;
  return new;
end;
$$;

drop trigger if exists trg_club_default_assets on public.clubs;
create trigger trg_club_default_assets
  after insert on public.clubs
  for each row execute function public.auto_install_default_assets();
