-- Quest scope + objective type enums
CREATE TYPE public.rd_quest_scope AS ENUM ('daily', 'weekly');
CREATE TYPE public.rd_quest_status AS ENUM ('active', 'completed', 'claimed');

-- Catalog of available quest templates
CREATE TABLE public.rune_delve_quest_definitions (
  id TEXT PRIMARY KEY,
  scope public.rd_quest_scope NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objective_type TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 1,
  shard_reward INTEGER NOT NULL DEFAULT 50,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  hero_class TEXT,
  weight INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_quest_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quest definitions readable by authenticated"
  ON public.rune_delve_quest_definitions FOR SELECT
  TO authenticated USING (true);

-- Active quests per player per period
CREATE TABLE public.rune_delve_active_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quest_id TEXT NOT NULL REFERENCES public.rune_delve_quest_definitions(id) ON DELETE CASCADE,
  scope public.rd_quest_scope NOT NULL,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL,
  status public.rd_quest_status NOT NULL DEFAULT 'active',
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_id, period_key)
);

CREATE INDEX idx_rd_active_quests_user_period
  ON public.rune_delve_active_quests (user_id, scope, period_key);

ALTER TABLE public.rune_delve_active_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own active quests"
  ON public.rune_delve_active_quests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own active quests"
  ON public.rune_delve_active_quests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own active quests"
  ON public.rune_delve_active_quests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_rd_active_quests_updated_at
  BEFORE UPDATE ON public.rune_delve_active_quests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed quest catalog (8 shared + 4 personal)
INSERT INTO public.rune_delve_quest_definitions (id, scope, title, description, objective_type, target_value, shard_reward, xp_reward, is_personal, hero_class, weight) VALUES
  -- Daily shared
  ('daily_clear_3', 'daily', 'Triple Threat', 'Clear 3 dungeon levels today.', 'levels_cleared', 3, 75, 50, false, NULL, 10),
  ('daily_chain_8', 'daily', 'Master Weaver', 'Chain 8 or more runes in a single match.', 'longest_chain', 8, 60, 40, false, NULL, 10),
  ('daily_no_damage', 'daily', 'Untouchable', 'Clear a level without taking any damage.', 'no_damage_clear', 1, 80, 50, false, NULL, 8),
  ('daily_score_2000', 'daily', 'High Scorer', 'Earn 2,000 points across runs today.', 'total_score', 2000, 70, 40, false, NULL, 10),
  ('daily_kill_10', 'daily', 'Slayer', 'Defeat 10 enemies in dungeon runs.', 'enemies_defeated', 10, 60, 40, false, NULL, 10),
  -- Daily personal (class-tied)
  ('daily_play_class', 'daily', 'Hero Focus', 'Complete a run with your selected hero class.', 'class_run_complete', 1, 50, 30, true, NULL, 10),
  ('daily_use_ability', 'daily', 'Power Move', 'Use your hero''s special ability 3 times.', 'abilities_used', 3, 55, 30, true, NULL, 10),
  -- Weekly shared
  ('weekly_daily_x5', 'weekly', 'Daily Devotee', 'Complete the Daily Challenge 5 times this week.', 'daily_challenges_completed', 5, 250, 150, false, NULL, 10),
  ('weekly_boss_x3', 'weekly', 'Boss Hunter', 'Defeat 3 boss enemies this week.', 'bosses_defeated', 3, 200, 120, false, NULL, 10),
  ('weekly_shards_1500', 'weekly', 'Treasure Hoarder', 'Earn 1,500 shards from gameplay this week.', 'shards_earned', 1500, 200, 100, false, NULL, 10),
  ('weekly_l30_x5', 'weekly', 'Deep Delver', 'Clear 5 levels at L30 or higher.', 'high_level_clears', 5, 250, 150, false, NULL, 10),
  -- Weekly personal
  ('weekly_class_mastery', 'weekly', 'Path of Mastery', 'Earn 500 XP on your selected hero class.', 'class_xp_earned', 500, 220, 130, true, NULL, 10);