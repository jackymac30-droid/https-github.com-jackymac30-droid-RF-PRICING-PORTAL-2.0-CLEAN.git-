/*
  # Finalize Week 17 Pricing Data
  
  1. Updates
    - Copy pricing from Week 16 to Week 17 with slight variations
    - Set rf_final_fob for all quotes
    - Create pricing calculations
    - Mark week as finalized
  
  2. Purpose
    - Prepare Week 17 for volume allocation testing
*/

-- Get Week 17 ID
DO $$
DECLARE
  v_week_17_id uuid;
  v_week_16_id uuid;
BEGIN
  SELECT id INTO v_week_17_id FROM weeks WHERE week_number = 17;
  SELECT id INTO v_week_16_id FROM weeks WHERE week_number = 16;

  -- Copy rf_final_fob from Week 16 to Week 17 with small price adjustments
  UPDATE quotes q17
  SET 
    rf_final_fob = q16.rf_final_fob * (0.98 + random() * 0.04),
    supplier_fob = q16.supplier_fob * (0.98 + random() * 0.04),
    updated_at = NOW()
  FROM quotes q16
  WHERE q16.week_id = v_week_16_id
    AND q17.week_id = v_week_17_id
    AND q16.item_id = q17.item_id
    AND q16.supplier_id = q17.supplier_id
    AND q16.rf_final_fob IS NOT NULL;

  -- Create pricing calculations for Week 17 (copy from Week 16)
  INSERT INTO item_pricing_calculations (week_id, item_id, avg_price, rebate, freight, dlvd_price, margin)
  SELECT 
    v_week_17_id,
    item_id,
    avg_price * (0.98 + random() * 0.04),
    rebate,
    freight,
    dlvd_price * (0.98 + random() * 0.04),
    margin * (0.98 + random() * 0.04)
  FROM item_pricing_calculations
  WHERE week_id = v_week_16_id
  ON CONFLICT (week_id, item_id) DO UPDATE
  SET
    avg_price = EXCLUDED.avg_price,
    rebate = EXCLUDED.rebate,
    freight = EXCLUDED.freight,
    dlvd_price = EXCLUDED.dlvd_price,
    margin = EXCLUDED.margin,
    updated_at = NOW();

  -- Mark Week 17 as finalized
  UPDATE weeks 
  SET status = 'finalized'
  WHERE id = v_week_17_id;

  RAISE NOTICE 'Week 17 finalized successfully';
END $$;
