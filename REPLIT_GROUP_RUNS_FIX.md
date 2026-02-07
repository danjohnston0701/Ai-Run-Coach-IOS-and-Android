# Group Runs - Replit Deployment Guide

## 🎯 Quick Summary

**Status:** ✅ The `/api/group-runs` endpoint **already exists** on your backend!  
**Problem:** It requires authentication but returns HTML (React app) instead of proper error when auth fails  
**Solution:** Simple one-line fix to test, then proper auth fix for production

---

## 🚀 Option 1: Quick Fix (2 Minutes) - RECOMMENDED FOR TESTING

This will make the endpoint work immediately for testing:

### Step 1: Copy this to Replit Shell

```bash
# Navigate to your project
cd /home/runner/${REPL_SLUG}

# Backup the current routes file
cp server/routes.ts server/routes.ts.backup

# Remove authMiddleware from the group-runs endpoint (line 1125)
sed -i 's/app\.get("\/api\/group-runs", authMiddleware,/app.get("\/api\/group-runs",/' server/routes.ts

# Verify the change
echo "✅ Checking if authMiddleware was removed..."
grep -n 'app.get("/api/group-runs"' server/routes.ts | head -2

# Restart the server
pkill -f "node.*server"
npm run server:prod &

echo ""
echo "✅ Done! The endpoint is now public (no auth required)"
echo "   Test it: curl https://${REPL_SLUG}.${REPL_OWNER}.repl.co/api/group-runs"
```

### Step 2: Test in Android App

1. Install updated Android APK
2. Navigate to Profile → Group Runs
3. Should now show empty list or existing group runs (no crash!)

---

## 🔧 Option 2: Proper Fix (Production-Ready)

The better approach is to fix the authentication issue properly.

### Issue: Why HTML is Returned

When the Android app calls `/api/group-runs` without an auth token:
1. Request hits `authMiddleware` 
2. Auth fails (no token)
3. Middleware doesn't explicitly return 401
4. Request falls through to Express default handler
5. Express serves React frontend HTML (because it's a catch-all route)

### Fix A: Make Auth Middleware Return JSON

Copy this to Replit Shell:

```bash
cat > fix-auth-middleware.js << 'EOF'
const fs = require('fs');

// Read the routes file
let routesContent = fs.readFileSync('server/routes.ts', 'utf8');

// Find the authMiddleware function and check if it returns JSON
if (routesContent.includes('authMiddleware')) {
  console.log('✅ Found authMiddleware in routes.ts');
  console.log('📝 Check that authMiddleware returns JSON on auth failure');
  console.log('   It should include: return res.status(401).json({ error: "Unauthorized" })');
  console.log('   Location: Look for "async function authMiddleware" or "const authMiddleware"');
} else {
  console.log('❌ authMiddleware not found in routes.ts');
  console.log('   It might be imported from another file (check server/auth.ts)');
}
EOF

node fix-auth-middleware.js
rm fix-auth-middleware.js
```

### Fix B: Update authMiddleware to Return JSON

**File:** `server/auth.ts` or in `server/routes.ts`

Find the `authMiddleware` function and ensure it returns JSON:

```typescript
async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // IMPORTANT: Return JSON, not just next()
    return res.status(401).json({ 
      error: "Unauthorized",
      message: "No authentication token provided" 
    });
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: "Unauthorized",
      message: "Invalid or expired token" 
    });
  }
}
```

---

## 🧪 Option 3: Add Test Data

Create sample group runs to test with:

### Copy to Replit Shell:

```bash
cat > add-test-data.js << 'EOF'
const { Client } = require('pg');

async function addTestGroupRuns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get first user as host
    const userResult = await client.query('SELECT id, name FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please register a user first!');
      process.exit(1);
    }

    const hostUser = userResult.rows[0];
    console.log(`📝 Using host: ${hostUser.name}`);

    // Create 3 test group runs
    const testRuns = [
      {
        title: 'Morning Sunrise Run',
        description: 'Easy pace 5k to start the day. Coffee afterwards!',
        distance: 5.0,
        pace: '5:30/km',
        days: 1
      },
      {
        title: 'Weekend Long Run',
        description: 'Group long run, moderate pace. 10k around the park.',
        distance: 10.0,
        pace: '5:45/km',
        days: 2
      },
      {
        title: 'Speed Work Tuesday',
        description: 'Interval training session. All fitness levels welcome!',
        distance: 7.5,
        pace: '4:30/km',
        days: 3
      }
    ];

    for (const run of testRuns) {
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
          $1, 'route', $2, $3, $4, $5,
          'INV-' || substr(md5(random()::text), 1, 8),
          'pending', 
          NOW() + INTERVAL '${run.days} days'
        ) RETURNING id, title;
      `, [hostUser.id, run.title, run.description, run.distance, run.pace]);

      console.log(`✅ Created: ${result.rows[0].title} (${result.rows[0].id})`);
    }

    console.log('');
    console.log('✅ Successfully created 3 test group runs!');
    console.log('📱 Check them in your Android app now.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

addTestGroupRuns();
EOF

node add-test-data.js
rm add-test-data.js
```

---

## 📊 Check Current Status

### Verify Database Tables Exist

```bash
cat > check-tables.js << 'EOF'
const { Client } = require('pg');

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Check group_runs table
    const groupRunsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_runs'
      );
    `);

    if (groupRunsExists.rows[0].exists) {
      const count = await client.query('SELECT COUNT(*) FROM group_runs');
      console.log(`✅ group_runs table exists (${count.rows[0].count} records)`);
    } else {
      console.log('❌ group_runs table does NOT exist - need to run migrations!');
    }

    // Check group_run_participants table
    const participantsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_run_participants'
      );
    `);

    if (participantsExists.rows[0].exists) {
      const count = await client.query('SELECT COUNT(*) FROM group_run_participants');
      console.log(`✅ group_run_participants table exists (${count.rows[0].count} records)`);
    } else {
      console.log('❌ group_run_participants table does NOT exist');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
EOF

node check-tables.js
rm check-tables.js
```

### Test the Endpoint

```bash
# Test without authentication (will return HTML currently)
curl -i https://${REPL_SLUG}.${REPL_OWNER}.repl.co/api/group-runs | head -20

# Expected: HTML if auth is required and failing
# After fix: JSON array of group runs
```

---

## 🏁 Complete Step-by-Step Guide

### For Quick Testing (No Auth):

```bash
# 1. Make endpoint public
sed -i 's/app\.get("\/api\/group-runs", authMiddleware,/app.get("\/api\/group-runs",/' server/routes.ts

# 2. Restart server
pkill -f "node.*server" && npm run server:prod &

# 3. Test
curl https://${REPL_SLUG}.${REPL_OWNER}.repl.co/api/group-runs

# 4. If empty, add test data
node add-test-data.js
```

### For Production (With Proper Auth):

1. **Update authMiddleware** to return JSON (see Fix B above)
2. **Ensure Android app sends auth token** (already done in RetrofitClient.kt)
3. **Restart server**
4. **Test with authentication**

---

## 🧪 Testing Checklist

- [ ] Database tables exist (`group_runs`, `group_run_participants`)
- [ ] Endpoint returns JSON (not HTML)
- [ ] Can fetch empty array `[]` successfully
- [ ] Test data created successfully
- [ ] Android app shows group runs list
- [ ] No crashes in Android app
- [ ] LogCat shows successful JSON parsing

---

## 🐛 Troubleshooting

### Still Getting HTML?

**Check:** Is the server restarted?
```bash
pkill -f "node.*server"
npm run server:prod &
```

### Database Tables Missing?

**Fix:** Run migrations
```bash
npm run db:push
```

### No Test Data?

**Fix:** Run the add-test-data script above

### Android Still Crashing?

**Check:** 
1. Is endpoint returning JSON? `curl https://your-repl.repl.co/api/group-runs`
2. Check Android LogCat for actual error
3. Verify Android APK is updated version with the fix

---

## 📝 Summary

**Current State:**
- ✅ Backend endpoint exists
- ✅ Database schema exists
- ✅ Storage functions exist
- ❌ Auth middleware returns HTML instead of JSON

**Quick Fix:** Remove authMiddleware (testing only)  
**Proper Fix:** Make authMiddleware return JSON errors  
**Android Fix:** Already implemented - just needs working endpoint

**Result:** Group Runs will work on Android app! 🎉

---

**Need Help?** Check the logs:
```bash
# Backend logs
pm2 logs

# Or if running with npm
# Check the terminal where server is running
```
