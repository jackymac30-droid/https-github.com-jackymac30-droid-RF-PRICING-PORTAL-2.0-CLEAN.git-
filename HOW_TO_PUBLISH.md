# How to Publish to GitHub (Auto-Updates Netlify) 🚀

## Quick Method: Use the Script

Just run this one command:

```bash

./publish.sh
```

That's it! It will:
1. ✅ Build your project
2. ✅ Commit all changes
3. ✅ Push to GitHub
4. ✅ Netlify auto-deploys (if connected)

---

## Manual Method

If you prefer to do it step by step:

### Step 1: Build
```bash
npm run build
```

### Step 2: Add Changes
```bash
git add .
```

### Step 3: Commit
```bash
git commit -m "Your message here"
```

### Step 4: Push
```bash
git push
```

---

## Make Sure Netlify is Connected

For auto-deployment to work, Netlify must be connected to GitHub:

1. Go to: **https://app.netlify.com**
2. Click your site → **"Site settings"**
3. Click **"Build & deploy"** → **"Continuous Deployment"**
4. Make sure it shows:
   - **Repository:** `jackymac30-droid/RF-PRICING-PORTAL-2.0`
   - **Branch:** `main`

If it's not connected:
1. Click **"Link to Git provider"**
2. Choose **"GitHub"**
3. Select your repository
4. Configure:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`

---

## After Publishing

1. **Wait 2-3 minutes** for Netlify to build
2. Check **"Deploys"** tab in Netlify to see progress
3. Your site updates automatically!

---

## Quick Commands

```bash
# Publish everything (easiest)
./publish.sh

# Or manually:
npm run build && git add . && git commit -m "Update" && git push
```

---

## Troubleshooting

**"No changes to commit"**
- This means everything is already pushed. No action needed!

**"Failed to push"**
- Check your GitHub connection: `git remote -v`
- Make sure you're logged in: `git config --global user.name`

**Netlify not updating**
- Make sure Netlify is connected to GitHub (see above)
- Check the "Deploys" tab for errors
- Make sure your build command is: `npm run build`
- Make sure publish directory is: `dist`

---

That's it! Just run `./publish.sh` whenever you want to update! 🎉

