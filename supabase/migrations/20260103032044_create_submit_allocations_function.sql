/*
  # Create Submit Allocations Function
  
  1. New Function
    - `submit_allocations_to_suppliers` - Copies awarded_volume to offered_volume
    - Bypasses PostgREST schema cache issues by using direct SQL
  
  2. Purpose
    - Work around Supabase API schema cache issues
    - Ensure allocation submission works reliably
*/

CREATE OR REPLACE FUNCTION submit_allocations_to_suppliers(week_id_param uuid)
RETURNS TABLE (
  success boolean,
  updated_count integer,
  error_message text
) AS $$
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
  
  -- Return success
  RETURN QUERY SELECT true, v_updated_count, NULL::text;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error
  RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
