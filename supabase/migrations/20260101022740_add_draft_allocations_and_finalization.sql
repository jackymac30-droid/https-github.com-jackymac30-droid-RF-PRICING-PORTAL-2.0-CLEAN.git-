/*
  # Add Draft Allocations and Finalization Support

  1. New Tables
    - `draft_allocations` - Stores draft volume allocations per week/item/supplier
      - `id` (uuid, primary key)
      - `week_id` (uuid, foreign key to weeks)
      - `item_id` (uuid, foreign key to items)
      - `supplier_id` (uuid, foreign key to suppliers)
      - `drafted_volume` (integer) - Draft volume allocation in cases
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Existing Tables
    - Add `finalized_at` timestamp to weeks table
    - Add `finalized_by` user tracking to weeks table

  3. Security
    - Enable RLS on draft_allocations table
    - Add policies for public access (demo mode)

  4. Notes
    - Draft allocations are saved per supplier as RF works through allocation
    - When finalized, drafts are committed to quotes.awarded_volume
    - Emergency unlock allows changes to finalized weeks
*/

-- Create draft_allocations table
CREATE TABLE IF NOT EXISTS draft_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  drafted_volume integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id, supplier_id)
);

COMMENT ON TABLE draft_allocations IS 'Stores draft volume allocations before finalization';
COMMENT ON COLUMN draft_allocations.drafted_volume IS 'Draft volume allocation in cases (not yet finalized)';

-- Add finalization tracking to weeks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'finalized_at'
  ) THEN
    ALTER TABLE weeks ADD COLUMN finalized_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weeks' AND column_name = 'finalized_by'
  ) THEN
    ALTER TABLE weeks ADD COLUMN finalized_by text;
  END IF;
END $$;

COMMENT ON COLUMN weeks.finalized_at IS 'Timestamp when week was finalized';
COMMENT ON COLUMN weeks.finalized_by IS 'User who finalized the week';

-- Enable RLS
ALTER TABLE draft_allocations ENABLE ROW LEVEL SECURITY;

-- Public access policies for demo mode
CREATE POLICY "Allow public read access to draft_allocations"
  ON draft_allocations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to draft_allocations"
  ON draft_allocations
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to draft_allocations"
  ON draft_allocations
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from draft_allocations"
  ON draft_allocations
  FOR DELETE
  TO public
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_draft_allocations_week_id ON draft_allocations(week_id);
CREATE INDEX IF NOT EXISTS idx_draft_allocations_supplier_id ON draft_allocations(week_id, supplier_id);