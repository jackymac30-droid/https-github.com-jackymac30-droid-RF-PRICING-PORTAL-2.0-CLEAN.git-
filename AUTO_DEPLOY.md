# 🤖 Automated Deployment

I can help you deploy, but you need to authenticate once. Here's the easiest way:

## Quick Setup (One-Time)

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Login (Opens Browser - You Click "Authorize")
```bash
netlify login
```

### Step 3: I'll Deploy It For You!
After you login, just tell me and I'll run:
```bash
npm run deploy
```

This will:
- ✅ Build your app
- ✅ Deploy to Netlify
- ✅ Give you your live link

---

## Or Use the Simple Method

**Just drag `/dist` folder to:** https://app.netlify.com/drop

No CLI needed! You'll get a link in 30 seconds.

---

## After Deployment

**Set environment variables in Netlify dashboard:**
1. Go to your site
2. Site settings → Environment variables
3. Add:
   - `VITE_ACCESS_CODE`
   - `VITE_RF_PASSWORD`
   - `VITE_SUPPLIER_PASSWORD`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Redeploy

---

**Which do you prefer?**
- Option A: Drag & drop (fastest, no CLI)
- Option B: CLI setup (I can help automate after you login once)

