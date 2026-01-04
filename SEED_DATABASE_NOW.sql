-- ============================================
-- COMPLETE DATABASE SEED SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================

-- Clear existing data (optional - comment out if you want to keep existing data)
-- DELETE FROM quotes;
-- DELETE FROM weeks;
-- DELETE FROM items;
-- DELETE FROM suppliers;

-- 1. INSERT SUPPLIERS
INSERT INTO suppliers (name, email)
VALUES
  ('Fresh Farms Inc', 'supplier1@freshfarms.com'),
  ('Berry Best Co', 'supplier2@berrybest.com'),
  ('Organic Growers', 'supplier3@organicgrowers.com'),
  ('Valley Fresh', 'supplier4@valleyfresh.com'),
  ('Premium Produce', 'supplier5@premiumproduce.com')
ON CONFLICT (email) DO NOTHING;

-- 2. INSERT ITEMS (check if they exist first to avoid duplicates)
INSERT INTO items (name, pack_size, category, organic_flag, display_order)
SELECT * FROM (VALUES
  ('Strawberry', '4×2 lb', 'strawberry', 'CONV', 1),
  ('Strawberry', '8×1 lb', 'strawberry', 'ORG', 2),
  ('Blueberry', '18 oz', 'blueberry', 'CONV', 3),
  ('Blueberry', 'Pint', 'blueberry', 'ORG', 4),
  ('Blackberry', '12×6 oz', 'blackberry', 'CONV', 5),
  ('Blackberry', '12×6 oz', 'blackberry', 'ORG', 6),
  ('Raspberry', '12×6 oz', 'raspberry', 'CONV', 7),
  ('Raspberry', '12×6 oz', 'raspberry', 'ORG', 8)
) AS v(name, pack_size, category, organic_flag, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM items i 
  WHERE i.name = v.name AND i.pack_size = v.pack_size
);

-- 3. INSERT WEEKS
INSERT INTO weeks (week_number, start_date, end_date, status)
VALUES
  (1, '2025-01-01', '2025-01-07', 'closed'),
  (2, '2025-01-08', '2025-01-14', 'closed'),
  (3, '2025-01-15', '2025-01-21', 'closed'),
  (4, '2025-01-22', '2025-01-28', 'closed'),
  (5, '2025-01-29', '2025-02-04', 'closed'),
  (6, '2025-02-05', '2025-02-11', 'open')
ON CONFLICT (week_number) DO NOTHING;

-- 4. INSERT QUOTES WITH COMPLETE WORKFLOW DATA
-- This creates realistic pricing data for all suppliers, items, and closed weeks

DO $$
DECLARE
  supplier_rec RECORD;
  item_rec RECORD;
  week_rec RECORD;
  supplier_fob_val DECIMAL(10,2);
  supplier_dlvd_val DECIMAL(10,2);
  rf_counter_fob_val DECIMAL(10,2);
  supplier_response_val TEXT;
  supplier_revised_fob_val DECIMAL(10,2);
  rf_final_fob_val DECIMAL(10,2);
  base_price DECIMAL(10,2);
  week_mult DECIMAL(10,2);
  competitiveness DECIMAL(10,2);
  counter_discount DECIMAL(10,2);
  revise_ratio DECIMAL(10,2);
BEGIN
  -- Loop through all closed weeks
  FOR week_rec IN SELECT * FROM weeks WHERE status = 'closed' ORDER BY week_number
  LOOP
    week_mult := 1.0 + (week_rec.week_number - 1) * 0.02; -- Slight price increase over weeks
    
    -- Loop through all suppliers
    FOR supplier_rec IN SELECT *, ROW_NUMBER() OVER (ORDER BY name) as supplier_idx FROM suppliers ORDER BY name
    LOOP
      competitiveness := 0.95 + ((supplier_rec.supplier_idx - 1) % 3) * 0.05; -- 0.95, 1.00, or 1.05
      
      -- Loop through all items
      FOR item_rec IN SELECT * FROM items ORDER BY display_order
      LOOP
        -- Determine base price by category
        CASE item_rec.category
          WHEN 'strawberry' THEN base_price := 16.50;
          WHEN 'blueberry' THEN base_price := 18.00;
          WHEN 'blackberry' THEN base_price := 20.00;
          WHEN 'raspberry' THEN base_price := 22.00;
          ELSE base_price := 17.00;
        END CASE;
        
        base_price := base_price * week_mult;
        
        -- Step 1: Supplier submits initial quote
        supplier_fob_val := ROUND((base_price * competitiveness + (RANDOM() - 0.5) * 2)::numeric, 2);
        supplier_dlvd_val := ROUND((supplier_fob_val * 1.15 + (RANDOM() - 0.5) * 1)::numeric, 2);
        
        -- Step 2: RF sends counter offer (7-10% discount)
        counter_discount := 0.07 + RANDOM() * 0.03;
        rf_counter_fob_val := ROUND((supplier_fob_val * (1 - counter_discount))::numeric, 2);
        
        -- Step 3: Supplier responds (70% accept, 30% revise)
        IF RANDOM() < 0.7 THEN
          supplier_response_val := 'accept';
          supplier_revised_fob_val := NULL;
        ELSE
          supplier_response_val := 'revise';
          -- Revised price is 30-70% of the way from counter to original
          revise_ratio := 0.3 + RANDOM() * 0.4;
          supplier_revised_fob_val := ROUND((rf_counter_fob_val + (supplier_fob_val - rf_counter_fob_val) * revise_ratio)::numeric, 2);
        END IF;
        
        -- Step 4: RF finalizes price
        IF supplier_response_val = 'accept' THEN
          -- Sometimes RF adjusts slightly from counter
          rf_final_fob_val := ROUND((rf_counter_fob_val + (RANDOM() - 0.5) * 0.2)::numeric, 2);
        ELSE
          -- If revised, RF might accept revised or negotiate down slightly (98-100% of revised)
          rf_final_fob_val := ROUND((supplier_revised_fob_val * (0.98 + RANDOM() * 0.02))::numeric, 2);
        END IF;
        
        -- Insert the quote
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
        )
        VALUES (
          week_rec.id,
          item_rec.id,
          supplier_rec.id,
          supplier_fob_val,
          supplier_dlvd_val,
          rf_counter_fob_val,
          supplier_response_val,
          supplier_revised_fob_val,
          rf_final_fob_val
        )
        ON CONFLICT (week_id, item_id, supplier_id) DO UPDATE SET
          supplier_fob = EXCLUDED.supplier_fob,
          supplier_dlvd = EXCLUDED.supplier_dlvd,
          rf_counter_fob = EXCLUDED.rf_counter_fob,
          supplier_response = EXCLUDED.supplier_response,
          supplier_revised_fob = EXCLUDED.supplier_revised_fob,
          rf_final_fob = EXCLUDED.rf_final_fob;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 5. VERIFICATION QUERY
SELECT 
  'Suppliers' as table_name, COUNT(*) as count FROM suppliers
UNION ALL
SELECT 
  'Items' as table_name, COUNT(*) as count FROM items
UNION ALL
SELECT 
  'Weeks' as table_name, COUNT(*) as count FROM weeks
UNION ALL
SELECT 
  'Quotes' as table_name, COUNT(*) as count FROM quotes;

-- Show breakdown by week status
SELECT 
  status,
  COUNT(*) as week_count
FROM weeks
GROUP BY status;

-- Show quotes per week
SELECT 
  w.week_number,
  w.status,
  COUNT(q.id) as quote_count
FROM weeks w
LEFT JOIN quotes q ON q.week_id = w.id
GROUP BY w.week_number, w.status
ORDER BY w.week_number;

