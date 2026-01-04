/*
  # Final Workflow Patch - Internal Costs & Allocation Response
  
  1. New Tables
    - `week_item_internal_costs`
      - `week_id` (uuid, FK to weeks)
      - `item_id` (uuid, FK to items)
      - `rebate` (numeric, nullable)
      - `margin` (numeric, nullable)
      - `freight` (numeric, nullable)
      - Primary key: (week_id, item_id)
  
  2. Updates to quotes table
    - Rename allocation_confirmation_* to supplier_allocation_*
    - Add supplier_allocation_response_volume if not exists
    - Update constraints for supplier_allocation_status
  
  3. Security
    - Enable RLS on week_item_internal_costs
    - Allow public read/write for demo mode
  
  4. Notes
    - Internal costs persist per week+item combination
    - Formula: delivered_cost = fob + rebate + margin + freight
    - Upsert pattern for easy updates
*/

-- Create week_item_internal_costs table
CREATE TABLE IF NOT EXISTS week_item_internal_costs (
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rebate numeric DEFAULT 0,
  margin numeric DEFAULT 0,
  freight numeric DEFAULT 0.85,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (week_id, item_id)
);

-- Enable RLS
ALTER TABLE week_item_internal_costs ENABLE ROW LEVEL SECURITY;

-- Allow public access for demo mode
CREATE POLICY "Allow public read access to internal costs"
  ON week_item_internal_costs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access to internal costs"
  ON week_item_internal_costs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access to internal costs"
  ON week_item_internal_costs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Rename allocation columns in quotes table
DO $$
BEGIN
  -- Rename allocation_confirmation_status to supplier_allocation_status
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmation_status'
  ) THEN
    ALTER TABLE quotes RENAME COLUMN allocation_confirmation_status TO supplier_allocation_status;
  END IF;

  -- Rename allocation_confirmed_volume to supplier_allocation_response_volume
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmed_volume'
  ) THEN
    ALTER TABLE quotes RENAME COLUMN allocation_confirmed_volume TO supplier_allocation_response_volume;
  END IF;

  -- Rename allocation_confirmed_at to supplier_allocation_responded_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmed_at'
  ) THEN
    ALTER TABLE quotes RENAME COLUMN allocation_confirmed_at TO supplier_allocation_responded_at;
  END IF;

  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_allocation_confirmation_status_check'
  ) THEN
    ALTER TABLE quotes DROP CONSTRAINT quotes_allocation_confirmation_status_check;
  END IF;

  -- Add new constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_supplier_allocation_status_check'
  ) THEN
    ALTER TABLE quotes 
    ADD CONSTRAINT quotes_supplier_allocation_status_check 
    CHECK (supplier_allocation_status IN ('pending', 'accepted', 'revised'));
  END IF;
END $$;

-- Update default value for supplier_allocation_status
ALTER TABLE quotes 
ALTER COLUMN supplier_allocation_status SET DEFAULT 'pending';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_week_item_internal_costs_week 
ON week_item_internal_costs(week_id);

CREATE INDEX IF NOT EXISTS idx_quotes_supplier_allocation_status 
ON quotes(supplier_allocation_status) 
WHERE supplier_allocation_status IS NOT NULL;
