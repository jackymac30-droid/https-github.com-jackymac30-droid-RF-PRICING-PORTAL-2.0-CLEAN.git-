/*
  # Setup Week 6 for Berry Best Co Demo

  1. Purpose
    - All suppliers finalized for Weeks 1-5 (including Berry Best Co)
    - Week 6: 4 suppliers have submitted and accepted their volumes
    - Week 6: Berry Best Co has NOT submitted - ready for demo workflow
    - Everything waiting on Berry Best Co's submission

  2. Changes
    - Add Berry Best Co to historical weeks (1-5) as a 5th supplier
    - For Week 6: Create quotes for 4 suppliers (excluding Berry Best)
    - Leave Berry Best Co out of Week 6 so they can demo the process
    - Adjust volumes so there's room for Berry Best Co to participate

  3. Notes
    - Week 6 is open, waiting for Berry Best Co
    - Other 4 suppliers have accepted their allocations
    - Volume needs account for all 5 suppliers, but only 4 have responded
*/

DO $$
DECLARE
  berry_best_id uuid;
  week_rec RECORD;
  item_rec RECORD;
  supplier_ids uuid[];
  all_supplier_ids uuid[];
  supplier_count integer;
  base_price numeric;
  volume_needed integer;
  vol_per_supplier integer;
  remaining_volume integer;
  berry_volume integer;
  supplier_idx integer;
  supplier_volume integer;
  week6_id uuid;
BEGIN
  -- Get Berry Best supplier ID
  SELECT id INTO berry_best_id FROM suppliers WHERE name = 'Berry Best Co';
  
  -- Get all supplier IDs except Berry Best (for Week 6)
  SELECT ARRAY(SELECT id FROM suppliers WHERE name != 'Berry Best Co' ORDER BY name)
  INTO supplier_ids;
  
  -- Get all supplier IDs including Berry Best (for Weeks 1-5)
  SELECT ARRAY(SELECT id FROM suppliers ORDER BY name)
  INTO all_supplier_ids;
  
  -- Get Week 6 ID
  SELECT id INTO week6_id FROM weeks WHERE week_number = 6;
  
  -- Clear existing data
  DELETE FROM quotes;
  DELETE FROM draft_allocations;
  DELETE FROM item_pricing_calculations;
  DELETE FROM item_volume_history;
  DELETE FROM week_item_volumes;
  
  -- ============================================
  -- WEEKS 1-5: All 5 suppliers (including Berry Best Co)
  -- ============================================
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
      
      -- Distribute among all 5 suppliers
      vol_per_supplier := volume_needed / 5;
      remaining_volume := volume_needed;
      
      FOR supplier_idx IN 1..5
      LOOP
        IF supplier_idx = 5 THEN
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
          week_rec.id, item_rec.id, all_supplier_ids[supplier_idx],
          base_price + (random() * 1.5 - 0.75)::numeric(10,2),
          base_price + 2.00 + (random() * 1.0)::numeric(10,2),
          base_price + (random() * 1.2 - 0.6)::numeric(10,2),
          supplier_volume, 'accept', supplier_volume, supplier_volume
        );
        
        INSERT INTO draft_allocations (week_id, item_id, supplier_id, drafted_volume)
        VALUES (week_rec.id, item_rec.id, all_supplier_ids[supplier_idx], supplier_volume);
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
  
  -- ============================================
  -- WEEK 6: Only 4 suppliers (excluding Berry Best Co)
  -- ============================================
  FOR item_rec IN
    SELECT id FROM items ORDER BY display_order
  LOOP
    volume_needed := 1000 + (random() * 200)::int;
    
    INSERT INTO week_item_volumes (week_id, item_id, volume_needed)
    VALUES (week6_id, item_rec.id, volume_needed);
    
    base_price := 8.00 + (random() * 4)::numeric(10,2);
    
    -- Reserve 20% of volume for Berry Best Co (they haven't submitted yet)
    berry_volume := ROUND(volume_needed * 0.20);
    remaining_volume := volume_needed - berry_volume;
    
    -- Distribute remaining 80% among 4 suppliers
    vol_per_supplier := remaining_volume / 4;
    remaining_volume := volume_needed - berry_volume;
    
    FOR supplier_idx IN 1..4
    LOOP
      IF supplier_idx = 4 THEN
        supplier_volume := remaining_volume;
      ELSE
        supplier_volume := vol_per_supplier;
        remaining_volume := remaining_volume - supplier_volume;
      END IF;
      
      -- Create quote with supplier having accepted
      INSERT INTO quotes (
        week_id, item_id, supplier_id,
        supplier_fob, supplier_dlvd, rf_final_fob,
        offered_volume, supplier_volume_response,
        supplier_volume_accepted, awarded_volume
      )
      VALUES (
        week6_id, item_rec.id, supplier_ids[supplier_idx],
        base_price + (random() * 1.5 - 0.75)::numeric(10,2),
        base_price + 2.00 + (random() * 1.0)::numeric(10,2),
        base_price + (random() * 1.2 - 0.6)::numeric(10,2),
        supplier_volume, 'accept', supplier_volume, NULL
      );
      
      INSERT INTO draft_allocations (week_id, item_id, supplier_id, drafted_volume)
      VALUES (week6_id, item_rec.id, supplier_ids[supplier_idx], supplier_volume);
    END LOOP;
    
    INSERT INTO item_pricing_calculations (
      week_id, item_id, avg_price, rebate, margin, freight, dlvd_price
    )
    VALUES (
      week6_id, item_rec.id, base_price, 0.50, 1.25, 0.75,
      base_price + 0.75 + 1.25 - 0.50
    );
  END LOOP;
  
  -- Week 6 is open, waiting for Berry Best Co
  UPDATE weeks 
  SET 
    allocation_submitted = true,
    allocation_submitted_at = NOW() - INTERVAL '2 days',
    allocation_submitted_by = 'RF Manager',
    status = 'open',
    finalized_at = NULL,
    finalized_by = NULL
  WHERE id = week6_id;
  
END $$;

-- Calculate 3-week averages (including Berry Best Co now)
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