# Finalized Pricing Analysis

## Section 1: What finalized pricing means in this system

### Database Fields That Determine Finalized State

1. **Week Status Field** (`weeks.status`)
   - **Location**: `weeks` table, `status` column
   - **Type**: `text` with CHECK constraint: `'open' | 'finalized' | 'closed'`
   - **Schema**: `/supabase/migrations/20260101010948_rebuild_pricing_portal_schema.sql` (line 84)
   - **Purpose**: Controls overall week state and unlocks Volume tab

2. **Quote Final Price Field** (`quotes.rf_final_fob`)
   - **Location**: `quotes` table, `rf_final_fob` column
   - **Type**: `decimal(10, 2)`, nullable
   - **Schema**: `/supabase/migrations/20260101010948_rebuild_pricing_portal_schema.sql` (line 161)
   - **Purpose**: RF's confirmed final price per quote (one supplier, one SKU)

### Conditions for "Finalized" State

**Week is considered finalized when:**
- `weeks.status = 'finalized'` OR `weeks.status = 'closed'`
- At least one quote has `rf_final_fob IS NOT NULL AND rf_final_fob > 0`

**Volume Tab Enable Condition:**
- **File**: `src/components/AwardVolume.tsx` (line 685)
- **Code**: `if (selectedWeek.status !== 'finalized' && selectedWeek.status !== 'closed')`
- **Result**: If week status is NOT 'finalized' AND NOT 'closed', Volume tab shows blocking message

**Finalization Validation:**
- **File**: `src/utils/database.ts` (lines 1200-1237)
- **Function**: `finalizePricingForWeek(weekId, userName)`
- **Validation**: Requires at least one quote with `rf_final_fob !== null && rf_final_fob !== undefined`
- **Action**: Sets `weeks.status = 'finalized'` if validation passes

---

## Section 2: Where it should be set

### Where `rf_final_fob` is Set

1. **Manual RF Input (Primary Method)**
   - **File**: `src/components/RFDashboard.tsx`
   - **Function**: `updateRFFinal(quoteId, finalFob)` (called from `src/utils/database.ts` line 230)
   - **UI Location**: RF Dashboard → Final Price input field (line 1425-1438)
   - **Trigger**: RF manually enters final price in input field
   - **Button**: "Push to Finalize" or "Submit Finals" (lines 331-373, 375-456)

2. **Auto-Finalization on Supplier Accept**
   - **File**: `src/utils/database.ts` (lines 182-193)
   - **Function**: `updateSupplierResponse(quoteId, response, revisedFob)`
   - **Condition**: `if (response === 'accept' && quote.rf_counter_fob !== null)`
   - **Action**: Automatically sets `rf_final_fob = quote.rf_counter_fob`
   - **Trigger**: Supplier accepts RF's counter offer

3. **Bulk Auto-Finalization**
   - **File**: `src/components/RFDashboard.tsx` (lines 423-456)
   - **Function**: `handlePushToFinalize()`
   - **Logic**: Auto-finalizes quotes based on:
     - Supplier revised price → uses `supplier_revised_fob`
     - Supplier accepted counter → uses `rf_counter_fob`
     - No counter, supplier price only → uses `supplier_fob`
   - **Trigger**: RF clicks "Push to Finalize" button

4. **Per-Item Finalization**
   - **File**: `src/components/RFDashboard.tsx` (lines 530-568)
   - **Function**: `handleFinalizeItem(itemId)`
   - **Action**: Finalizes all quotes for a specific item that don't have `rf_final_fob` set
   - **Trigger**: RF clicks "Finalize Item" button next to item name

### Where Week Status is Set to 'finalized'

1. **Explicit Finalization Function**
   - **File**: `src/utils/database.ts` (lines 1200-1237)
   - **Function**: `finalizePricingForWeek(weekId, userName)`
   - **Called From**:
     - `src/components/RFDashboard.tsx` line 575 (`handleFinalizePricing`)
     - `src/components/AwardVolume.tsx` line 313 (`handleFinalizeWeekPricing`)
   - **Validation**: Requires at least one quote with `rf_final_fob` set
   - **Action**: Updates `weeks.status = 'finalized'`

2. **UI Buttons That Trigger Finalization**
   - **RFDashboard**: "Finalize Week Pricing" button (line 570)
   - **AwardVolume**: "Finalize Week Pricing" button (line 845)
   - **Both**: Call `finalizePricingForWeek()` which validates and updates week status

---

## Section 3: Why it's not being set

### Root Cause Analysis

**Problem**: Pricing never reaches "finalized" state, blocking Volume tab.

**Likely Causes**:

1. **RF Confirms Pricing Without Setting `rf_final_fob`**
   - **Scenario**: RF reviews supplier prices and mentally "confirms" them, but doesn't:
     - Manually enter final prices in the input fields
     - Click "Push to Finalize" button
     - Click "Finalize Item" buttons
     - Click "Finalize Week Pricing" button
   - **Result**: `rf_final_fob` remains `NULL` for all quotes
   - **Evidence**: `finalizePricingForWeek()` validation fails (line 1215-1216)

2. **Auto-Finalization Only Works for Accepted Counters**
   - **File**: `src/utils/database.ts` (lines 191-192)
   - **Condition**: Auto-finalization ONLY happens when `supplier_response === 'accept' AND rf_counter_fob IS NOT NULL`
   - **Gap**: If RF accepts supplier's original price (no counter sent), `rf_final_fob` is NOT auto-set
   - **Gap**: If supplier revises price, `rf_final_fob` is NOT auto-set (left null for RF review)

3. **Bulk Auto-Finalization Requires Button Click**
   - **File**: `src/components/RFDashboard.tsx` (lines 375-456)
   - **Function**: `handlePushToFinalize()` has comprehensive auto-finalization logic
   - **Problem**: This logic only runs when RF clicks "Push to Finalize" button
   - **If RF doesn't click this button**: Quotes remain without `rf_final_fob` even if pricing is "confirmed"

4. **Week Status Update Requires Validation**
   - **File**: `src/utils/database.ts` (lines 1213-1216)
   - **Validation**: `if (quotesWithFinalPricing.length === 0)` → returns error
   - **Problem**: If no quotes have `rf_final_fob` set, week status cannot be updated to 'finalized'
   - **Result**: Week stays in 'open' status, Volume tab remains blocked

5. **Missing Automatic Trigger When RF Confirms**
   - **Gap**: There's no automatic mechanism that sets `rf_final_fob` when RF "confirms" pricing through normal workflow
   - **Gap**: RF must explicitly:
     - Enter final prices manually, OR
     - Click "Push to Finalize" button, OR
     - Click "Finalize Item" buttons, OR
     - Click "Finalize Week Pricing" (but this fails if no `rf_final_fob` exists)

### Specific Code Paths That Fail

**Path 1: RF Accepts Supplier Price (No Counter)**
- Supplier submits `supplier_fob = $10.00`
- RF reviews and mentally confirms
- **Expected**: `rf_final_fob = $10.00` should be set
- **Actual**: `rf_final_fob` remains `NULL` unless RF manually sets it
- **Location**: No auto-finalization for this scenario

**Path 2: Supplier Revises Price**
- RF sends counter: `rf_counter_fob = $9.50`
- Supplier revises: `supplier_revised_fob = $9.75`
- RF reviews and accepts revised price
- **Expected**: `rf_final_fob = $9.75` should be set
- **Actual**: `rf_final_fob` remains `NULL` (left for RF review per line 183 comment)
- **Location**: `src/utils/database.ts` line 183: "If supplier revises, leave rf_final_fob null for RF to review"

**Path 3: RF Tries to Finalize Week Without Setting Final Prices**
- RF clicks "Finalize Week Pricing"
- **Expected**: Week status changes to 'finalized'
- **Actual**: Function returns error: "Cannot finalize: No quotes have final pricing set"
- **Location**: `src/utils/database.ts` line 1216

---

## Section 4: Minimal fix options (no refactor)

### Option 1: Auto-Set `rf_final_fob` When RF Confirms (Recommended)

**File**: `src/utils/database.ts`

**Change**: Modify `updateSupplierResponse()` to also set `rf_final_fob` when supplier revises (not just when accepting).

**Current Code** (lines 182-193):
```typescript
// Auto-finalize if supplier accepts the counter
// If supplier revises, leave rf_final_fob null for RF to review
const updateData: any = {
  supplier_response: response,
  supplier_revised_fob: revisedFob || null,
  updated_at: new Date().toISOString(),
};

// Auto-lock to counter price if supplier accepts
if (response === 'accept' && quote && quote.rf_counter_fob !== null) {
  updateData.rf_final_fob = quote.rf_counter_fob;
}
```

**Minimal Fix**:
```typescript
// Auto-finalize if supplier accepts the counter
// Auto-finalize to revised price if supplier revises
const updateData: any = {
  supplier_response: response,
  supplier_revised_fob: revisedFob || null,
  updated_at: new Date().toISOString(),
};

// Auto-lock to counter price if supplier accepts
if (response === 'accept' && quote && quote.rf_counter_fob !== null) {
  updateData.rf_final_fob = quote.rf_counter_fob;
}
// Auto-lock to revised price if supplier revises
else if (response === 'revise' && revisedFob !== null && revisedFob > 0) {
  updateData.rf_final_fob = revisedFob;
}
```

**Impact**: When supplier revises price, `rf_final_fob` is automatically set to the revised price, allowing week finalization.

---

### Option 2: Auto-Set `rf_final_fob` for Quotes Without Counters

**File**: `src/utils/database.ts`

**Change**: Add logic to automatically set `rf_final_fob = supplier_fob` when RF confirms pricing without sending a counter.

**Location**: Create new function or modify existing finalization logic.

**Minimal Fix**: Add to `finalizePricingForWeek()` function (after line 1213):
```typescript
// Auto-set rf_final_fob for quotes that have supplier_fob but no rf_final_fob
if (quotesWithFinalPricing.length === 0) {
  // Try to auto-finalize quotes with supplier prices but no final price
  const quotesToAutoFinalize = quotes?.filter(q => 
    q.rf_final_fob === null && 
    q.supplier_fob !== null && 
    q.supplier_fob > 0
  ) || [];
  
  if (quotesToAutoFinalize.length > 0) {
    for (const quote of quotesToAutoFinalize) {
      // Use supplier_revised_fob if available, otherwise supplier_fob
      const finalPrice = quote.supplier_revised_fob || quote.supplier_fob;
      if (finalPrice) {
        await supabase
          .from('quotes')
          .update({ rf_final_fob: finalPrice })
          .eq('id', quote.id);
      }
    }
    // Re-check after auto-finalization
    const { data: updatedQuotes } = await supabase
      .from('quotes')
      .select('id, rf_final_fob')
      .eq('week_id', weekId);
    
    const updatedFinalPricing = updatedQuotes?.filter(q => 
      q.rf_final_fob !== null && q.rf_final_fob !== undefined
    ) || [];
    
    if (updatedFinalPricing.length === 0) {
      return { success: false, error: 'Cannot finalize: No quotes have final pricing set. Please set rf_final_fob for at least one quote.' };
    }
  } else {
    return { success: false, error: 'Cannot finalize: No quotes have final pricing set. Please set rf_final_fob for at least one quote.' };
  }
}
```

**Impact**: When RF tries to finalize week, system automatically sets `rf_final_fob` for quotes that have supplier prices, allowing finalization to proceed.

---

### Option 3: SQL Trigger to Auto-Set `rf_final_fob` (Database-Level)

**File**: Create new migration file

**Minimal Fix**: Add database trigger that automatically sets `rf_final_fob` when certain conditions are met.

**SQL**:
```sql
-- Auto-set rf_final_fob when supplier revises (if not already set)
CREATE OR REPLACE FUNCTION auto_set_rf_final_on_revise()
RETURNS TRIGGER AS $$
BEGIN
  -- If supplier revises and rf_final_fob is null, set it to revised price
  IF NEW.supplier_response = 'revise' 
     AND NEW.supplier_revised_fob IS NOT NULL 
     AND NEW.rf_final_fob IS NULL THEN
    NEW.rf_final_fob := NEW.supplier_revised_fob;
  END IF;
  
  -- If supplier accepts counter and rf_final_fob is null, set it to counter price
  IF NEW.supplier_response = 'accept' 
     AND NEW.rf_counter_fob IS NOT NULL 
     AND NEW.rf_final_fob IS NULL THEN
    NEW.rf_final_fob := NEW.rf_counter_fob;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_rf_final
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_rf_final_on_revise();
```

**Impact**: Automatically sets `rf_final_fob` at database level when supplier responds, ensuring it's always set when pricing is confirmed.

---

### Option 4: Modify Finalization Validation to Be More Permissive

**File**: `src/utils/database.ts`

**Change**: Allow week finalization if quotes have `supplier_fob` or `supplier_revised_fob`, even if `rf_final_fob` is not explicitly set.

**Current Code** (lines 1213-1216):
```typescript
const quotesWithFinalPricing = quotes?.filter(q => q.rf_final_fob !== null && q.rf_final_fob !== undefined) || [];

if (quotesWithFinalPricing.length === 0) {
  return { success: false, error: 'Cannot finalize: No quotes have final pricing set. Please set rf_final_fob for at least one quote.' };
}
```

**Minimal Fix**:
```typescript
// Check for quotes with rf_final_fob explicitly set
const quotesWithFinalPricing = quotes?.filter(q => q.rf_final_fob !== null && q.rf_final_fob !== undefined) || [];

// If no explicit final prices, check for quotes with supplier prices (implicit confirmation)
if (quotesWithFinalPricing.length === 0) {
  const quotesWithSupplierPrices = quotes?.filter(q => 
    (q.supplier_revised_fob !== null && q.supplier_revised_fob > 0) ||
    (q.supplier_fob !== null && q.supplier_fob > 0)
  ) || [];
  
  if (quotesWithSupplierPrices.length === 0) {
    return { success: false, error: 'Cannot finalize: No quotes have pricing set. Please set supplier prices first.' };
  }
  
  // Auto-finalize quotes with supplier prices
  for (const quote of quotesWithSupplierPrices) {
    const finalPrice = quote.supplier_revised_fob || quote.supplier_fob;
    if (finalPrice) {
      await supabase
        .from('quotes')
        .update({ rf_final_fob: finalPrice })
        .eq('id', quote.id);
    }
  }
}
```

**Impact**: Week can be finalized even if RF hasn't explicitly set `rf_final_fob`, as long as supplier prices exist. System auto-sets `rf_final_fob` during finalization.

---

## Summary

**The Problem**: 
- `rf_final_fob` is not automatically set when RF "confirms" pricing
- Week status cannot change to 'finalized' without at least one `rf_final_fob` set
- Volume tab requires week status = 'finalized' or 'closed'

**The Root Cause**:
- Auto-finalization only works for supplier-accepted counters
- RF must manually set final prices or click buttons to trigger bulk finalization
- No automatic mechanism when RF confirms pricing through normal workflow

**Recommended Minimal Fix**:
- **Option 1** (Auto-set on supplier revise): Simplest, handles common case where supplier revises price
- **Option 2** (Auto-set during finalization): Most user-friendly, allows RF to finalize week without manually setting every price
- **Option 3** (Database trigger): Most robust, ensures `rf_final_fob` is always set when it should be
- **Option 4** (Permissive validation): Allows finalization with implicit confirmation, auto-sets during process

**Files to Modify**:
- `src/utils/database.ts` (lines 182-193 for Option 1, lines 1200-1237 for Options 2 & 4)
- OR create new migration file for Option 3

