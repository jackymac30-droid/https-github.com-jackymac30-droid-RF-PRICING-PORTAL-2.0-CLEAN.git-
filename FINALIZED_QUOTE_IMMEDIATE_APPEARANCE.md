# Finalized Quote Immediate Appearance Fix

## Problem
When RF finalizes a supplier quote (sets `rf_final_fob`), it should immediately appear in the AI Allocation tab. Currently, the Allocation tab only refreshes on manual page refresh or tab switch.

## Solution

### 1. "Pricing Finalized" State Per Quote

**Database Field**: `quotes.rf_final_fob`
- **Type**: `decimal(10, 2)`, nullable
- **Definition**: When `rf_final_fob IS NOT NULL AND rf_final_fob > 0`, the quote is finalized
- **Location**: `quotes` table

**Where It's Set**:
- **Function**: `src/utils/database.ts` line 230-245: `updateRFFinal(quoteId, finalFob)`
- **Called From**: `src/components/RFDashboard.tsx` line 373: `handleSubmitFinals()`
- **Action**: Updates `quotes.rf_final_fob = finalFob` for the specified quote

### 2. Finalize Action Reliability

**Current Implementation** (already correct):
```typescript
// src/utils/database.ts line 230-245
export async function updateRFFinal(
  quoteId: string,
  finalFob: number
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      rf_final_fob: finalFob,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) {
    logger.error('Error updating quote:', error);
    return false;
  }
  return true;
}
```

**Status**: ✅ Reliably writes `rf_final_fob` to database

### 3. Allocation Query (BEFORE/AFTER)

#### BEFORE (Already Correct):
```typescript
// src/components/Allocation.tsx line 139-144
const itemQuotes = quotes.filter(q => 
  q.item_id === item.id && 
  q.rf_final_fob !== null && 
  q.rf_final_fob !== undefined && 
  q.rf_final_fob > 0
);
```

**Query Used**:
- Fetches: `fetchQuotesWithDetails(selectedWeek.id)` - gets all quotes for week
- Filters: Only quotes where `rf_final_fob IS NOT NULL AND rf_final_fob > 0`
- Groups: By SKU (item_id) - multiple suppliers per SKU
- Includes: `week_id`, `item_id`, `item_name` (via quote.item), `supplier_id`, `supplier_name` (via quote.supplier), `rf_final_fob` (as `price`), `awarded_volume`

#### AFTER (No Change to Query - Already Correct):
Same query, but now with **realtime subscription** to auto-refresh when quotes change.

### 4. Unlock Condition (BEFORE/AFTER)

#### BEFORE:
```typescript
// src/components/Allocation.tsx line 412-413
const weekStatus = selectedWeek.status;
if (weekStatus !== 'finalized' && weekStatus !== 'closed') {
  return (blocking message)
}
```

#### AFTER (From Previous Fix):
```typescript
// src/components/Allocation.tsx line 411-425
const weekStatus = actualWeekStatus || selectedWeek.status;
const canAccess = weekStatus === 'finalized' || 
                  weekStatus === 'closed' || 
                  hasFinalizedQuotes;  // ✅ Checks for finalized quotes

if (!canAccess) {
  return (blocking message)
}
```

**Status**: ✅ Unlock condition matches finalized quote truth

### 5. Realtime Subscription (NEW)

**Added**: `src/components/Allocation.tsx` lines 198-207

```typescript
// Realtime subscription: Refresh when quotes are updated (rf_final_fob set)
const handleQuotesUpdate = useCallback(() => {
  if (selectedWeek?.id) {
    logger.debug('Quotes updated, refreshing allocation data...');
    loadData();
  }
}, [selectedWeek?.id, loadData]);

// Subscribe to quotes table changes for this week
useRealtime('quotes', handleQuotesUpdate, { 
  column: 'week_id', 
  value: selectedWeek?.id 
});
```

**Effect**: When any quote in the selected week is updated (including `rf_final_fob` being set), the Allocation component automatically refreshes and shows the new finalized quote.

## Test Steps

1. **Open Pricing Tab**
   - Select a week
   - Select a supplier
   - See quotes with supplier prices

2. **Finalize One Supplier Quote**
   - Enter final price in "Final Price" input
   - Click "Submit Finals" button
   - OR click "Finalize Item" button
   - Verify: `updateRFFinal()` is called and `rf_final_fob` is set in database

3. **Switch to Allocation Tab** (or keep it open in another window)
   - Click "Award Volume" tab
   - **Expected**: The finalized quote appears immediately in the SKU list
   - **Expected**: Supplier name and finalized price (`rf_final_fob`) are visible
   - **Expected**: Allocation inputs are available for that supplier

4. **Verify Real-time Update**
   - Keep Allocation tab open
   - Go back to Pricing tab
   - Finalize another supplier quote
   - **Expected**: Within 1-2 seconds, the new finalized quote appears in Allocation tab automatically (no refresh needed)

## Files Changed

1. **src/components/Allocation.tsx**
   - Added `useRealtime` import
   - Added realtime subscription to `quotes` table
   - Subscription triggers `loadData()` when any quote in the week is updated

## Query Details

**Exact Query Used**:
```typescript
// Fetches all quotes for the week
const quotes = await fetchQuotesWithDetails(selectedWeek.id);

// Filters for finalized quotes only
const itemQuotes = quotes.filter(q => 
  q.item_id === item.id && 
  q.rf_final_fob !== null && 
  q.rf_final_fob !== undefined && 
  q.rf_final_fob > 0
);

// Returns per SKU:
// - item_id, item_name (from quote.item)
// - supplier_id, supplier_name (from quote.supplier)
// - finalized_unit_cost: quote.rf_final_fob
// - offered_volume: quote.awarded_volume (draft allocation)
```

**Data Structure**:
```typescript
interface AllocationEntry {
  quote_id: string;
  supplier_name: string;
  supplier_id: string;
  price: number;  // This is rf_final_fob
  dlvd_price: number | null;
  awarded_volume: number;
  // ... response fields
}
```

## Summary

✅ **Finalized State**: `quotes.rf_final_fob IS NOT NULL AND rf_final_fob > 0`  
✅ **Finalize Action**: `updateRFFinal()` reliably writes to database  
✅ **Allocation Query**: Already filters for finalized quotes only  
✅ **Unlock Condition**: Matches finalized quote truth  
✅ **Real-time Updates**: Realtime subscription refreshes Allocation when quotes are finalized  

**Result**: As soon as RF finalizes a quote, it immediately appears in the AI Allocation tab without manual refresh.

