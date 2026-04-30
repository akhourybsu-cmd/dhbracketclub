-- Rebalance Co-op Operation phase targets for the new 30-wave Endless gauntlet.
-- Sim shows:
--   • realmix friend-group run: ~540 kills, ~17k score, ~12k boss dmg
--   • strong (balanced/optimizer): ~900 kills, ~29k score, ~20k boss dmg
-- New targets size each phase for ~10-20 quality runs from a small group,
-- so the Operation feels like a sustained 1-2 week effort, not a 16-run grind
-- on Phase 2 alone.

ALTER TABLE public.nexus_operations
  ALTER COLUMN phase1_target SET DEFAULT 6000,
  ALTER COLUMN phase2_target SET DEFAULT 220000,
  ALTER COLUMN phase3_target SET DEFAULT 80000;

-- Bring the active Operation in line with the new defaults (only if still
-- running). Phase progress is preserved — players keep their contributions.
UPDATE public.nexus_operations
   SET phase1_target = 6000,
       phase2_target = 220000,
       phase3_target = 80000
 WHERE status = 'active';