#!/bin/bash

echo "🚀 Publishing to GitHub..."
echo ""

# Build the project first
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors and try again."
    exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""

# Add all changes
echo "📝 Staging all changes..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit."
else
    # Commit with timestamp
    echo "💾 Committing changes..."
    git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Push to GitHub
    echo "📤 Pushing to GitHub..."
    git push
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "⚠️  First time? You'll need to authenticate ONCE:"
        echo ""
        echo "   1. Get a token: https://github.com/settings/tokens"
        echo "   2. Click 'Generate new token (classic)'"
        echo "   3. Check 'repo' permission"
        echo "   4. Copy the token"
        echo "   5. Run this command:"
        echo ""
        echo "      git push https://YOUR_TOKEN@github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git main"
        echo ""
        echo "   After this ONE time, it will work automatically forever!"
        echo ""
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully pushed to GitHub!"
        echo ""
        echo "🌐 Netlify will automatically deploy in 2-3 minutes"
        echo "   Check: https://app.netlify.com"
    else
        echo ""
        echo "❌ Failed to push. Check your git configuration."
        exit 1
    fi
fi

echo ""
echo "✨ Done! Your changes will be live on Netlify shortly."

