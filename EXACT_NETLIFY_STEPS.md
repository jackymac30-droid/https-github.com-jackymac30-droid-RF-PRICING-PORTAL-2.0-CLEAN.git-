# Exact Steps: Where to Put Supabase Keys in Netlify 🎯

## Step-by-Step (Click by Click)

### Step 1: Go to Your Netlify Site
1. Open: **https://app.netlify.com**
2. **Sign in** if you're not already
3. You'll see a list of your sites
4. **Click on your site** (RF-PRICING-PORTAL-2.0 or whatever you named it)

### Step 2: Open Site Settings
1. At the top of your site page, you'll see tabs like:
   - **Overview** | **Deploys** | **Plugins** | **Domain settings** | **Site settings**
2. Click **"Site settings"** (it's usually on the far right)

### Step 3: Find Environment Variables
1. On the left sidebar, you'll see a menu:
   - Build & deploy
   - Domain management
   - Environment variables ← **CLICK THIS!**
   - Functions
   - Identity
   - etc.
2. Click **"Environment variables"**

### Step 4: Add Your First Variable
1. You'll see a page that says **"Environment variables"**
2. Click the big button: **"Add a variable"** (usually blue/green button)
3. A form will pop up with two boxes:

   **Box 1 - Key:**
   - Type exactly: `VITE_SUPABASE_URL`
   - (This is the variable name - type it exactly as shown)

   **Box 2 - Value:**
   - Paste your Supabase **Project URL** here
   - (It looks like: `https://xxxxxxxxxxxxx.supabase.co`)

4. Click **"Save"** or **"Add variable"** button

### Step 5: Add Your Second Variable
1. Click **"Add a variable"** button again
2. Fill in the form:

   **Box 1 - Key:**
   - Type exactly: `VITE_SUPABASE_ANON_KEY`

   **Box 2 - Value:**
   - Paste your Supabase **anon/public key** here
   - (It's a long string like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

3. Click **"Save"** or **"Add variable"** button

### Step 6: Redeploy Your Site
1. Go back to the top tabs
2. Click **"Deploys"** tab
3. Click **"Trigger deploy"** button (usually a dropdown)
4. Click **"Deploy site"**
5. Wait 2-3 minutes for it to rebuild

---

## Visual Guide - Where Everything Is

```
Netlify Dashboard
│
├── Your Site Name
│   │
│   ├── [Overview] [Deploys] [Plugins] [Site settings] ← Click "Site settings"
│   │
│   └── Site settings page:
│       │
│       ├── Left Sidebar:
│       │   ├── General
│       │   ├── Build & deploy
│       │   ├── Domain management
│       │   ├── Environment variables ← CLICK HERE!
│       │   ├── Functions
│       │   └── ...
│       │
│       └── Main Area:
│           └── Environment variables page:
│               │
│               ├── [Add a variable] button ← CLICK THIS!
│               │
│               └── Pop-up form:
│                   ├── Key: [type here]
│                   ├── Value: [paste here]
│                   └── [Save] button
```

---

## What Goes Where?

### From Supabase, you should have TWO things:

**Thing 1: Project URL**
- Looks like: `https://abcdefghijklmnop.supabase.co`
- Goes in Netlify as:
  - **Key:** `VITE_SUPABASE_URL`
  - **Value:** (paste the URL)

**Thing 2: anon/public key**
- Looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxx`
- Goes in Netlify as:
  - **Key:** `VITE_SUPABASE_ANON_KEY`
  - **Value:** (paste the key)

---

## Quick Checklist

- [ ] Went to https://app.netlify.com
- [ ] Clicked on my site
- [ ] Clicked "Site settings" tab
- [ ] Clicked "Environment variables" in left sidebar
- [ ] Clicked "Add a variable"
- [ ] Added `VITE_SUPABASE_URL` with the URL value
- [ ] Clicked "Add a variable" again
- [ ] Added `VITE_SUPABASE_ANON_KEY` with the key value
- [ ] Went to "Deploys" tab
- [ ] Clicked "Trigger deploy" → "Deploy site"

---

## Direct Links (After You're Logged In)

If you're already logged into Netlify, you can go directly to:
- Environment variables: https://app.netlify.com/sites/YOUR_SITE_NAME/configuration/env
- (Replace `YOUR_SITE_NAME` with your actual site name)

---

## Still Can't Find It?

**Look for these words:**
- "Environment variables"
- "Env vars"
- "Environment"
- "Variables"
- "Add a variable" button

**It's usually under:**
- Site settings → Environment variables
- OR
- Build & deploy → Environment variables

---

## Need Help?

Tell me:
1. What page are you on in Netlify right now?
2. What do you see in the left sidebar?
3. What did Supabase give you? (You can paste it here and I'll tell you exactly where each piece goes)

