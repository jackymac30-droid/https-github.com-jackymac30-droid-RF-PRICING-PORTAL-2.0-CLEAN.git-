#!/bin/bash

# Simple script to push to GitHub
# Replace YOUR_TOKEN_HERE with your actual token

echo "🚀 Pushing your code to GitHub..."
echo ""

# Replace YOUR_TOKEN_HERE with the token you copied from GitHub
TOKEN="YOUR_TOKEN_HERE"

# Push to GitHub
git push https://${TOKEN}@github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0.git main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Your code is now on GitHub!"
    echo "🌐 View it at: https://github.com/jackymac30-droid/RF-PRICING-PORTAL-2.0"
else
    echo ""
    echo "❌ Something went wrong. Make sure:"
    echo "   1. You replaced YOUR_TOKEN_HERE with your actual token"
    echo "   2. Your token has 'repo' permissions"
    echo "   3. You're connected to the internet"
fi

