# 🚀 Deployment Steps - Quick Guide

## Step 1: Build the App

The app has been built! Your production files are in the `/dist` folder.

## Step 2: Set Up Environment Variables

Before deploying, create a `.env` file in the root directory:

```env
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Passwords (REQUIRED for production)
VITE_RF_PASSWORD=your_strong_rf_password_here
VITE_SUPPLIER_PASSWORD=your_strong_supplier_password_here

# Optional: Access Code for extra protection
VITE_ACCESS_CODE=your_shared_access_code_here
```

**Important:** After setting these, rebuild:
```bash
npm run build
```

## Step 3: Deploy Options

### Option A: Google Chrome Hosting (Recommended for you)

Since you mentioned hosting on Google Chrome, you can use:

1. **Google Cloud Storage + Cloud CDN**
   - Upload `/dist` folder contents to a GCS bucket
   - Enable static website hosting
   - Set up Cloud CDN for fast delivery

2. **Firebase Hosting** (Easiest)
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   # Select dist as public directory
   firebase deploy
   ```

3. **Netlify** (Very Easy)
   - Go to https://netlify.com
   - Drag and drop your `/dist` folder
   - Done!

4. **Vercel** (Very Easy)
   - Go to https://vercel.com
   - Connect your GitHub repo or upload `/dist`
   - Done!

### Option B: Any Static Hosting

The `/dist` folder contains everything you need. Upload it to:
- AWS S3 + CloudFront
- Azure Static Web Apps
- Cloudflare Pages
- Any web server

## Step 4: Configure Environment Variables in Hosting

**CRITICAL:** When deploying, you need to set environment variables in your hosting platform:

### For Netlify/Vercel:
- Go to Site Settings → Environment Variables
- Add all `VITE_*` variables from your `.env` file
- Redeploy after adding variables

### For Firebase:
- Use `.env.production` file or
- Set in Firebase Console → Hosting → Environment Variables

### For Google Cloud:
- Set in Cloud Run/App Engine environment config
- Or use Secret Manager for sensitive values

## Step 5: Test Your Deployment

1. Visit your deployed URL
2. You should see the Access Code screen (if you set `VITE_ACCESS_CODE`)
3. Enter the access code
4. Then login with user + password

## 🔒 Security Checklist Before Sharing

- [ ] Strong passwords set in environment variables
- [ ] Access code set (optional but recommended)
- [ ] Environment variables configured in hosting platform
- [ ] HTTPS enabled (required for Supabase)
- [ ] Test login flow works
- [ ] Test that wrong passwords are rejected
- [ ] Test that wrong access code is rejected

## 📝 Quick Commands

```bash
# Build for production
npm run build

# Preview the build locally
npm run preview

# Start dev server (for testing)
npm run dev
```

## 🆘 Troubleshooting

**Build fails?**
- Check that all dependencies are installed: `npm install`
- Check for TypeScript errors: `npm run typecheck`

**App doesn't work after deployment?**
- Verify environment variables are set in hosting platform
- Check browser console for errors
- Ensure Supabase URL and keys are correct
- Make sure HTTPS is enabled (Supabase requires it)

**Can't login?**
- Check that passwords match what's in environment variables
- Verify you're not in dev mode (localhost)
- Check that access code is correct (if set)

## 📞 Next Steps

1. ✅ Build is complete (check `/dist` folder)
2. ⏭️ Set up environment variables
3. ⏭️ Choose hosting platform
4. ⏭️ Deploy `/dist` folder
5. ⏭️ Configure environment variables in hosting
6. ⏭️ Test and share!

