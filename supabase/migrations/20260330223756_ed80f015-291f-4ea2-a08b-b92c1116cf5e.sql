
ALTER TABLE public.lockbox_locks 
ADD COLUMN maze_grid jsonb;

-- Make maze_id nullable since new locks will use maze_grid instead
ALTER TABLE public.lockbox_locks 
ALTER COLUMN maze_id DROP NOT NULL;
