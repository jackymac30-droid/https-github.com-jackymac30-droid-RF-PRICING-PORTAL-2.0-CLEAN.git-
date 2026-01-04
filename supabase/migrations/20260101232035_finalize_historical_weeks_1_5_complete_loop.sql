/*
  # Finalize Historical Weeks 1-5 with Complete Workflow Loop

  ## Summary
  Completes the full pricing and allocation workflow for weeks 1-5 to demonstrate 
  end-to-end system functionality for CEO presentation.

  ## Changes Made
  
  ### 1. Pricing Finalization (All Suppliers, All SKUs)
    - Sets `supplier_pricing_finalized = true` for all 200 quotes (5 weeks × 8 items × 5 suppliers)
    - Adds pricing finalization timestamps
    - Marks pricing as locked and confirmed
  
  ### 2. Volume Allocations (Distributed Across Suppliers)
    - Awards volume to all suppliers based on competitive pricing
    - Allocates realistic volumes (50-200 cases per quote)
    - Ensures volume distribution matches real-world patterns
    - Total volume per item ranges from 400-600 cases
  
  ### 3. Supplier Volume Acceptance
    - All suppliers accept their awarded volumes
    - Sets `supplier_volume_approval = 'accepted'`
    - Adds supplier response notes confirming acceptance
  
  ### 4. Allocation Confirmation
    - Sets `allocation_confirmation_status = 'confirmed'`
    - Confirms `allocation_confirmed_volume` matches `awarded_volume`
    - Adds confirmation timestamps
  
  ### 5. Week Finalization
    - Changes week status from 'closed' to 'finalized'
    - Sets finalization timestamps and user attribution
    - Marks allocation as submitted to suppliers
  
  ## Result
  Weeks 1-5 now show complete workflow:
  ✓ Supplier quotes submitted
  ✓ RF counter offers made
  ✓ Supplier responses received
  ✓ Final pricing locked
  ✓ Volume allocated to all suppliers
  ✓ Suppliers accept volumes
  ✓ Allocations confirmed
  ✓ Weeks finalized
*/

-- Step 1: Finalize pricing for all quotes in weeks 1-5
UPDATE quotes
SET 
  supplier_pricing_finalized = true,
  supplier_pricing_finalized_at = w.finalized_at,
  supplier_volume_approval = 'accepted',
  supplier_volume_notes = 'Confirmed and accepted - ready for delivery'
FROM weeks w
WHERE quotes.week_id = w.id
  AND w.week_number <= 5
  AND quotes.supplier_pricing_finalized = false;

-- Step 2: Award volumes based on competitive pricing
-- Berry Best Co gets good allocations (they have competitive prices)
UPDATE quotes
SET 
  awarded_volume = CASE 
    WHEN w.week_number = 1 THEN 120
    WHEN w.week_number = 2 THEN 130
    WHEN w.week_number = 3 THEN 110
    WHEN w.week_number = 4 THEN 125
    ELSE 115
  END,
  offered_volume = CASE 
    WHEN w.week_number = 1 THEN 120
    WHEN w.week_number = 2 THEN 130
    WHEN w.week_number = 3 THEN 110
    WHEN w.week_number = 4 THEN 125
    ELSE 115
  END,
  supplier_volume_response = 'accept',
  supplier_volume_accepted = CASE 
    WHEN w.week_number = 1 THEN 120
    WHEN w.week_number = 2 THEN 130
    WHEN w.week_number = 3 THEN 110
    WHEN w.week_number = 4 THEN 125
    ELSE 115
  END,
  allocation_confirmation_status = 'confirmed',
  allocation_confirmed_volume = CASE 
    WHEN w.week_number = 1 THEN 120
    WHEN w.week_number = 2 THEN 130
    WHEN w.week_number = 3 THEN 110
    WHEN w.week_number = 4 THEN 125
    ELSE 115
  END,
  allocation_confirmed_at = w.finalized_at + INTERVAL '2 days'
FROM weeks w, suppliers s
WHERE quotes.week_id = w.id
  AND quotes.supplier_id = s.id
  AND w.week_number <= 5
  AND s.name = 'Berry Best Co';

-- Fresh Farms Inc gets moderate allocations
UPDATE quotes
SET 
  awarded_volume = CASE 
    WHEN w.week_number = 1 THEN 100
    WHEN w.week_number = 2 THEN 105
    WHEN w.week_number = 3 THEN 95
    WHEN w.week_number = 4 THEN 110
    ELSE 98
  END,
  offered_volume = CASE 
    WHEN w.week_number = 1 THEN 100
    WHEN w.week_number = 2 THEN 105
    WHEN w.week_number = 3 THEN 95
    WHEN w.week_number = 4 THEN 110
    ELSE 98
  END,
  supplier_volume_response = 'accept',
  supplier_volume_accepted = CASE 
    WHEN w.week_number = 1 THEN 100
    WHEN w.week_number = 2 THEN 105
    WHEN w.week_number = 3 THEN 95
    WHEN w.week_number = 4 THEN 110
    ELSE 98
  END,
  allocation_confirmation_status = 'confirmed',
  allocation_confirmed_volume = CASE 
    WHEN w.week_number = 1 THEN 100
    WHEN w.week_number = 2 THEN 105
    WHEN w.week_number = 3 THEN 95
    WHEN w.week_number = 4 THEN 110
    ELSE 98
  END,
  allocation_confirmed_at = w.finalized_at + INTERVAL '2 days'
FROM weeks w, suppliers s
WHERE quotes.week_id = w.id
  AND quotes.supplier_id = s.id
  AND w.week_number <= 5
  AND s.name = 'Fresh Farms Inc';

-- Organic Growers gets smaller allocations (higher prices)
UPDATE quotes
SET 
  awarded_volume = CASE 
    WHEN w.week_number = 1 THEN 75
    WHEN w.week_number = 2 THEN 80
    WHEN w.week_number = 3 THEN 70
    WHEN w.week_number = 4 THEN 85
    ELSE 72
  END,
  offered_volume = CASE 
    WHEN w.week_number = 1 THEN 75
    WHEN w.week_number = 2 THEN 80
    WHEN w.week_number = 3 THEN 70
    WHEN w.week_number = 4 THEN 85
    ELSE 72
  END,
  supplier_volume_response = 'accept',
  supplier_volume_accepted = CASE 
    WHEN w.week_number = 1 THEN 75
    WHEN w.week_number = 2 THEN 80
    WHEN w.week_number = 3 THEN 70
    WHEN w.week_number = 4 THEN 85
    ELSE 72
  END,
  allocation_confirmation_status = 'confirmed',
  allocation_confirmed_volume = CASE 
    WHEN w.week_number = 1 THEN 75
    WHEN w.week_number = 2 THEN 80
    WHEN w.week_number = 3 THEN 70
    WHEN w.week_number = 4 THEN 85
    ELSE 72
  END,
  allocation_confirmed_at = w.finalized_at + INTERVAL '2 days'
FROM weeks w, suppliers s
WHERE quotes.week_id = w.id
  AND quotes.supplier_id = s.id
  AND w.week_number <= 5
  AND s.name = 'Organic Growers';

-- Premium Produce gets competitive allocations
UPDATE quotes
SET 
  awarded_volume = CASE 
    WHEN w.week_number = 1 THEN 90
    WHEN w.week_number = 2 THEN 95
    WHEN w.week_number = 3 THEN 85
    WHEN w.week_number = 4 THEN 100
    ELSE 88
  END,
  offered_volume = CASE 
    WHEN w.week_number = 1 THEN 90
    WHEN w.week_number = 2 THEN 95
    WHEN w.week_number = 3 THEN 85
    WHEN w.week_number = 4 THEN 100
    ELSE 88
  END,
  supplier_volume_response = 'accept',
  supplier_volume_accepted = CASE 
    WHEN w.week_number = 1 THEN 90
    WHEN w.week_number = 2 THEN 95
    WHEN w.week_number = 3 THEN 85
    WHEN w.week_number = 4 THEN 100
    ELSE 88
  END,
  allocation_confirmation_status = 'confirmed',
  allocation_confirmed_volume = CASE 
    WHEN w.week_number = 1 THEN 90
    WHEN w.week_number = 2 THEN 95
    WHEN w.week_number = 3 THEN 85
    WHEN w.week_number = 4 THEN 100
    ELSE 88
  END,
  allocation_confirmed_at = w.finalized_at + INTERVAL '2 days'
FROM weeks w, suppliers s
WHERE quotes.week_id = w.id
  AND quotes.supplier_id = s.id
  AND w.week_number <= 5
  AND s.name = 'Premium Produce';

-- Valley Fresh gets good allocations
UPDATE quotes
SET 
  awarded_volume = CASE 
    WHEN w.week_number = 1 THEN 105
    WHEN w.week_number = 2 THEN 110
    WHEN w.week_number = 3 THEN 100
    WHEN w.week_number = 4 THEN 115
    ELSE 102
  END,
  offered_volume = CASE 
    WHEN w.week_number = 1 THEN 105
    WHEN w.week_number = 2 THEN 110
    WHEN w.week_number = 3 THEN 100
    WHEN w.week_number = 4 THEN 115
    ELSE 102
  END,
  supplier_volume_response = 'accept',
  supplier_volume_accepted = CASE 
    WHEN w.week_number = 1 THEN 105
    WHEN w.week_number = 2 THEN 110
    WHEN w.week_number = 3 THEN 100
    WHEN w.week_number = 4 THEN 115
    ELSE 102
  END,
  allocation_confirmation_status = 'confirmed',
  allocation_confirmed_volume = CASE 
    WHEN w.week_number = 1 THEN 105
    WHEN w.week_number = 2 THEN 110
    WHEN w.week_number = 3 THEN 100
    WHEN w.week_number = 4 THEN 115
    ELSE 102
  END,
  allocation_confirmed_at = w.finalized_at + INTERVAL '2 days'
FROM weeks w, suppliers s
WHERE quotes.week_id = w.id
  AND quotes.supplier_id = s.id
  AND w.week_number <= 5
  AND s.name = 'Valley Fresh';

-- Step 3: Update weeks 1-5 to finalized status with timestamps
UPDATE weeks
SET 
  status = 'finalized',
  finalized_at = start_date + INTERVAL '5 days',
  finalized_by = 'admin@rf3foods.com',
  allocation_submitted = true,
  allocation_submitted_at = start_date + INTERVAL '7 days',
  allocation_submitted_by = 'admin@rf3foods.com'
WHERE week_number <= 5
  AND status = 'closed';
