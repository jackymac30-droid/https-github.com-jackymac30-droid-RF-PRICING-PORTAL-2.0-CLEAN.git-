/*
  # Fix Submit Allocations Function

  1. Function Fix
    - Drop and recreate `submit_allocations_to_suppliers` with proper security
    - Use fully qualified table names with secure search_path
    - Ensure it properly copies awarded_volume to offered_volume
    - Handle all volume-related fields correctly
  
  2. Security
    - Uses SECURITY DEFINER with immutable search_path
    - All references fully qualified with public schema
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS public.submit_allocations_to_suppliers(uuid);

-- Recreate with proper security and full qualification
CREATE OR REPLACE FUNCTION public.submit_allocations_to_suppliers(week_id_param uuid)
RETURNS TABLE (
  success boolean,
  updated_count integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  -- Update all quotes with awarded_volume for this week
  -- Copy awarded_volume to offered_volume and reset supplier response fields
  UPDATE public.quotes
  SET
    offered_volume = awarded_volume,
    supplier_volume_approval = 'pending',
    supplier_volume_response = NULL,
    supplier_volume_accepted = NULL,
    supplier_volume_response_notes = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE 
    week_id = week_id_param
    AND awarded_volume IS NOT NULL
    AND awarded_volume > 0;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update the week to mark allocations as submitted
  UPDATE public.weeks
  SET
    allocation_submitted = true,
    allocation_submitted_at = CURRENT_TIMESTAMP,
    allocation_submitted_by = 'system',
    updated_at = CURRENT_TIMESTAMP
  WHERE id = week_id_param;
  
  -- Return success with count
  RETURN QUERY SELECT true, v_updated_count, NULL::text;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error with message
  RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.submit_allocations_to_suppliers(uuid) TO anon, authenticated;

-- Verify the function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'submit_allocations_to_suppliers'
    AND n.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'Function submit_allocations_to_suppliers was not created successfully';
  END IF;
END $$;
