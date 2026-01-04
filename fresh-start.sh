#!/bin/bash

echo "🆕 Starting Fresh - Removing Git History"
echo ""

# Check if .git exists
if [ ! -d ".git" ]; then
    echo "❌ No .git folder found. Already fresh?"
    exit 1
fi

echo "⚠️  This will remove all git history!"
echo "   Your code will stay, but git history will be gone."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "🗑️  Removing old git history..."
rm -rf .git

echo "✅ Old history removed!"
echo ""
echo "🆕 Initializing fresh git repository..."
git init
git add .
git commit -m "Initial commit - clean version without secrets"

echo ""
echo "✅ Fresh repository created!"
echo ""
echo "📤 Next steps:"
echo "   1. Create a new repository on GitHub: https://github.com/new"
echo "   2. Copy the repository URL"
echo "   3. Run: git remote add origin YOUR_NEW_REPO_URL"
echo "   4. Run: git push -u origin main"
echo "   5. Connect Netlify to the new repository"
echo ""
echo "✨ Your code is ready - no secrets in history!"

