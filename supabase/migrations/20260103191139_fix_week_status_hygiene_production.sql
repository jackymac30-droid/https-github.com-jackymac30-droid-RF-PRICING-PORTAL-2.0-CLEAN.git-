/*
  # Fix Week Status Hygiene - Production

  1. Purpose
    - Ensure only ONE week is 'open' at a time
    - All other weeks should be 'closed' (not 'finalized')
    - Finalized status is reserved for explicit finalization

  2. Changes
    - Set all weeks to 'closed' status
    - Clear finalized_at and finalized_by for all weeks
    - Set the most recent week (by start_date DESC) to 'open'

  3. Notes
    - Suppliers can still view ALL weeks (open, closed, finalized)
    - Only RF workflow cares about open/closed distinction
    - This ensures clean status hygiene in production
*/

-- First, set all weeks to 'closed' and clear finalization fields
UPDATE weeks 
SET 
  status = 'closed',
  finalized_at = NULL,
  finalized_by = NULL;

-- Then, set the most recent week (by start_date DESC) to 'open'
UPDATE weeks 
SET status = 'open'
WHERE id = (
  SELECT id 
  FROM weeks 
  ORDER BY start_date DESC 
  LIMIT 1
);
