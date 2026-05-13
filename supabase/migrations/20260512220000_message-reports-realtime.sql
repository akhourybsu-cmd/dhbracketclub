-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Enable realtime for message_reports
--
-- Lets the admin Message Reports panel react to new reports + status
-- changes without manual refresh.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  begin
    alter publication supabase_realtime add table public.message_reports;
  exception
    -- Table is already part of the publication — safe to ignore so this
    -- migration stays re-runnable.
    when duplicate_object then null;
  end;
end $$;
