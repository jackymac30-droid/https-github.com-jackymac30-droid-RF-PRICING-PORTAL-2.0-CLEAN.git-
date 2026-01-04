# How to Get Your Supabase URL & Key 🔑

## Step-by-Step (Super Simple!)

### Step 1: Go to Supabase Dashboard
1. Open your web browser
2. Go to: **https://supabase.com/dashboard**
3. **Sign in** (or create an account if you don't have one)

### Step 2: Select Your Project
1. You'll see a list of your projects
2. **Click on your project** (the one you're using for the RF Pricing Dashboard)
   - If you don't have a project yet, click **"New Project"** to create one

### Step 3: Go to Settings
1. Look at the **left sidebar** (menu on the left side)
2. Click the **⚙️ Settings** icon (gear icon) at the bottom
3. Click **"API"** in the settings menu

### Step 4: Copy Your Keys
You'll see a page with two important things:

**1. Project URL:**
- Look for **"Project URL"** or **"URL"**
- It looks like: `https://xxxxxxxxxxxxx.supabase.co`
- **Copy this entire URL** (this is your `VITE_SUPABASE_URL`)

**2. API Keys:**
- Look for **"Project API keys"** section
- Find the one labeled **"anon"** or **"public"** (NOT the "service_role" one!)
- It's a long string that looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Copy this key** (this is your `VITE_SUPABASE_ANON_KEY`)

---

## Visual Guide

```
Supabase Dashboard
├── Your Project Name
│   ├── Table Editor
│   ├── SQL Editor
│   ├── Authentication
│   └── ⚙️ Settings  ← Click here!
│       ├── General
│       ├── API  ← Click here!
│       ├── Database
│       └── ...
```

On the API page, you'll see:
```
┌─────────────────────────────────────┐
│ Project URL                         │
│ https://xxxxx.supabase.co           │ ← Copy this!
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Project API keys                    │
│                                     │
│ anon / public                       │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6...    │ ← Copy this!
│                                     │
│ service_role (secret)               │
│ [Don't copy this one!]              │
└─────────────────────────────────────┘
```

---

## What to Do With These Keys

### For Netlify:
1. Go to your Netlify site dashboard
2. **Site settings** → **Environment variables**
3. Add:
   - **Key:** `VITE_SUPABASE_URL` → **Value:** (paste the URL you copied)
   - **Key:** `VITE_SUPABASE_ANON_KEY` → **Value:** (paste the anon key you copied)
4. Click **Save**
5. **Redeploy** your site

### For Local Development:
Create a file called `.env` in your project folder:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## ⚠️ Important Notes

- ✅ The **anon/public key** is safe to use in frontend code
- ❌ **NEVER** use the **service_role** key in frontend code (it's secret!)
- ✅ You can share the anon key - it's meant to be public
- ✅ The URL is also safe to share

---

## Can't Find Your Project?

If you don't have a Supabase project yet:

1. Go to: https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name:** RF Pricing Dashboard (or whatever you want)
   - **Database Password:** (create a strong password - save it!)
   - **Region:** (choose closest to you)
4. Click **"Create new project"**
5. Wait 2-3 minutes for it to set up
6. Then follow the steps above to get your keys!

---

## Quick Link

**Direct link to API settings** (after you select your project):
https://supabase.com/dashboard/project/_/settings/api

(Replace `_` with your project ID if you know it)

