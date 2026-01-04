# 🚀 Super Easy Deployment

## Option 1: Automatic (If you have .env file)

Just run this one command:
```bash
./set-netlify-env.sh
```

This will:
- ✅ Read your `.env` file
- ✅ Set all variables in Netlify automatically
- ✅ No copy/paste needed!

**First time?** You'll need to login once:
```bash
netlify login
```

Then run the script again.

---

## Option 2: Manual (If you don't have .env)

1. **Get your Supabase keys:**
   - Go to: https://supabase.com/dashboard → Your Project → Settings → API
   - Copy the **Project URL** and **anon key**

2. **Set them in Netlify (one time):**
   ```bash
   netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
   netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key-here"
   ```

3. **Redeploy:**
   ```bash
   netlify deploy --prod --dir=dist
   ```

Done! 🎉

---

## Option 3: Copy-Paste Helper

If you have a `.env` file, I can show you exactly what to paste:

```bash
cat .env | grep VITE_
```

Copy those values and paste them into Netlify dashboard → Environment variables.

---

**Which do you prefer?** The script (Option 1) is fastest if you have `.env` set up.

