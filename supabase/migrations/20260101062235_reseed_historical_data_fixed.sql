/*
  # Reseed Complete Historical Data

  1. Purpose
    - Create complete historical data for Weeks 1-5
    - Use actual IDs from database
    - 4 suppliers participate per week (excluding Berry Best Co)
    - Week 6 remains open

  2. Data
    - Weeks 1-5: Complete quotes, allocations, awarded volumes
    - Week 6: Volume needs only
    - 3-week volume averages

  3. Notes
    - All IDs fetched dynamically
    - Volumes match volume_needed
*/

DO $$
DECLARE
  berry_best_id uuid;
  week_rec RECORD;
  item_rec RECORD;
  supplier_ids uuid[];
  supplier_count integer := 0;
  base_price numeric;
  volume_needed integer;
  vol_per_supplier integer;
  remaining_volume integer;
  supplier_idx integer;
  supplier_volume integer;
BEGIN
  -- Get Berry Best supplier ID
  SELECT id INTO berry_best_id FROM suppliers WHERE name = 'Berry Best Co';
  
  -- Get supplier IDs except Berry Best
  SELECT ARRAY(SELECT id FROM suppliers WHERE name != 'Berry Best Co' ORDER BY name)
  INTO supplier_ids;
  
  supplier_count := array_length(supplier_ids, 1);
  
  -- Clear existing data
  DELETE FROM quotes;
  DELETE FROM draft_allocations;
  DELETE FROM item_pricing_calculations;
  DELETE FROM item_volume_history;
  DELETE FROM week_item_volumes;
  
  -- Process weeks 1-5
  FOR week_rec IN
    SELECT id, week_number FROM weeks WHERE week_number BETWEEN 1 AND 5 ORDER BY week_number
  LOOP
    FOR item_rec IN
      SELECT id FROM items ORDER BY display_order
    LOOP
      volume_needed := 900 + (random() * 300)::int;
      
      INSERT INTO week_item_volumes (week_id, item_id, volume_needed)
      VALUES (week_rec.id, item_rec.id, volume_needed);
      
      base_price := 8.00 + (random() * 4)::numeric(10,2);
      
      vol_per_supplier := volume_needed / supplier_count;
      remaining_volume := volume_needed;
      
      FOR supplier_idx IN 1..supplier_count
      LOOP
        IF supplier_idx = supplier_count THEN
          supplier_volume := remaining_volume;
        ELSE
          supplier_volume := vol_per_supplier;
          remaining_volume := remaining_volume - supplier_volume;
        END IF;
        
        INSERT INTO quotes (
          week_id, item_id, supplier_id,
          supplier_fob, supplier_dlvd, rf_final_fob,
          offered_volume, supplier_volume_response,
          supplier_volume_accepted, awarded_volume
        )
        VALUES (
          week_rec.id, item_rec.id, supplier_ids[supplier_idx],
          base_price + (random() * 1.5 - 0.75)::numeric(10,2),
          base_price + 2.00 + (random() * 1.0)::numeric(10,2),
          base_price + (random() * 1.2 - 0.6)::numeric(10,2),
          supplier_volume, 'accept', supplier_volume, supplier_volume
        );
        
        INSERT INTO draft_allocations (week_id, item_id, supplier_id, drafted_volume)
        VALUES (week_rec.id, item_rec.id, supplier_ids[supplier_idx], supplier_volume);
      END LOOP;
      
      INSERT INTO item_pricing_calculations (
        week_id, item_id, avg_price, rebate, margin, freight, dlvd_price
      )
      VALUES (
        week_rec.id, item_rec.id, base_price, 0.50, 1.25, 0.75,
        base_price + 0.75 + 1.25 - 0.50
      );
    END LOOP;
    
    UPDATE weeks 
    SET 
      allocation_submitted = true,
      allocation_submitted_at = NOW() - INTERVAL '14 days',
      allocation_submitted_by = 'RF Manager',
      status = 'closed',
      finalized_at = NOW() - INTERVAL '10 days',
      finalized_by = 'RF Manager'
    WHERE id = week_rec.id;
  END LOOP;
  
  -- Week 6
  FOR week_rec IN SELECT id FROM weeks WHERE week_number = 6
  LOOP
    UPDATE weeks 
    SET 
      allocation_submitted = false,
      allocation_submitted_at = NULL,
      allocation_submitted_by = NULL,
      status = 'open',
      finalized_at = NULL,
      finalized_by = NULL
    WHERE id = week_rec.id;
    
    FOR item_rec IN SELECT id FROM items
    LOOP
      INSERT INTO week_item_volumes (week_id, item_id, volume_needed)
      VALUES (week_rec.id, item_rec.id, 900 + (random() * 300)::int);
    END LOOP;
  END LOOP;
END $$;

-- Calculate 3-week averages
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
  three_wk_vol integer;
  three_wk_price numeric;
BEGIN
  FOR week_rec IN
    SELECT id, week_number FROM weeks WHERE week_number BETWEEN 1 AND 5 ORDER BY week_number
  LOOP
    FOR item_rec IN SELECT id FROM items
    LOOP
      SELECT
        COALESCE(SUM(awarded_volume), 0),
        COALESCE(AVG(rf_final_fob), 0)
      INTO total_vol, avg_pr
      FROM quotes
      WHERE week_id = week_rec.id AND item_id = item_rec.id;

      IF week_rec.week_number = 1 THEN
        three_wk_vol := total_vol;
        three_wk_price := avg_pr;
      ELSIF week_rec.week_number = 2 THEN
        SELECT
          COALESCE(SUM(q.awarded_volume), 0),
          COALESCE(AVG(q.rf_final_fob), 0)
        INTO w1_vol, w1_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = 1 AND q.item_id = item_rec.id;

        three_wk_vol := ROUND((w1_vol + total_vol) / 2.0);
        three_wk_price := ROUND((w1_price + avg_pr) / 2.0, 2);
      ELSE
        SELECT
          COALESCE(SUM(q.awarded_volume), 0),
          COALESCE(AVG(q.rf_final_fob), 0)
        INTO w1_vol, w1_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = week_rec.week_number - 2 AND q.item_id = item_rec.id;

        SELECT
          COALESCE(SUM(q.awarded_volume), 0),
          COALESCE(AVG(q.rf_final_fob), 0)
        INTO w2_vol, w2_price
        FROM quotes q
        JOIN weeks w ON q.week_id = w.id
        WHERE w.week_number = week_rec.week_number - 1 AND q.item_id = item_rec.id;

        three_wk_vol := ROUND((w1_vol + w2_vol + total_vol) / 3.0);
        three_wk_price := ROUND((w1_price + w2_price + avg_pr) / 3.0, 2);
      END IF;

      INSERT INTO item_volume_history (
        item_id, week_id, total_volume, avg_price,
        three_week_avg_volume, three_week_avg_price
      )
      VALUES (
        item_rec.id, week_rec.id, total_vol, avg_pr,
        three_wk_vol, three_wk_price
      );
    END LOOP;
  END LOOP;
END $$;