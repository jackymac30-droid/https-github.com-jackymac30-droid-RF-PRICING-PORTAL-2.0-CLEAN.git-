# 🚀 Deploy to Netlify - Step by Step

## Method 1: Netlify Drop (Easiest - No Account Needed)

1. **Go to:** https://app.netlify.com/drop
2. **Drag your `/dist` folder** onto the page
3. **Wait for upload** (30 seconds)
4. **Get your link!** You'll see something like: `https://amazing-cupcake-123.netlify.app`
5. **Click "Site settings"** → "Environment variables"
6. **Add these variables:**
   - `VITE_ACCESS_CODE` = `RF2024` (or your custom code)
   - `VITE_RF_PASSWORD` = your RF password
   - `VITE_SUPPLIER_PASSWORD` = your supplier password
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
7. **Click "Redeploy"** after adding variables

**Done!** Share your link.

---

## Method 2: Netlify CLI (Recommended for Updates)

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Login to Netlify
```bash
netlify login
```
(This opens your browser to authorize)

### Step 3: Initialize Site
```bash
netlify init
```
- Choose "Create & configure a new site"
- Give it a name (or press Enter for random)
- Build command: `npm run build`
- Publish directory: `dist`

### Step 4: Set Environment Variables
```bash
netlify env:set VITE_ACCESS_CODE "RF2024"
netlify env:set VITE_RF_PASSWORD "your_rf_password"
netlify env:set VITE_SUPPLIER_PASSWORD "your_supplier_password"
netlify env:set VITE_SUPABASE_URL "your_supabase_url"
netlify env:set VITE_SUPABASE_ANON_KEY "your_supabase_key"
```

### Step 5: Deploy
```bash
npm run build
netlify deploy --prod
```

**Your site is live!** You'll get a link like: `https://your-site-name.netlify.app`

---

## Method 3: Connect GitHub (Auto-Deploy on Push)

1. **Push your code to GitHub** (if not already)
2. **Go to:** https://app.netlify.com
3. **Click "Add new site"** → "Import an existing project"
4. **Choose "GitHub"** and authorize
5. **Select your repository**
6. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
7. **Click "Deploy site"**
8. **Add environment variables:**
   - Site settings → Environment variables
   - Add all `VITE_*` variables
9. **Trigger redeploy** (or push a new commit)

**Now every time you push to GitHub, Netlify auto-deploys!**

---

## 🔧 Netlify Configuration File (Optional)

Create `netlify.toml` in your project root for automatic configuration:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

---

## 📝 Quick Checklist

- [ ] Build completed (`npm run build`)
- [ ] `/dist` folder exists
- [ ] Deployed to Netlify (any method above)
- [ ] Environment variables set in Netlify
- [ ] Site redeployed after adding variables
- [ ] Tested the protection screen
- [ ] Tested login flow
- [ ] Got your shareable link!

---

## 🆘 Troubleshooting

**Build fails on Netlify?**
- Check build logs in Netlify dashboard
- Make sure `package.json` has all dependencies
- Verify build command is `npm run build`

**Environment variables not working?**
- Make sure you added them in Netlify dashboard
- Redeploy after adding variables
- Check variable names start with `VITE_`

**App doesn't load?**
- Check browser console for errors
- Verify Supabase URL and keys are correct
- Make sure HTTPS is enabled (Netlify does this automatically)

---

## 🔗 After Deployment

Your link will look like:
- `https://your-site-name.netlify.app`

Share this link + your access code with authorized users!

