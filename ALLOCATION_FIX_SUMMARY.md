# Allocation Tab Unlock Fix - Summary

## Problem Identified

### 1. Tab Router Location
**File**: `src/components/RFDashboard.tsx`
- **Line 907**: Tab button allows clicking to `award_volume` view (no gate on button)
- **Line 1081**: Renders `<Allocation>` component when `mainView === 'award_volume'`

### 2. Blocking Condition (BEFORE FIX)
**File**: `src/components/Allocation.tsx`
- **Line 412-413**: 
  ```typescript
  const weekStatus = selectedWeek.status;
  if (weekStatus !== 'finalized' && weekStatus !== 'closed') {
    return (blocking message)
  }
  ```
- **Problem**: Checks `selectedWeek.status` prop which can be stale. If week status in DB is 'finalized' but prop hasn't updated, it blocks access.

### 3. What "Pricing Finalized" Means
**Database Fields**:
- `weeks.status = 'finalized'` (set by `finalizePricingForWeek()` function)
- `quotes.rf_final_fob IS NOT NULL AND rf_final_fob > 0` (at least one quote must have final price)

**Where It's Set**:
- **File**: `src/utils/database.ts` line 1221-1330
- **Function**: `finalizePricingForWeek(weekId, userName)`
- **Action**: Updates `weeks.status = 'finalized'` after validating at least one quote has `rf_final_fob`

**Button Handler**:
- **File**: `src/components/RFDashboard.tsx` line 653
- **Function**: `handleFinalizePricing()`
- **Calls**: `finalizePricingForWeek()` then switches to `award_volume` tab

### 4. Why It Was NOT Unlocking

**Root Cause**: 
- Allocation component checked `selectedWeek.status` prop which could be stale
- Even if database had `status = 'finalized'`, if the prop wasn't refreshed, it would block
- Component didn't check for finalized quotes as fallback

**Secondary Issue**:
- No periodic check to detect when week status changes from 'open' to 'finalized'

### 5. The Fix

**File Changed**: `src/components/Allocation.tsx`

**Changes Made**:

1. **Added database status check** (lines 87-95):
   ```typescript
   // Check database status directly (not just prop)
   const { supabase } = await import('../utils/supabase');
   const { data: weekData } = await supabase
     .from('weeks')
     .select('status')
     .eq('id', selectedWeek.id)
     .single();
   
   const dbStatus = weekData?.status || selectedWeek.status;
   setActualWeekStatus(dbStatus);
   ```

2. **Added finalized quotes check** (lines 107-112):
   ```typescript
   // Check if there are any finalized quotes (rf_final_fob set)
   const hasAnyFinalized = quotes.some(q => 
     q.rf_final_fob !== null && 
     q.rf_final_fob !== undefined && 
     q.rf_final_fob > 0
   );
   setHasFinalizedQuotes(hasAnyFinalized);
   ```

3. **Updated gate condition** (lines 411-425):
   ```typescript
   // Check if week is finalized - use database status OR check for finalized quotes
   // This allows access if: week status is finalized/closed OR there are finalized quotes
   const weekStatus = actualWeekStatus || selectedWeek.status;
   const canAccess = weekStatus === 'finalized' || weekStatus === 'closed' || hasFinalizedQuotes;
   
   if (!canAccess) {
     return (blocking message)
   }
   ```

4. **Added periodic status check** (lines 177-195):
   - Polls database every 2 seconds when week is 'open' to catch status changes
   - Automatically reloads when status changes to 'finalized'

### 6. Data Loading (Already Correct)

**File**: `src/components/Allocation.tsx` lines 137-144

The component already correctly:
- Filters quotes by `rf_final_fob IS NOT NULL AND rf_final_fob > 0`
- Groups by SKU (item_id)
- Shows multiple suppliers per SKU with their finalized prices
- Uses `quote.rf_final_fob` as the `price` field (line 154)

**Query Returns**:
- `week_id`: From selectedWeek
- `item_id`: From items table
- `item_name`: From items table (via quote.item)
- `supplier_id`: From quotes.supplier_id
- `supplier_name`: From quotes.supplier.name
- `finalized_unit_cost`: From quotes.rf_final_fob (this is the finalized price)
- `offered_volume`: From quotes.awarded_volume (draft allocation)

## Test Checklist

1. **Create Week**
   - ✅ Week created with status = 'open'

2. **Shipper Submits**
   - ✅ Supplier enters `supplier_fob` prices
   - ✅ RF can see quotes in Pricing tab

3. **RF Finalizes**
   - ✅ RF sets `rf_final_fob` for at least one quote (manually or via "Finalize Item" button)
   - ✅ RF clicks "Finalize Week Pricing" button
   - ✅ `finalizePricingForWeek()` runs and sets `weeks.status = 'finalized'`

4. **Volume Tab Unlocks**
   - ✅ Click "Award Volume" tab
   - ✅ Allocation component checks database status (not just prop)
   - ✅ Finds `weeks.status = 'finalized'` OR finds quotes with `rf_final_fob > 0`
   - ✅ Tab unlocks and shows allocation interface

5. **SKU Shows Multiple Suppliers**
   - ✅ For each SKU with finalized pricing:
     - Shows item name, pack size, organic flag
     - Shows all suppliers who have `rf_final_fob` set
     - Each supplier row shows:
       - Supplier name
       - Finalized price (`rf_final_fob`)
       - Delivered price (if available)
       - Allocation input field
   - ✅ Data is real (from database, not fake numbers)

## Files Changed

1. **src/components/Allocation.tsx**
   - Added `actualWeekStatus` state
   - Added `hasFinalizedQuotes` state
   - Modified `loadData()` to check database status directly
   - Modified `loadData()` to check for finalized quotes
   - Updated gate condition to allow access if week is finalized OR has finalized quotes
   - Added periodic status polling when week is 'open'

## Before/After Comparison

### BEFORE:
```typescript
const weekStatus = selectedWeek.status;  // Stale prop
if (weekStatus !== 'finalized' && weekStatus !== 'closed') {
  return (blocking message)
}
```

### AFTER:
```typescript
const weekStatus = actualWeekStatus || selectedWeek.status;  // Database status
const canAccess = weekStatus === 'finalized' || 
                  weekStatus === 'closed' || 
                  hasFinalizedQuotes;  // Fallback to quote check
if (!canAccess) {
  return (blocking message)
}
```

## Key Improvement

**Single Source of Truth**: The component now checks the database directly for week status, ensuring it always has the latest state. It also has a fallback to check for finalized quotes, so even if week status isn't updated yet, if there are finalized quotes, the tab unlocks.

