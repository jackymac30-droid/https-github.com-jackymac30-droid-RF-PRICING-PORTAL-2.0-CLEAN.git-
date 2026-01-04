/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes on Foreign Keys
    - Add index on draft_allocations.supplier_id
    - Add index on week_item_internal_costs.item_id

  2. Drop Unused Indexes
    - idx_draft_allocations_item_id
    - idx_week_item_volumes_week_id
    - idx_week_item_volumes_item_id
    - idx_quotes_allocation_status
    - idx_quotes_supplier_allocation_status

  3. Drop Duplicate Indexes
    - Keep idx_week_item_volumes_item, drop idx_week_item_volumes_item_id
    - Keep idx_week_item_volumes_week, drop idx_week_item_volumes_week_id

  4. Fix Duplicate RLS Policies on week_item_volumes
    - Drop duplicate policies
    - Keep single set of policies

  5. Fix Function Search Path
    - Set immutable search_path on submit_supplier_response function
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Add index on draft_allocations.supplier_id
DROP INDEX IF EXISTS idx_draft_allocations_supplier_id;
CREATE INDEX IF NOT EXISTS idx_draft_allocations_supplier_id 
ON draft_allocations(supplier_id);

-- Add index on week_item_internal_costs.item_id  
DROP INDEX IF EXISTS idx_week_item_internal_costs_item_id;
CREATE INDEX IF NOT EXISTS idx_week_item_internal_costs_item_id 
ON week_item_internal_costs(item_id);

-- ============================================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_draft_allocations_item_id;
DROP INDEX IF EXISTS idx_week_item_volumes_week_id;
DROP INDEX IF EXISTS idx_week_item_volumes_item_id;
DROP INDEX IF EXISTS idx_quotes_allocation_status;
DROP INDEX IF EXISTS idx_quotes_supplier_allocation_status;

-- ============================================================================
-- 3. FIX DUPLICATE RLS POLICIES ON week_item_volumes
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can read volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Public can view week_item_volumes" ON week_item_volumes;
DROP POLICY IF EXISTS "Anyone can insert volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Public can insert week_item_volumes" ON week_item_volumes;
DROP POLICY IF EXISTS "Anyone can update volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Public can update week_item_volumes" ON week_item_volumes;
DROP POLICY IF EXISTS "Anyone can delete volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Public can delete week_item_volumes" ON week_item_volumes;

-- Create single set of policies (keeping simpler names)
CREATE POLICY "Public can view week_item_volumes"
  ON week_item_volumes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert week_item_volumes"
  ON week_item_volumes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update week_item_volumes"
  ON week_item_volumes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete week_item_volumes"
  ON week_item_volumes FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- 4. FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Recreate submit_supplier_response with immutable search_path
DROP FUNCTION IF EXISTS submit_supplier_response(uuid, uuid, uuid, integer, text);

CREATE OR REPLACE FUNCTION submit_supplier_response(
  p_week_id uuid,
  p_item_id uuid,
  p_supplier_id uuid,
  p_response_volume integer,
  p_response_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result json;
BEGIN
  -- Validate response status
  IF p_response_status NOT IN ('pending', 'accepted', 'revised') THEN
    RAISE EXCEPTION 'Invalid response status: %', p_response_status;
  END IF;

  -- Upsert the response
  INSERT INTO quotes (
    week_id,
    item_id,
    supplier_id,
    supplier_response_volume,
    supplier_response_status,
    supplier_response_submitted_at,
    updated_at
  )
  VALUES (
    p_week_id,
    p_item_id,
    p_supplier_id,
    p_response_volume,
    p_response_status,
    now(),
    now()
  )
  ON CONFLICT (week_id, item_id, supplier_id)
  DO UPDATE SET
    supplier_response_volume = EXCLUDED.supplier_response_volume,
    supplier_response_status = EXCLUDED.supplier_response_status,
    supplier_response_submitted_at = EXCLUDED.supplier_response_submitted_at,
    updated_at = EXCLUDED.updated_at
  RETURNING to_json(quotes.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_supplier_response(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_supplier_response(uuid, uuid, uuid, integer, text) TO anon;

-- ============================================================================
-- 5. VERIFY RESULTS
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Security and performance fixes applied successfully';
END $$;
