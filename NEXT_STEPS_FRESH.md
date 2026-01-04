# Next Steps After Fresh Start ✅

## ✅ Done!
Your git history has been removed. Your code is safe and ready.

## Step 1: Create New GitHub Repository

1. Go to: **https://github.com/new**
2. Repository name: **`RF-PRICING-PORTAL-2.0-CLEAN`** (or any name you want)
3. **Don't** check "Initialize with README"
4. Click **"Create repository"**
5. **Copy the repository URL** (looks like: `https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0-CLEAN.git`)

## Step 2: Connect to New Repository

Run these commands (replace `YOUR_NEW_REPO_URL` with the URL you copied):

```bash
git remote add origin YOUR_NEW_REPO_URL
git branch -M main
git push -u origin main
```

**Example:**
```bash
git remote add origin https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0-CLEAN.git
git branch -M main
git push -u origin main
```

When it asks for credentials, use your GitHub token (get it from https://github.com/settings/tokens)

## Step 3: Connect Netlify to New Repository

1. Go to: **https://app.netlify.com**
2. Click your site → **"Site settings"**
3. **"Build & deploy"** → **"Continuous Deployment"**
4. Click **"Link to Git provider"** (or change existing)
5. Choose **"GitHub"**
6. Select your **NEW** repository: `RF-PRICING-PORTAL-2.0-CLEAN`
7. Configure:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
8. Click **"Save"** or **"Deploy site"**

## Step 4: Add Environment Variables

1. In Netlify → **Site settings** → **Environment variables**
2. Add:
   - `VITE_SUPABASE_URL` = (your Supabase URL)
   - `VITE_SUPABASE_ANON_KEY` = (your Supabase key)
   - `VITE_DEV_MODE` = `true`
   - `VITE_ACCESS_CODE` = `RF2024`

## ✅ Done!

After this:
- ✅ No token in history
- ✅ Netlify will build successfully
- ✅ Future pushes work with just `./publish.sh` or `git push`

---

## Going Forward

After setup, you can just use:
```bash
./publish.sh
```

Or:
```bash
git add .
git commit -m "Your changes"
git push
```

**No more fresh starts needed!** This was a one-time fix.

