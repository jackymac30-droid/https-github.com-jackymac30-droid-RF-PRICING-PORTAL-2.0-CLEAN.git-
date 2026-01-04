/*
  # Create Week 15 and 16 with Pricing Data
  
  1. New Data
    - Create quotes for all item/supplier combinations for Week 15 and 16
    - Add sample pricing with realistic ranges
  
  2. Purpose
    - Enable Award Volume workflow testing
    - Provide complete pricing data for allocation decisions
*/

DO $$
DECLARE
  week15_id uuid;
  week16_id uuid;
BEGIN
  -- Get Week 15 and 16 IDs
  SELECT id INTO week15_id FROM weeks WHERE week_number = 15;
  SELECT id INTO week16_id FROM weeks WHERE week_number = 16;

  -- Create quotes for Week 15 with pricing
  INSERT INTO quotes (week_id, item_id, supplier_id, supplier_fob, rf_final_fob, supplier_pricing_finalized)
  SELECT 
    week15_id,
    i.id,
    s.id,
    CASE i.name
      WHEN 'Strawberry' THEN 10.50 + (random() * 2)
      WHEN 'Raspberry' THEN 12.00 + (random() * 2.5)
      WHEN 'Blueberry' THEN 15.00 + (random() * 3)
      WHEN 'Blackberry' THEN 13.50 + (random() * 2)
      WHEN 'Mixed Berry' THEN 11.00 + (random() * 2)
      WHEN 'Strawberry Sliced' THEN 11.50 + (random() * 2)
      WHEN 'Mango' THEN 14.00 + (random() * 2.5)
      WHEN 'Pineapple' THEN 12.50 + (random() * 2)
      ELSE 10.00
    END,
    CASE i.name
      WHEN 'Strawberry' THEN 10.50 + (random() * 2)
      WHEN 'Raspberry' THEN 12.00 + (random() * 2.5)
      WHEN 'Blueberry' THEN 15.00 + (random() * 3)
      WHEN 'Blackberry' THEN 13.50 + (random() * 2)
      WHEN 'Mixed Berry' THEN 11.00 + (random() * 2)
      WHEN 'Strawberry Sliced' THEN 11.50 + (random() * 2)
      WHEN 'Mango' THEN 14.00 + (random() * 2.5)
      WHEN 'Pineapple' THEN 12.50 + (random() * 2)
      ELSE 10.00
    END,
    true
  FROM items i
  CROSS JOIN suppliers s
  ON CONFLICT (week_id, item_id, supplier_id) DO UPDATE
  SET 
    supplier_fob = EXCLUDED.supplier_fob, 
    rf_final_fob = EXCLUDED.rf_final_fob, 
    supplier_pricing_finalized = true;

  -- Create quotes for Week 16 with pricing
  INSERT INTO quotes (week_id, item_id, supplier_id, supplier_fob, rf_final_fob, supplier_pricing_finalized)
  SELECT 
    week16_id,
    i.id,
    s.id,
    CASE i.name
      WHEN 'Strawberry' THEN 10.50 + (random() * 2)
      WHEN 'Raspberry' THEN 12.00 + (random() * 2.5)
      WHEN 'Blueberry' THEN 15.00 + (random() * 3)
      WHEN 'Blackberry' THEN 13.50 + (random() * 2)
      WHEN 'Mixed Berry' THEN 11.00 + (random() * 2)
      WHEN 'Strawberry Sliced' THEN 11.50 + (random() * 2)
      WHEN 'Mango' THEN 14.00 + (random() * 2.5)
      WHEN 'Pineapple' THEN 12.50 + (random() * 2)
      ELSE 10.00
    END,
    CASE i.name
      WHEN 'Strawberry' THEN 10.50 + (random() * 2)
      WHEN 'Raspberry' THEN 12.00 + (random() * 2.5)
      WHEN 'Blueberry' THEN 15.00 + (random() * 3)
      WHEN 'Blackberry' THEN 13.50 + (random() * 2)
      WHEN 'Mixed Berry' THEN 11.00 + (random() * 2)
      WHEN 'Strawberry Sliced' THEN 11.50 + (random() * 2)
      WHEN 'Mango' THEN 14.00 + (random() * 2.5)
      WHEN 'Pineapple' THEN 12.50 + (random() * 2)
      ELSE 10.00
    END,
    true
  FROM items i
  CROSS JOIN suppliers s
  ON CONFLICT (week_id, item_id, supplier_id) DO UPDATE
  SET 
    supplier_fob = EXCLUDED.supplier_fob, 
    rf_final_fob = EXCLUDED.rf_final_fob, 
    supplier_pricing_finalized = true;

  -- Add item pricing calculations for both weeks
  INSERT INTO item_pricing_calculations (week_id, item_id, freight, margin, rebate, dlvd_price)
  SELECT week15_id, id, 1.50, 0.50, 0.25, 0.00
  FROM items
  ON CONFLICT (week_id, item_id) DO UPDATE
  SET freight = EXCLUDED.freight, margin = EXCLUDED.margin, rebate = EXCLUDED.rebate;

  INSERT INTO item_pricing_calculations (week_id, item_id, freight, margin, rebate, dlvd_price)
  SELECT week16_id, id, 1.50, 0.50, 0.25, 0.00
  FROM items
  ON CONFLICT (week_id, item_id) DO UPDATE
  SET freight = EXCLUDED.freight, margin = EXCLUDED.margin, rebate = EXCLUDED.rebate;

END $$;
