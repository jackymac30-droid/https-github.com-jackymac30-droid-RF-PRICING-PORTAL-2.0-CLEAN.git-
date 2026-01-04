# URGENT: Fix Login - Can't Sign In 🔴

## The Problem
- Access code works (RF2024) ✅
- Can see login page ✅
- Can choose users ✅
- BUT can't actually log in ❌

## Root Cause
`VITE_DEV_MODE` is NOT set to `true` in Netlify, so passwords are required but you don't have them set up.

## IMMEDIATE FIX

### Step 1: Add VITE_DEV_MODE to Netlify (CRITICAL)
1. Go to: **https://app.netlify.com**
2. Click your site → **"Site settings"**
3. Click **"Environment variables"**
4. Click **"Add a variable"**
5. Add:
   - **Key:** `VITE_DEV_MODE`
   - **Value:** `true`
6. Click **"Save"**

### Step 2: Redeploy (REQUIRED)
1. Go to **"Deploys"** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait 2-3 minutes for it to rebuild

### Step 3: Seed Database (If Not Done)
1. After redeploy, go to your site
2. Enter access code: `RF2024`
3. Look for **"Seed Database"** button (blue button at bottom)
4. Click it - this adds suppliers to your database
5. Wait 30 seconds

### Step 4: Try Login Again
1. Access code: `RF2024`
2. Select "RF Manager" or any supplier
3. **Leave password BLANK** (dev mode = no password needed)
4. Click "Access Platform"

---

## Why This Happens

Without `VITE_DEV_MODE=true`:
- ❌ Passwords are required
- ❌ You don't have passwords set up
- ❌ Login fails

With `VITE_DEV_MODE=true`:
- ✅ Passwords are optional
- ✅ Can login without passwords
- ✅ Seed button appears

---

## Complete Environment Variables Checklist

Make sure ALL of these are in Netlify:

- [ ] `VITE_SUPABASE_URL` = (your Supabase URL)
- [ ] `VITE_SUPABASE_ANON_KEY` = (your Supabase key)
- [ ] `VITE_DEV_MODE` = `true` ← **THIS IS THE KEY ONE!**
- [ ] `VITE_ACCESS_CODE` = `RF2024`

**After adding/checking, ALWAYS redeploy!**

---

## Still Not Working?

1. **Clear browser cache:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Check browser console (F12):** Look for errors
3. **Verify environment variables:** Make sure they're saved correctly
4. **Check deployment logs:** Go to Deploys → Click latest → Check for errors

---

**The fix is simple: Add `VITE_DEV_MODE=true` and redeploy!**

