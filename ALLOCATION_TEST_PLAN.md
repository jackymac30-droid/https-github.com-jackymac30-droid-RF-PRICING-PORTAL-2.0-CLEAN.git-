# AI Allocation Test Plan

## Overview
Test the complete workflow from pricing finalization through allocation to supplier acceptance and close loop.

## Prerequisites
1. Week with status = 'open'
2. At least 2 suppliers with finalized pricing (rf_final_fob set) for at least 2 SKUs
3. Historical data from previous weeks (for AI fairness calculation)

---

## Test Case 1: Manual Allocation Mode

### Steps:
1. **Finalize Pricing**
   - Go to Pricing tab
   - Finalize pricing for at least 2 suppliers across 2 SKUs
   - Verify week status changes to 'finalized'

2. **Navigate to Allocation Tab**
   - Click "Allocation" tab (formerly "Award Volume")
   - Verify tab opens and shows SKUs with finalized pricing

3. **Set Volume Needed**
   - For each SKU, enter "Total Volume Needed" (e.g., 1000 cases)
   - Verify input saves after 500ms debounce
   - Verify "Remaining" updates live

4. **Manual Allocation**
   - For each SKU, allocate volume to suppliers manually
   - Enter volumes in "Allocated" inputs
   - Verify:
     - Remaining needed updates live
     - Weighted avg price updates live
     - Total cost updates live
     - Percentage per supplier updates live

5. **Lock SKU**
   - Click "Lock SKU" button for first SKU
   - Verify:
     - SKU shows "Locked" badge
     - Allocation inputs become read-only
     - Volume needed input becomes disabled
   - Click "Unlock" to verify it unlocks

6. **Lock All SKUs**
   - Lock all SKUs
   - Verify "Send Awards to Suppliers" button appears

7. **Send Awards**
   - Click "Send Awards to Suppliers"
   - Verify:
     - Success toast appears
     - Week status updates (allocation_submitted = true)
     - Tab switches to "Exceptions Mode"

---

## Test Case 2: AI Target Price Mode

### Steps:
1. **Enable AI Mode**
   - Unlock a SKU (if locked)
   - Click "Enable" on "AI Target Price Mode"
   - Verify AI controls appear

2. **Set Target Price**
   - Enter a target average price (e.g., $18.50)
   - Verify input accepts decimal values

3. **Adjust Fairness Slider**
   - Set to 0% (pure cheapest)
   - Set to 100% (pure historical fairness)
   - Set to 50% (balanced)
   - Verify slider updates value

4. **Run Auto Allocate**
   - Click "Auto Allocate" button
   - Verify:
     - Allocation fills automatically
     - Weighted avg price approaches target
     - If target not achievable, warning message shows closest achievable price
     - Historical fairness is respected based on slider position

5. **Verify Allocation**
   - Check that total allocated = volume needed
   - Check weighted avg is close to target (within tolerance)
   - Verify fairness: at 100%, allocation matches historical shares

---

## Test Case 3: Exceptions Mode (Supplier Responses)

### Steps:
1. **Send Awards** (from Test Case 1)
   - Complete manual allocation and send awards

2. **Supplier Response Simulation**
   - In database or supplier dashboard, set supplier_volume_response = 'update'
   - Set supplier_volume_accepted to a different value (e.g., if awarded 500, set to 600)
   - Set supplier_volume_response_notes

3. **View Exceptions**
   - Refresh Allocation tab
   - Verify:
     - Tab shows "Exceptions Mode" badge
     - Only SKUs with exceptions are shown
     - Exception rows highlighted in orange
     - Shows revised volume from supplier

4. **Accept Revised Volume**
   - Click "Accept" button on exception row
   - Verify:
     - Allocation updates to supplier's revised volume
     - Exception row disappears
     - Success toast appears

5. **Close Loop**
   - Resolve all exceptions
   - Verify "Close Loop" button appears and is enabled
   - Click "Close Loop"
   - Verify success message

---

## Test Case 4: Edge Cases

### 4.1 Empty State
- Week with no finalized pricing
- Verify: Shows "No SKUs with finalized pricing" message

### 4.2 Over-Allocation
- Allocate more than volume needed
- Verify: Shows "X over" in red, progress bar turns red

### 4.3 Under-Allocation
- Allocate less than volume needed
- Verify: Shows "X remaining" in orange, progress bar shows gap

### 4.4 Zero Volume Needed
- Set volume needed to 0
- Verify: Allocation inputs disabled, no errors

### 4.5 No Historical Data
- Test AI allocation on SKU with no historical allocations
- Verify: Falls back to even distribution or cheapest allocation

### 4.6 Target Price Not Achievable
- Set target price too low (below cheapest supplier)
- Verify: Warning message shows closest achievable price

### 4.7 Target Price Too High
- Set target price above all supplier prices
- Verify: Warning message explains why

---

## Test Case 5: Data Persistence

### Steps:
1. **Allocate Volume**
   - Set volume needed and allocate to suppliers
   - Refresh page
   - Verify: All allocations persist

2. **Lock State**
   - Lock a SKU
   - Refresh page
   - Verify: Lock state persists (when DB column added)

3. **AI Settings**
   - Enable AI mode, set target price and fairness
   - Refresh page
   - Verify: Settings reset (expected - UI state only)

---

## Test Case 6: Performance

### Steps:
1. **Large Dataset**
   - Test with 10+ SKUs, 5+ suppliers each
   - Verify: No lag in UI updates
   - Verify: Debounced saves don't cause issues

2. **Rapid Input**
   - Rapidly change allocation values
   - Verify: Only final value saves (debounce works)
   - Verify: UI updates smoothly

---

## Expected Results Summary

✅ **Manual Mode**: Full control, live calculations, lock workflow  
✅ **AI Mode**: Optimizes to target price with fairness control  
✅ **Exceptions Mode**: Shows only items needing action  
✅ **Close Loop**: Enabled only when all exceptions resolved  
✅ **Data Persistence**: Allocations save correctly  
✅ **Edge Cases**: Handled gracefully with clear messaging  

---

## Known Limitations

1. **Lock State**: Currently stored in component state only. Will need DB column for persistence.
2. **Max Volume**: Supplier max volume constraint not yet implemented (placeholder in optimizer).
3. **Historical Data**: Requires at least 1 week of historical allocations for fairness calculation.

---

## Rollback Plan

If issues arise:
1. Revert `RFDashboard.tsx` to use `AwardVolume` and `VolumeAcceptance` components
2. Keep new components for future iteration
3. Database functions are additive and safe

