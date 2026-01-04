# Environment Variables - Simple Explanation 🔑

## What Are "Variables"?

Think of it like a form with two boxes:

**Box 1 (Variable Name):** `VITE_SUPABASE_URL`  
**Box 2 (The Value):** `https://your-project.supabase.co`

The **NAME** is always the same (like a label).  
The **VALUE** is what you copy from Supabase (like filling in the blank).

---

## The Process (Step by Step)

### Step 1: Get the VALUES from Supabase
1. Go to Supabase dashboard
2. Get your **Project URL** (the value)
3. Get your **anon key** (the value)

**You DON'T create these - Supabase already made them!**  
You just **copy** them.

### Step 2: Add them to Netlify
1. Go to Netlify dashboard
2. Go to **Site settings** → **Environment variables**
3. Click **"Add a variable"**
4. Fill in the form:

   **First Variable:**
   - **Key (name):** `VITE_SUPABASE_URL` ← Type this exactly
   - **Value:** `https://your-project.supabase.co` ← Paste from Supabase
   - Click **Save**

   **Second Variable:**
   - **Key (name):** `VITE_SUPABASE_ANON_KEY` ← Type this exactly
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ← Paste from Supabase
   - Click **Save**

---

## Visual Example

```
┌─────────────────────────────────────────┐
│ Netlify Environment Variables           │
├─────────────────────────────────────────┤
│                                         │
│ Variable 1:                             │
│ ┌─────────────────────────────────────┐ │
│ │ Key:   VITE_SUPABASE_URL            │ │ ← You type this
│ │ Value: https://abc123.supabase.co   │ │ ← You paste from Supabase
│ └─────────────────────────────────────┘ │
│                                         │
│ Variable 2:                             │
│ ┌─────────────────────────────────────┐ │
│ │ Key:   VITE_SUPABASE_ANON_KEY       │ │ ← You type this
│ │ Value: eyJhbGciOiJIUzI1NiIsInR5c... │ │ ← You paste from Supabase
│ └─────────────────────────────────────┘ │
│                                         │
│ [Add a variable] button                 │
└─────────────────────────────────────────┘
```

---

## What You Type vs What You Copy

### YOU TYPE (the variable names):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### YOU COPY FROM SUPABASE (the values):
- The URL: `https://xxxxxxxxxxxxx.supabase.co`
- The key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Complete Step-by-Step Process

### 1️⃣ Get Values from Supabase
- Go to: https://supabase.com/dashboard
- Settings → API
- Copy the **Project URL**
- Copy the **anon/public key**

### 2️⃣ Add to Netlify
- Go to: https://app.netlify.com
- Click your site
- **Site settings** → **Environment variables**
- Click **"Add a variable"**

**First one:**
- Key: `VITE_SUPABASE_URL`
- Value: (paste the URL you copied)
- Save

**Second one:**
- Click **"Add a variable"** again
- Key: `VITE_SUPABASE_ANON_KEY`
- Value: (paste the key you copied)
- Save

### 3️⃣ Redeploy
- Go to **Deploys** tab
- Click **"Trigger deploy"** → **"Deploy site"**

---

## Common Questions

**Q: Do I create the values?**  
A: No! Supabase already created them. You just copy them.

**Q: Where do the variable names come from?**  
A: They're fixed names your code expects. You type them exactly as shown.

**Q: What if I type the name wrong?**  
A: Your app won't work. Make sure to type them exactly:
- `VITE_SUPABASE_URL` (not `VITE_SUPABASE_URLS` or `SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY` (not `VITE_SUPABASE_KEY` or `ANON_KEY`)

**Q: Can I see what I already added?**  
A: Yes! In Netlify → Site settings → Environment variables, you'll see a list of all your variables.

---

## Quick Checklist

- [ ] Got Project URL from Supabase
- [ ] Got anon key from Supabase
- [ ] Added `VITE_SUPABASE_URL` to Netlify with the URL value
- [ ] Added `VITE_SUPABASE_ANON_KEY` to Netlify with the key value
- [ ] Redeployed the site

Done! 🎉

