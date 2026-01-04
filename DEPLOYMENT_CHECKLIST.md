# Deployment Checklist

## ✅ Pre-Deployment

- [x] All code is committed and tested
- [x] Build script works (`npm run build`)
- [x] Environment variables documented (`.env.example`)
- [x] Netlify configuration ready (`netlify.toml`)
- [x] Deployment documentation created

## 📦 Creating the Zip

The project is ready! To create the deployment zip:

**Option 1: Use Python script**
```bash
python3 package-deployment.py
```

**Option 2: Use shell script**
```bash
chmod +x create-deployment-zip.sh
./create-deployment-zip.sh
```

**Option 3: Manual zip command**
```bash
zip -r rf-dashboard-deployment.zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "*.zip"
```

## 🚀 Deployment Steps

1. **Extract the zip file**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   VITE_RF_PASSWORD=your_password
   VITE_SUPPLIER_PASSWORD=your_password
   VITE_ACCESS_CODE=your_code
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Deploy to Netlify:**
   - Drag `dist` folder to Netlify dashboard
   - OR use CLI: `netlify deploy --prod --dir=dist`
   - OR connect Git repo for auto-deployment

6. **Set environment variables** in Netlify:
   - Go to Site Settings → Environment Variables
   - Add all variables from `.env.example`

## 📋 Files Included in Zip

- ✅ All source code (`src/`)
- ✅ Configuration files
- ✅ Supabase migrations
- ✅ Public assets
- ✅ Documentation
- ✅ Deployment scripts

## 📋 Files Excluded

- ❌ `node_modules/` (install separately)
- ❌ `.git/` (version control)
- ❌ `dist/` (builds on deployment)
- ❌ Log files

## 🔒 Security Notes

- Never commit `.env` files with real credentials
- Use environment variables in hosting platform
- Keep passwords secure
- Enable HTTPS in production

