#!/bin/bash

echo "🔗 Setting up GitHub repository..."
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: RF Pricing Dashboard"
fi

echo "📋 Steps to create GitHub repository:"
echo ""
echo "1. Go to: https://github.com/new"
echo "2. Repository name: rf-pricing-dashboard (or whatever you want)"
echo "3. Make it Private or Public (your choice)"
echo "4. DO NOT check 'Initialize with README'"
echo "5. Click 'Create repository'"
echo ""
echo "6. Copy the repository URL (it will look like:)"
echo "   https://github.com/yourusername/rf-pricing-dashboard.git"
echo ""
read -p "7. Paste the repository URL here: " repo_url

if [ ! -z "$repo_url" ]; then
    echo ""
    echo "🔗 Adding remote repository..."
    git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"
    
    echo "📤 Pushing to GitHub..."
    git branch -M main
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully pushed to GitHub!"
        echo "   View at: $repo_url"
    else
        echo ""
        echo "❌ Push failed. You may need to authenticate."
        echo ""
        echo "💡 Try one of these:"
        echo "   1. Install GitHub CLI: brew install gh && gh auth login"
        echo "   2. Or use SSH instead"
    fi
else
    echo "⏭️  Skipped. You can set this up later."
fi

