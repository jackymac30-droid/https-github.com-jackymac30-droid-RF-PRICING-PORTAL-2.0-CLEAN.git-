# Setup Database From Scratch 🗄️

## The Problem
You're getting "relation suppliers does not exist" because the database tables haven't been created yet.

## Solution: Run Migrations First, Then Seed

### Step 1: Run the Main Schema Migration
This creates all the tables (suppliers, items, weeks, quotes, etc.)

1. Go to: **https://supabase.com/dashboard**
2. Click your project → **"SQL Editor"** → **"New query"**
3. Open: `supabase/migrations/20260101010948_rebuild_pricing_portal_schema.sql`
4. **Copy ALL the SQL code**
5. **Paste into Supabase SQL Editor**
6. Click **"Run"**
7. Wait 10-30 seconds

This creates:
- ✅ `suppliers` table
- ✅ `items` table
- ✅ `weeks` table
- ✅ `quotes` table
- ✅ `audit_log` table
- ✅ All security policies

### Step 2: Run Additional Migrations (In Order)
Run these migrations in order (they add more features):

1. **20260102005037_fix_security_and_performance_issues.sql**
   - Fixes security and performance

2. **20260103015913_create_week_item_volumes_table.sql**
   - Creates volume tracking table

3. **20260103192631_add_supplier_response_columns_to_quotes.sql**
   - Adds supplier response columns

4. **20260104000000_update_close_loop_to_lock_week.sql**
   - Updates week status handling

5. **20260105000000_add_supplier_eligibility_status.sql**
   - Adds supplier eligibility

**OR** run them all at once (see Step 3)

### Step 3: Run All Migrations (Easier)
Instead of running one by one, you can run the most important ones:

**Essential migrations to run:**
1. `20260101010948_rebuild_pricing_portal_schema.sql` ← **START HERE**
2. `20260102005037_fix_security_and_performance_issues.sql`
3. `20260103015913_create_week_item_volumes_table.sql`
4. `20260103192631_add_supplier_response_columns_to_quotes.sql`
5. `20260104000000_update_close_loop_to_lock_week.sql`

Run each one in Supabase SQL Editor.

### Step 4: Seed the Database
**AFTER** tables are created, run the seed script:

1. Open: `seed-complete-database.sql`
2. Copy ALL the SQL
3. Paste into Supabase SQL Editor
4. Click **"Run"**
5. Wait 10-30 seconds

---

## Quick Setup (All in One)

I can create a single SQL file that runs everything in order. Would you like me to do that?

---

## Verify Tables Exist

After running migrations, verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('suppliers', 'items', 'weeks', 'quotes');
```

You should see all 4 tables listed.

---

## Order Matters!

1. **First:** Run schema migration (creates tables)
2. **Then:** Run other migrations (adds features)
3. **Finally:** Run seed script (adds data)

**Don't skip step 1!** That's why you got the error.

