# Seed Your Database with Pre-Loaded Data 🗄️

## Quick Setup: Get Suppliers, Items, Weeks, and Sample Data

### Step 1: Go to Supabase SQL Editor
1. Go to: **https://supabase.com/dashboard**
2. Click your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### Step 2: Copy and Run the Seed Script
1. Open the file `seed-database.sql` in this project
2. **Copy the entire contents**
3. **Paste into Supabase SQL Editor**
4. Click **"Run"** (or press Cmd+Enter)
5. Wait 10-30 seconds

### Step 3: Verify It Worked
You should see a result showing:
```
supplier_count | item_count | week_count | quote_count
5             | 8          | 6          | 200+
```

### Step 4: Refresh Your App
1. Go to your Netlify site
2. **Refresh the page**
3. You should now see:
   - ✅ 5 suppliers in the dropdown
   - ✅ Items listed
   - ✅ Weeks available
   - ✅ Sample pricing data

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
- Weeks 1-5: Closed with historical pricing data
- Week 6: Open (ready for new quotes)

### Quotes:
- ~200+ quotes with sample pricing data
- Historical pricing for closed weeks
- Ready for you to test the full workflow

---

## Troubleshooting

**If you get errors:**
1. Make sure you're in the right Supabase project
2. Check if tables already exist (the script uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times)
3. If you want to start fresh, uncomment the DELETE statements at the top of the SQL file

**If suppliers still don't show:**
1. Check browser console (F12) for errors
2. Verify Supabase connection in Netlify environment variables
3. Make sure you refreshed the page after seeding

---

## Need More Data?

You can modify the SQL script to:
- Add more suppliers
- Add more items
- Add more weeks
- Generate more quotes

Just edit `seed-database.sql` and run it again!

