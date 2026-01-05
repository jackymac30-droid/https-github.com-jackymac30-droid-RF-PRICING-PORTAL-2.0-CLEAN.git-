/*
  # Fix week_item_volumes RLS and Auto-Seed Volume Needs
  
  1. Purpose
    - Ensure public access to week_item_volumes (for demo)
    - Create trigger to auto-seed volume_needed rows when week is created
    - Fix "seed volume not loading" blocker
  
  2. Changes
    - Drop conflicting RLS policies
    - Create clean public access policies
    - Create trigger to auto-create week_item_volumes rows for all items when week is created
*/

-- ============================================
-- Step 1: Fix RLS Policies
-- ============================================

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public read access to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public insert to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public update to week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Allow public delete from week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Public can view week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Public can insert week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Public can update week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Public can delete week_item_volumes" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can delete volume needs" ON public.week_item_volumes;

-- Ensure table exists
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
CREATE POLICY "Allow public read access to week_item_volumes"
  ON public.week_item_volumes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to week_item_volumes"
  ON public.week_item_volumes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to week_item_volumes"
  ON public.week_item_volumes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from week_item_volumes"
  ON public.week_item_volumes
  FOR DELETE
  TO public
  USING (true);

-- ============================================
-- Step 2: Create Function to Auto-Seed Volume Needs
-- ============================================

CREATE OR REPLACE FUNCTION auto_seed_volume_needs_for_week()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new week is created, automatically create week_item_volumes rows for all items
  -- This ensures seed volume data exists and prevents UI from breaking
  INSERT INTO public.week_item_volumes (week_id, item_id, volume_needed, created_at, updated_at)
  SELECT 
    NEW.id,
    items.id,
    0, -- Default to 0, RF will set actual values later
    NOW(),
    NOW()
  FROM public.items
  ON CONFLICT (week_id, item_id) DO NOTHING; -- Don't error if rows already exist
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================
-- Step 3: Create Trigger
-- ============================================

DROP TRIGGER IF EXISTS trigger_auto_seed_volume_needs ON public.weeks;

CREATE TRIGGER trigger_auto_seed_volume_needs
  AFTER INSERT ON public.weeks
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_volume_needs_for_week();

-- ============================================
-- Step 4: Backfill Existing Weeks (Optional)
-- ============================================

-- Create missing volume_needed rows for existing weeks that don't have them
INSERT INTO public.week_item_volumes (week_id, item_id, volume_needed, created_at, updated_at)
SELECT 
  w.id,
  i.id,
  0,
  NOW(),
  NOW()
FROM public.weeks w
CROSS JOIN public.items i
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.week_item_volumes wiv 
  WHERE wiv.week_id = w.id AND wiv.item_id = i.id
)
ON CONFLICT (week_id, item_id) DO NOTHING;

COMMENT ON FUNCTION auto_seed_volume_needs_for_week() IS 
  'Automatically creates week_item_volumes rows for all items when a new week is created. Ensures seed volume data exists and prevents UI from breaking.';

COMMENT ON TRIGGER trigger_auto_seed_volume_needs ON public.weeks IS 
  'Auto-seeds volume_needed rows (default 0) for all items when a week is created.';

