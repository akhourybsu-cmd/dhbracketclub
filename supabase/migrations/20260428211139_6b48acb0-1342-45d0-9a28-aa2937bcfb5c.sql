
CREATE TABLE public.nexus_mission_calibrations (
  mission_id integer PRIMARY KEY,
  start_energy_delta integer NOT NULL DEFAULT 0,
  base_hp_delta integer NOT NULL DEFAULT 0,
  reward_cores_delta integer NOT NULL DEFAULT 0,
  wave_reward_mult numeric NOT NULL DEFAULT 1.0,
  enemy_hp_mult numeric NOT NULL DEFAULT 1.0,
  enemy_shield_mult numeric NOT NULL DEFAULT 1.0,
  enemy_speed_mult numeric NOT NULL DEFAULT 1.0,
  boss_hp_mult numeric NOT NULL DEFAULT 1.0,
  boss_shield_mult numeric NOT NULL DEFAULT 1.0,
  spawn_count_mult numeric NOT NULL DEFAULT 1.0,
  spawn_interval_mult numeric NOT NULL DEFAULT 1.0,
  spawn_delay_mult numeric NOT NULL DEFAULT 1.0,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_wave_reward_mult CHECK (wave_reward_mult BETWEEN 0.25 AND 3.0),
  CONSTRAINT chk_enemy_hp_mult CHECK (enemy_hp_mult BETWEEN 0.25 AND 3.0),
  CONSTRAINT chk_enemy_shield_mult CHECK (enemy_shield_mult BETWEEN 0.0 AND 3.0),
  CONSTRAINT chk_enemy_speed_mult CHECK (enemy_speed_mult BETWEEN 0.5 AND 2.0),
  CONSTRAINT chk_boss_hp_mult CHECK (boss_hp_mult BETWEEN 0.25 AND 3.0),
  CONSTRAINT chk_boss_shield_mult CHECK (boss_shield_mult BETWEEN 0.0 AND 3.0),
  CONSTRAINT chk_spawn_count_mult CHECK (spawn_count_mult BETWEEN 0.25 AND 3.0),
  CONSTRAINT chk_spawn_interval_mult CHECK (spawn_interval_mult BETWEEN 0.25 AND 3.0),
  CONSTRAINT chk_spawn_delay_mult CHECK (spawn_delay_mult BETWEEN 0.0 AND 3.0),
  CONSTRAINT chk_start_energy_delta CHECK (start_energy_delta BETWEEN -300 AND 300),
  CONSTRAINT chk_base_hp_delta CHECK (base_hp_delta BETWEEN -25 AND 50),
  CONSTRAINT chk_reward_cores_delta CHECK (reward_cores_delta BETWEEN -100 AND 200)
);

ALTER TABLE public.nexus_mission_calibrations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (so live missions reflect tuning).
CREATE POLICY "calibrations readable by authenticated"
  ON public.nexus_mission_calibrations
  FOR SELECT
  TO authenticated
  USING (true);

-- Only app admins can write.
CREATE POLICY "calibrations insert by admin"
  ON public.nexus_mission_calibrations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY "calibrations update by admin"
  ON public.nexus_mission_calibrations
  FOR UPDATE
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY "calibrations delete by admin"
  ON public.nexus_mission_calibrations
  FOR DELETE
  TO authenticated
  USING (public.is_app_admin(auth.uid()));

CREATE TRIGGER trg_nexus_calibrations_updated_at
  BEFORE UPDATE ON public.nexus_mission_calibrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
