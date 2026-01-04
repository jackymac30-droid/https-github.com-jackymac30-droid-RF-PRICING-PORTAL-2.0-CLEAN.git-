/*
  # Add Volume Needed Tracking

  1. New Tables
    - `week_item_volumes`
      - `id` (uuid, primary key)
      - `week_id` (uuid, foreign key to weeks)
      - `item_id` (uuid, foreign key to items)
      - `volume_needed` (integer) - number of cases needed for this SKU in this week
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - Unique constraint on (week_id, item_id)
  
  2. Security
    - Enable RLS on `week_item_volumes` table
    - Allow authenticated users to read volume needs
    - Only allow authenticated users to update volume needs

  3. Notes
    - Volume is always measured in cases
    - This tracks how many cases are needed per SKU per week
*/

CREATE TABLE IF NOT EXISTS week_item_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  volume_needed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id)
);

ALTER TABLE week_item_volumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read volume needs"
  ON week_item_volumes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert volume needs"
  ON week_item_volumes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update volume needs"
  ON week_item_volumes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete volume needs"
  ON week_item_volumes
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_week_item_volumes_week ON week_item_volumes(week_id);
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_item ON week_item_volumes(item_id);

COMMENT ON TABLE week_item_volumes IS 'Tracks the volume needed (in cases) for each SKU in each week';
COMMENT ON COLUMN week_item_volumes.volume_needed IS 'Number of cases needed for this item in this week';