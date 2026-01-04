-- Complete Database Seed: Suppliers, Items, Weeks, and Full Historical Data
-- This creates 5 suppliers, 8 items, 6 weeks (5 closed with complete data, 1 open)
-- Includes complete workflow: quotes → counters → responses → finalizations → allocations

-- 1. Clear existing data (optional - comment out if you want to keep existing)
-- DELETE FROM quotes;
-- DELETE FROM week_item_volumes;
-- DELETE FROM item_pricing_calculations;
-- DELETE FROM weeks;
-- DELETE FROM items;
-- DELETE FROM suppliers;

-- 2. Insert Suppliers (Shippers)
INSERT INTO suppliers (name, email) VALUES
  ('Fresh Farms Inc', 'supplier1@freshfarms.com'),
  ('Berry Best Co', 'supplier2@berrybest.com'),
  ('Organic Growers', 'supplier3@organicgrowers.com'),
  ('Valley Fresh', 'supplier4@valleyfresh.com'),
  ('Premium Produce', 'supplier5@premiumproduce.com')
ON CONFLICT (email) DO NOTHING;

-- 3. Insert Items (SKUs)
INSERT INTO items (name, pack_size, category, organic_flag, display_order) VALUES
  ('Strawberry', '4×2 lb', 'strawberry', 'CONV', 1),
  ('Strawberry', '8×1 lb', 'strawberry', 'ORG', 2),
  ('Blueberry', '18 oz', 'blueberry', 'CONV', 3),
  ('Blueberry', 'Pint', 'blueberry', 'ORG', 4),
  ('Blackberry', '12×6 oz', 'blackberry', 'CONV', 5),
  ('Blackberry', '12×6 oz', 'blackberry', 'ORG', 6),
  ('Raspberry', '12×6 oz', 'raspberry', 'CONV', 7),
  ('Raspberry', '12×6 oz', 'raspberry', 'ORG', 8)
ON CONFLICT DO NOTHING;

-- 4. Insert Weeks (5 closed weeks with complete data, 1 open week)
INSERT INTO weeks (week_number, start_date, end_date, status, allocation_submitted, pricing_finalized) VALUES
  (1, '2025-01-01', '2025-01-07', 'closed', true, true),
  (2, '2025-01-08', '2025-01-14', 'closed', true, true),
  (3, '2025-01-15', '2025-01-21', 'closed', true, true),
  (4, '2025-01-22', '2025-01-28', 'closed', true, true),
  (5, '2025-01-29', '2025-02-04', 'closed', true, true),
  (6, '2025-02-05', '2025-02-11', 'open', false, false)
ON CONFLICT DO NOTHING;

-- 5. Insert Complete Historical Data for Closed Weeks
-- This creates realistic workflow data: initial quotes → RF counters → supplier responses → finalizations
DO $$
DECLARE
  supplier_rec RECORD;
  item_rec RECORD;
  week_rec RECORD;
  supplier_fob_val NUMERIC;
  supplier_dlvd_val NUMERIC;
  rf_counter_val NUMERIC;
  supplier_response_val TEXT;
  supplier_revised_val NUMERIC;
  rf_final_val NUMERIC;
  awarded_volume_val INTEGER;
BEGIN
  -- Loop through closed weeks (weeks 1-5)
  FOR week_rec IN SELECT * FROM weeks WHERE status = 'closed' ORDER BY week_number LOOP
    -- Loop through suppliers
    FOR supplier_rec IN SELECT * FROM suppliers ORDER BY name LOOP
      -- Loop through items
      FOR item_rec IN SELECT * FROM items ORDER BY display_order LOOP
        -- Generate realistic pricing workflow
        supplier_fob_val := ROUND((15 + RANDOM() * 3)::numeric, 2);
        supplier_dlvd_val := ROUND((18 + RANDOM() * 3)::numeric, 2);
        rf_counter_val := ROUND((supplier_fob_val * 0.95)::numeric, 2); -- RF counters at 5% below
        
        -- Supplier response: 70% accept, 30% revise
        IF RANDOM() > 0.3 THEN
          supplier_response_val := 'accept';
          supplier_revised_val := NULL;
          rf_final_val := rf_counter_val; -- If accepted, final = counter
        ELSE
          supplier_response_val := 'revise';
          supplier_revised_val := ROUND((rf_counter_val * 1.02)::numeric, 2); -- Revise 2% above counter
          rf_final_val := supplier_revised_val; -- If revised, final = revised price
        END IF;
        
        -- Awarded volume (random between 100-1000 cases)
        awarded_volume_val := 100 + FLOOR(RANDOM() * 900)::INTEGER;
        
        -- Insert quote with complete workflow data
        INSERT INTO quotes (
          week_id, 
          item_id, 
          supplier_id, 
          supplier_fob, 
          supplier_dlvd,
          rf_counter_fob, 
          supplier_response,
          supplier_revised_fob,
          rf_final_fob,
          awarded_volume
        ) VALUES (
          week_rec.id,
          item_rec.id,
          supplier_rec.id,
          supplier_fob_val,
          supplier_dlvd_val,
          rf_counter_val,
          supplier_response_val,
          supplier_revised_val,
          rf_final_val,
          awarded_volume_val
        )
        ON CONFLICT (week_id, item_id, supplier_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 6. Verify the data was inserted
SELECT 
  (SELECT COUNT(*) FROM suppliers) as supplier_count,
  (SELECT COUNT(*) FROM items) as item_count,
  (SELECT COUNT(*) FROM weeks) as week_count,
  (SELECT COUNT(*) FROM quotes) as quote_count,
  (SELECT COUNT(*) FROM quotes WHERE rf_final_fob IS NOT NULL) as finalized_quotes,
  (SELECT COUNT(*) FROM quotes WHERE awarded_volume IS NOT NULL) as quotes_with_volume;

-- 7. Show sample data
SELECT 
  w.week_number,
  s.name as supplier,
  i.name || ' ' || i.pack_size as item,
  q.supplier_fob,
  q.rf_counter_fob,
  q.supplier_response,
  q.rf_final_fob,
  q.awarded_volume
FROM quotes q
JOIN weeks w ON q.week_id = w.id
JOIN suppliers s ON q.supplier_id = s.id
JOIN items i ON q.item_id = i.id
WHERE w.status = 'closed'
ORDER BY w.week_number, s.name, i.display_order
LIMIT 20;

