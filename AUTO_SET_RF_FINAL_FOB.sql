-- ============================================
-- Auto-Set rf_final_fob Trigger
-- ============================================
-- This SQL automatically sets rf_final_fob when suppliers respond to pricing
-- Fixes issue where pricing never reaches "finalized" state, blocking Volume tab
-- ============================================
-- 
-- To apply: Copy and paste this entire script into Supabase SQL Editor
-- ============================================

-- Step 1: Create function to auto-set rf_final_fob
CREATE OR REPLACE FUNCTION auto_set_rf_final_fob()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if rf_final_fob is not already set (don't overwrite manual entries)
  IF NEW.rf_final_fob IS NULL THEN
    
    -- Scenario 1: Supplier accepts counter offer
    -- Auto-finalize to the counter price
    IF NEW.supplier_response = 'accept' 
       AND NEW.rf_counter_fob IS NOT NULL 
       AND NEW.rf_counter_fob > 0 THEN
      NEW.rf_final_fob := NEW.rf_counter_fob;
    END IF;
    
    -- Scenario 2: Supplier revises price
    -- Auto-finalize to the revised price (RF has implicitly confirmed by receiving revision)
    IF NEW.supplier_response = 'revise' 
       AND NEW.supplier_revised_fob IS NOT NULL 
       AND NEW.supplier_revised_fob > 0 THEN
      NEW.rf_final_fob := NEW.supplier_revised_fob;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Step 2: Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_auto_set_rf_final_fob ON quotes;

-- Step 3: Create trigger that fires before UPDATE on quotes table
CREATE TRIGGER trigger_auto_set_rf_final_fob
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  WHEN (
    -- Only fire if supplier_response is being set or changed
    (OLD.supplier_response IS DISTINCT FROM NEW.supplier_response)
    OR
    (OLD.supplier_revised_fob IS DISTINCT FROM NEW.supplier_revised_fob)
    OR
    (OLD.rf_counter_fob IS DISTINCT FROM NEW.rf_counter_fob)
  )
  EXECUTE FUNCTION auto_set_rf_final_fob();

-- Step 4: Add documentation comments
COMMENT ON FUNCTION auto_set_rf_final_fob() IS 
  'Automatically sets rf_final_fob when supplier accepts counter or revises price. Ensures pricing can be finalized without manual intervention.';

COMMENT ON TRIGGER trigger_auto_set_rf_final_fob ON quotes IS 
  'Auto-sets rf_final_fob when supplier responds to pricing, enabling week finalization and Volume tab access.';

-- ============================================
-- Verification Query (optional - run to check it worked)
-- ============================================
-- SELECT 
--   trigger_name,
--   event_manipulation,
--   event_object_table,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_auto_set_rf_final_fob';
-- ============================================

