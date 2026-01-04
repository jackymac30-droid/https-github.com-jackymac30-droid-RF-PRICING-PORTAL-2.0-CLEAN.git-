# Fix Netlify Not Updating 🔧

## The Problem
Netlify is still showing the old site because it's either:
1. Not connected to the new GitHub repository
2. Still connected to the old repository
3. Deployment hasn't completed yet

## Solution: Connect to New Repository

### Step 1: Check Current Connection
1. Go to: **https://app.netlify.com**
2. Click your site
3. Go to **"Site settings"** → **"Build & deploy"** → **"Continuous Deployment"**
4. Check what repository it shows

### Step 2: Connect to NEW Repository
If it shows the OLD repository (`RF-PRICING-PORTAL-2.0`), you need to change it:

1. In **"Continuous Deployment"**, click **"Link to Git provider"** (or "Change repository")
2. Choose **"GitHub"**
3. Select your **NEW** repository: `https-github.com-jackymac30-droid-RF-PRICING-PORTAL-2.0-CLEAN.git-`
4. Configure:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **"Save"**

### Step 3: Trigger New Deploy
1. Go to **"Deploys"** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait 2-3 minutes

---

## Fix Login Issue

If you can't sign in, check:

### 1. Environment Variables
Make sure these are set in Netlify:
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_ANON_KEY` ✅
- `VITE_DEV_MODE` = `true` (for no-password login)
- `VITE_ACCESS_CODE` = `RF2024`

### 2. Seed Database
Your database might be empty. Use the "Seed Database" button on the login page (if dev mode is enabled).

### 3. Check Access Code
The access code is: `RF2024`

---

## Quick Checklist

- [ ] Netlify connected to NEW repository
- [ ] Environment variables added
- [ ] New deployment triggered
- [ ] Wait 2-3 minutes for build
- [ ] Try login with access code: `RF2024`

---

## Still Not Working?

1. **Clear browser cache** - Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Check deployment logs** - Go to Deploys → Click latest → Check for errors
3. **Verify environment variables** - Make sure they're saved correctly

