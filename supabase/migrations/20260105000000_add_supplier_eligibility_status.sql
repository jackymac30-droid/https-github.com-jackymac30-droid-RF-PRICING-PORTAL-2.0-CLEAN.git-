/*
  # Add Supplier Eligibility Status - Real-World Workflow Support

  ## Purpose
  This migration implements the core business rule:
  "Pricing submission ≠ allocation eligibility"
  
  RF needs to explicitly mark which suppliers are eligible for volume award.
  This separates data collection (pricing) from strategic decisions (allocation).

  ## New Column
  - `supplier_eligibility_status` (text) on quotes table
    - Values: 'submitted', 'reviewed', 'feedback_sent', 'eligible_for_award', 'not_used'
    - Default: 'submitted' (when supplier first submits pricing)
    - Only RF can change this status

  ## Business Rules
  1. When supplier submits pricing → status = 'submitted'
  2. RF reviews pricing → can mark as 'reviewed'
  3. RF sends feedback but doesn't award → 'feedback_sent'
  4. RF plans to allocate volume → 'eligible_for_award'
  5. RF decides not to use → 'not_used'
  
  ## Impact
  - Only suppliers with status 'eligible_for_award' appear in allocation interface
  - Weighted averages calculated only on eligible suppliers
  - Removes any automatic "lowest price wins" logic
*/

-- Add supplier_eligibility_status column to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_eligibility_status'
  ) THEN
    ALTER TABLE quotes 
    ADD COLUMN supplier_eligibility_status text DEFAULT 'submitted'
    CHECK (supplier_eligibility_status IN ('submitted', 'reviewed', 'feedback_sent', 'eligible_for_award', 'not_used'));
    
    -- Set default for existing rows
    UPDATE quotes 
    SET supplier_eligibility_status = CASE
      WHEN supplier_fob IS NOT NULL THEN 'submitted'
      ELSE 'submitted'
    END;
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_quotes_eligibility_status 
    ON quotes(week_id, item_id, supplier_eligibility_status);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN quotes.supplier_eligibility_status IS 
'RF-controlled status: submitted (default), reviewed, feedback_sent, eligible_for_award (only these appear in allocation), not_used';

