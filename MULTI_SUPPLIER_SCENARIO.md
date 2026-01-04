# Multi-Supplier Pricing Scenario: Strawberry 2lb

## Scenario Overview
**SKU:** Strawberry 2lb  
**Week:** Week 15 (Jan 15-21, 2024)  
**Suppliers:** 4 different shippers competing for the same SKU

---

## Step 1: Suppliers Submit Initial Pricing

### Supplier Submissions (via Supplier Dashboard)

| Supplier | Supplier FOB | Submitted At | Quote ID |
|----------|--------------|--------------|----------|
| **Coastal Farms** | $10.50 | Day 1, 9:00 AM | quote_001 |
| **Valley Growers** | $11.25 | Day 1, 10:30 AM | quote_002 |
| **Mountain Fresh** | $9.75 | Day 1, 2:15 PM | quote_003 |
| **Pacific Produce** | $10.95 | Day 1, 4:00 PM | quote_004 |

**Database State:**
```sql
-- quotes table now has 4 records for the same item_id (Strawberry 2lb)
-- Each with different supplier_id but same week_id and item_id

quote_001: { week_id: 'week_15', item_id: 'strawberry_2lb', supplier_id: 'coastal_farms', supplier_fob: 10.50 }
quote_002: { week_id: 'week_15', item_id: 'strawberry_2lb', supplier_id: 'valley_growers', supplier_fob: 11.25 }
quote_003: { week_id: 'week_15', item_id: 'strawberry_2lb', supplier_id: 'mountain_fresh', supplier_fob: 9.75 }
quote_004: { week_id: 'week_15', item_id: 'strawberry_2lb', supplier_id: 'pacific_produce', supplier_fob: 10.95 }
```

---

## Step 2: RF Reviews All Quotes Per SKU

### RF Dashboard View (RF clicks "Quotes" button for Strawberry 2lb)

**Main SKU Row:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Strawberry 2lb  │  Status: Needs RF Counter  │  [Quotes ▼]    │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded Quotes Table (when RF clicks "Quotes"):**
```
┌──────────────────┬──────────────┬──────────────┬──────────────────┬──────────────┐
│ Supplier         │ Supplier FOB │ RF Counter   │ Supplier Response│ RF Final     │
├──────────────────┼──────────────┼──────────────┼──────────────────┼──────────────┤
│ Mountain Fresh   │ $9.75        │ -            │ -                │ -            │
│ Coastal Farms    │ $10.50       │ -            │ -                │ -            │
│ Pacific Produce  │ $10.95       │ -            │ -                │ -            │
│ Valley Growers   │ $11.25       │ -            │ -                │ -            │
└──────────────────┴──────────────┴──────────────┴──────────────────┴──────────────┘
```

**RF's Analysis:**
- **Mountain Fresh** is cheapest at $9.75
- **Coastal Farms** is competitive at $10.50
- **Pacific Produce** is mid-range at $10.95
- **Valley Growers** is highest at $11.25

**RF Decision:**
- Counter Mountain Fresh (best price, but wants to negotiate)
- Counter Coastal Farms (good relationship, wants better price)
- Accept Pacific Produce as-is (fair price, reliable supplier)
- Decline Valley Growers (too expensive)

---

## Step 3: RF Counters Per Supplier

### RF Actions (via RF Dashboard - per quote)

| Supplier | Action | RF Counter FOB | Notes |
|----------|--------|----------------|-------|
| **Mountain Fresh** | Counter | $9.50 | RF wants $0.25 lower |
| **Coastal Farms** | Counter | $10.25 | RF wants $0.25 lower |
| **Pacific Produce** | Accept | - | No counter needed |
| **Valley Growers** | Decline | - | Too expensive, won't counter |

**Database State:**
```sql
quote_001: { supplier_fob: 10.50, rf_counter_fob: 10.25, supplier_response: null }
quote_002: { supplier_fob: 11.25, rf_counter_fob: null, supplier_response: null } -- No counter (declined)
quote_003: { supplier_fob: 9.75, rf_counter_fob: 9.50, supplier_response: null }
quote_004: { supplier_fob: 10.95, rf_counter_fob: null, supplier_response: null } -- No counter (accepted)
```

**Updated Quotes Table:**
```
┌──────────────────┬──────────────┬──────────────┬──────────────────┬──────────────┐
│ Supplier         │ Supplier FOB │ RF Counter   │ Supplier Response│ RF Final     │
├──────────────────┼──────────────┼──────────────┼──────────────────┼──────────────┤
│ Mountain Fresh   │ $9.75        │ $9.50        │ -                │ -            │
│ Coastal Farms    │ $10.50       │ $10.25       │ -                │ -            │
│ Pacific Produce  │ $10.95       │ -            │ -                │ -            │
│ Valley Growers   │ $11.25       │ -            │ -                │ -            │
└──────────────────┴──────────────┴──────────────┴──────────────────┴──────────────┘
```

---

## Step 4: Suppliers Respond to Counters

### Supplier Responses (via Supplier Dashboard)

| Supplier | Response | Revised FOB | Notes |
|----------|----------|-------------|-------|
| **Mountain Fresh** | Accept | - | Accepts $9.50 counter |
| **Coastal Farms** | Revise | $10.30 | Won't go below $10.30 |
| **Pacific Produce** | Accept | - | Accepts original $10.95 (no counter) |

**Database State:**
```sql
quote_001: { supplier_fob: 10.50, rf_counter_fob: 10.25, supplier_response: 'revise', supplier_revised_fob: 10.30 }
quote_002: { supplier_fob: 11.25, rf_counter_fob: null, supplier_response: null } -- No response (declined)
quote_003: { supplier_fob: 9.75, rf_counter_fob: 9.50, supplier_response: 'accept', supplier_revised_fob: null }
quote_004: { supplier_fob: 10.95, rf_counter_fob: null, supplier_response: 'accept', supplier_revised_fob: null }
```

**Updated Quotes Table:**
```
┌──────────────────┬──────────────┬──────────────┬──────────────────┬──────────────┐
│ Supplier         │ Supplier FOB │ RF Counter   │ Supplier Response│ RF Final     │
├──────────────────┼──────────────┼──────────────┼──────────────────┼──────────────┤
│ Mountain Fresh   │ $9.75        │ $9.50        │ ACCEPT           │ -            │
│ Coastal Farms    │ $10.50       │ $10.25       │ REVISE ($10.30)  │ -            │
│ Pacific Produce  │ $10.95       │ -            │ ACCEPT           │ -            │
│ Valley Growers   │ $11.25       │ -            │ -                │ -            │
└──────────────────┴──────────────┴──────────────┴──────────────────┴──────────────┘
```

---

## Step 5: RF Finalizes Pricing Per Supplier

### RF Final Decisions (via RF Dashboard - per quote)

| Supplier | RF Final FOB | Decision Logic |
|----------|--------------|----------------|
| **Mountain Fresh** | $9.50 | Accepts supplier's acceptance of $9.50 counter |
| **Coastal Farms** | $10.30 | Accepts supplier's revised price of $10.30 |
| **Pacific Produce** | $10.95 | Confirms original price (no counter was needed) |
| **Valley Growers** | - | No final price (declined, won't be used) |

**Database State:**
```sql
quote_001: { supplier_fob: 10.50, rf_counter_fob: 10.25, supplier_response: 'revise', supplier_revised_fob: 10.30, rf_final_fob: 10.30 }
quote_002: { supplier_fob: 11.25, rf_counter_fob: null, supplier_response: null, rf_final_fob: null } -- Declined
quote_003: { supplier_fob: 9.75, rf_counter_fob: 9.50, supplier_response: 'accept', supplier_revised_fob: null, rf_final_fob: 9.50 }
quote_004: { supplier_fob: 10.95, rf_counter_fob: null, supplier_response: 'accept', supplier_revised_fob: null, rf_final_fob: 10.95 }
```

**Final Quotes Table:**
```
┌──────────────────┬──────────────┬──────────────┬──────────────────┬──────────────┐
│ Supplier         │ Supplier FOB │ RF Counter   │ Supplier Response│ RF Final     │
├──────────────────┼──────────────┼──────────────┼──────────────────┼──────────────┤
│ Mountain Fresh   │ $9.75        │ $9.50        │ ACCEPT           │ $9.50 ✓      │
│ Coastal Farms    │ $10.50       │ $10.25       │ REVISE ($10.30)  │ $10.30 ✓     │
│ Pacific Produce  │ $10.95       │ -            │ ACCEPT           │ $10.95 ✓     │
│ Valley Growers   │ $11.25       │ -            │ -                │ -            │
└──────────────────┴──────────────┴──────────────┴──────────────────┴──────────────┘
```

**SKU Status:** Now shows "Complete" (all active suppliers have `rf_final_fob` set)

---

## Step 6: RF Sets Internal Pricing Calculations

### Pricing Calculations Tab (per SKU, not per supplier)

**RF enters for Strawberry 2lb:**
- **Rebate:** $0.80
- **Freight:** $1.75
- **Profit Per Case:** $2.00

**Weighted Average FOB Calculation:**
- Mountain Fresh: $9.50 (will be used for volume allocation)
- Coastal Farms: $10.30 (will be used for volume allocation)
- Pacific Produce: $10.95 (will be used for volume allocation)
- Valley Growers: $11.25 (declined, not included)

**Note:** Weighted average is calculated based on **awarded volumes** (set later), not just final prices.

**Our Avg Cost Formula:**
```
Our Avg Cost = Weighted Avg FOB + Rebate + Freight
```

**Delivered Price Formula:**
```
Delivered Price = Our Avg Cost + Profit Per Case
```

**Database State:**
```sql
-- item_pricing_calculations table (one record per SKU per week)
{
  week_id: 'week_15',
  item_id: 'strawberry_2lb',
  avg_price: 10.25,  -- Weighted average of final FOBs (calculated when volumes are set)
  rebate: 0.80,
  freight: 1.75,
  margin: 2.00,  -- Profit per case
  dlvd_price: 14.80  -- Our Avg Cost (10.25 + 0.80 + 1.75) + Profit (2.00)
}
```

---

## Step 7: RF Allocates Volume Per Supplier

### Award Volume Tab (RF allocates volume to each supplier)

**Volume Allocation:**
- **Mountain Fresh:** 500 cases (best price: $9.50)
- **Coastal Farms:** 300 cases (good relationship: $10.30)
- **Pacific Produce:** 200 cases (reliable supplier: $10.95)
- **Valley Growers:** 0 cases (declined, too expensive)

**Total Volume:** 1,000 cases

**Database State:**
```sql
quote_001: { rf_final_fob: 10.30, awarded_volume: 300 }  -- Coastal Farms
quote_002: { rf_final_fob: null, awarded_volume: 0 }  -- Valley Growers (declined)
quote_003: { rf_final_fob: 9.50, awarded_volume: 500 }  -- Mountain Fresh
quote_004: { rf_final_fob: 10.95, awarded_volume: 200 }  -- Pacific Produce
```

**Weighted Average FOB Recalculation:**
```
Weighted Avg FOB = (9.50 × 500 + 10.30 × 300 + 10.95 × 200) / 1000
                 = (4750 + 3090 + 2190) / 1000
                 = 10.03
```

**Updated Pricing Calculations:**
```
Our Avg Cost = 10.03 + 0.80 + 1.75 = $12.58
Delivered Price = 12.58 + 2.00 = $14.58
Est. Profit = 2.00 × 1000 = $2,000
```

---

## Step 8: RF Submits Allocations to Suppliers

### Submit Allocations Action

**RF clicks "Send Allocation to Shipper"**

**Database State:**
```sql
-- awarded_volume is copied to offered_volume for each quote
quote_001: { awarded_volume: 300, offered_volume: 300 }  -- Coastal Farms
quote_003: { awarded_volume: 500, offered_volume: 500 }  -- Mountain Fresh
quote_004: { awarded_volume: 200, offered_volume: 200 }  -- Pacific Produce
quote_002: { awarded_volume: 0, offered_volume: 0 }  -- Valley Growers (no offer)
```

**Supplier Notifications:**
- Mountain Fresh receives: "You've been awarded 500 cases at $9.50 FOB"
- Coastal Farms receives: "You've been awarded 300 cases at $10.30 FOB"
- Pacific Produce receives: "You've been awarded 200 cases at $10.95 FOB"
- Valley Growers receives: Nothing (declined earlier)

---

## Step 9: Suppliers Respond to Volume Offers

### Supplier Volume Responses (via Supplier Dashboard)

| Supplier | Response | Accepted Volume | Notes |
|----------|----------|-----------------|-------|
| **Mountain Fresh** | Accept | 500 cases | Accepts full allocation |
| **Coastal Farms** | Revise | 250 cases | Can only supply 250 cases |
| **Pacific Produce** | Accept | 200 cases | Accepts full allocation |

**Database State:**
```sql
quote_001: { 
  offered_volume: 300, 
  supplier_volume_response: 'update', 
  supplier_volume_accepted: 250 
}  -- Coastal Farms revised
quote_003: { 
  offered_volume: 500, 
  supplier_volume_response: 'accept', 
  supplier_volume_accepted: 500 
}  -- Mountain Fresh accepted
quote_004: { 
  offered_volume: 200, 
  supplier_volume_response: 'accept', 
  supplier_volume_accepted: 200 
}  -- Pacific Produce accepted
```

---

## Step 10: RF Finalizes Volume in Acceptance Tab

### Volume Acceptance Tab (RF reviews supplier responses)

**Volume Acceptance View:**
```
┌──────────────────┬──────────────┬──────────────┬──────────────────┬──────────────┐
│ Supplier         │ Offered      │ Response     │ Accepted Volume  │ Action       │
├──────────────────┼──────────────┼──────────────┼──────────────────┼──────────────┤
│ Mountain Fresh   │ 500 cases    │ ACCEPT       │ 500 cases        │ [Accept]     │
│ Coastal Farms    │ 300 cases    │ REVISE       │ 250 cases        │ [Accept]     │
│ Pacific Produce  │ 200 cases    │ ACCEPT       │ 200 cases        │ [Accept]     │
└──────────────────┴──────────────┴──────────────┴──────────────────┴──────────────┘
```

**RF Actions:**
- Accepts Mountain Fresh's 500 cases
- Accepts Coastal Farms' revised 250 cases
- Accepts Pacific Produce's 200 cases

**Final Volume:** 950 cases (down from 1,000 due to Coastal Farms revision)

**Database State:**
```sql
quote_001: { 
  awarded_volume: 250,  -- Updated to match supplier_volume_accepted
  supplier_volume_accepted: 250 
}
quote_003: { 
  awarded_volume: 500,  -- Matches supplier_volume_accepted
  supplier_volume_accepted: 500 
}
quote_004: { 
  awarded_volume: 200,  -- Matches supplier_volume_accepted
  supplier_volume_accepted: 200 
}
```

**Updated Financial Calculations:**
```
Weighted Avg FOB = (9.50 × 500 + 10.30 × 250 + 10.95 × 200) / 950
                 = (4750 + 2575 + 2190) / 950
                 = 10.02

Our Avg Cost = 10.02 + 0.80 + 1.75 = $12.57
Delivered Price = 12.57 + 2.00 = $14.57
Est. Profit = 2.00 × 950 = $1,900
Committed Revenue = 14.57 × 950 = $13,841.50
Committed Cost = 12.57 × 950 = $11,941.50
Margin = (1,900 / 13,841.50) × 100 = 13.72%
```

---

## Step 11: RF Closes the Loop

### Close Volume Loop Action

**RF clicks "Close the Loop"**

**Validation Checks:**
- ✅ All supplier responses have been handled
- ✅ No pending allocations
- ✅ All finalized allocations have `awarded_volume` matching `supplier_volume_accepted`

**Database State:**
```sql
-- weeks table
{ 
  id: 'week_15',
  status: 'closed',
  volume_finalized: true,
  finalized_at: '2024-01-20T17:00:00Z'
}
```

**Final Summary:**
- **SKU:** Strawberry 2lb
- **Total Volume:** 950 cases
- **Suppliers Used:** 3 (Mountain Fresh, Coastal Farms, Pacific Produce)
- **Weighted Avg FOB:** $10.02
- **Our Avg Cost:** $12.57
- **Delivered Price:** $14.57
- **Est. Profit:** $1,900
- **Margin:** 13.72%

---

## Key Takeaways

1. **Multiple Quotes Per SKU:** Each supplier has their own quote record for the same SKU, allowing independent pricing negotiation.

2. **Per-Quote Workflow:** RF can counter, accept, or decline each supplier independently, even for the same SKU.

3. **Weighted Average:** The system calculates weighted average FOB based on final awarded volumes, not just prices.

4. **Volume Allocation:** RF can split volume across multiple suppliers for the same SKU based on price, relationship, and reliability.

5. **Supplier Responses:** Each supplier can independently accept or revise their volume allocation.

6. **Financial Calculations:** All financial totals (revenue, cost, profit, margin) are calculated from the single source of truth: `item_pricing_calculations` and final `awarded_volume` values.

7. **Declined Suppliers:** Valley Growers was declined early in pricing and never received a volume allocation, so they don't appear in final calculations.

---

## UI Flow Summary

1. **RF Dashboard:** View all SKUs → Click "Quotes" → See all 4 suppliers' prices → Counter/Accept per supplier
2. **Pricing Calculations:** Set rebate, freight, profit per case → System calculates weighted avg FOB from final prices
3. **Award Volume:** Allocate volume to each supplier → System recalculates weighted avg FOB based on volumes
4. **Volume Acceptance:** Review supplier responses → Accept/Revise per supplier → Finalize volumes
5. **Close Loop:** Validate all responses handled → Lock week → All parties see final status

