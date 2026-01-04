/*
  # Add Volume Loop Closure Tracking

  1. New Fields for Weeks Table
    - `volume_finalized` (boolean) - Tracks if the volume allocation loop is closed
    - `volume_finalized_at` (timestamptz) - When the loop was closed
    - `volume_finalized_by` (text) - User who closed the loop
  
  2. Purpose
    - Track completion of the full volume allocation cycle:
      1. RF sets volume needs
      2. RF allocates volume to suppliers
      3. RF sends allocation to suppliers
      4. Suppliers respond with acceptance/counter-offers
      5. RF accepts supplier responses
      6. RF closes the loop (NEW)
  
  3. Security
    - No RLS changes needed (weeks table already has proper policies)
*/

-- Add volume finalization tracking to weeks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'volume_finalized'
  ) THEN
    ALTER TABLE weeks ADD COLUMN volume_finalized boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'volume_finalized_at'
  ) THEN
    ALTER TABLE weeks ADD COLUMN volume_finalized_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'volume_finalized_by'
  ) THEN
    ALTER TABLE weeks ADD COLUMN volume_finalized_by text;
  END IF;
END $$;

-- Create function to close the volume allocation loop
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
  
  -- Mark the week as volume finalized
  UPDATE public.weeks
  SET
    volume_finalized = true,
    volume_finalized_at = CURRENT_TIMESTAMP,
    volume_finalized_by = user_name
  WHERE id = week_id_param;
  
  -- Return success
  RETURN QUERY SELECT true, 'Volume allocation loop closed successfully', 0;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, 'Error: ' || SQLERRM, 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.close_volume_loop(uuid, text) TO anon, authenticated;
