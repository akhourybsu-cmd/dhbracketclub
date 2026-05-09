-- ═══════════════════════════════════════════════════════════════════
-- Reset new-club assets
-- • Drop the auto-defaults trigger (new clubs start with a blank slate)
-- • Remove all pre-installed assets for every club EXCEPT Dry Horse
--   (Dry Horse keeps the bulk-install from the previous migration)
-- ═══════════════════════════════════════════════════════════════════

-- Drop trigger + function added in 20260509220000
drop trigger if exists trg_club_default_assets on public.clubs;
drop function if exists public.auto_install_default_assets();

-- Remove all installed assets for non-Dry-Horse clubs
delete from public.club_installed_assets
where club_id in (
  select id from public.clubs
  where lower(name) != 'dry horse'
);
