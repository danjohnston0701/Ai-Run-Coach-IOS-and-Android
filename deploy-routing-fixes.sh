#!/bin/bash

# Deploy Advanced Routing Intelligence to Replit
# Feb 9, 2026 - Add highway filtering, distance validation, terrain optimization

echo "🚀 Deploying Advanced Routing Intelligence to Replit..."
echo ""
echo "✅ New Features:"
echo "  - Highway/motorway filtering (avoids major roads)"
echo "  - Distance tolerance validation (±10% of target)"
echo "  - Terrain preference (parks, trails, paths when preferTrails=true)"
echo "  - Enhanced quality scoring"
echo ""

# Check if Replit CLI is installed
if ! command -v replit &> /dev/null; then
    echo "❌ Replit CLI not found. Installing..."
    npm install -g @replit/cli
fi

# Navigate to project directory
cd "$(dirname "$0")"

echo "📦 Committing changes to Git..."
git add server/intelligent-route-generation.ts
git commit -m "feat: Add advanced routing intelligence

- Filter out highways/motorways using GraphHopper road_class data
- Validate distance within ±10% of target
- Optimize for trails/paths when preferTrails=true  
- Enhanced terrain scoring (trails, paths, cycleways)
- Reject routes with >30% highway usage
- Score: Quality (50%) + Popularity (30%) + Terrain (20%)

Fixes routing issues where routes used major roads instead of trails."

echo ""
echo "🔄 Pushing to GitHub..."
git push origin main

echo ""
echo "🌐 Deploying to Replit..."
echo "   → Login to Replit: https://replit.com/@DanielJohnston9/Ai-Run-Coach"
echo "   → Go to Shell tab"
echo "   → Run: git pull origin main"
echo ""
echo "✅ Local changes committed and pushed to GitHub!"
echo "⚠️  MANUAL STEP: Pull changes in Replit Shell with: git pull origin main"
echo ""
read -p "Press Enter once you've pulled in Replit Shell..."

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Test the new routing:"
echo "   POST https://ai-run-coach.replit.app/api/routes/generate-intelligent"
echo "   Body: { \"latitude\": YOUR_LAT, \"longitude\": YOUR_LNG, \"distanceKm\": 5, \"preferTrails\": true }"
echo ""
echo "✅ Routes will now:"
echo "   - Avoid highways and major roads"
echo "   - Stay within ±10% of target distance"
echo "   - Prefer trails, parks, and paths"
echo "   - Have no U-turns or dead ends"
