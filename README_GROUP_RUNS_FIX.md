# 🏃 Group Runs Endpoint - Quick Fix Guide

## 🎯 TL;DR - Copy This Into Replit Shell

**OPTION 1: One-Liner (Fastest)**
```bash
cp server/routes.ts server/routes.ts.backup && sed -i 's/app\.get("\/api\/group-runs", authMiddleware,/app.get("\/api\/group-runs",/' server/routes.ts && pkill -f "node.*server" && sleep 2 && npm run server:prod & sleep 5 && echo "✅ Done! Test your Android app now."
```

**OPTION 2: With Script**
```bash
bash REPLIT_QUICK_FIX.sh
```

**OPTION 3: Add Test Data**
```bash
# After Option 1 or 2, add sample group runs:
node add-test-data.js
```

---

## 📋 What's The Issue?

Your Android app calls `/api/group-runs` but gets **HTML** instead of **JSON**:
- ❌ Expected: `[{id: "...", name: "...", ...}]`
- ❌ Got: `<!DOCTYPE html>...` (React app)
- ❌ Result: App crashes with JSON parsing error

### Why?
The endpoint **exists** but requires authentication. When Android calls it without auth:
1. Auth middleware rejects it
2. But doesn't return proper JSON error
3. Falls through to React frontend
4. React HTML causes JSON parsing crash

---

## ✅ The Fix

### Quick Fix (Testing)
Remove authentication requirement temporarily:
- Changes `server/routes.ts` line 1125
- Makes endpoint public (no auth needed)
- **Use for testing only!**

### Proper Fix (Production)
Update `authMiddleware` to return JSON instead of falling through:
```typescript
// In server/auth.ts or server/routes.ts
if (!authHeader) {
  return res.status(401).json({ error: "Unauthorized" }); // ← This!
}
```

---

## 📁 Files Included

| File | Purpose |
|------|---------|
| `REPLIT_QUICK_FIX.sh` | Complete automated fix script |
| `REPLIT_ONE_LINER.txt` | Copy/paste one-liners for Replit Shell |
| `REPLIT_GROUP_RUNS_FIX.md` | Detailed guide with all options |
| `add-test-data.js` | Creates sample group runs (auto-generated) |
| `deploy-group-runs.sh` | Diagnostic and deployment script |

---

## 🚀 Quick Start Guide

### Step 1: Run the Fix
In Replit Shell:
```bash
bash REPLIT_QUICK_FIX.sh
```

### Step 2: Add Test Data
```bash
node add-test-data.js
```

### Step 3: Test Android App
1. Open app
2. Go to Profile → Group Runs
3. Should show: "Group Runs feature coming soon!" → Then actual group runs list!

### Step 4: Test the Endpoint
```bash
curl https://YOUR-REPL.repl.co/api/group-runs
```

Expected output:
```json
[
  {
    "id": "...",
    "hostUserId": "...",
    "title": "Morning Sunrise Run",
    "description": "Easy 5k to start the day",
    "targetDistance": 5.0,
    ...
  }
]
```

---

## 🐛 Troubleshooting

### Still Getting HTML?
```bash
# Check if server restarted
ps aux | grep node

# Force restart
pkill -f "node.*server"
npm run server:prod &
```

### No Test Data Showing?
```bash
# Check database
cat > check-db.js << 'EOF'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT COUNT(*) FROM group_runs');
  console.log(`Found ${r.rows[0].count} group runs`);
  await c.end();
})();
EOF
node check-db.js
```

### Android Still Crashing?
1. Check LogCat for actual error
2. Verify endpoint returns JSON: `curl https://YOUR-REPL.repl.co/api/group-runs`
3. Ensure Android APK is latest version (with the fix)
4. Check `GROUP_RUNS_JSON_PARSING_FIX.md` in Android repo

---

## 📚 Documentation

- **Quick Fix**: This file
- **Detailed Guide**: `REPLIT_GROUP_RUNS_FIX.md`
- **One-Liners**: `REPLIT_ONE_LINER.txt`
- **Android Fix**: `GROUP_RUNS_JSON_PARSING_FIX.md` (in Android repo)
- **Test Guide**: `TEST_GROUP_RUNS_FIX.md` (in Android repo)

---

## ⚠️ Important Notes

### Security
- Quick fix removes authentication (testing only!)
- For production: Implement proper auth middleware fix
- See `REPLIT_GROUP_RUNS_FIX.md` → "Option 2: Proper Fix"

### Reverting Changes
```bash
cp server/routes.ts.backup server/routes.ts
pkill -f "node.*server"
npm run server:prod &
```

---

## ✅ Success Checklist

- [ ] Endpoint returns JSON (not HTML)
- [ ] Can fetch `/api/group-runs` successfully
- [ ] Test data created (3 sample group runs)
- [ ] Android app shows group runs list
- [ ] No crashes in Android app
- [ ] No JSON parsing errors in LogCat

---

## 🎉 That's It!

The endpoint already exists on your backend - you just needed to make it accessible! Now your Android app should work perfectly with Group Runs.

**Questions?** Check `REPLIT_GROUP_RUNS_FIX.md` for detailed explanations.

---

**Last Updated:** February 7, 2026  
**Android Fix:** GROUP_RUNS_JSON_PARSING_FIX.md  
**Status:** ✅ Ready to deploy
