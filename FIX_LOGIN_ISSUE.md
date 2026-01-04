# Fix Login Issue 🔐

## The Problem
Can't login to RF side or supplier side.

## Common Causes & Fixes

### 1. Database is Empty (Most Likely)
Your database probably has no suppliers or users.

**Fix: Seed the Database**
1. Go to your Netlify site
2. You should see the login page
3. If you see a **"Seed Database"** button (blue button at bottom), click it
4. Wait for it to finish (30 seconds)
5. Refresh the page
6. Try logging in again

**OR** seed via Supabase:
1. Go to: https://supabase.com/dashboard
2. Click your project → **"SQL Editor"**
3. Open the file `seed-database.sql` from this project
4. Copy and paste the SQL
5. Click **"Run"**
6. Refresh your Netlify site

### 2. Environment Variables Not Set
Make sure these are in Netlify:

1. Go to Netlify → Site settings → Environment variables
2. Check you have:
   - `VITE_SUPABASE_URL` ✅
   - `VITE_SUPABASE_ANON_KEY` ✅
   - `VITE_DEV_MODE` = `true` (for no-password login)
   - `VITE_ACCESS_CODE` = `RF2024`

3. **Redeploy** after adding variables

### 3. Access Code Issue
- Access code should be: `RF2024`
- Enter it on the "Protected Access" screen first
- Then you'll see the login page

### 4. Dev Mode Not Enabled
If `VITE_DEV_MODE` is not set to `true`:
- You'll need passwords to login
- Make sure it's set to `true` in Netlify environment variables

---

## Step-by-Step Fix

### Step 1: Check Environment Variables
1. Netlify → Site settings → Environment variables
2. Verify all variables are there
3. If missing, add them and redeploy

### Step 2: Seed Database
**Option A: Use Seed Button (Easiest)**
- If you see "Seed Database" button on login page, click it

**Option B: Use SQL (If button not showing)**
- Go to Supabase SQL Editor
- Run `seed-database.sql`

### Step 3: Try Login
1. Access code: `RF2024`
2. Select "RF Manager" or any supplier
3. If dev mode is on, no password needed
4. Click "Access Platform"

---

## Quick Checklist

- [ ] Environment variables set in Netlify
- [ ] `VITE_DEV_MODE` = `true` (for no-password)
- [ ] Database seeded (suppliers exist)
- [ ] Access code entered: `RF2024`
- [ ] Site redeployed after adding variables

---

## Still Not Working?

Check browser console (F12):
1. What error do you see?
2. Is Supabase connecting?
3. Are there any red errors?

Share the error and I'll help fix it!

