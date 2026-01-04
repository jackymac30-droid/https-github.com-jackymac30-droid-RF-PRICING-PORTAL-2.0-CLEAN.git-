#!/bin/bash

# Create deployment-ready zip file
# Excludes: node_modules, .git, dist, logs, and system files

cd "$(dirname "$0")"

ZIP_NAME="rf-dashboard-deployment-$(date +%Y%m%d).zip"

echo "Creating deployment zip: $ZIP_NAME"
echo "Excluding: node_modules, .git, dist, logs..."

# Create zip excluding unnecessary files
zip -r "$ZIP_NAME" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "*.zip" \
  -x "*.tar.gz" \
  -x ".env.local" \
  -x ".env.*.local" \
  > /dev/null 2>&1

if [ -f "$ZIP_NAME" ]; then
  SIZE=$(ls -lh "$ZIP_NAME" | awk '{print $5}')
  echo "✅ Successfully created: $ZIP_NAME ($SIZE)"
  echo "📦 File location: $(pwd)/$ZIP_NAME"
else
  echo "❌ Failed to create zip file"
  exit 1
fi

