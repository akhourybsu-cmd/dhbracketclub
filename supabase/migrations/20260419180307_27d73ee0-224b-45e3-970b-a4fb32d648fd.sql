-- 1) Add external mapping columns to nfl_teams
ALTER TABLE public.nfl_teams
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_provider text;

CREATE UNIQUE INDEX IF NOT EXISTS nfl_teams_provider_external_uniq
  ON public.nfl_teams (external_provider, external_id)
  WHERE external_id IS NOT NULL;

-- 2) Backfill ESPN team IDs by team abbreviation (ESPN uses these numeric IDs)
UPDATE public.nfl_teams SET external_provider = 'espn', external_id = v.eid
FROM (VALUES
  ('ARI','22'),('ATL','1'),('BAL','33'),('BUF','2'),('CAR','29'),('CHI','3'),
  ('CIN','4'),('CLE','5'),('DAL','6'),('DEN','7'),('DET','8'),('GB','9'),
  ('HOU','34'),('IND','11'),('JAX','30'),('KC','12'),('LAC','24'),('LAR','14'),
  ('LV','13'),('MIA','15'),('MIN','16'),('NE','17'),('NO','18'),('NYG','19'),
  ('NYJ','20'),('PHI','21'),('PIT','23'),('SEA','26'),('SF','25'),('TB','27'),
  ('TEN','10'),('WAS','28')
) AS v(abbr, eid)
WHERE public.nfl_teams.abbr = v.abbr;

-- 3) Auto-derive nfl_weeks.status from its games
CREATE OR REPLACE FUNCTION public.recompute_nfl_week_status(_week_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int;
  finals int;
  started int;
  current_status text;
  new_status text;
BEGIN
  SELECT status INTO current_status FROM public.nfl_weeks WHERE id = _week_id;
  IF current_status = 'scored' THEN
    RETURN; -- never downgrade a scored week
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'final'),
    count(*) FILTER (WHERE kickoff_at <= now())
  INTO total, finals, started
  FROM public.nfl_games WHERE week_id = _week_id;

  IF total = 0 THEN
    new_status := 'upcoming';
  ELSIF finals = total THEN
    new_status := 'closed';
  ELSIF started > 0 AND started < total THEN
    new_status := 'partially_locked';
  ELSIF started = total THEN
    new_status := 'closed';
  ELSE
    new_status := 'open';
  END IF;

  UPDATE public.nfl_weeks SET status = new_status, updated_at = now()
  WHERE id = _week_id AND status IS DISTINCT FROM new_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_nfl_games_recompute_week_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_nfl_week_status(OLD.week_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_nfl_week_status(NEW.week_id);
    IF TG_OP = 'UPDATE' AND NEW.week_id IS DISTINCT FROM OLD.week_id THEN
      PERFORM public.recompute_nfl_week_status(OLD.week_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS nfl_games_status_recompute ON public.nfl_games;
CREATE TRIGGER nfl_games_status_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.nfl_games
FOR EACH ROW EXECUTE FUNCTION public.trg_nfl_games_recompute_week_status();