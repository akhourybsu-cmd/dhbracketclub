-- Allow pool admins to delete their pools
CREATE POLICY "Admins can delete pools"
ON public.pools
FOR DELETE
TO authenticated
USING (is_pool_admin(auth.uid(), id));