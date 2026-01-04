/*
  # Update Close Volume Loop to Lock Week Status

  1. Purpose
    - When RF closes the volume loop, the week status should be set to 'closed'
    - This prevents further changes to pricing and volumes
    - Emergency unlock allows RF to reopen for critical changes

  2. Changes
    - Update close_volume_loop function to set status = 'closed'
    - Keep volume_finalized flag for tracking
*/

CREATE OR REPLACE FUNCTION public.close_volume_loop(
  week_id_param uuid,
  user_name text
)
RETURNS TABLE (
  success boolean,
  message text,
  pending_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pending_count integer := 0;
BEGIN
  -- Check for any pending supplier responses (offered_volume > 0 but no awarded_volume)
  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.quotes
  WHERE week_id = week_id_param
    AND offered_volume > 0
    AND (awarded_volume IS NULL OR awarded_volume = 0);
  
  -- If there are pending responses, don't allow closing
  IF v_pending_count > 0 THEN
    RETURN QUERY SELECT false, 
      'Cannot close loop: ' || v_pending_count || ' supplier response(s) still pending',
      v_pending_count;
    RETURN;
  END IF;
  
  -- Mark the week as volume finalized AND lock the week status
  UPDATE public.weeks
  SET
    volume_finalized = true,
    volume_finalized_at = CURRENT_TIMESTAMP,
    volume_finalized_by = user_name,
    status = 'closed'  -- Lock the week status
  WHERE id = week_id_param;
  
  -- Return success
  RETURN QUERY SELECT true, 'Volume allocation loop closed successfully. Week is now locked.', 0;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, 'Error: ' || SQLERRM, 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.close_volume_loop(uuid, text) TO anon, authenticated;

