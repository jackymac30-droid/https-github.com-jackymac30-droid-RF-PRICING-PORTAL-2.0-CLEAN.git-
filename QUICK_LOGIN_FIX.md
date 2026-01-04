# Quick Login Fix 🔐

## The Problem
Can't login to RF or Supplier side.

## Most Likely Issue: Database is Empty

Your database probably has no suppliers, so you can't login as a supplier.

## Quick Fix: Seed Database

### Option 1: Use Seed Button (Easiest)
1. Go to your Netlify site
2. Enter access code: `RF2024`
3. Look for a **blue "Seed Database"** button at the bottom of the login page
4. Click it
5. Wait 30 seconds
6. Refresh the page
7. Try logging in again

### Option 2: Seed via Supabase SQL
1. Go to: https://supabase.com/dashboard
2. Click your project → **"SQL Editor"**
3. Click **"New query"**
4. Open the file `seed-database.sql` from this project
5. Copy ALL the SQL code
6. Paste into Supabase SQL Editor
7. Click **"Run"**
8. Wait 10-30 seconds
9. Refresh your Netlify site
10. Try logging in

---

## Environment Variables Check

Make sure these are set in Netlify:

1. Go to Netlify → Site settings → Environment variables
2. Verify you have:
   - `VITE_SUPABASE_URL` ✅
   - `VITE_SUPABASE_ANON_KEY` ✅
   - `VITE_DEV_MODE` = `true` (IMPORTANT - for no-password login)
   - `VITE_ACCESS_CODE` = `RF2024`

3. **Redeploy** after checking/adding variables

---

## Login Steps

1. **Access Code:** Enter `RF2024`
2. **Select User:**
   - For RF: Select "RF Manager"
   - For Supplier: Select any supplier (after database is seeded)
3. **Password:** 
   - If `VITE_DEV_MODE=true`, password is optional (leave blank)
   - If not set, you need a password
4. Click "Access Platform"

---

## If Seed Button Doesn't Show

The seed button only shows if `VITE_DEV_MODE=true`. 

Make sure:
1. `VITE_DEV_MODE` is set to `true` in Netlify
2. Site is redeployed
3. Then the button will appear

---

## Quick Checklist

- [ ] `VITE_DEV_MODE` = `true` in Netlify
- [ ] Database seeded (suppliers exist)
- [ ] Access code: `RF2024`
- [ ] Site redeployed after adding variables

Try seeding the database first - that's most likely the issue!

