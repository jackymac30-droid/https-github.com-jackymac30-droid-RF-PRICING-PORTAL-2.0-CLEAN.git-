/*
  # Add Pricing Calculations and Allocation History

  1. New Tables
    - `item_pricing_calculations` - Stores internal pricing calculations per week/item
      - `id` (uuid, primary key)
      - `week_id` (uuid, foreign key to weeks)
      - `item_id` (uuid, foreign key to items)
      - `avg_price` (numeric) - Calculated average price
      - `rebate` (numeric) - Rebate amount
      - `margin` (numeric) - Margin amount
      - `freight` (numeric) - Freight cost
      - `dlvd_price` (numeric) - Final delivered price
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Existing Tables
    - Add `allocation_submitted` boolean to weeks table to track if allocations have been submitted to suppliers
    - Add `allocation_submitted_at` timestamp to weeks table
    - Add `allocation_submitted_by` text to weeks table

  3. Security
    - Enable RLS on item_pricing_calculations table
    - Add policies for public access (demo mode)

  4. Notes
    - Pricing calculations are internal to RF and used for margin analysis
    - Allocation submitted flag controls supplier visibility of awarded volumes
    - Historical data is preserved when week is finalized
*/

-- Create item_pricing_calculations table
CREATE TABLE IF NOT EXISTS item_pricing_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  avg_price numeric DEFAULT 0,
  rebate numeric DEFAULT 0,
  margin numeric DEFAULT 0,
  freight numeric DEFAULT 0,
  dlvd_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id)
);

COMMENT ON TABLE item_pricing_calculations IS 'Internal pricing calculations and margin analysis per week/item';
COMMENT ON COLUMN item_pricing_calculations.avg_price IS 'Average price across suppliers for this item';
COMMENT ON COLUMN item_pricing_calculations.rebate IS 'Rebate amount for margin calculation';
COMMENT ON COLUMN item_pricing_calculations.margin IS 'Margin amount for internal tracking';
COMMENT ON COLUMN item_pricing_calculations.freight IS 'Freight cost per unit';
COMMENT ON COLUMN item_pricing_calculations.dlvd_price IS 'Final delivered price after all calculations';

-- Add allocation submission tracking to weeks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'allocation_submitted'
  ) THEN
    ALTER TABLE weeks ADD COLUMN allocation_submitted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'allocation_submitted_at'
  ) THEN
    ALTER TABLE weeks ADD COLUMN allocation_submitted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'allocation_submitted_by'
  ) THEN
    ALTER TABLE weeks ADD COLUMN allocation_submitted_by text;
  END IF;
END $$;

COMMENT ON COLUMN weeks.allocation_submitted IS 'Whether volume allocations have been submitted to suppliers';
COMMENT ON COLUMN weeks.allocation_submitted_at IS 'Timestamp when allocations were submitted';
COMMENT ON COLUMN weeks.allocation_submitted_by IS 'User who submitted the allocations';

-- Enable RLS
ALTER TABLE item_pricing_calculations ENABLE ROW LEVEL SECURITY;

-- Public access policies for demo mode
CREATE POLICY "Allow public read access to item_pricing_calculations"
  ON item_pricing_calculations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to item_pricing_calculations"
  ON item_pricing_calculations
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to item_pricing_calculations"
  ON item_pricing_calculations
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from item_pricing_calculations"
  ON item_pricing_calculations
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_item_pricing_calculations_week_id ON item_pricing_calculations(week_id);
CREATE INDEX IF NOT EXISTS idx_item_pricing_calculations_item_id ON item_pricing_calculations(item_id);