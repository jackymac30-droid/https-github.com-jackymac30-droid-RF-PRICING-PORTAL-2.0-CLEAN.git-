# Deployment Guide

## Quick Start

1. **Extract the zip file**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_RF_PASSWORD=your_rf_password
   VITE_SUPPLIER_PASSWORD=your_supplier_password
   VITE_ACCESS_CODE=your_access_code
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Deploy to Netlify:**
   - Option A: Drag and drop the `dist` folder to Netlify
   - Option B: Use Netlify CLI: `netlify deploy --prod --dir=dist`
   - Option C: Connect to Git repository for continuous deployment

## Environment Variables Setup

After deploying, set these environment variables in your hosting platform:

### Required:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Optional (for password protection):
- `VITE_RF_PASSWORD` - Password for RF users
- `VITE_SUPPLIER_PASSWORD` - Password for supplier users
- `VITE_ACCESS_CODE` - Access code for shared links
- `VITE_DEV_MODE=true` - Enable development mode (passwords optional on localhost)

## Netlify Deployment

1. Go to [Netlify](https://app.netlify.com)
2. Drag and drop the `dist` folder OR connect your Git repository
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Site Settings → Environment Variables
6. Deploy!

## Features

- ✅ Password protection for RF and Supplier dashboards
- ✅ Access code for shared links
- ✅ Development mode for local testing
- ✅ Real-time data updates
- ✅ Advanced analytics dashboard
- ✅ Responsive design

## Support

For issues or questions, check the documentation files in the project root.

