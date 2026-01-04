#!/bin/bash

# One-command Netlify environment variable setup
# Reads from .env and sets them in Netlify

echo "🔍 Reading environment variables from .env..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Create a .env file with your variables first."
    exit 1
fi

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

# Check if logged in
if ! netlify status &> /dev/null; then
    echo "🔐 Please login to Netlify first:"
    echo "   netlify login"
    exit 1
fi

echo "📝 Setting environment variables..."

# Read .env and set each VITE_ variable in Netlify
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Only process VITE_ variables
    if [[ $key == VITE_* ]]; then
        # Remove quotes from value if present
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        echo "  Setting $key..."
        netlify env:set "$key" "$value" --json > /dev/null 2>&1
    fi
done < .env

echo ""
echo "✅ Done! All environment variables set."
echo ""
echo "🚀 Now redeploy your site:"
echo "   netlify deploy --prod --dir=dist"
echo ""
echo "Or trigger a redeploy from the Netlify dashboard."

