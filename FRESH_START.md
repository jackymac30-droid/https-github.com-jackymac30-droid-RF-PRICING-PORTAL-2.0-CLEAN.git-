# Fresh Start - Remove Token from History 🆕

## The Problem
Netlify scans your entire git history and found the token in an old commit. Even though we removed it, it's still in history.

## Solution: Create Fresh Repository (5 minutes)

### Step 1: Create New GitHub Repository
1. Go to: **https://github.com/new**
2. Name it: **"RF-PRICING-PORTAL-2.0-CLEAN"** (or any name)
3. Don't initialize with README
4. Click **"Create repository"**

### Step 2: Get the New Repository URL
Copy the URL - it will look like:
`https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0-CLEAN.git`

### Step 3: Remove Old Git History
Run these commands in your project folder:

```bash
# Remove old git history
rm -rf .git

# Start fresh
git init
git add .
git commit -m "Initial commit - clean version"

# Add new remote (replace with your new repo URL)
git remote add origin https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0-CLEAN.git

# Push to new repo (you'll need to authenticate once)
git push -u origin main
```

### Step 4: Connect Netlify to New Repository
1. Go to Netlify → Your site → **Site settings**
2. **Build & deploy** → **Continuous Deployment**
3. Click **"Link to Git provider"** (or change existing)
4. Select your **NEW** repository: `RF-PRICING-PORTAL-2.0-CLEAN`
5. Configure:
   - Branch: `main`
   - Build: `npm run build`
   - Publish: `dist`
6. Click **"Save"**

### Step 5: Delete Old Site (Optional)
1. In Netlify, go to old site → **Site settings**
2. Scroll to bottom → **"Delete site"**
3. Or just use the new one

---

## After This

✅ No token in history
✅ Netlify will build successfully
✅ Everything works automatically

---

## Quick Commands (Copy & Paste)

```bash
# Remove old git
rm -rf .git

# Start fresh
git init
git add .
git commit -m "Clean version - no secrets"

# Add new remote (replace YOUR_NEW_REPO_URL)
git remote add origin YOUR_NEW_REPO_URL

# Push (will ask for token once)
git push -u origin main
```

Then connect Netlify to the new repository!

