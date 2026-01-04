#!/bin/bash

# ONE COMMAND TO RULE THEM ALL
# This script does everything: sets env vars and deploys

echo "🚀 Easy Deploy Script"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    echo ""
    echo "Create a .env file with:"
    echo "  VITE_SUPABASE_URL=https://your-project.supabase.co"
    echo "  VITE_SUPABASE_ANON_KEY=your-key-here"
    echo ""
    echo "Get these from: https://supabase.com/dashboard → Your Project → Settings → API"
    exit 1
fi

# Check Netlify CLI
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Check login
echo "🔐 Checking Netlify login..."
if ! netlify status &> /dev/null; then
    echo "   Please login first:"
    netlify login
fi

# Build
echo "🔨 Building app..."
npm run build

# Set environment variables from .env
echo "📝 Setting environment variables..."
while IFS='=' read -r key value; do
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    if [[ $key == VITE_* ]]; then
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        echo "   ✓ $key"
        netlify env:set "$key" "$value" > /dev/null 2>&1
    fi
done < .env

# Deploy
echo "🚀 Deploying to Netlify..."
netlify deploy --prod --dir=dist

echo ""
echo "✅ Done! Your site is live!"
echo "   Check your Netlify dashboard for the URL"

