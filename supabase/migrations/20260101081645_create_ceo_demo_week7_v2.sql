/*
  # CEO Demo - Week 7 Active Negotiations

  Creates Week 7 with compelling pricing negotiations showing:
  - Multiple suppliers at different negotiation stages
  - 5-8% cost savings from RF counters
  - Competition driving better prices
  - Full workflow in action
*/

-- Clean up Week 7
DELETE FROM week_item_volumes WHERE week_id IN (SELECT id FROM weeks WHERE week_number = 7);
DELETE FROM draft_allocations WHERE week_id IN (SELECT id FROM weeks WHERE week_number = 7);
DELETE FROM quotes WHERE week_id IN (SELECT id FROM weeks WHERE week_number = 7);
DELETE FROM weeks WHERE week_number = 7;

-- Create Week 7
INSERT INTO weeks (week_number, start_date, end_date, status, created_at)
VALUES (7, '2026-02-09', '2026-02-15', 'open', now());

-- Setup Week 7 negotiations
DO $$
DECLARE
  week7_id uuid;
BEGIN
  SELECT id INTO week7_id FROM weeks WHERE week_number = 7;

  -- ORGANIC STRAWBERRIES (8×1 lb)
  -- Berry Best: FINAL stage (saved $1.00!)
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '9a5234c0-0ad0-4d47-a64d-fd8eb51c54e2', 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 18.50, 17.75, 'revise', 17.50, 17.50);

  -- Fresh Farms: COUNTER stage (waiting for response)
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob)
  VALUES (week7_id, '85aacc1d-af3b-4f53-a3ca-4269e8348cad', 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 19.25, 18.50);

  -- Organic Growers: RESPONSE stage (just responded)
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob)
  VALUES (week7_id, '3a262a24-98bc-405a-9372-eeff1a83826d', 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 18.75, 18.00, 'accept', 18.00);

  -- Premium Produce: Initial FOB only
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob)
  VALUES (week7_id, '52057f47-cb20-498c-9161-1fcfb6136a0b', 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 20.00);

  -- Valley Fresh: FINAL stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '38923212-08c7-42d4-b13a-194261e5b734', 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 19.50, 18.75, 'accept', 18.75, 18.75);

  -- ORGANIC BLUEBERRIES (Pint)
  -- Berry Best: FINAL stage (best price!)
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '9a5234c0-0ad0-4d47-a64d-fd8eb51c54e2', '9d35c529-11ad-4369-a040-ae74c50764ad', 32.00, 30.50, 'revise', 30.25, 30.25);

  -- Fresh Farms: COUNTER stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob)
  VALUES (week7_id, '85aacc1d-af3b-4f53-a3ca-4269e8348cad', '9d35c529-11ad-4369-a040-ae74c50764ad', 33.50, 31.75);

  -- Organic Growers: FINAL stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '3a262a24-98bc-405a-9372-eeff1a83826d', '9d35c529-11ad-4369-a040-ae74c50764ad', 31.75, 30.75, 'accept', 30.75, 30.75);

  -- Premium Produce: Initial FOB
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob)
  VALUES (week7_id, '52057f47-cb20-498c-9161-1fcfb6136a0b', '9d35c529-11ad-4369-a040-ae74c50764ad', 34.00);

  -- ORGANIC RASPBERRIES (12×6 oz)
  -- Berry Best: RESPONSE stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob)
  VALUES (week7_id, '9a5234c0-0ad0-4d47-a64d-fd8eb51c54e2', '490a8789-02c3-4f9e-8fe1-4c59eaea1021', 28.00, 26.50, 'revise', 26.75);

  -- Fresh Farms: Initial FOB
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob)
  VALUES (week7_id, '85aacc1d-af3b-4f53-a3ca-4269e8348cad', '490a8789-02c3-4f9e-8fe1-4c59eaea1021', 29.00);

  -- Organic Growers: COUNTER stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob)
  VALUES (week7_id, '3a262a24-98bc-405a-9372-eeff1a83826d', '490a8789-02c3-4f9e-8fe1-4c59eaea1021', 27.50, 26.25);

  -- Valley Fresh: FINAL stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '38923212-08c7-42d4-b13a-194261e5b734', '490a8789-02c3-4f9e-8fe1-4c59eaea1021', 28.50, 27.00, 'accept', 27.00, 27.00);

  -- ORGANIC BLACKBERRIES (12×6 oz)
  -- Berry Best: FINAL stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '9a5234c0-0ad0-4d47-a64d-fd8eb51c54e2', '0bdb3ba5-b345-43ee-b357-0508c6dcd57d', 26.00, 24.75, 'accept', 24.75, 24.75);

  -- Fresh Farms: FINAL stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob, rf_final_fob)
  VALUES (week7_id, '85aacc1d-af3b-4f53-a3ca-4269e8348cad', '0bdb3ba5-b345-43ee-b357-0508c6dcd57d', 27.00, 25.50, 'revise', 25.25, 25.25);

  -- Organic Growers: RESPONSE stage
  INSERT INTO quotes (week_id, supplier_id, item_id, supplier_fob, rf_counter_fob, supplier_response, supplier_revised_fob)
  VALUES (week7_id, '3a262a24-98bc-405a-9372-eeff1a83826d', '0bdb3ba5-b345-43ee-b357-0508c6dcd57d', 25.50, 24.50, 'accept', 24.50);

  -- Volume needs for Week 7
  INSERT INTO week_item_volumes (week_id, item_id, volume_needed)
  VALUES
    (week7_id, 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c', 850),
    (week7_id, '9d35c529-11ad-4369-a040-ae74c50764ad', 650),
    (week7_id, '490a8789-02c3-4f9e-8fe1-4c59eaea1021', 450),
    (week7_id, '0bdb3ba5-b345-43ee-b357-0508c6dcd57d', 400)
  ON CONFLICT (week_id, item_id) DO UPDATE SET volume_needed = EXCLUDED.volume_needed;

END $$;
