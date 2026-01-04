# ⚡ Deploy Right Now - 3 Steps

## Step 1: Build (Already Done ✅)
Your app is built in the `/dist` folder.

## Step 2: Deploy to Netlify

### Option A: Drag & Drop (Fastest)
1. Open: https://app.netlify.com/drop
2. Drag your **entire `/dist` folder** onto the page
3. Wait 30 seconds
4. **You'll get a link!** Copy it.

### Option B: Use Netlify CLI
```bash
# Install Netlify CLI (one time)
npm install -g netlify-cli

# Login (opens browser)
netlify login

# Deploy
netlify deploy --prod --dir=dist
```

## Step 3: Set Environment Variables

**In Netlify Dashboard:**
1. Go to your site
2. Click "Site settings"
3. Click "Environment variables"
4. Click "Add variable" and add:

```
VITE_ACCESS_CODE = RF2024
VITE_RF_PASSWORD = your_rf_password
VITE_SUPPLIER_PASSWORD = your_supplier_password  
VITE_SUPABASE_URL = your_supabase_url
VITE_SUPABASE_ANON_KEY = your_supabase_key
```

5. Click "Redeploy site" after adding variables

## ✅ Done!

Your link: `https://your-site.netlify.app`

**Share this link + access code with users!**

