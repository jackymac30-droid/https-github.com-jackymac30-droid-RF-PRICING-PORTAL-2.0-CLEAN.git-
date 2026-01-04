#!/bin/bash

# Initialize git repository
echo "Initializing git repository..."
git init

# Configure git (you may want to change these)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Add all files
echo "Staging all files..."
git add .

# Create initial commit
echo "Creating initial commit..."
git commit -m "Initial commit: RF Pricing Dashboard with enhanced Predictive Analytics

- AI-powered price predictions with interactive trend charts
- Summary statistics dashboard
- Filtering and sorting capabilities
- Confidence gauges and expandable forecast details
- Complete historical data integration"

# Show status
echo ""
echo "Git repository initialized and committed!"
echo ""
git status

