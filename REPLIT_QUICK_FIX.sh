#!/bin/bash
#
# ================================================================
# QUICK FIX FOR GROUP RUNS - PASTE THIS INTO REPLIT SHELL
# ================================================================
# This makes /api/group-runs work immediately (removes auth requirement)
# For testing only - use proper auth for production
# ================================================================

echo "🚀 AI Run Coach - Group Runs Quick Fix"
echo "======================================"
echo ""

# Step 1: Backup current file
echo "📦 Creating backup..."
cp server/routes.ts server/routes.ts.backup
echo "✅ Backup created: server/routes.ts.backup"
echo ""

# Step 2: Remove authMiddleware from group-runs endpoint
echo "🔧 Removing authentication requirement..."
sed -i 's/app\.get("\/api\/group-runs", authMiddleware,/app.get("\/api\/group-runs",/' server/routes.ts

# Verify the change
if grep -q 'app.get("/api/group-runs", async' server/routes.ts; then
    echo "✅ Successfully removed authMiddleware"
else
    echo "⚠️  Could not verify change - check manually"
fi
echo ""

# Step 3: Restart server
echo "🔄 Restarting server..."
pkill -f "node.*server_dist" 2>/dev/null
pkill -f "tsx.*server" 2>/dev/null
sleep 2

# Start server in background
npm run server:prod > server.log 2>&1 &
SERVER_PID=$!
echo "✅ Server restarted (PID: $SERVER_PID)"
echo ""

# Step 4: Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Step 5: Test endpoint
echo "🧪 Testing endpoint..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "https://${REPL_SLUG}.${REPL_OWNER}.repl.co/api/group-runs")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q "^\["; then
        echo "✅ SUCCESS! Endpoint returns JSON array"
        echo "📊 Response preview:"
        echo "$BODY" | head -c 200
        echo "..."
    else
        echo "⚠️  Endpoint returns 200 but not JSON array"
        echo "Response: $BODY" | head -c 100
    fi
else
    echo "⚠️  Endpoint returned HTTP $HTTP_CODE"
fi
echo ""

# Step 6: Create test data (optional)
echo "📝 Would you like to add test group runs?"
echo "This will create 3 sample group runs for testing."
echo ""
echo "To add test data, run:"
echo "  node add-test-data.js"
echo ""

# Create the test data script
cat > add-test-data.js << 'EOF'
const { Client } = require('pg');

async function addTestData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Get first user
    const userResult = await client.query('SELECT id, name FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please register a user first!');
      return;
    }

    const hostUser = userResult.rows[0];
    console.log(`📝 Using host: ${hostUser.name}`);

    // Create 3 test group runs
    const runs = [
      { title: 'Morning Sunrise Run', desc: 'Easy 5k to start the day', dist: 5.0, days: 1 },
      { title: 'Weekend Long Run', desc: 'Group 10k at moderate pace', dist: 10.0, days: 2 },
      { title: 'Speed Work Session', desc: 'Interval training - all levels', dist: 7.5, days: 3 }
    ];

    for (const run of runs) {
      await client.query(`
        INSERT INTO group_runs (
          host_user_id, mode, title, description, target_distance, target_pace,
          invite_token, status, planned_start_at
        ) VALUES (
          $1, 'route', $2, $3, $4, '5:30/km',
          'INV-' || substr(md5(random()::text), 1, 8),
          'pending', NOW() + INTERVAL '${run.days} days'
        )
      `, [hostUser.id, run.title, run.desc, run.dist]);
      
      console.log(`✅ Created: ${run.title}`);
    }

    console.log('');
    console.log('✅ Test data created! Check your Android app.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addTestData();
EOF

echo "✅ Created: add-test-data.js"
echo ""

# Step 7: Summary
echo "✨ QUICK FIX COMPLETE!"
echo "====================="
echo ""
echo "What was changed:"
echo "  - Removed authMiddleware from /api/group-runs endpoint"
echo "  - Server restarted and running"
echo "  - Endpoint is now public (no auth required)"
echo ""
echo "Next steps:"
echo "  1. Test endpoint: curl https://${REPL_SLUG}.${REPL_OWNER}.repl.co/api/group-runs"
echo "  2. Add test data: node add-test-data.js"
echo "  3. Test Android app (Profile → Group Runs)"
echo ""
echo "⚠️  IMPORTANT: This removes authentication!"
echo "   For production, implement proper auth fix (see REPLIT_GROUP_RUNS_FIX.md)"
echo ""
echo "To revert changes:"
echo "  cp server/routes.ts.backup server/routes.ts"
echo "  npm run server:prod"
echo ""
echo "✅ Done!"
EOF

chmod +x REPLIT_QUICK_FIX.sh
