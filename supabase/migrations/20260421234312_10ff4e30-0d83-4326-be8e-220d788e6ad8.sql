
ALTER TABLE public.draft_playoff_matches
  DROP CONSTRAINT IF EXISTS draft_playoff_matches_round_check;

ALTER TABLE public.draft_playoff_matches
  ADD CONSTRAINT draft_playoff_matches_round_check
  CHECK (round IN ('qf', 'sf', 'final', 'third_place'));

ALTER TABLE public.draft_playoff_matches
  DROP CONSTRAINT IF EXISTS draft_playoff_matches_status_check;

ALTER TABLE public.draft_playoff_matches
  ADD CONSTRAINT draft_playoff_matches_status_check
  CHECK (status IN ('pending', 'awaiting_topic', 'in_progress', 'complete'));
