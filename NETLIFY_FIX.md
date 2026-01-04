# 🔧 Fix Netlify Deployment

## The Problem
Your app needs environment variables to connect to Supabase. Without them, you'll see a "Configuration Error" page.

## ✅ Quick Fix (5 minutes)

### Step 1: Get Your Environment Variables
Check your local `.env` file or your Supabase dashboard for:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ACCESS_CODE` (if you set one)
- `VITE_RF_PASSWORD` (if you set one)
- `VITE_SUPPLIER_PASSWORD` (if you set one)

### Step 2: Add to Netlify
1. Go to your Netlify dashboard
2. Click on your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add each variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://your-project.supabase.co`
   - Click **Save**
6. Repeat for:
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ACCESS_CODE` (optional)
   - `VITE_RF_PASSWORD` (optional)
   - `VITE_SUPPLIER_PASSWORD` (optional)

### Step 3: Redeploy
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait for it to finish
4. Try your link again

---

## 🚨 Still Not Working?

**Check the browser console (F12):**
- What error message do you see?
- Is it the "Configuration Error" page?
- Or a blank page?

**Common Issues:**
1. **Missing env vars** → See Step 2 above
2. **Wrong Supabase URL** → Make sure it starts with `https://`
3. **CORS error** → Check Supabase dashboard → Settings → API → Allowed origins
4. **Build failed** → Check Netlify deploy logs

---

## 📋 What You Need From Supabase

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

---

**Tell me what error you see and I'll help fix it!**

