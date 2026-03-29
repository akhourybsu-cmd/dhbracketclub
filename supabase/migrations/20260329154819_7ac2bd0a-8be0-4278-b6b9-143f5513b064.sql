
-- Make channels.created_by nullable so system can seed channels
ALTER TABLE public.channels ALTER COLUMN created_by DROP NOT NULL;

-- Seed default channels with NULL created_by (system-created)
INSERT INTO public.channels (name, description, category_id, position, is_default, created_by) VALUES
  ('general', 'Main group chat', 'a0000000-0000-0000-0000-000000000001', 0, true, NULL),
  ('announcements', 'Important updates', 'a0000000-0000-0000-0000-000000000001', 1, false, NULL),
  ('sports', 'Games, scores, hot takes', 'a0000000-0000-0000-0000-000000000002', 0, false, NULL),
  ('movies-tv', 'What to watch', 'a0000000-0000-0000-0000-000000000002', 1, false, NULL),
  ('food', 'Restaurants, recipes, eats', 'a0000000-0000-0000-0000-000000000002', 2, false, NULL),
  ('random', 'Whatever goes', 'a0000000-0000-0000-0000-000000000002', 3, false, NULL),
  ('trips', 'Travel planning', 'a0000000-0000-0000-0000-000000000003', 0, false, NULL),
  ('fantasy', 'Fantasy leagues talk', 'a0000000-0000-0000-0000-000000000003', 1, false, NULL);
