/*
  # Comprehensive Fix - Create All Missing Objects
  
  1. Tables
    - Ensure `week_item_volumes` exists with proper structure
  
  2. Functions
    - Create `submit_allocations_to_suppliers` function
    - Updates quotes AND weeks table
  
  3. Security
    - Fix RLS policies (remove conflicts, allow anonymous access for demo)
  
  4. Purpose
    - Single migration to ensure all DB objects exist for production deploy
    - Fix all 404s and missing function errors
*/

-- ============================================================
-- 1. CREATE WEEK_ITEM_VOLUMES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.week_item_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  volume_needed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.week_item_volumes IS 'Tracks the volume needed (in cases) for each SKU in each week';
COMMENT ON COLUMN public.week_item_volumes.volume_needed IS 'Number of cases needed for this item in this week';

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'week_item_volumes_week_id_item_id_key'
  ) THEN
    ALTER TABLE public.week_item_volumes 
    ADD CONSTRAINT week_item_volumes_week_id_item_id_key 
    UNIQUE (week_id, item_id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_week_id ON public.week_item_volumes(week_id);
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_item_id ON public.week_item_volumes(item_id);

-- Enable RLS
ALTER TABLE public.week_item_volumes ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can delete volume needs" ON public.week_item_volumes;

-- Create new policies (allow anonymous for demo mode)
CREATE POLICY "Anyone can read volume needs"
  ON public.week_item_volumes
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert volume needs"
  ON public.week_item_volumes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update volume needs"
  ON public.week_item_volumes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete volume needs"
  ON public.week_item_volumes
  FOR DELETE
  USING (true);

-- ============================================================
-- 2. CREATE SUBMIT_ALLOCATIONS_TO_SUPPLIERS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_allocations_to_suppliers(week_id_param uuid)
RETURNS TABLE (
  success boolean,
  updated_count integer,
  error_message text
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  -- Update all quotes with awarded_volume for this week
  UPDATE quotes
  SET
    offered_volume = awarded_volume,
    supplier_volume_approval = 'pending',
    supplier_volume_response = NULL,
    supplier_volume_accepted = NULL,
    supplier_volume_response_notes = NULL,
    updated_at = NOW()
  WHERE 
    week_id = week_id_param
    AND awarded_volume IS NOT NULL
    AND awarded_volume > 0;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update weeks table to mark allocation as submitted
  UPDATE weeks
  SET
    allocation_submitted = true,
    allocation_submitted_at = NOW(),
    allocation_submitted_by = 'demo'
  WHERE id = week_id_param;
  
  -- Return success
  RETURN QUERY SELECT true, v_updated_count, NULL::text;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$;

-- ============================================================
-- 3. ENSURE AT LEAST ONE OPEN WEEK EXISTS
-- ============================================================

DO $$
DECLARE
  v_open_week_count integer;
  v_max_week_number integer;
  v_new_week_id uuid;
BEGIN
  -- Count open weeks
  SELECT COUNT(*) INTO v_open_week_count
  FROM weeks
  WHERE status = 'open';
  
  -- If no open weeks, create one
  IF v_open_week_count = 0 THEN
    -- Get the highest week number
    SELECT COALESCE(MAX(week_number), 0) INTO v_max_week_number
    FROM weeks;
    
    -- Create new open week
    INSERT INTO weeks (week_number, start_date, end_date, status)
    VALUES (
      v_max_week_number + 1,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '6 days',
      'open'
    )
    RETURNING id INTO v_new_week_id;
    
    -- Create quotes for all supplier/item combinations
    INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, supplier_dlvd)
    SELECT 
      v_new_week_id,
      s.id,
      i.id,
      NULL,
      NULL
    FROM suppliers s
    CROSS JOIN items i;
    
    RAISE NOTICE 'Created new open week: %', v_max_week_number + 1;
  END IF;
END $$;
