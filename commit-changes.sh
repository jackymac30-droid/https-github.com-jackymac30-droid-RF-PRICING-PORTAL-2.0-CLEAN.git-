#!/bin/bash

echo "🚀 Committing all changes to git..."
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git config user.name "${GIT_USER_NAME:-Your Name}"
    git config user.email "${GIT_USER_EMAIL:-your.email@example.com}"
fi

# Show what will be committed
echo "📋 Files to be committed:"
git status --short
echo ""

# Add all changes
echo "➕ Staging all changes..."
git add .

# Create commit
echo "💾 Creating commit..."
git commit -m "Enhanced Predictive Analytics with interactive charts and filters

- Added summary statistics dashboard
- Interactive trend charts for each forecast
- Filtering by trend and category
- Confidence gauges with color coding
- Expandable forecast details
- Improved visual design and animations"

echo ""
echo "✅ All changes committed!"
echo ""
echo "📊 Commit summary:"
git log --oneline -1
echo ""
echo "💡 Next steps:"
echo "   - To push to GitHub/GitLab, run: git remote add origin <your-repo-url>"
echo "   - Then: git push -u origin main"
echo ""
git status

