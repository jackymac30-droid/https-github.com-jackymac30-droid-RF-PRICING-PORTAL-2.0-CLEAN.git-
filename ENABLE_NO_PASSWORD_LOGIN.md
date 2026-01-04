# Enable No-Password Login (Dev Mode) 🔓

## The Problem
You want to login without passwords for easy testing.

## Solution: Enable Dev Mode in Netlify

### Step 1: Add Environment Variable in Netlify
1. Go to: **https://app.netlify.com**
2. Click your site → **"Site settings"**
3. Click **"Environment variables"**
4. Click **"Add a variable"**
5. Add:
   - **Key:** `VITE_DEV_MODE`
   - **Value:** `true`
6. Click **"Save"**

### Step 2: Redeploy
1. Go to **"Deploys"** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait 2-3 minutes

### Step 3: Test
1. Refresh your site
2. Enter access code: `RF2024`
3. Select a user (RF Manager or Supplier)
4. **No password needed!** Just click "Login"

---

## What This Does

When `VITE_DEV_MODE=true`:
- ✅ **No password required** - just select user and login
- ✅ **Access code still required** (for security)
- ✅ **Works on Netlify** (not just localhost)

---

## Alternative: Disable Access Code Too

If you also want to skip the access code screen:

1. Add another environment variable:
   - **Key:** `VITE_ACCESS_CODE`
   - **Value:** (leave empty or set to blank)

**OR** modify the code to skip access code in dev mode (already does this if on localhost, but Netlify needs the env var).

---

## Quick Setup

**In Netlify Environment Variables, add:**

```
VITE_DEV_MODE = true
VITE_ACCESS_CODE = RF2024
```

Then redeploy. You'll have:
- Access code: `RF2024` (one-time per session)
- No password needed after that!

---

## For Local Development

If running locally (`npm run dev`), dev mode is **automatically enabled** - no passwords needed!

