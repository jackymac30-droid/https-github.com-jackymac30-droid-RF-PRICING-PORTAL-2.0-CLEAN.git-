#!/bin/bash

echo "🚀 Setting up git push to GitHub..."
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository first..."
    git init
    git add .
    git commit -m "Initial commit: RF Pricing Dashboard"
fi

# Check if remote exists
if git remote | grep -q origin; then
    echo "✅ Remote 'origin' already configured"
    git remote -v
else
    echo "⚠️  No remote repository configured"
    echo ""
    echo "To push to GitHub, you need to:"
    echo "1. Create a new repository on GitHub (don't initialize with README)"
    echo "2. Copy the repository URL"
    echo "3. Run: git remote add origin <your-repo-url>"
    echo "4. Then run: git push -u origin main"
    echo ""
    read -p "Enter your GitHub repository URL (or press Enter to skip): " repo_url
    
    if [ ! -z "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "✅ Remote added!"
    else
        echo "⏭️  Skipping remote setup"
        exit 0
    fi
fi

echo ""
echo "📤 Pushing to remote..."
git branch -M main 2>/dev/null || true
git push -u origin main 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo "   - Repository doesn't exist on GitHub"
    echo "   - Authentication required (use GitHub CLI or SSH keys)"
    echo "   - Wrong repository URL"
    echo ""
    echo "💡 Try:"
    echo "   - Install GitHub CLI: gh auth login"
    echo "   - Or use SSH: git remote set-url origin git@github.com:user/repo.git"
fi

commit
