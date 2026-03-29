
-- Add category column to rankings table
ALTER TABLE public.rankings ADD COLUMN IF NOT EXISTS category text DEFAULT null;

-- Create item_enrichments table for storing enrichment data
CREATE TABLE public.item_enrichments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT 'ranking_item',
  category text,
  normalized_name text,
  matched_name text,
  image_url text,
  thumbnail_url text,
  source_provider text,
  confidence numeric(3,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique constraint on item_id + item_type
ALTER TABLE public.item_enrichments ADD CONSTRAINT item_enrichments_item_unique UNIQUE (item_id, item_type);

-- Enable RLS
ALTER TABLE public.item_enrichments ENABLE ROW LEVEL SECURITY;

-- Enrichments viewable by all authenticated users
CREATE POLICY "Enrichments viewable by authenticated"
  ON public.item_enrichments FOR SELECT
  TO authenticated
  USING (true);

-- System/authenticated can insert enrichments
CREATE POLICY "Authenticated can insert enrichments"
  ON public.item_enrichments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated can update enrichments (for manual overrides)
CREATE POLICY "Authenticated can update enrichments"
  ON public.item_enrichments FOR UPDATE
  TO authenticated
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_item_enrichments_updated_at
  BEFORE UPDATE ON public.item_enrichments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
