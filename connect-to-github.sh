#!/bin/bash

REPO_URL="https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git"

echo "🔗 Connecting Cursor to GitHub"
echo "Repository: $REPO_URL"
echo ""

# Initialize git if needed
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add remote
echo "🔗 Adding GitHub remote..."
git remote remove origin 2>/dev/null
git remote add origin "$REPO_URL"
echo "✅ Remote added!"

# Show remote status
echo ""
echo "📡 Remote Configuration:"
git remote -v
echo ""

# Stage all files
echo "➕ Staging all files..."
git add .
echo "✅ Files staged"
echo ""

# Commit
echo "💾 Creating commit..."
git commit -m "Initial commit: RF Pricing Dashboard with enhanced Predictive Analytics

- AI-powered price predictions with interactive trend charts
- Summary statistics dashboard
- Filtering and sorting capabilities
- Confidence gauges and expandable forecast details
- Complete historical data integration
- Enhanced UI/UX with dark theme" || echo "⚠️  Commit may have failed or nothing to commit"
echo ""

# Push to GitHub
echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Your code is now on GitHub!"
    echo ""
    echo "🌐 View your repository at:"
    echo "   https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0"
    echo ""
    echo "✅ Cursor ↔ GitHub connection established!"
else
    echo ""
    echo "❌ Push failed. You may need to authenticate."
    echo ""
    echo "💡 Try:"
    echo "   1. GitHub CLI: gh auth login"
    echo "   2. Or use personal access token"
    echo "   3. Or push manually from GitHub Desktop"
fi

