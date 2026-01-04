/*
  # Fix Week Status Hygiene
  
  1. Updates
    - Set all weeks to 'closed' status
    - Set the most recent week (by start_date) to 'open'
    - Clear finalized_at timestamps for closed weeks
  
  2. Notes
    - Only one week should be 'open' at a time
    - All other weeks are 'closed' (not 'finalized')
    - Finalized status is reserved for explicit finalization action
*/

-- First, set all weeks to 'closed' and clear finalized_at
UPDATE weeks 
SET 
  status = 'closed',
  finalized_at = NULL,
  finalized_by = NULL
WHERE status != 'closed';

-- Then, set the most recent week (by start_date DESC) to 'open'
UPDATE weeks 
SET status = 'open'
WHERE id = (
  SELECT id 
  FROM weeks 
  ORDER BY start_date DESC 
  LIMIT 1
);
