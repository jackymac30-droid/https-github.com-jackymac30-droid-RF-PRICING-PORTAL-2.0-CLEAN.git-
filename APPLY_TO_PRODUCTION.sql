-- ============================================================
-- PRODUCTION FIX - Run this in Supabase SQL Editor
-- ============================================================
-- This creates missing database objects and fixes Week 19 data
-- Copy and paste this entire file into your Supabase SQL Editor
-- ============================================================

-- 1. CREATE WEEK_ITEM_VOLUMES TABLE
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

-- Add unique constraint
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

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can read volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can insert volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can update volume needs" ON public.week_item_volumes;
DROP POLICY IF EXISTS "Anyone can delete volume needs" ON public.week_item_volumes;

-- Create new policies (allow anonymous for demo)
CREATE POLICY "Anyone can read volume needs"
  ON public.week_item_volumes FOR SELECT USING (true);

CREATE POLICY "Anyone can insert volume needs"
  ON public.week_item_volumes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update volume needs"
  ON public.week_item_volumes FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete volume needs"
  ON public.week_item_volumes FOR DELETE USING (true);

-- 2. CREATE SUBMIT_ALLOCATIONS_TO_SUPPLIERS FUNCTION
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

-- 3. FIX WEEK 19 PRICING CALCULATIONS
DO $$
DECLARE
  v_week_19_id uuid;
  v_strawberry_id uuid;
  v_blueberry_id uuid;
  v_raspberry_id uuid;
  v_blackberry_id uuid;
BEGIN
  -- Get week 19 ID (adjust week number if needed)
  SELECT id INTO v_week_19_id FROM weeks WHERE week_number = 19;

  -- Only proceed if week 19 exists
  IF v_week_19_id IS NOT NULL THEN
    SELECT id INTO v_strawberry_id FROM items WHERE name = 'Strawberry' LIMIT 1;
    SELECT id INTO v_blueberry_id FROM items WHERE name = 'Blueberry' LIMIT 1;
    SELECT id INTO v_raspberry_id FROM items WHERE name = 'Raspberry' LIMIT 1;
    SELECT id INTO v_blackberry_id FROM items WHERE name = 'Blackberry' LIMIT 1;

    -- Insert pricing calculations for Week 19
    INSERT INTO item_pricing_calculations (week_id, item_id, avg_price, rebate, freight, dlvd_price, margin)
    VALUES
      (v_week_19_id, v_strawberry_id, 10.00, 0.80, 1.75, 12.45, 1.50),
      (v_week_19_id, v_blueberry_id, 12.00, 0.80, 1.75, 14.45, 1.50),
      (v_week_19_id, v_raspberry_id, 14.00, 0.80, 1.75, 16.45, 1.50),
      (v_week_19_id, v_blackberry_id, 11.00, 0.80, 1.75, 13.45, 1.50)
    ON CONFLICT (week_id, item_id) DO UPDATE
    SET
      avg_price = EXCLUDED.avg_price,
      rebate = EXCLUDED.rebate,
      freight = EXCLUDED.freight,
      dlvd_price = EXCLUDED.dlvd_price,
      margin = EXCLUDED.margin,
      updated_at = NOW();

    RAISE NOTICE 'Fixed Week 19 pricing calculations';
  END IF;
END $$;

-- 4. VERIFY EVERYTHING WORKS
SELECT
  'week_item_volumes table' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'week_item_volumes'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
UNION ALL
SELECT
  'submit_allocations_to_suppliers function',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'submit_allocations_to_suppliers'
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END
UNION ALL
SELECT
  'Week 19 pricing calculations',
  CASE WHEN EXISTS (
    SELECT 1 FROM item_pricing_calculations ipc
    JOIN weeks w ON ipc.week_id = w.id
    WHERE w.week_number = 19 AND ipc.dlvd_price > 0
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END;
