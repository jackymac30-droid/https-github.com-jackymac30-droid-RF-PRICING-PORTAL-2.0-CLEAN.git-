-- ============================================
-- Comprehensive Auto-Finalize Pricing Solution
-- ============================================
-- This SQL provides multiple ways to auto-set rf_final_fob:
-- 1. Trigger that fires when supplier responds
-- 2. Function RF can call to finalize existing quotes
-- ============================================
-- 
-- To apply: Copy and paste this entire script into Supabase SQL Editor
-- ============================================

-- ============================================
-- Step 1: Enhanced Trigger
-- ============================================

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_set_rf_final_fob ON quotes;

-- Enhanced function
CREATE OR REPLACE FUNCTION auto_set_rf_final_fob()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if rf_final_fob is not already set (don't overwrite manual entries)
  IF NEW.rf_final_fob IS NULL THEN
    
    -- Scenario 1: Supplier accepts counter offer
    IF NEW.supplier_response = 'accept' 
       AND NEW.rf_counter_fob IS NOT NULL 
       AND NEW.rf_counter_fob > 0 THEN
      NEW.rf_final_fob := NEW.rf_counter_fob;
    END IF;
    
    -- Scenario 2: Supplier revises price
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

-- Create trigger
CREATE TRIGGER trigger_auto_set_rf_final_fob
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  WHEN (
    -- Fire on any relevant field change
    (OLD.supplier_response IS DISTINCT FROM NEW.supplier_response)
    OR
    (OLD.supplier_revised_fob IS DISTINCT FROM NEW.supplier_revised_fob)
    OR
    (OLD.rf_counter_fob IS DISTINCT FROM NEW.rf_counter_fob)
  )
  EXECUTE FUNCTION auto_set_rf_final_fob();

-- ============================================
-- Step 2: Function for RF to Auto-Finalize Existing Quotes
-- ============================================

CREATE OR REPLACE FUNCTION auto_finalize_quotes_for_week(p_week_id uuid)
RETURNS TABLE (
  quotes_updated integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
  v_quote record;
BEGIN
  -- Loop through all quotes for this week that don't have rf_final_fob set
  FOR v_quote IN 
    SELECT id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob
    FROM quotes
    WHERE week_id = p_week_id
      AND rf_final_fob IS NULL
      AND supplier_fob IS NOT NULL
      AND supplier_fob > 0
  LOOP
    -- Determine the final price based on available data
    DECLARE
      v_final_price numeric;
    BEGIN
      -- Priority 1: Supplier revised price
      IF v_quote.supplier_revised_fob IS NOT NULL AND v_quote.supplier_revised_fob > 0 THEN
        v_final_price := v_quote.supplier_revised_fob;
      -- Priority 2: Supplier accepted counter
      ELSIF v_quote.supplier_response = 'accept' AND v_quote.rf_counter_fob IS NOT NULL AND v_quote.rf_counter_fob > 0 THEN
        v_final_price := v_quote.rf_counter_fob;
      -- Priority 3: RF counter (if supplier hasn't responded yet, use counter as final)
      ELSIF v_quote.rf_counter_fob IS NOT NULL AND v_quote.rf_counter_fob > 0 THEN
        v_final_price := v_quote.rf_counter_fob;
      -- Priority 4: Supplier's original price (only if no counter was sent)
      ELSIF v_quote.supplier_fob IS NOT NULL AND v_quote.supplier_fob > 0 THEN
        v_final_price := v_quote.supplier_fob;
      ELSE
        v_final_price := NULL;
      END IF;
      
      -- Update the quote if we have a valid final price
      IF v_final_price IS NOT NULL AND v_final_price > 0 THEN
        UPDATE quotes
        SET rf_final_fob = v_final_price,
            updated_at = NOW()
        WHERE id = v_quote.id;
        
        v_updated_count := v_updated_count + 1;
      END IF;
    END;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    v_updated_count,
    CASE 
      WHEN v_updated_count > 0 THEN 
        format('Successfully finalized %s quote(s)', v_updated_count)
      ELSE 
        'No quotes were finalized. All quotes either already have rf_final_fob set or are missing supplier pricing data.'
    END;
END;
$$;

-- ============================================
-- Step 3: Grant Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION auto_finalize_quotes_for_week(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_finalize_quotes_for_week(uuid) TO anon;

-- ============================================
-- Step 4: How to Use
-- ============================================
-- 
-- To auto-finalize all quotes for a week:
-- SELECT * FROM auto_finalize_quotes_for_week('your-week-id-here');
-- 
-- Example:
-- SELECT * FROM auto_finalize_quotes_for_week(
--   (SELECT id FROM weeks WHERE week_number = 6 LIMIT 1)
-- );
-- ============================================

