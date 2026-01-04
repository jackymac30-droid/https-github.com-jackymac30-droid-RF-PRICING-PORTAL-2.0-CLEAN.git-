#!/bin/bash

echo "🚀 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors and try again."
    exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Deploying to Netlify..."

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo ""
    echo "⚠️  Netlify CLI not found. Installing..."
    npm install -g netlify-cli
    echo ""
    echo "🔐 Please login to Netlify (browser will open)..."
    netlify login
    echo ""
fi

# Deploy
netlify deploy --prod --dir=dist

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment complete! Your site is live!"
    echo ""
    echo "🌐 Check your Netlify dashboard for the URL"
else
    echo ""
    echo "❌ Deployment failed. Check the error above."
    exit 1
fi

