# 🚀 Quick Deploy - Get Your Sharable Link

## Option 1: Netlify (Easiest - 2 minutes)

1. **Go to:** https://app.netlify.com/drop
2. **Drag and drop** your `/dist` folder onto the page
3. **Done!** You'll get a link like: `https://random-name-123.netlify.app`
4. **Set Environment Variables:**
   - Click on your site → Site settings → Environment variables
   - Add:
     - `VITE_ACCESS_CODE` = your code (e.g., `RF2024`)
     - `VITE_RF_PASSWORD` = your RF password
     - `VITE_SUPPLIER_PASSWORD` = your supplier password
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase key
   - Click "Redeploy" after adding variables

**That's it!** Share the link with your access code.

---

## Option 2: Vercel (Also Easy - 2 minutes)

1. **Go to:** https://vercel.com/new
2. **Drag and drop** your `/dist` folder
3. **Set Root Directory:** `dist`
4. **Add Environment Variables** in the deployment settings
5. **Deploy!** Get link like: `https://your-app.vercel.app`

---

## Option 3: Firebase Hosting (Google - 5 minutes)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select Hosting, set public directory to "dist")
firebase init hosting

# Deploy
firebase deploy
```

Then set environment variables in Firebase Console.

---

## Option 4: GitHub Pages (Free, but needs GitHub)

1. Push code to GitHub
2. Go to Settings → Pages
3. Select source: GitHub Actions
4. Create workflow file (I can help with this)

---

## ⚡ Quickest Option: Netlify Drop

**Just drag `/dist` folder to:** https://app.netlify.com/drop

You'll have a link in 30 seconds!

---

## 🔐 After Deployment

1. **Set environment variables** in your hosting platform
2. **Test the link** - you should see the protection screen
3. **Share the link + access code** separately

---

## 📝 What to Share

- **Link:** `https://your-app.netlify.app` (or whatever you get)
- **Access Code:** `RF2024` (or whatever you set)
- **Passwords:** Share separately with authorized users

