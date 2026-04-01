
-- Step 1: Delete duplicate rows, keeping the one with the most data (title not null preferred, then latest)
DELETE FROM public.message_link_previews
WHERE id NOT IN (
  SELECT DISTINCT ON (message_id, url) id
  FROM public.message_link_previews
  ORDER BY message_id, url, 
    (CASE WHEN title IS NOT NULL THEN 0 ELSE 1 END),
    created_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE public.message_link_previews
ADD CONSTRAINT message_link_previews_message_id_url_key UNIQUE (message_id, url);

-- Step 3: Drop the existing restrictive DELETE policy
DROP POLICY IF EXISTS "Users can delete own link previews" ON public.message_link_previews;

-- Step 4: Add a broader DELETE policy so any authenticated user can remove shared media
CREATE POLICY "Authenticated can delete link previews"
ON public.message_link_previews
FOR DELETE
TO authenticated
USING (true);
