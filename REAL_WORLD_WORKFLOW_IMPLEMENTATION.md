# Real-World Workflow Implementation

## Core Business Rule (Anchor)

> **"Pricing submission ≠ allocation eligibility"**
> 
> Not every shipper who submits pricing gets volume.
> Allocation is a **separate, flexible decision layer**.

---

## Implementation Status

### ✅ Completed

1. **Database Schema**
   - Added `supplier_eligibility_status` column to `quotes` table
   - Status values: `submitted`, `reviewed`, `feedback_sent`, `eligible_for_award`, `not_used`
   - Default: `submitted` (when supplier first submits pricing)
   - Migration: `20260105000000_add_supplier_eligibility_status.sql`

2. **Database Function**
   - Created `update_supplier_eligibility()` function
   - Includes audit logging
   - Migration: `20260105000001_add_update_eligibility_function.sql`

3. **TypeScript Types**
   - Updated `Quote` interface to include `supplier_eligibility_status`
   - Added documentation explaining the business rule

4. **Database Utility Function**
   - Added `updateSupplierEligibility()` to `database.ts`
   - Wraps the RPC call with proper error handling

### 🚧 Remaining Work

1. **RF Review Interface** (TODO #3)
   - Create component for RF to review all supplier pricing side-by-side
   - Add UI to mark suppliers as eligible/not eligible
   - Show eligibility status in pricing table
   - Location: Add to `RFDashboard.tsx` or create new `SupplierReview.tsx`

2. **Update AwardVolume** (TODO #4)
   - Filter allocation interface to only show `eligible_for_award` suppliers
   - Update `loadVolumeData()` to filter by eligibility status
   - Location: `src/components/AwardVolume.tsx`

3. **Weighted Average Calculation** (TODO #5)
   - Update weighted average to only use `eligible_for_award` suppliers
   - Update `item_pricing_calculations` to filter by eligibility
   - Location: `src/components/PricingCalculations.tsx` and `AwardVolume.tsx`

4. **Remove Auto-Logic** (TODO #6)
   - Audit codebase for any "lowest price wins" logic
   - Remove automatic allocation based on price
   - Ensure all allocation is manual/RF-controlled
   - Search for: price comparisons, automatic rankings, auto-allocation

5. **Internal Pricing Calculator** (TODO #7)
   - Verify calculator is RF-only (no supplier visibility)
   - Ensure it's separate from supplier pricing
   - Location: `src/components/PricingCalculations.tsx`

---

## Workflow States

### Supplier Pricing Submission (OPEN TO ALL)
- All suppliers can submit pricing
- Status automatically set to `submitted`
- No allocation happens here (data intake only)

### RF Review + Feedback Layer (CRITICAL)
- RF reviews all submitted pricing side-by-side
- RF can mark suppliers:
  - `reviewed` - RF looked at it
  - `feedback_sent` - RF responded but didn't award
  - `eligible_for_award` - RF plans to allocate volume
  - `not_used` - Pricing logged but no volume

### Internal Pricing Calculator (RF ONLY)
- Non-negotiable requirement
- RF-only visibility
- Separate from supplier pricing
- Calculates: landed cost, internal net cost, margin %

### Weighted Average Cost (Post-Selection)
- **ONLY considers `eligible_for_award` suppliers**
- Calculated after RF marks eligibility
- Based on planned volumes per eligible supplier

### Volume Allocation (Flexible, Not Auto)
- Only `eligible_for_award` suppliers appear in allocation interface
- RF manually controls volume
- No forced "lowest price wins" logic
- System validates: sum = total volume, supplier is eligible

---

## Key Implementation Notes

### Do NOT hard-code:
- ❌ "Lowest price auto wins"
- ❌ "All submitted suppliers must be allocated"
- ❌ "Pricing submission = allocation eligibility"

### REQUIRED separations:
- ✅ **Pricing table** → intake only
- ✅ **Eligibility flag** → RF decision
- ✅ **Allocation table** → volume logic
- ✅ **Internal calc** → RF only, no supplier visibility

### Mental Model:
> Pricing is **data collection**  
> Eligibility is **human judgment**  
> Allocation is **strategy**  
> Weighted avg is **a result, not a rule**

---

## Next Steps

1. Create RF review interface component
2. Update AwardVolume to filter by eligibility
3. Update weighted average calculations
4. Audit and remove auto-allocation logic
5. Verify internal calculator is RF-only

---

## Database Queries Needed

### Get all quotes for review (RF):
```sql
SELECT * FROM quotes 
WHERE week_id = ? 
AND supplier_fob IS NOT NULL
ORDER BY item_id, supplier_fob;
```

### Get only eligible suppliers for allocation:
```sql
SELECT * FROM quotes 
WHERE week_id = ? 
AND supplier_eligibility_status = 'eligible_for_award'
AND rf_final_fob IS NOT NULL;
```

### Calculate weighted average (only eligible):
```sql
SELECT 
  item_id,
  SUM(rf_final_fob * awarded_volume) / NULLIF(SUM(awarded_volume), 0) as weighted_avg
FROM quotes
WHERE week_id = ?
AND supplier_eligibility_status = 'eligible_for_award'
AND awarded_volume > 0
GROUP BY item_id;
```

