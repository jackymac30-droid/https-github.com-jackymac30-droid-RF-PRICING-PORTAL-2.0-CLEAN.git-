-- ============================================
-- FIX: Update Week Status to 'finalized'
-- ============================================
-- If pricing is finalized but the week status isn't updating,
-- run this SQL to manually set the status.
-- ============================================

-- Option 1: Update a specific week by week_number
-- Replace 6 with your actual week number
UPDATE weeks 
SET status = 'finalized'
WHERE week_number = 6
  AND status = 'open';

-- Option 2: Update all weeks that have finalized pricing but status is still 'open'
-- This finds weeks where quotes have rf_final_fob set but week status is still 'open'
UPDATE weeks
SET status = 'finalized'
WHERE id IN (
  SELECT DISTINCT week_id
  FROM quotes
  WHERE rf_final_fob IS NOT NULL
    AND rf_final_fob > 0
)
AND status = 'open';

-- Option 3: Check current status of all weeks
SELECT 
  id,
  week_number,
  status,
  start_date,
  end_date,
  (SELECT COUNT(*) FROM quotes WHERE week_id = weeks.id AND rf_final_fob IS NOT NULL) as quotes_with_final_pricing
FROM weeks
ORDER BY week_number DESC;

-- Option 4: Update a specific week by ID (if you know the week ID)
-- Replace 'YOUR_WEEK_ID_HERE' with the actual UUID
-- UPDATE weeks 
-- SET status = 'finalized'
-- WHERE id = 'YOUR_WEEK_ID_HERE';

