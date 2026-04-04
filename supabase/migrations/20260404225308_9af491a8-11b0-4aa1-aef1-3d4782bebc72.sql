
-- Drop restrictive policies that require created_by match (broken for null created_by)
DROP POLICY IF EXISTS "Creator can update channels" ON public.channels;
DROP POLICY IF EXISTS "Creator can delete channels" ON public.channels;

-- Allow any authenticated user to update channels
CREATE POLICY "Authenticated can update channels"
ON public.channels
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow any authenticated user to delete channels
CREATE POLICY "Authenticated can delete channels"
ON public.channels
FOR DELETE
TO authenticated
USING (true);
