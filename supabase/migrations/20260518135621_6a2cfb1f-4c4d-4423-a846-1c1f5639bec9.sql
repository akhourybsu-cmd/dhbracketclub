INSERT INTO public.platform_assets (slug, name, category, placement_area, short_description, full_description, icon_name, sort_order, is_active, is_premium, requires_configuration, default_configuration_json)
VALUES (
  'narrative-rpg',
  'Narrative RPG',
  'social',
  'navigation',
  'Run collaborative story-driven RPG campaigns with AI-assisted GM tools.',
  'A full Chronicle Engine for hosting narrative role-playing campaigns inside your club. Game Masters can propose campaigns, manage scenes, chapters, NPCs, clues, items, factions, and clocks, and use AI assistance for narration and suggestions. Players create characters, post in-character, roll dice, and contribute to evolving stories — async or in live sessions.',
  'BookOpen',
  160,
  true,
  false,
  false,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  placement_area = EXCLUDED.placement_area,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();