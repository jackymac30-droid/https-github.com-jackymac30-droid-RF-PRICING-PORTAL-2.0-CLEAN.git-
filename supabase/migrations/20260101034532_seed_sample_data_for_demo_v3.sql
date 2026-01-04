/*
  # Seed Sample Data for Demo
  
  1. Purpose
    - Create realistic demo data for all weeks (1-6) and all suppliers except Berry Best Co
    - Week 6 is open and ready for Berry Best Co to participate
    - Weeks 1-5 are closed with finalized allocations
    
  2. Data Structure
    - Volume needs for each item per week
    - Quotes from 4 suppliers (excluding Berry Best Co)
    - Draft allocations and offered volumes
    - Supplier responses (all accepted)
    - Finalized awarded volumes
    - Pricing calculations
    
  3. Demo Workflow
    - Berry Best Co can participate in Week 6 (open)
    - All other suppliers have completed their responses for all weeks
    - Internal sheet matches supplier accepted volumes
*/

DO $$
DECLARE
  berry_best_id uuid := 'e1bd270c-9447-4485-91c3-e0af32f22f5c';
  fresh_farms_id uuid := '688224e1-5bb5-4935-a83a-b01d01a01328';
  organic_growers_id uuid := '94955de9-1a14-4863-b99f-5574fa587395';
  premium_produce_id uuid := '1c5a4c5b-9fe9-436d-ab50-905db1e31ab8';
  valley_fresh_id uuid := 'e047b5b3-07f1-4d28-bbe2-9b10e769d799';
  
  week1_id uuid := '65fe03b2-fffb-49d1-a5de-9f253f9c4eae';
  week2_id uuid := '8b12838c-44ea-478a-8382-9744c77857a1';
  week3_id uuid := 'b0d453f4-7484-4dbd-931e-509efb323abb';
  week4_id uuid := '4c174378-0f27-4ee2-9482-b739bfcb1f01';
  week5_id uuid := 'c929003b-cfb9-476d-868f-d78bf229c607';
  week6_id uuid := '0f48ad50-7da7-4373-acf7-26e161929208';
  
  item_ids uuid[];
  current_week_id uuid;
  current_item_id uuid;
  supplier_ids uuid[];
  current_supplier_id uuid;
  quote_id uuid;
  base_price numeric;
  allocated_volume int;
BEGIN
  -- Get all item IDs
  SELECT ARRAY_AGG(id) INTO item_ids FROM items;
  
  -- Define supplier IDs (excluding Berry Best)
  supplier_ids := ARRAY[fresh_farms_id, organic_growers_id, premium_produce_id, valley_fresh_id];
  
  -- Loop through weeks 1-6
  FOR current_week_id IN SELECT unnest(ARRAY[week1_id, week2_id, week3_id, week4_id, week5_id, week6_id])
  LOOP
    -- Set volume needs for each item (between 800-1200 cases)
    FOREACH current_item_id IN ARRAY item_ids
    LOOP
      INSERT INTO week_item_volumes (week_id, item_id, volume_needed)
      VALUES (current_week_id, current_item_id, 1000 + (random() * 200)::int)
      ON CONFLICT (week_id, item_id) DO UPDATE
        SET volume_needed = EXCLUDED.volume_needed;
    END LOOP;
    
    -- Create quotes for each supplier and item
    FOREACH current_item_id IN ARRAY item_ids
    LOOP
      base_price := 8.00 + (random() * 4)::numeric(10,2);
      
      FOREACH current_supplier_id IN ARRAY supplier_ids
      LOOP
        -- Allocate roughly 250 cases per supplier (4 suppliers = ~1000 total)
        allocated_volume := 200 + (random() * 100)::int;
        
        -- Vary price by supplier (±15%)
        INSERT INTO quotes (
          week_id, 
          item_id, 
          supplier_id, 
          supplier_fob, 
          rf_final_fob, 
          offered_volume, 
          supplier_volume_response, 
          supplier_volume_accepted, 
          awarded_volume
        )
        VALUES (
          current_week_id,
          current_item_id,
          current_supplier_id,
          base_price + (random() * 1.5 - 0.75)::numeric(10,2),
          base_price + (random() * 1.2 - 0.6)::numeric(10,2),
          allocated_volume,
          'accept',
          allocated_volume,
          allocated_volume
        )
        ON CONFLICT (week_id, item_id, supplier_id) DO UPDATE
          SET 
            supplier_fob = EXCLUDED.supplier_fob,
            rf_final_fob = EXCLUDED.rf_final_fob,
            offered_volume = EXCLUDED.offered_volume,
            supplier_volume_response = EXCLUDED.supplier_volume_response,
            supplier_volume_accepted = EXCLUDED.supplier_volume_accepted,
            awarded_volume = EXCLUDED.awarded_volume;
            
        -- Add draft allocations
        INSERT INTO draft_allocations (week_id, item_id, supplier_id, drafted_volume)
        VALUES (current_week_id, current_item_id, current_supplier_id, allocated_volume)
        ON CONFLICT (week_id, item_id, supplier_id) DO UPDATE
          SET drafted_volume = EXCLUDED.drafted_volume;
      END LOOP;
      
      -- Add pricing calculations for each item
      INSERT INTO item_pricing_calculations (week_id, item_id, avg_price, rebate, margin, freight, dlvd_price)
      VALUES (
        current_week_id,
        current_item_id,
        base_price,
        0.50,
        1.25,
        0.75,
        base_price + 0.75 + 1.25 - 0.50
      )
      ON CONFLICT (week_id, item_id) DO UPDATE
        SET 
          avg_price = EXCLUDED.avg_price,
          rebate = EXCLUDED.rebate,
          margin = EXCLUDED.margin,
          freight = EXCLUDED.freight,
          dlvd_price = EXCLUDED.dlvd_price;
    END LOOP;
    
    -- Mark weeks 1-5 as having allocations submitted and finalized
    IF current_week_id != week6_id THEN
      UPDATE weeks 
      SET 
        allocation_submitted = true,
        allocation_submitted_at = NOW() - INTERVAL '7 days',
        allocation_submitted_by = 'RF Manager',
        status = 'finalized',
        finalized_at = NOW() - INTERVAL '5 days',
        finalized_by = 'RF Manager'
      WHERE id = current_week_id;
    ELSE
      -- Week 6 is open, allocations submitted but not finalized
      UPDATE weeks 
      SET 
        allocation_submitted = true,
        allocation_submitted_at = NOW() - INTERVAL '1 day',
        allocation_submitted_by = 'RF Manager',
        status = 'open'
      WHERE id = current_week_id;
    END IF;
  END LOOP;
  
END $$;
