#!/bin/bash

echo "🔍 Checking Cursor ↔ GitHub Connection"
echo "========================================"
echo ""

# Check if git is initialized
if [ -d .git ]; then
    echo "✅ Git is initialized in this project"
else
    echo "❌ Git is NOT initialized"
    echo "   Run: git init"
    exit 1
fi

echo ""

# Check for remote
echo "📡 GitHub Remote Status:"
if git remote | grep -q origin; then
    echo "✅ Connected to GitHub!"
    echo ""
    echo "Remote URL:"
    git remote -v
    echo ""
    
    # Check if we can reach it
    remote_url=$(git remote get-url origin 2>/dev/null)
    if [[ $remote_url == *"github.com"* ]]; then
        echo "🌐 GitHub Repository:"
        echo "   $remote_url"
        echo ""
        echo "To view online, visit:"
        echo "   https://github.com/$(echo $remote_url | sed -E 's/.*github.com[:/](.*)\.git/\1/')"
    fi
else
    echo "❌ NOT connected to GitHub"
    echo ""
    echo "To connect:"
    echo "1. Create a repo at: https://github.com/new"
    echo "2. Run: git remote add origin https://github.com/yourusername/repo-name.git"
    echo "3. Run: git push -u origin main"
fi

echo ""
echo "📊 Local Git Status:"
git status --short 2>&1 | head -10

echo ""
echo "📝 Recent Commits:"
git log --oneline -5 2>&1 || echo "   No commits yet"

