/*
  # CEO Demo - Week 6 Gap Fill Scenario

  Updates Week 6 to show gap-fill functionality:
  - Some suppliers revised volumes down
  - Creates gaps that need to be filled
  - Demonstrates Step 9 of the workflow
*/

-- Set Week 6 to finalized with allocation submitted
UPDATE weeks
SET
  status = 'finalized',
  allocation_submitted = true,
  allocation_submitted_at = now() - interval '2 days',
  allocation_submitted_by = 'RF Demo User'
WHERE week_number = 6;

-- Create gap scenario in Week 6
DO $$
DECLARE
  week6_id uuid;
BEGIN
  SELECT id INTO week6_id FROM weeks WHERE week_number = 6;

  -- STRAWBERRY: Berry Best allocated 500, accepted only 350 (150 gap)
  UPDATE quotes
  SET
    offered_volume = 500,
    supplier_volume_response = 'update',
    supplier_volume_accepted = 350,
    supplier_volume_notes = 'Weather conditions reduced harvest - can only supply 350 cases'
  WHERE week_id = week6_id 
    AND supplier_id = '9a5234c0-0ad0-4d47-a64d-fd8eb51c54e2'
    AND item_id = 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c';

  -- STRAWBERRY: Fresh Farms allocated 300, accepted only 200 (100 gap)
  UPDATE quotes
  SET
    offered_volume = 300,
    supplier_volume_response = 'update',
    supplier_volume_accepted = 200,
    supplier_volume_notes = 'Prioritizing long-term contracts - reduced to 200 cases'
  WHERE week_id = week6_id 
    AND supplier_id = '85aacc1d-af3b-4f53-a3ca-4269e8348cad'
    AND item_id = 'c24cf06d-1377-4b6f-96d7-375e4eb1df5c';

  -- BLUEBERRY: Organic Growers accepted full allocation (no gap - good example)
  UPDATE quotes
  SET
    offered_volume = 400,
    supplier_volume_response = 'accept',
    supplier_volume_accepted = 400
  WHERE week_id = week6_id 
    AND supplier_id = '3a262a24-98bc-405a-9372-eeff1a83826d'
    AND item_id = '9d35c529-11ad-4369-a040-ae74c50764ad';

  -- RASPBERRY: Valley Fresh allocated 250, accepted only 180 (70 gap)
  UPDATE quotes
  SET
    offered_volume = 250,
    supplier_volume_response = 'update',
    supplier_volume_accepted = 180,
    supplier_volume_notes = 'Unexpected demand from another buyer - revised down'
  WHERE week_id = week6_id 
    AND supplier_id = '38923212-08c7-42d4-b13a-194261e5b734'
    AND item_id = '490a8789-02c3-4f9e-8fe1-4c59eaea1021';

END $$;
