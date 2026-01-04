/*
  # Fix Week Status and Add 3-Week Volume Averages

  1. Purpose
    - Ensure Week 6 is properly "open" for both RF and suppliers
    - Add 3-week volume average tracking for historical data
    - Populate historical volume data for previous 5 weeks
    - Ensure awarded volumes match week volume needs

  2. Changes
    - Create `item_volume_history` table for tracking 3-week averages
    - Update Week 6 status to be properly open (no allocations submitted yet)
    - Populate historical volume data for Weeks 1-5
    - Calculate and store 3-week volume averages
    - Adjust awarded volumes to match volume_needed

  3. Notes
    - Week 6 will be completely open for new quotes
    - Weeks 1-5 will have complete historical data
    - 3-week averages will be calculated from most recent weeks
*/

-- Create item_volume_history table for tracking 3-week averages
CREATE TABLE IF NOT EXISTS item_volume_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  total_volume integer NOT NULL DEFAULT 0,
  avg_price numeric(10, 2) NOT NULL DEFAULT 0,
  three_week_avg_volume integer NOT NULL DEFAULT 0,
  three_week_avg_price numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id)
);

ALTER TABLE item_volume_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to item_volume_history"
  ON item_volume_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to item_volume_history"
  ON item_volume_history FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_item_volume_history_item ON item_volume_history(item_id);
CREATE INDEX IF NOT EXISTS idx_item_volume_history_week ON item_volume_history(week_id);

-- Update Week 6 to be properly open (remove allocation submission)
DO $$
DECLARE
  week6_id uuid := '0f48ad50-7da7-4373-acf7-26e161929208';
BEGIN
  UPDATE weeks
  SET
    status = 'open',
    allocation_submitted = false,
    allocation_submitted_at = NULL,
    allocation_submitted_by = NULL,
    finalized_at = NULL,
    finalized_by = NULL
  WHERE id = week6_id;

  -- Clear volume allocations for Week 6 to make it truly open
  UPDATE quotes
  SET
    offered_volume = NULL,
    supplier_volume_response = NULL,
    supplier_volume_accepted = NULL
  WHERE week_id = week6_id;
END $$;

-- Ensure awarded volumes match volume_needed for weeks 1-5
DO $$
DECLARE
  week_rec RECORD;
  item_rec RECORD;
  total_awarded integer;
  volume_needed integer;
  adjustment_factor numeric;
BEGIN
  -- Loop through weeks 1-5
  FOR week_rec IN
    SELECT id FROM weeks WHERE week_number BETWEEN 1 AND 5
  LOOP
    -- Loop through each item
    FOR item_rec IN
      SELECT id FROM items
    LOOP
      -- Get volume needed
      SELECT wiv.volume_needed INTO volume_needed
      FROM week_item_volumes wiv
      WHERE wiv.week_id = week_rec.id AND wiv.item_id = item_rec.id;

      -- Get total awarded volume
      SELECT COALESCE(SUM(awarded_volume), 0) INTO total_awarded
      FROM quotes
      WHERE week_id = week_rec.id AND item_id = item_rec.id;

      -- If there's a mismatch, adjust proportionally
      IF total_awarded > 0 AND volume_needed > 0 AND total_awarded != volume_needed THEN
        adjustment_factor := volume_needed::numeric / total_awarded::numeric;

        UPDATE quotes
        SET
          awarded_volume = ROUND(awarded_volume * adjustment_factor),
          offered_volume = ROUND(offered_volume * adjustment_factor),
          supplier_volume_accepted = ROUND(supplier_volume_accepted * adjustment_factor)
        WHERE week_id = week_rec.id AND item_id = item_rec.id AND awarded_volume > 0;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Populate item_volume_history with data from weeks 1-5
DO $$
DECLARE
  week_rec RECORD;
  item_rec RECORD;
  total_vol integer;
  avg_pr numeric;
  w1_vol integer;
  w1_price numeric;
  w2_vol integer;
  w2_price numeric;
  w3_vol integer;
  w3_price numeric;
  three_wk_vol integer;
  three_wk_price numeric;
BEGIN
  -- Loop through weeks 1-5
  FOR week_rec IN
    SELECT id, week_number FROM weeks WHERE week_number BETWEEN 1 AND 5 ORDER BY week_number
  LOOP
    -- Loop through each item
    FOR item_rec IN
      SELECT id FROM items
    LOOP
      -- Calculate total volume and average price for current week
      SELECT
        COALESCE(SUM(awarded_volume), 0),
        COALESCE(AVG(rf_final_fob), 0)
      INTO total_vol, avg_pr
      FROM quotes
      WHERE week_id = week_rec.id AND item_id = item_rec.id AND awarded_volume > 0;

      -- Calculate 3-week average (current week and 2 previous weeks)
      IF week_rec.week_number = 1 THEN
        -- Week 1: only current week data
        three_wk_vol := total_vol;
        three_wk_price := avg_pr;
      ELSIF week_rec.week_number = 2 THEN
        -- Week 2: average of weeks 1 and 2
        SELECT
          COALESCE(SUM(awarded_volume), 0),
          COALESCE(AVG(rf_final_fob), 0)
        INTO w1_vol, w1_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = 1 AND q.item_id = item_rec.id AND q.awarded_volume > 0;

        three_wk_vol := ROUND((w1_vol + total_vol) / 2.0);
        three_wk_price := ROUND((w1_price + avg_pr) / 2.0, 2);
      ELSE
        -- Week 3+: average of current week and 2 previous weeks
        SELECT
          COALESCE(SUM(awarded_volume), 0),
          COALESCE(AVG(rf_final_fob), 0)
        INTO w1_vol, w1_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = week_rec.week_number - 2 AND q.item_id = item_rec.id AND q.awarded_volume > 0;

        SELECT
          COALESCE(SUM(awarded_volume), 0),
          COALESCE(AVG(rf_final_fob), 0)
        INTO w2_vol, w2_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = week_rec.week_number - 1 AND q.item_id = item_rec.id AND q.awarded_volume > 0;

        three_wk_vol := ROUND((w1_vol + w2_vol + total_vol) / 3.0);
        three_wk_price := ROUND((w1_price + w2_price + avg_pr) / 3.0, 2);
      END IF;

      -- Insert into item_volume_history
      INSERT INTO item_volume_history (
        item_id,
        week_id,
        total_volume,
        avg_price,
        three_week_avg_volume,
        three_week_avg_price
      )
      VALUES (
        item_rec.id,
        week_rec.id,
        total_vol,
        avg_pr,
        three_wk_vol,
        three_wk_price
      )
      ON CONFLICT (week_id, item_id) DO UPDATE
      SET
        total_volume = EXCLUDED.total_volume,
        avg_price = EXCLUDED.avg_price,
        three_week_avg_volume = EXCLUDED.three_week_avg_volume,
        three_week_avg_price = EXCLUDED.three_week_avg_price,
        updated_at = now();
    END LOOP;
  END LOOP;
END $$;

-- Add final adjustment to ensure totals are exact
DO $$
DECLARE
  week_rec RECORD;
  item_rec RECORD;
  total_awarded integer;
  volume_needed integer;
  diff integer;
  quote_to_adjust uuid;
BEGIN
  FOR week_rec IN
    SELECT id FROM weeks WHERE week_number BETWEEN 1 AND 5
  LOOP
    FOR item_rec IN
      SELECT id FROM items
    LOOP
      SELECT COALESCE(wiv.volume_needed, 0) INTO volume_needed
      FROM week_item_volumes wiv
      WHERE wiv.week_id = week_rec.id AND wiv.item_id = item_rec.id;

      SELECT COALESCE(SUM(awarded_volume), 0) INTO total_awarded
      FROM quotes
      WHERE week_id = week_rec.id AND item_id = item_rec.id;

      diff := volume_needed - total_awarded;

      IF diff != 0 THEN
        -- Adjust the first quote to make up the difference
        SELECT id INTO quote_to_adjust
        FROM quotes
        WHERE week_id = week_rec.id AND item_id = item_rec.id AND awarded_volume > 0
        LIMIT 1;

        IF quote_to_adjust IS NOT NULL THEN
          UPDATE quotes
          SET
            awarded_volume = awarded_volume + diff,
            offered_volume = offered_volume + diff,
            supplier_volume_accepted = supplier_volume_accepted + diff
          WHERE id = quote_to_adjust;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;