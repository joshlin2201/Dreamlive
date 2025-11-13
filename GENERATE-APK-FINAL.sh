#!/bin/bash

# Dreamland Live Pro - Final APK Generation Script
# This script does everything for you!

echo "🎵 Dreamland Live Pro - Android APK Generator"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check if build exists
if [ ! -d "build" ]; then
    echo "❌ Build folder not found. Running npm run build..."
    npm run build
fi

echo "✅ Build folder ready"
echo ""

# Step 2: Open Netlify Drop in browser
echo "${BLUE}📤 STEP 1: Deploy to Netlify${NC}"
echo "----------------------------"
echo "I'm opening Netlify Drop in your browser..."
echo "👉 Drag and drop the 'build' folder that will open in Finder"
echo ""
sleep 2
open https://app.netlify.com/drop
open build
echo "Press ENTER after you've deployed and copied your Netlify URL..."
read

# Step 3: Get URL from user
echo ""
echo "${BLUE}🔗 STEP 2: Enter Your Netlify URL${NC}"
echo "--------------------------------"
echo "Paste the URL Netlify gave you (e.g., https://amazing-name-123456.netlify.app):"
read NETLIFY_URL

if [ -z "$NETLIFY_URL" ]; then
    echo "❌ No URL provided. Exiting..."
    exit 1
fi

echo "✅ URL received: $NETLIFY_URL"
echo ""

# Step 4: Open PWA Builder
echo "${BLUE}⚡ STEP 3: Generate APK with PWA Builder${NC}"
echo "--------------------------------------"
echo "Opening PWA Builder in your browser..."
echo ""
echo "Instructions:"
echo "1. Paste this URL: $NETLIFY_URL"
echo "2. Click 'Start'"
echo "3. Click 'Package For Stores'"
echo "4. Select 'Android'"
echo "5. Fill in:"
echo "   - App Name: Dreamland Live Pro"
echo "   - Package ID: com.dreamlandmaidcafe.livepro"
echo "   - Version: 1.0.0"
echo "6. Click 'Generate'"
echo "7. Download your APK!"
echo ""
sleep 3
open "https://www.pwabuilder.com/"

echo ""
echo "${GREEN}✅ DONE!${NC}"
echo ""
echo "📲 Next Steps:"
echo "1. Download the APK from PWA Builder"
echo "2. Transfer it to your Android tablet"
echo "3. Install and enjoy perfect fade functionality!"
echo ""
echo "🎵 Your Dreamland Live Pro app is ready!"
