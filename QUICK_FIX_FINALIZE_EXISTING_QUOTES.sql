-- ============================================
-- QUICK FIX: Finalize Existing Quotes
-- ============================================
-- Run this to auto-set rf_final_fob for quotes that are stuck
-- This will finalize quotes based on available pricing data
-- ============================================

-- Option 1: Finalize ALL quotes for a specific week
-- Replace 'YOUR_WEEK_ID' with your actual week ID, or use:
-- Replace 6 with your week number

UPDATE quotes
SET rf_final_fob = CASE
  -- Priority 1: Use supplier revised price if available
  WHEN supplier_revised_fob IS NOT NULL AND supplier_revised_fob > 0 
    THEN supplier_revised_fob
  -- Priority 2: Supplier accepted counter
  WHEN supplier_response = 'accept' AND rf_counter_fob IS NOT NULL AND rf_counter_fob > 0 
    THEN rf_counter_fob
  -- Priority 3: Use RF counter if set (RF confirmed this price)
  WHEN rf_counter_fob IS NOT NULL AND rf_counter_fob > 0 
    THEN rf_counter_fob
  -- Priority 4: Use supplier's original price (RF accepts initial quote)
  WHEN supplier_fob IS NOT NULL AND supplier_fob > 0 
    THEN supplier_fob
  ELSE NULL
END,
updated_at = NOW()
WHERE rf_final_fob IS NULL
  AND supplier_fob IS NOT NULL
  AND supplier_fob > 0
  AND week_id = (SELECT id FROM weeks WHERE week_number = 6 LIMIT 1);  -- Change week_number as needed

-- Check how many were updated
SELECT 
  COUNT(*) as quotes_finalized,
  week_number
FROM quotes q
JOIN weeks w ON q.week_id = w.id
WHERE q.rf_final_fob IS NOT NULL
  AND w.week_number = 6  -- Change week_number as needed
GROUP BY week_number;

-- ============================================
-- Option 2: Finalize ALL weeks at once (use with caution)
-- ============================================
/*
UPDATE quotes
SET rf_final_fob = CASE
  WHEN supplier_revised_fob IS NOT NULL AND supplier_revised_fob > 0 
    THEN supplier_revised_fob
  WHEN supplier_response = 'accept' AND rf_counter_fob IS NOT NULL AND rf_counter_fob > 0 
    THEN rf_counter_fob
  WHEN rf_counter_fob IS NOT NULL AND rf_counter_fob > 0 
    THEN rf_counter_fob
  WHEN supplier_fob IS NOT NULL AND supplier_fob > 0 
    THEN supplier_fob
  ELSE NULL
END,
updated_at = NOW()
WHERE rf_final_fob IS NULL
  AND supplier_fob IS NOT NULL
  AND supplier_fob > 0;
*/

-- ============================================
-- Option 3: Check current status before fixing
-- ============================================
/*
SELECT 
  w.week_number,
  COUNT(*) as total_quotes,
  COUNT(q.rf_final_fob) as quotes_with_final_fob,
  COUNT(*) - COUNT(q.rf_final_fob) as quotes_missing_final_fob,
  COUNT(CASE WHEN q.supplier_fob IS NOT NULL THEN 1 END) as quotes_with_supplier_price
FROM weeks w
LEFT JOIN quotes q ON q.week_id = w.id
GROUP BY w.week_number, w.id
ORDER BY w.week_number DESC;
*/

