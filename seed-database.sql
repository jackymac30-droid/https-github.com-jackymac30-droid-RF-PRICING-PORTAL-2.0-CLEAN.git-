-- Seed Database with Suppliers, Items, Weeks, and Sample Data
-- Run this in Supabase SQL Editor to pre-load everything

-- 1. Clear existing data (optional - comment out if you want to keep existing data)
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

-- 4. Insert Weeks (create an open week and some closed weeks)
INSERT INTO weeks (week_number, start_date, end_date, status) VALUES
  (1, '2025-01-01', '2025-01-07', 'closed'),
  (2, '2025-01-08', '2025-01-14', 'closed'),
  (3, '2025-01-15', '2025-01-21', 'closed'),
  (4, '2025-01-22', '2025-01-28', 'closed'),
  (5, '2025-01-29', '2025-02-04', 'closed'),
  (6, '2025-02-05', '2025-02-11', 'open')
ON CONFLICT DO NOTHING;

-- 5. Insert Sample Quotes for Closed Weeks (with pricing data)
-- This creates realistic pricing history
DO $$
DECLARE
  supplier_rec RECORD;
  item_rec RECORD;
  week_rec RECORD;
  supplier_fob_val NUMERIC;
  supplier_dlvd_val NUMERIC;
  rf_counter_val NUMERIC;
  rf_final_val NUMERIC;
BEGIN
  -- Loop through closed weeks
  FOR week_rec IN SELECT * FROM weeks WHERE status = 'closed' LOOP
    -- Loop through suppliers
    FOR supplier_rec IN SELECT * FROM suppliers LOOP
      -- Loop through items
      FOR item_rec IN SELECT * FROM items LOOP
        -- Generate random but realistic prices
        supplier_fob_val := ROUND((15 + RANDOM() * 3)::numeric, 2);
        supplier_dlvd_val := ROUND((18 + RANDOM() * 3)::numeric, 2);
        rf_counter_val := ROUND((14.5 + RANDOM() * 2.5)::numeric, 2);
        rf_final_val := ROUND((14.5 + RANDOM() * 2)::numeric, 2);
        
        -- Insert quote with pricing data
        INSERT INTO quotes (
          week_id, 
          item_id, 
          supplier_id, 
          supplier_fob, 
          supplier_dlvd, 
          rf_counter_fob, 
          supplier_response,
          supplier_revised_fob,
          rf_final_fob
        ) VALUES (
          week_rec.id,
          item_rec.id,
          supplier_rec.id,
          supplier_fob_val,
          supplier_dlvd_val,
          rf_counter_val,
          CASE WHEN RANDOM() > 0.5 THEN 'accept' ELSE 'revise' END,
          CASE WHEN RANDOM() > 0.5 THEN ROUND((14.75 + RANDOM() * 2)::numeric, 2) ELSE NULL END,
          rf_final_val
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
  (SELECT COUNT(*) FROM quotes) as quote_count;

