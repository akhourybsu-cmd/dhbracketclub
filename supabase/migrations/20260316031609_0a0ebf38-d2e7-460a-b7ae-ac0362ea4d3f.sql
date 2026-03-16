
-- Add updated_at triggers to tables that have updated_at columns

CREATE TRIGGER set_updated_at_games
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_brackets
  BEFORE UPDATE ON public.brackets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_bracket_picks
  BEFORE UPDATE ON public.bracket_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_game_external_mappings
  BEFORE UPDATE ON public.game_external_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_standings
  BEFORE UPDATE ON public.standings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_provider_configs
  BEFORE UPDATE ON public.provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
