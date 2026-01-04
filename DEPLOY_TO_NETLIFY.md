# Deploy to Netlify - Simple Steps 🚀

## Your Setup is Ready!
✅ `netlify.toml` is configured  
✅ Build command: `npm run build`  
✅ Output folder: `dist`  
✅ Code is on GitHub  

## Step-by-Step: Connect Netlify to GitHub

### Step 1: Sign Up / Log In to Netlify
1. Go to: **https://app.netlify.com**
2. Click **"Sign up"** (or **"Log in"** if you have an account)
3. Choose **"Sign up with GitHub"** (easiest way!)
4. Authorize Netlify to access your GitHub

### Step 2: Add Your Site
1. Once logged in, click the **"Add new site"** button
2. Choose **"Import an existing project"**
3. Click **"Deploy with GitHub"**
4. You might need to authorize Netlify to access your GitHub repos (click "Authorize")

### Step 3: Select Your Repository
1. You'll see a list of your GitHub repositories
2. Find and click: **"RF-PRICING-PORTAL-2.0"**
3. Click **"Connect"**

### Step 4: Configure Build Settings
Netlify should automatically detect your settings from `netlify.toml`, but verify:

- **Branch to deploy:** `main` ✅
- **Build command:** `npm run build` ✅
- **Publish directory:** `dist` ✅

If these are already filled in correctly, you're good! If not, type them in.

### Step 5: Deploy!
1. Click the big green **"Deploy site"** button
2. Wait 2-3 minutes while Netlify builds your site
3. You'll see a progress bar and build logs
4. When it says **"Published"** - you're done! 🎉

### Step 6: Get Your Live URL
After deployment, Netlify will give you a URL like:
- `https://random-name-12345.netlify.app`

You can:
- **Rename it** to something nicer (like `rf-pricing-dashboard.netlify.app`)
- **Add a custom domain** if you have one

---

## Environment Variables (IMPORTANT! ⚠️)

Your app uses Supabase, so you **MUST** add these environment variables:

1. After your site is deployed, go to: **Site settings** → **Environment variables**
2. Click **"Add a variable"**
3. Add these two variables:

   **Variable 1:**
   - Key: `VITE_SUPABASE_URL`
   - Value: (Your Supabase project URL - looks like `https://xxxxx.supabase.co`)

   **Variable 2:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: (Your Supabase anon/public key)

4. Click **"Save"**
5. **Redeploy** your site (go to **Deploys** tab → **Trigger deploy** → **Deploy site**)

**Where to find your Supabase keys:**
- Go to your Supabase project dashboard
- Click **Settings** (gear icon) → **API**
- Copy the **Project URL** and **anon/public key**

---

## Automatic Deployments 🎯

**The best part:** Every time you push to GitHub, Netlify will automatically:
- ✅ Detect the change
- ✅ Rebuild your site
- ✅ Deploy the new version

You don't need to do anything! Just push to GitHub and Netlify handles the rest.

---

## Quick Deploy (Alternative Method)

If you prefer using the command line:

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

But the GitHub connection method above is easier and gives you automatic deployments!

---

## Need Help?

- Netlify Docs: https://docs.netlify.com
- Your site will be live at: `https://app.netlify.com` (after you deploy)

