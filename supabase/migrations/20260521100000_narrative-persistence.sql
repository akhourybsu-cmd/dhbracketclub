-- DH Club — Narrative RPG · Persistence audit follow-up
--
-- Adds two campaign-level columns that the audit identified as living
-- only in client memory:
--
--   • canon_locks      — jsonb array of campaign-specific canon rules
--                        (e.g. "Velvetaine is the city. Not a metaphor.")
--                        Templates suggest these; the campaign owns its
--                        own copy after creation. Read by the AI service
--                        as immutable context.
--
--   • waiting_on_state — jsonb object capturing the GM's "who am I
--                        waiting on" pin: { mode, player_ids, required,
--                        since } where mode ∈ 'all' | 'specific'.
--                        Drives the Waiting-on-player status pill.
--                        Persists across refresh / devices / users.
--
-- Both are nullable + default to a safe empty value so existing
-- campaigns continue to work without backfill.

alter table public.narrative_campaigns
  add column if not exists canon_locks jsonb not null default '[]'::jsonb;

alter table public.narrative_campaigns
  add column if not exists waiting_on_state jsonb not null default '{}'::jsonb;

-- Convenience: a partial index for campaigns with an active waiting
-- state so the list page can quickly filter on "needs response".
create index if not exists narrative_campaigns_waiting_idx
  on public.narrative_campaigns ((waiting_on_state->>'mode'))
  where waiting_on_state ? 'mode';
