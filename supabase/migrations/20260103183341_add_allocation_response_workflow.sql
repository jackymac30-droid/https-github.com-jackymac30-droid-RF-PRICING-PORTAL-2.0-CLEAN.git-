/*
  # Allocation Response Workflow Enhancement
  
  1. Updates
    - Update allocation_confirmation_status constraint to support 'pending', 'accepted', 'revised'
    - These existing columns will be used for allocation response workflow:
      - allocation_confirmation_status: tracks if supplier accepted or revised
      - allocation_confirmed_volume: stores supplier's response volume
      - allocation_confirmation_notes: optional notes from supplier
      - allocation_confirmed_at: timestamp when supplier responded
  
  2. Notes
    - Reuses existing columns to avoid schema bloat
    - When RF sends allocation (awarded_volume set), status defaults to 'pending'
    - Supplier can accept (confirmed_volume = awarded_volume) or revise (custom volume)
    - RF dashboard will show status and response volumes
*/

-- Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_allocation_confirmation_status_check'
  ) THEN
    ALTER TABLE quotes DROP CONSTRAINT quotes_allocation_confirmation_status_check;
  END IF;
END $$;

-- Add updated constraint supporting the allocation response workflow
ALTER TABLE quotes 
ADD CONSTRAINT quotes_allocation_confirmation_status_check 
CHECK (allocation_confirmation_status IN ('pending', 'accepted', 'revised'));

-- Create index for efficient filtering by allocation status
CREATE INDEX IF NOT EXISTS idx_quotes_allocation_status 
ON quotes(allocation_confirmation_status) 
WHERE allocation_confirmation_status IS NOT NULL;

-- Create index for supplier allocation queries
CREATE INDEX IF NOT EXISTS idx_quotes_supplier_week_allocation 
ON quotes(supplier_id, week_id, awarded_volume) 
WHERE awarded_volume IS NOT NULL;
