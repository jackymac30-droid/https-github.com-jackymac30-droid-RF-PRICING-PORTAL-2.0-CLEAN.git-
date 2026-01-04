#!/bin/bash

# Netlify Deployment Script
# Run this after: netlify login

echo "🚀 Building app..."
npm run build

echo "📦 Deploying to Netlify..."
netlify deploy --prod --dir=dist

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to Netlify dashboard"
echo "2. Site settings → Environment variables"
echo "3. Add your VITE_* variables"
echo "4. Redeploy site"

