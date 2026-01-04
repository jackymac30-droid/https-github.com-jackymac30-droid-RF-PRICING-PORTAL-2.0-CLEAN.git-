# Connect Netlify to GitHub - Step by Step 🔗

## The Problem
Your code is on GitHub, but Netlify isn't updating because they're not connected.

## Solution: Connect Netlify to GitHub

### Step 1: Go to Netlify
1. Open: **https://app.netlify.com**
2. **Sign in** if needed

### Step 2: Add New Site from Git
1. Click the **"Add new site"** button (top right)
2. Click **"Import an existing project"**
3. Click **"Deploy with GitHub"**

### Step 3: Authorize Netlify
1. If prompted, click **"Authorize Netlify"** or **"Configure GitHub App"**
2. You might need to:
   - Select which repositories Netlify can access
   - Choose **"All repositories"** or **"Only select repositories"**
   - If "Only select", make sure **"RF-PRICING-PORTAL-2.0"** is selected
3. Click **"Install"** or **"Authorize"**

### Step 4: Select Your Repository
1. You'll see a list of your GitHub repositories
2. Find and click: **"RF-PRICING-PORTAL-2.0"**
3. Click **"Connect"** or **"Select"**

### Step 5: Configure Build Settings
Netlify should auto-detect from `netlify.toml`, but verify:

- **Branch to deploy:** `main` ✅
- **Build command:** `npm run build` ✅
- **Publish directory:** `dist` ✅

If these are correct, proceed. If not, type them in.

### Step 6: Add Environment Variables
Before deploying, add your environment variables:

1. Click **"Show advanced"** or **"Environment variables"**
2. Click **"Add variable"** and add:
   - `VITE_SUPABASE_URL` = (your Supabase URL)
   - `VITE_SUPABASE_ANON_KEY` = (your Supabase key)
   - `VITE_DEV_MODE` = `true` (for no-password login)
   - `VITE_ACCESS_CODE` = `RF2024` (optional)

### Step 7: Deploy!
1. Click the big green **"Deploy site"** button
2. Wait 2-3 minutes
3. Your site will be live!

---

## After Connecting

✅ Every time you run `./publish.sh` or `git push`, Netlify will automatically:
- Detect the change
- Build your site
- Deploy the new version

No more manual deployments needed!

---

## If You Already Have a Site

If you already deployed via drag & drop:

### Option A: Delete and Recreate (Easiest)
1. Go to your site → **"Site settings"** → Scroll to bottom
2. Click **"Delete site"**
3. Follow steps above to create new site from GitHub

### Option B: Connect Existing Site
1. Go to your site → **"Site settings"**
2. Click **"Build & deploy"** → **"Continuous Deployment"**
3. Click **"Link to Git provider"**
4. Choose **"GitHub"**
5. Select repository: **"RF-PRICING-PORTAL-2.0"**
6. Configure build settings (see Step 5 above)
7. Click **"Save"**

---

## Verify It's Connected

After connecting, go to:
- **Site settings** → **"Build & deploy"** → **"Continuous Deployment"**

You should see:
- ✅ **Repository:** `jackymac30-droid/RF-PRICING-PORTAL-2.0`
- ✅ **Branch:** `main`
- ✅ **Deploy settings:** Shows your build command

---

## Test It

1. Make a small change to your code
2. Run: `./publish.sh`
3. Go to Netlify → **"Deploys"** tab
4. You should see a new deployment starting automatically!

---

## Quick Checklist

- [ ] Went to Netlify → "Add new site"
- [ ] Clicked "Deploy with GitHub"
- [ ] Authorized Netlify to access GitHub
- [ ] Selected "RF-PRICING-PORTAL-2.0" repository
- [ ] Configured: Branch `main`, Build `npm run build`, Publish `dist`
- [ ] Added environment variables
- [ ] Clicked "Deploy site"
- [ ] Verified connection in Site settings

---

## Need Help?

If you get stuck:
1. What step are you on?
2. What error message do you see?
3. Screenshot the Netlify page if possible

