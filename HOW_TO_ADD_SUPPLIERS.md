# How to Add Suppliers to Your Database 🚚

## The Problem
You can log in to RF Manager, but no suppliers are showing. This means your database doesn't have any suppliers yet.

## Solution: Add Suppliers

You have **3 options** to add suppliers:

---

## Option 1: Add via Supabase Dashboard (Easiest) ✅

### Step 1: Go to Supabase
1. Go to: **https://supabase.com/dashboard**
2. Click on your project
3. Click **"Table Editor"** in the left sidebar
4. Click on the **"suppliers"** table

### Step 2: Add a Supplier
1. Click the **"Insert"** button (or **"+"** button)
2. Fill in the form:
   - **name:** (e.g., "Berry Best Co")
   - **email:** (e.g., "supplier@berrybest.com")
3. Click **"Save"** or press Enter
4. Repeat for each supplier you want to add

### Step 3: Refresh Your App
1. Go back to your Netlify site
2. Refresh the page (F5 or Cmd+R)
3. Suppliers should now appear!

---

## Option 2: Add via SQL Editor (Faster for Multiple)

### Step 1: Go to SQL Editor
1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**

### Step 2: Run This SQL
Copy and paste this SQL (modify the names/emails as needed):

```sql
INSERT INTO suppliers (name, email) VALUES
  ('Berry Best Co', 'supplier1@berrybest.com'),
  ('Fresh Farms Inc', 'supplier2@freshfarms.com'),
  ('Organic Growers', 'supplier3@organicgrowers.com'),
  ('Valley Fresh', 'supplier4@valleyfresh.com'),
  ('Premium Produce', 'supplier5@premiumproduce.com');
```

### Step 3: Run the Query
1. Click **"Run"** button (or press Cmd+Enter)
2. You should see "Success. No rows returned"
3. Refresh your app - suppliers should appear!

---

## Option 3: Use the Seed Function (For Testing)

If you want to quickly add test suppliers, you can use the built-in seed function:

1. Open your browser's **Developer Console** (F12)
2. Go to the **Console** tab
3. Paste this code and press Enter:

```javascript
// This will add 5 test suppliers
fetch('/api/seed-suppliers', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

**Note:** This requires the seed endpoint to be set up. If it doesn't work, use Option 1 or 2 instead.

---

## Quick Checklist

- [ ] Opened Supabase dashboard
- [ ] Went to Table Editor → suppliers table
- [ ] Added at least one supplier (name + email)
- [ ] Refreshed the Netlify app
- [ ] Suppliers now showing in RF Manager

---

## What Each Supplier Needs

Each supplier record needs:
- **name** (text) - The supplier's company name
- **email** (text) - Their email address (must be unique)
- **id** (uuid) - Automatically generated
- **created_at** (timestamp) - Automatically set

---

## Example Suppliers

Here are some example suppliers you can add:

```
Berry Best Co | berry@berrybest.com
Fresh Farms Inc | contact@freshfarms.com
Organic Growers | info@organicgrowers.com
Valley Fresh | sales@valleyfresh.com
Premium Produce | hello@premiumproduce.com
```

---

## Still Not Working?

**Check these things:**

1. **Are you in the right Supabase project?**
   - Make sure you're in the project that matches your `VITE_SUPABASE_URL`

2. **Did you refresh the app?**
   - After adding suppliers, refresh your Netlify site

3. **Check the browser console:**
   - Press F12 → Console tab
   - Look for any error messages
   - Share them with me if you see errors

4. **Verify suppliers were added:**
   - In Supabase Table Editor, you should see your suppliers listed
   - If they're there but not showing in the app, there might be a connection issue

---

## Need Help?

Tell me:
1. Did you add suppliers via Supabase?
2. Do you see any errors in the browser console (F12)?
3. Are the suppliers visible in Supabase Table Editor?

