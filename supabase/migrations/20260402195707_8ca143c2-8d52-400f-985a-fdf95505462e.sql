-- Allow authenticated users to create and manage channel categories
CREATE POLICY "Authenticated can create categories"
ON public.channel_categories FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update categories"
ON public.channel_categories FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete categories"
ON public.channel_categories FOR DELETE TO authenticated
USING (true);