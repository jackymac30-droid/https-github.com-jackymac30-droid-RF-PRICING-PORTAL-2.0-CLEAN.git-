/*
  # Add Supplier Pricing Finalization Tracking

  1. Changes
    - Add `supplier_pricing_finalized` boolean field to quotes table to track when a supplier finalizes their pricing for a specific item
    - Add `supplier_pricing_finalized_at` timestamp field to track when finalization occurred
    
  2. Purpose
    - Allows suppliers to mark their pricing as complete
    - Enables RF to see which suppliers have finalized their pricing
    - Creates a clear workflow: suppliers finalize → prices flow to allocation sheet → RF makes allocation decisions
    
  3. Security
    - No RLS changes needed as existing policies already cover the quotes table
*/

-- Add supplier pricing finalization fields to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_pricing_finalized'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_pricing_finalized boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_pricing_finalized_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_pricing_finalized_at timestamptz;
  END IF;
END $$;