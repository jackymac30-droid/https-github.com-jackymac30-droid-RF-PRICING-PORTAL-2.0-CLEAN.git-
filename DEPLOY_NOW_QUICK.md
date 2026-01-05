# 🚀 Deploy Updated Changes to Netlify - Quick Guide

## ✅ Build Complete!
Your code has been built. The `/dist` folder contains your updated app.

## Option 1: Drag & Drop (Fastest - 30 seconds)

1. **Open:** https://app.netlify.com/drop
2. **Drag your `/dist` folder** onto the page
3. **Wait 30 seconds**
4. **Get your new preview link!**

This creates a new deploy each time. Perfect for testing changes.

---

## Option 2: Netlify CLI (Update Existing Site)

If you already have a Netlify site connected, use this:

```bash
# Install Netlify CLI (one time)
npm install -g netlify-cli

# Login (opens browser)
netlify login

# Deploy to your existing site
cd /Users/jackymac/Downloads/project
netlify deploy --prod --dir=dist
```

---

## Option 3: If Connected to GitHub

If your Netlify site is connected to GitHub for auto-deploy:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Fix seed volume loading and add RF allocation sandbox"
   git push
   ```

2. **Netlify will auto-deploy** (usually takes 2-3 minutes)

---

## 📝 After Deploying

**Important:** Make sure your environment variables are set in Netlify:
- Go to your Netlify site → Site settings → Environment variables
- Ensure these are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_RF_PASSWORD`
  - `VITE_SUPPLIER_PASSWORD`
  - `VITE_ACCESS_CODE`

**Then hard refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R) to clear cache!

---

## 🔍 Still Not Working?

If changes still don't show:
1. **Clear browser cache** (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Check Netlify deploy logs** to ensure build succeeded
3. **Check browser console** for any JavaScript errors

