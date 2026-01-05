# Netlify Deployment Checklist ✅

## Build Configuration

### Build Command
```
npm run build
```

### Publish Directory
```
dist
```

### Node Version
```
18
```

---

## Required Environment Variables

Set these in **Netlify Dashboard → Site Settings → Environment Variables**:

### Required (App won't work without these):
1. **`VITE_SUPABASE_URL`**
   - Value: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - Get from: Supabase Dashboard → Settings → API → Project URL

2. **`VITE_SUPABASE_ANON_KEY`**
   - Value: Your Supabase anon/public key
   - Get from: Supabase Dashboard → Settings → API → Project API keys → anon/public

### Optional (App will work with defaults):
3. **`VITE_ACCESS_CODE`** (default: `RF2024`)
   - Access code required before login

4. **`VITE_RF_PASSWORD`** (default: `rf2024!secure`)
   - RF user password

5. **`VITE_SUPPLIER_PASSWORD`** (default: `supplier2024!secure`)
   - Supplier user password

6. **`VITE_DEV_MODE`** (default: `false`)
   - Set to `true` to enable dev mode features

7. **`VITE_TEST_EMAIL`** (optional)
   - Email address for testing email functionality

8. **`VITE_RESEND_API_KEY`** (optional)
   - API key for Resend email service

9. **`VITE_EMAIL_FROM`** (default: `Robinson Fresh <noreply@robinsonfresh.com>`)
   - Email sender address

---

## Netlify Configuration Files

### `netlify.toml` ✅
Already configured with:
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `18`
- SPA redirects: `/* → /index.html` (status 200)

### `public/_redirects` ✅
Already configured with:
- `/* /index.html 200` (SPA routing)

---

## Deployment Steps

1. **Connect to GitHub** (if not already connected)
   - Netlify Dashboard → Add new site → Import from Git → GitHub
   - Select your repository

2. **Set Environment Variables**
   - Netlify Dashboard → Site Settings → Environment Variables
   - Add all required variables (see above)
   - Click "Save"

3. **Deploy**
   - If connected to GitHub, push to main branch (auto-deploys)
   - Or: Netlify Dashboard → Deploys → Trigger deploy → Deploy site

4. **Verify**
   - Check build logs for success
   - Visit deployed site URL
   - Test login flow
   - Test routing (refresh on any route - should not 404)

---

## Smoke Test Checklist

After deployment, verify:

- [ ] **Build succeeds** (check Netlify build logs)
- [ ] **Homepage loads** (no blank page)
- [ ] **Login page appears** (if not logged in)
- [ ] **Login works** (RF and Supplier roles)
- [ ] **Routing works** (refresh on `/pricing`, `/analytics`, etc. - no 404)
- [ ] **Supabase connection works** (data loads, no console errors)
- [ ] **No runtime errors** (check browser console)
- [ ] **All tabs/pages accessible** (Pricing, Analytics, AI Allocation, etc.)

---

## Troubleshooting

### Build Fails
- Check build logs in Netlify Dashboard
- Verify Node version is 18
- Ensure all dependencies are in `package.json`

### Runtime Errors
- Check browser console (F12)
- Verify environment variables are set correctly
- Ensure Supabase URL and key are correct

### 404 on Refresh
- Verify `_redirects` file exists in `public/` folder
- Verify `netlify.toml` has redirects configured
- Check that `dist/_redirects` exists after build

### Supabase Connection Fails
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Check Supabase dashboard for project status
- Verify RLS policies allow anonymous access

### Missing Data
- Check Supabase database has data
- Verify RLS policies are configured correctly
- Check browser console for specific error messages

---

## Files Changed for Netlify Deployment

1. **`src/utils/loadAllocationScenario.ts`**
   - Fixed duplicate `supplier_dlvd` key in object literal

2. **`src/utils/supabase.ts`**
   - Enhanced error handling for missing env vars
   - Added production-safe placeholder values

3. **`netlify.toml`** (already existed)
   - Verified configuration is correct

4. **`public/_redirects`** (already existed)
   - Verified SPA routing is configured

---

## Build Output

Expected build output:
```
dist/
  ├── index.html
  ├── _redirects
  └── assets/
      ├── index-[hash].css
      └── index-[hash].js
```

---

## Notes

- All environment variables must be prefixed with `VITE_` to be accessible in the browser
- The app uses client-side routing (React Router), so all routes must redirect to `index.html`
- Supabase connection is validated at app startup - missing env vars will show a user-friendly error
- No local file dependencies - all data comes from Supabase
- Window/localStorage usage is guarded with `typeof window !== 'undefined'` checks

