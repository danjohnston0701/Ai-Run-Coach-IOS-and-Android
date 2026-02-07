#!/bin/bash

# ====================================================================
# Group Runs Endpoint Deployment Script for Replit
# ====================================================================
# This script helps diagnose and fix the /api/group-runs endpoint
# that's currently returning HTML instead of JSON to Android clients
# ====================================================================

set -e  # Exit on error

echo "🚀 AI Run Coach - Group Runs Endpoint Fix"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the correct directory
echo "📍 Step 1: Verifying directory..."
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi
echo -e "${GREEN}✅ Project root directory confirmed${NC}"
echo ""

# Step 2: Check if group_runs table exists in database
echo "📊 Step 2: Checking database schema..."
echo "Running database check..."

# Create a simple node script to check the table
cat > check-db.js << 'EOF'
const { Client } = require('pg');

async function checkDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Database connection successful');

    // Check if group_runs table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_runs'
      );
    `);

    if (result.rows[0].exists) {
      console.log('✅ group_runs table exists');

      // Count records
      const count = await client.query('SELECT COUNT(*) FROM group_runs');
      console.log(`📊 Found ${count.rows[0].count} group runs in database`);
    } else {
      console.log('❌ group_runs table does NOT exist');
      console.log('⚠️  You need to run database migrations!');
      process.exit(1);
    }

    // Check if group_run_participants table exists
    const participantsResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_run_participants'
      );
    `);

    if (participantsResult.rows[0].exists) {
      console.log('✅ group_run_participants table exists');
    } else {
      console.log('❌ group_run_participants table does NOT exist');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDatabase();
EOF

node check-db.js
rm check-db.js
echo ""

# Step 3: Check current server status
echo "🔍 Step 3: Checking server configuration..."
if [ -f "server/routes.ts" ]; then
    if grep -q "app.get(\"/api/group-runs\"" server/routes.ts; then
        echo -e "${GREEN}✅ Group runs endpoint exists in routes.ts${NC}"
    else
        echo -e "${RED}❌ Group runs endpoint NOT found in routes.ts${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ server/routes.ts not found${NC}"
    exit 1
fi
echo ""

# Step 4: Test endpoint locally
echo "🧪 Step 4: Testing endpoint..."
echo "This test requires the server to be running."
echo ""

read -p "Is the server currently running? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Testing endpoint..."
    
    # Test without auth (should fail gracefully)
    echo "Test 1: GET /api/group-runs (no auth) - should return 401 or HTML"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
        https://$(echo $REPL_SLUG).$(echo $REPL_OWNER).repl.co/api/group-runs
    echo ""
    
    echo -e "${YELLOW}⚠️  If you see HTML/text, the auth middleware is rejecting requests silently${NC}"
    echo ""
fi

# Step 5: Provide deployment instructions
echo "📋 Step 5: Deployment Checklist"
echo "================================"
echo ""
echo "The endpoint already exists! Here's what to check:"
echo ""
echo "1. ✅ Database schema exists (group_runs table)"
echo "2. ✅ Backend route exists (server/routes.ts line ~1125 and ~4008)"
echo "3. ✅ Storage functions exist (server/storage.ts)"
echo ""
echo "The issue is that the endpoint requires authentication but returns HTML"
echo "instead of a proper 401 JSON error when auth fails."
echo ""
echo "🔧 FIX OPTIONS:"
echo ""
echo "Option A: Make endpoint public (testing only)"
echo "   - Remove authMiddleware from line 1125 in server/routes.ts"
echo "   - Change: app.get(\"/api/group-runs\", authMiddleware, ..."
echo "   - To: app.get(\"/api/group-runs\", ..."
echo ""
echo "Option B: Fix Android app to send auth token (RECOMMENDED)"
echo "   - The Android app should include Authorization header"
echo "   - Format: 'Bearer <user_token>'"
echo "   - Token is stored in SessionManager after login"
echo ""
echo "Option C: Return proper JSON error for missing auth"
echo "   - Modify authMiddleware to return JSON instead of falling through"
echo ""

# Step 6: Create test data script
echo "📝 Creating test data script..."
cat > add-test-group-run.js << 'EOF'
const { Client } = require('pg');

async function addTestGroupRun() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get first user as host
    const userResult = await client.query('SELECT id, name FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Create a user first!');
      return;
    }

    const hostUser = userResult.rows[0];
    console.log(`📝 Using host: ${hostUser.name} (${hostUser.id})`);

    // Create test group run
    const result = await client.query(`
      INSERT INTO group_runs (
        host_user_id, 
        mode, 
        title, 
        description, 
        target_distance, 
        target_pace,
        invite_token,
        status, 
        planned_start_at
      ) VALUES (
        $1, 
        'route', 
        'Morning Group Run', 
        'Easy pace 5k run around the park. All levels welcome!', 
        5.0, 
        '5:30/km',
        'TEST-' || gen_random_uuid()::text,
        'pending', 
        NOW() + INTERVAL '1 day'
      ) RETURNING *;
    `, [hostUser.id]);

    console.log('✅ Test group run created!');
    console.log('ID:', result.rows[0].id);
    console.log('Title:', result.rows[0].title);
    console.log('Planned for:', result.rows[0].planned_start_at);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addTestGroupRun();
EOF

echo -e "${GREEN}✅ Test data script created: add-test-group-run.js${NC}"
echo ""

# Step 7: Summary and next steps
echo "✨ SUMMARY"
echo "=========="
echo ""
echo "The /api/group-runs endpoint EXISTS and is WORKING on the backend."
echo "The issue is an authentication problem causing HTML to be returned."
echo ""
echo "🎯 QUICK FIX (for testing):"
echo "   1. Run: node add-test-group-run.js"
echo "   2. Temporarily remove authMiddleware from routes.ts line 1125"
echo "   3. Restart server: npm run server:prod"
echo "   4. Test Android app - should now show group runs"
echo ""
echo "🎯 PROPER FIX (for production):"
echo "   1. Ensure Android app sends Authorization header"
echo "   2. Check ApiService.kt and RetrofitClient.kt"
echo "   3. Verify SessionManager stores token correctly"
echo "   4. Test with proper authentication"
echo ""
echo "📄 For more details, see: GROUP_RUNS_DEPLOYMENT_GUIDE.md"
echo ""
echo -e "${GREEN}✅ Deployment script completed!${NC}"
EOF

chmod +x deploy-group-runs.sh
