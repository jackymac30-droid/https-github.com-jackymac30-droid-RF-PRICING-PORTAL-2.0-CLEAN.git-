# Seed Volume & Allocation Fix Summary

## PART 1: FIX "SEED VOLUME NOT LOADING" (BLOCKER)

### A) What "Seed Volume" Is

**Database Location:**
- **Table**: `week_item_volumes`
- **Fields**: `week_id`, `item_id`, `volume_needed` (integer, default 0)
- **Purpose**: Stores total volume needed per SKU per week (RF's target volume)

**Component Loading:**
- **Function**: `fetchVolumeNeeds(weekId)` in `src/utils/database.ts` (line 1052)
- **Used By**: `AwardVolume.tsx` component (line 77, 148)
- **Query**: `SELECT * FROM week_item_volumes WHERE week_id = ?`

### B) Why It Wasn't Loading

**Root Causes:**
1. **Missing Rows**: When a new week is created via `createNewWeek()`, it creates quotes but does NOT create `week_item_volumes` rows
2. **Empty Result**: `fetchVolumeNeeds()` returns empty array `[]` when no rows exist
3. **UI Breakage**: Components expect `volume_needed` data and break or show empty when missing
4. **RLS Policies**: May have conflicting policies preventing public access

### C) Fixes Implemented

**1. Auto-Seed Volume Needs on Week Creation**
- **File**: `src/utils/database.ts` (lines 460-477)
- **Change**: Modified `createNewWeek()` to automatically create `week_item_volumes` rows for all items with `volume_needed = 0`
- **Result**: Every new week now has seed volume data initialized

**2. Database Trigger for Auto-Seeding**
- **File**: `supabase/migrations/20260106000002_fix_week_item_volumes_rls_and_auto_seed.sql`
- **Change**: Created trigger `trigger_auto_seed_volume_needs` that fires AFTER INSERT on `weeks` table
- **Result**: Automatically creates `week_item_volumes` rows even if week is created outside the app

**3. UI Graceful Handling**
- **File**: `src/components/AwardVolume.tsx` (lines 87-95, 152-160)
- **Change**: Added fallback logic to initialize `volume_needed = 0` for all items if no data exists
- **Result**: UI no longer breaks when seed volume is missing; shows 0 instead

**4. RLS Policy Fix**
- **File**: `supabase/migrations/20260106000002_fix_week_item_volumes_rls_and_auto_seed.sql`
- **Change**: Dropped conflicting policies, created clean public access policies
- **Result**: Ensures public access works for demo mode

**5. Backfill Existing Weeks**
- **File**: Migration includes SQL to backfill missing rows for existing weeks
- **Result**: Existing weeks without seed volume now have default rows created

### D) How to Test Seed Volume Loading

**Test Checklist:**
1. ✅ Create a new week → Check `week_item_volumes` table has rows for all items (volume_needed = 0)
2. ✅ Open Volume tab for new week → Should show volume inputs with 0, not break
3. ✅ Enter volume needed → Should save and persist
4. ✅ Refresh page → Volume needs should still be there
5. ✅ Check existing weeks → Should have volume_needed rows (backfilled)

**SQL Verification:**
```sql
-- Check if week has volume_needed rows
SELECT w.week_number, COUNT(wiv.id) as volume_rows, COUNT(i.id) as total_items
FROM weeks w
CROSS JOIN items i
LEFT JOIN week_item_volumes wiv ON wiv.week_id = w.id AND wiv.item_id = i.id
WHERE w.week_number = 6  -- Replace with your week number
GROUP BY w.week_number;

-- Should show: volume_rows == total_items (all items have volume_needed rows)
```

---

## PART 2: RF ALLOCATION "WHAT-IF" SANDBOX

### Implementation Summary

**1. Per-Quote Finalization (Already Working)**
- ✅ Volume tab unlocks when at least one quote has `rf_final_fob` set
- ✅ Only finalized quotes (with `rf_final_fob`) appear in allocation grid
- ✅ Multiple suppliers per SKU supported

**2. Cost Calculations Added**
- ✅ **Row Cost**: Unit price × proposed volume (shown in table)
- ✅ **SKU Total Cost**: Sum of all row costs for that SKU (shown in summary card)
- ✅ **Weighted Avg FOB**: Already existed, now shows in summary
- ✅ **Overall Totals**: Total volume, total cost, weighted avg across all SKUs

**3. Validation Added**
- ✅ **Per-SKU Validation**: Shows "X remaining" or "X over" if sum(proposed) ≠ total needed
- ✅ **Overall Validation**: Shows gap/excess across all SKUs
- ✅ **Visual Indicators**: Green checkmark when complete, orange/red for gaps

**4. "Fill Cheapest" Helper**
- ✅ Button that auto-allocates all volume to cheapest supplier per SKU
- ✅ Clears existing allocations first, then fills cheapest
- ✅ Useful for quick cost optimization

**5. Data Flow Preserved**
- ✅ Draft volumes saved to `awarded_volume` (existing behavior)
- ✅ "Send Allocations to Suppliers" button writes to `offered_volume` (existing)
- ✅ Supplier response loop uses `awarded_volume` (final) - no mixing with drafts

### Files Modified

1. **`src/utils/database.ts`**
   - Auto-create `week_item_volumes` rows in `createNewWeek()`

2. **`src/components/AwardVolume.tsx`**
   - Added cost calculations (row cost, SKU total, overall totals)
   - Added validation indicators
   - Added "Fill Cheapest" button
   - Enhanced UI to show cost breakdown

3. **`supabase/migrations/20260106000002_fix_week_item_volumes_rls_and_auto_seed.sql`**
   - Database trigger for auto-seeding
   - RLS policy fixes
   - Backfill existing weeks

### How to Test Allocation Feature

**Test Checklist:**
1. ✅ Finalize at least one quote (set `rf_final_fob`) → Volume tab should unlock
2. ✅ Enter "Total Volume Needed" for a SKU → Should save
3. ✅ See finalized suppliers for that SKU in allocation grid
4. ✅ Enter "Award Cases" for suppliers → Should see "Row Cost" update
5. ✅ Check SKU summary shows "SKU Total Cost"
6. ✅ Check overall summary shows "Total Cost" across all SKUs
7. ✅ Enter volumes that don't sum to total needed → Should show gap/excess
8. ✅ Click "Fill Cheapest" → Should auto-allocate to cheapest supplier
9. ✅ Click "Send Allocations to Suppliers" → Should write to `offered_volume`

---

## End-to-End Test Plan

### Step 1: Create Week
```
1. Go to Pricing tab
2. Click "Create New Week"
3. Verify: week_item_volumes rows created (check DB or see volume inputs show 0)
```

### Step 2: Seed Volume Loads
```
1. Go to Volume tab
2. Verify: Volume inputs show 0 (not broken/empty)
3. Enter volume needed for a SKU
4. Click "Save Volume Needs"
5. Verify: Volume persists after refresh
```

### Step 3: Pricing Finalize Per Quote
```
1. Go to Pricing tab
2. Select a supplier
3. Finalize at least one quote (set rf_final_fob)
4. Verify: Volume tab unlocks (even if other quotes not finalized)
```

### Step 4: Volume Tab Unlocks
```
1. Go to Volume tab
2. Verify: Can see finalized quotes in allocation grid
3. Verify: Only quotes with rf_final_fob appear
```

### Step 5: Allocation What-If Works
```
1. Enter "Total Volume Needed" for a SKU (e.g., 1000 cases)
2. Enter "Award Cases" for multiple suppliers (e.g., 600 + 400)
3. Verify: Row costs calculate (price × volume)
4. Verify: SKU Total Cost shows sum
5. Verify: Overall summary shows totals
6. Verify: Validation shows "Complete" when sum = total needed
```

### Step 6: Send Awards
```
1. Click "Send Allocations to Suppliers"
2. Verify: awarded_volume written to DB
3. Verify: offered_volume copied from awarded_volume
4. Verify: allocation_submitted flag set
```

### Step 7: Supplier Response
```
1. Supplier responds (accept/revise)
2. RF reviews in Volume Acceptance tab
3. Verify: Uses awarded_volume (final), not draft values
```

### Step 8: Close Loop
```
1. RF accepts all supplier responses
2. Close volume loop
3. Verify: Week status = 'closed'
```

---

## SQL Migration to Apply

Run this in Supabase SQL Editor:
```sql
-- File: supabase/migrations/20260106000002_fix_week_item_volumes_rls_and_auto_seed.sql
-- This fixes RLS policies and creates auto-seed trigger
```

Or apply via migration system if using Supabase CLI.

---

## Key Points

✅ **No UI Redesign**: Existing workflow preserved, only enhancements added
✅ **Minimal Changes**: Only added necessary fields and calculations
✅ **Backward Compatible**: Existing weeks continue to work
✅ **Per-Quote Finalization**: Volume tab unlocks with first finalized quote
✅ **Cost Optimization**: RF can see costs and optimize allocation
✅ **Draft vs Final**: Clear separation between draft (`awarded_volume`) and final (`offered_volume`)

