/*
  # Auto-Set rf_final_fob Trigger
  
  1. Purpose
    - Automatically set rf_final_fob when supplier responds to pricing
    - Ensures pricing can reach finalized state without manual intervention
    - Fixes issue where Volume tab is blocked because pricing never finalizes
  
  2. Changes
    - Create function to auto-set rf_final_fob based on supplier responses
    - Create trigger that fires on quotes table UPDATE
    - Handles three scenarios:
      a) Supplier accepts counter → set rf_final_fob = rf_counter_fob
      b) Supplier revises price → set rf_final_fob = supplier_revised_fob
      c) Supplier submits price (no counter) → leave null (RF must confirm)
  
  3. Business Logic
    - Only auto-sets if rf_final_fob is currently NULL (doesn't overwrite manual entries)
    - Respects RF's manual final price decisions
    - Ensures at least one quote has rf_final_fob set, allowing week finalization
*/

-- Create function to auto-set rf_final_fob when supplier responds
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
    
    -- Note: We don't auto-set for supplier_fob alone because:
    -- - RF may want to send a counter offer first
    -- - RF needs to explicitly confirm supplier's initial price
    -- - This preserves the negotiation workflow
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create trigger that fires before UPDATE on quotes table
DROP TRIGGER IF EXISTS trigger_auto_set_rf_final_fob ON quotes;

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

-- Add comment for documentation
COMMENT ON FUNCTION auto_set_rf_final_fob() IS 
  'Automatically sets rf_final_fob when supplier accepts counter or revises price. Ensures pricing can be finalized without manual intervention.';

COMMENT ON TRIGGER trigger_auto_set_rf_final_fob ON quotes IS 
  'Auto-sets rf_final_fob when supplier responds to pricing, enabling week finalization and Volume tab access.';

