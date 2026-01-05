-- ============================================
-- FINAL FIX: Force Week Status to 'finalized'
-- ============================================
-- Run this if pricing is finalized but Award Volume still won't open
-- ============================================

-- Step 1: Check current status
SELECT 
  id,
  week_number,
  status,
  start_date,
  end_date,
  (SELECT COUNT(*) FROM quotes WHERE week_id = weeks.id AND rf_final_fob IS NOT NULL AND rf_final_fob > 0) as finalized_quotes
FROM weeks
ORDER BY week_number DESC;

-- Step 2: Update ALL weeks that have finalized quotes but status is still 'open'
UPDATE weeks
SET status = 'finalized'
WHERE id IN (
  SELECT DISTINCT week_id
  FROM quotes
  WHERE rf_final_fob IS NOT NULL
    AND rf_final_fob > 0
)
AND status = 'open';

-- Step 3: Verify the update
SELECT 
  week_number,
  status,
  (SELECT COUNT(*) FROM quotes WHERE week_id = weeks.id AND rf_final_fob IS NOT NULL AND rf_final_fob > 0) as finalized_quotes
FROM weeks
WHERE status = 'finalized'
ORDER BY week_number DESC;

-- If you see your week with status = 'finalized', refresh your browser and try Award Volume tab again.

