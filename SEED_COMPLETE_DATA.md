# Seed Complete Database with Historical Data 📊

## What This Does
This seed script creates:
- ✅ **5 Suppliers** (shippers)
- ✅ **8 Items** (SKUs)
- ✅ **6 Weeks** (5 closed with complete data, 1 open)
- ✅ **Complete workflow data** for all 5 closed weeks:
  - Initial supplier quotes
  - RF counter offers
  - Supplier responses (accept/revise)
  - Finalized pricing
  - Awarded volumes

## How to Run

### Step 1: Go to Supabase SQL Editor
1. Go to: **https://supabase.com/dashboard**
2. Click your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New query"**

### Step 2: Run the Seed Script
1. Open the file: **`seed-complete-database.sql`**
2. **Copy ALL the SQL code**
3. **Paste into Supabase SQL Editor**
4. Click **"Run"** (or press Cmd+Enter)
5. Wait 10-30 seconds

### Step 3: Verify It Worked
You should see a result showing:
```
supplier_count | item_count | week_count | quote_count | finalized_quotes | quotes_with_volume
5             | 8          | 6          | 200+        | 200+            | 200+
```

### Step 4: Refresh Your App
1. Go to your Netlify site
2. **Refresh the page** (Cmd+R or Ctrl+R)
3. You should now see:
   - ✅ 5 suppliers in dropdown
   - ✅ 6 weeks available
   - ✅ Can select any week
   - ✅ Historical data for weeks 1-5

---

## What Gets Created

### Suppliers (5):
- Fresh Farms Inc
- Berry Best Co
- Organic Growers
- Valley Fresh
- Premium Produce

### Items (8):
- Strawberry 4×2 lb (CONV)
- Strawberry 8×1 lb (ORG)
- Blueberry 18 oz (CONV)
- Blueberry Pint (ORG)
- Blackberry 12×6 oz (CONV)
- Blackberry 12×6 oz (ORG)
- Raspberry 12×6 oz (CONV)
- Raspberry 12×6 oz (ORG)

### Weeks (6):
- **Weeks 1-5:** Closed with complete historical data
  - All suppliers quoted
  - RF counters sent
  - Supplier responses (accept/revise)
  - Finalized pricing
  - Awarded volumes
- **Week 6:** Open (ready for new quotes)

### Historical Data:
- ~200 quotes across all weeks
- Complete pricing workflow
- Volume allocations
- All stages of the loop completed

---

## After Seeding

1. **Refresh your Netlify site**
2. **Enter access code:** `RF2024`
3. **Select "RF Manager"**
4. **Select a week** (weeks 1-5 have full data)
5. **Select a supplier** (all 5 are available)
6. **See all the historical pricing data!**

---

## Troubleshooting

**If you get errors:**
- Make sure you're in the right Supabase project
- Check that tables exist (run migrations first if needed)
- The script uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times

**If data doesn't show:**
- Clear browser cache (Cmd+Shift+R)
- Check Supabase connection in Netlify environment variables
- Verify the seed script completed successfully

---

**Run the seed script and you'll have all your data!** 🎉

