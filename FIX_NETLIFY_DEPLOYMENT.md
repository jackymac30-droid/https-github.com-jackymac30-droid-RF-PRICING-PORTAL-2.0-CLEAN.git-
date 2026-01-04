# Fix Netlify Not Deploying Changes

## The Problem
You pushed code to GitHub, but Netlify isn't updating. This means Netlify isn't connected to GitHub for automatic deployments.

## Solution: Connect Netlify to GitHub

### Step 1: Check Your Netlify Site
1. Go to: https://app.netlify.com
2. Click on your site
3. Look at the top - does it say "Connected to Git" or "Manual deploy"?

### Step 2: Connect to GitHub (If Not Connected)

**Option A: If you deployed via drag & drop:**
1. Go to your site → **"Site settings"**
2. Scroll down to **"Build & deploy"**
3. Under **"Continuous Deployment"**, click **"Link to Git provider"**
4. Choose **"GitHub"**
5. Authorize Netlify to access your GitHub
6. Select your repository: **"RF-PRICING-PORTAL-2.0"**
7. Configure:
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
8. Click **"Deploy site"**

**Option B: If you already have a site but it's not connected:**
1. Go to your site → **"Site settings"**
2. Click **"Build & deploy"** → **"Continuous Deployment"**
3. Click **"Link to Git provider"**
4. Follow steps above

### Step 3: Trigger Manual Deploy (Quick Fix)

If you want to deploy NOW without setting up auto-deploy:

1. Go to your site on Netlify
2. Click **"Deploys"** tab
3. Click **"Trigger deploy"** → **"Deploy site"**
4. Wait 2-3 minutes

**BUT** - this will deploy the OLD code from when you first deployed. To get the NEW code, you need to connect to GitHub first.

---

## The Right Way: Connect to GitHub

Since you're pushing to GitHub, you should connect Netlify to GitHub so it auto-deploys every time you push.

### Complete Setup:

1. **Go to Netlify:** https://app.netlify.com
2. **Click "Add new site"** → **"Import an existing project"**
3. **Click "Deploy with GitHub"**
4. **Authorize** Netlify to access GitHub
5. **Select repository:** `jackymac30-droid/RF-PRICING-PORTAL-2.0`
6. **Configure:**
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
7. **Click "Deploy site"**

This will:
- ✅ Connect to your GitHub repo
- ✅ Auto-deploy every time you push
- ✅ Use the latest code from GitHub

---

## After Connecting

Once connected:
- Every `git push` will automatically trigger a Netlify deployment
- You'll see deployments in the "Deploys" tab
- No more manual deployments needed!

---

## Quick Check

After connecting, verify:
1. Go to your site → **"Site settings"** → **"Build & deploy"**
2. Under **"Continuous Deployment"**, you should see:
   - **Repository:** `jackymac30-droid/RF-PRICING-PORTAL-2.0`
   - **Branch:** `main`
   - **Deploy settings:** Shows your build command

If you see this, you're all set! 🎉

