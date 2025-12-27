#!/bin/bash

# Script to switch to Node.js v18 and install dependencies
# Run this script to complete the backend setup

echo "📦 Backend Setup Script"
echo "======================="
echo ""

# Check if nvm is available
if ! command -v nvm &> /dev/null; then
    echo "⚠️  NVM not found in current shell"
    echo ""
    echo "Please run ONE of these commands in your terminal:"
    echo ""
    echo "Option 1: Load NVM (if installed)"
    echo "  source ~/.nvm/nvm.sh"
    echo "  nvm use 18"
    echo ""
    echo "Option 2: Use system Node (if v18 is installed)"
    echo "  node --version  # Check if already on v18"
    echo ""
    echo "Option 3: Install nvm first"
    echo "  Visit: https://github.com/nvm-sh/nvm#installing-and-updating"
    echo ""
    exit 1
fi

echo "🔄 Switching to Node.js v18..."
nvm use 18

if [ $? -ne 0 ]; then
    echo "❌ Node.js v18 not found"
    echo "📥 Installing Node.js v18..."
    nvm install 18
    nvm use 18
fi

echo ""
echo "✅ Node version: $(node --version)"
echo ""

echo "🧹 Cleaning previous installation..."
rm -rf node_modules package-lock.json swipe.db*

echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "🚀 Start the server with:"
    echo "   npm start"
    echo ""
else
    echo ""
    echo "❌ Installation failed. Check the error above."
    echo ""
fi
