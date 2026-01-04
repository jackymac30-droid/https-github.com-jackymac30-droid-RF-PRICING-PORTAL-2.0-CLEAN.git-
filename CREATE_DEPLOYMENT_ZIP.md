# Create Deployment Zip - Instructions

## Quick Method (Recommended)

Run this command in your terminal from the project directory:

```bash
python3 package-deployment.py
```

Or use the shell script:

```bash
chmod +x create-deployment-zip.sh
./create-deployment-zip.sh
```

## Manual Method

If the scripts don't work, create the zip manually:

1. **Open Terminal** in the project directory
2. **Run this command:**

```bash
zip -r rf-dashboard-deployment.zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "*.zip" \
  -x ".env.local"
```

## What's Included

✅ All source code (`src/` folder)
✅ Configuration files (package.json, vite.config.ts, etc.)
✅ Supabase migrations (`supabase/` folder)
✅ Public assets (`public/` folder)
✅ Documentation files
✅ Deployment scripts

## What's Excluded

❌ `node_modules/` (install with `npm install`)
❌ `.git/` folder
❌ `dist/` folder (builds on deployment)
❌ Log files and system files

## After Creating the Zip

1. The zip file will be named: `rf-dashboard-deployment.zip`
2. Share this file - it's ready for deployment!
3. Recipient should:
   - Extract the zip
   - Run `npm install`
   - Set up environment variables (see `.env.example`)
   - Run `npm run build`
   - Deploy the `dist` folder

