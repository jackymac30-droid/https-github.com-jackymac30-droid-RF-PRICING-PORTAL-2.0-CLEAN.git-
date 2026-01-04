/*
  # Fix week_item_volumes Policy Conflict
  
  1. Changes
    - Drop ALL existing policies on week_item_volumes to resolve conflicts
    - Recreate clean public access policies for demo mode
    - Ensure table exists with proper structure
  
  2. Security
    - Public access policies (matching other demo tables)
    - This resolves the conflict between authenticated and public policies
*/

-- Drop ALL existing policies that might conflict
DROP POLICY IF EXISTS "Authenticated users can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public read access to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public insert to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public update to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public delete from week_item_volumes" ON public.week_item_volumes;

-- Ensure table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.week_item_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  volume_needed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (week_id, item_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_week_id ON public.week_item_volumes(week_id);
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_item_id ON public.week_item_volumes(item_id);

-- Enable RLS
ALTER TABLE public.week_item_volumes ENABLE ROW LEVEL SECURITY;

-- Create clean public access policies (for demo mode)
CREATE POLICY "Public can view week_item_volumes"
  ON public.week_item_volumes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert week_item_volumes"
  ON public.week_item_volumes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update week_item_volumes"
  ON public.week_item_volumes
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete week_item_volumes"
  ON public.week_item_volumes
  FOR DELETE
  TO anon, authenticated
  USING (true);
