# Garmin Production App Approval Checklist

## Current Status: IN PROGRESS ⚠️

Last Updated: February 11, 2026

---

## 1. TECHNICAL REVIEW

### ✅ **A. APIs Tested/In Use**

**Current Implementation:**
- **Wellness API**: Daily summaries, sleep, stress, Body Battery, HRV, Pulse Ox, respiration
- **Activity API**: Historical activity sync (IN PROGRESS - needs production key)
- **OAuth 2.0**: Authorization and token management

**Evidence Required:**
- [ ] API call logs showing successful requests
- [ ] Screenshots of data being received
- [ ] List of endpoints being used

**Current Endpoints:**
```
GET /wellness-api/rest/dailies
GET /wellness-api/rest/sleeps
GET /wellness-api/rest/heartrates
GET /wellness-api/rest/stressDetails
GET /wellness-api/rest/bodyBatteries
GET /wellness-api/rest/hrv
GET /wellness-api/rest/pulseox
GET /wellness-api/rest/respiration
GET /wellnessapi/rest/activities (BLOCKED - needs production key)
```

---

### ⚠️ **B. Authorization for at least two Garmin Connect users**

**Status**: NEEDS TESTING

**Required:**
- [ ] At least 2 different Garmin Connect accounts must authorize your app
- [ ] Document the user IDs (without revealing personal info)
- [ ] Screenshot showing successful authorization for both users

**Action Items:**
1. Test with your personal Garmin account
2. Have a team member or friend connect their Garmin account
3. Take screenshots of the "Connected Devices" screen showing connection status
4. Document in a table:

| User | Garmin User ID | Authorization Date | Status |
|------|---------------|-------------------|--------|
| User 1 | garmin_user_xxx | 2026-02-11 | Connected |
| User 2 | garmin_user_yyy | 2026-02-12 | Connected |

---

### ❌ **C. User Deregistration and User Permission Endpoints**

**User Deregistration**: ✅ IMPLEMENTED
```
DELETE /api/connected-devices/:deviceId
```

**User Permission Endpoint**: ❌ MISSING

**Required by Garmin:**
You need a **User Permission endpoint** that Garmin can call to verify what permissions a user has granted.

**ACTION: Implement User Permission Endpoint**

Expected endpoint: `GET /api/garmin/user-permissions/:userId`

**Implementation Needed:**
```typescript
app.get("/api/garmin/user-permissions/:userId", async (req, res) => {
  const { userId } = req.params;
  
  // Verify request is from Garmin (check API key/signature)
  
  const device = await storage.getConnectedDevices(userId);
  const garminDevice = device.find(d => d.deviceType === 'garmin' && d.isActive);
  
  if (!garminDevice) {
    return res.status(404).json({ 
      error: "User not found or no active Garmin connection" 
    });
  }
  
  res.json({
    userId: userId,
    permissions: [
      "WELLNESS_READ",
      "ACTIVITY_READ",
      "SLEEP_READ",
      "HEARTRATE_READ"
    ],
    status: "active",
    connectedAt: garminDevice.createdAt
  });
});
```

---

### ❌ **D. PING/PUSH Notification Processing**

**Status**: NOT IMPLEMENTED (CRITICAL)

**What This Means:**
- Garmin will send **PUSH notifications** when new data is available
- You must process these notifications and respond within 30 seconds
- **PULL-ONLY** (polling Garmin's API periodically) is **NOT ALLOWED** for production

**Current Issue:**
Your app currently only does PULL requests (fetching historical data on demand). This won't be approved.

**ACTION: Implement PING/PUSH Endpoints**

**Required Endpoints:**

**1. PING Endpoint** - Garmin tests if your server is alive
```typescript
app.post("/api/garmin/ping", async (req, res) => {
  console.log("📡 Garmin PING received");
  res.status(200).json({ status: "ok" });
});
```

**2. PUSH Endpoint** - Garmin sends data notifications
```typescript
app.post("/api/garmin/push", async (req, res) => {
  console.log("📨 Garmin PUSH notification received:", req.body);
  
  // Immediately respond 200 (within 30 seconds)
  res.status(200).json({ status: "received" });
  
  // Process asynchronously (don't block the response)
  processGarminNotification(req.body).catch(err => {
    console.error("Error processing Garmin notification:", err);
  });
});

async function processGarminNotification(payload: any) {
  // Parse notification type (activity, sleep, dailies, etc.)
  const { userId, dataType, uploadId } = payload;
  
  // Fetch the actual data from Garmin using the uploadId
  // Store in your database
  // Update user's data
}
```

**Requirements:**
- [ ] Server must respond HTTP 200 within 30 seconds
- [ ] Must handle minimum payload of 10MB (100MB for Activity data)
- [ ] Must process activities, wellness, sleep, HR, stress, etc.
- [ ] Implement retry logic if processing fails

**Garmin Verification Tool:**
- You'll need to provide these endpoint URLs to Garmin
- They'll test them with their Partner Verification Tool

---

### ❌ **E. HTTP 200 Asynchronous Response (within 30 seconds)**

**Status**: NEEDS IMPLEMENTATION

**Required:**
When Garmin sends PUSH notifications:
1. Respond with HTTP 200 **immediately** (< 30 seconds)
2. Process data **asynchronously** in the background
3. Handle large payloads (10MB+ for wellness, 100MB+ for activities)

**Implementation Pattern:**
```typescript
app.post("/api/garmin/push", async (req, res) => {
  // 1. Immediately acknowledge receipt
  res.status(200).json({ status: "received", timestamp: new Date() });
  
  // 2. Process in background (don't await)
  setImmediate(async () => {
    try {
      await processGarminData(req.body);
    } catch (error) {
      console.error("Background processing error:", error);
      // Implement retry queue
    }
  });
});
```

---

### ❌ **F. Training/Courses API (if applicable)**

**Status**: NOT APPLICABLE

**Your App**: AI Run Coach does NOT send workouts/courses TO Garmin Connect
**Decision**: Mark as N/A - you only READ data from Garmin, not WRITE

---

## 2. UX AND BRAND COMPLIANCE REVIEW

### **A. Garmin Branding Locations in Your App**

**Current Implementation:**
✅ **Connected Devices Screen**:
- Garmin Connect logo (PNG, full color)
- Description: "Connect via Garmin Connect OAuth for activity sync and health data"
- Feature badges: "Real-time data", "Post-run sync"
- Info message: "Garmin Companion App recommended"

✅ **Garmin Pre-Connect Screen** (`GarminConnectScreen.kt`):
- Garmin logo at top
- Benefits section
- Historical data import options (7, 14, 30 days)

⚠️ **Run History Screen**:
- Shows "Synced from Garmin Connect" badge on imported runs
- Garmin logo displayed

**Required Screenshots:**
- [ ] Connected Devices screen (disconnected state)
- [ ] Connected Devices screen (connected state)
- [ ] Garmin pre-connect authorization screen
- [ ] Run history showing Garmin-synced runs
- [ ] Run detail screen showing Garmin attribution

---

### **B. Brand Guidelines Compliance**

**Garmin Brand Guidelines Checklist:**

**Required Attribution (Page 2 - Activities):**
✅ "Synced from Garmin Connect" - IMPLEMENTED
✅ Garmin Connect logo displayed - IMPLEMENTED
⚠️ "Powered by Garmin" text - MISSING

**ACTION: Add "Powered by Garmin" Attribution**

**Where to Add:**
1. **Run Detail Screen** - At bottom: "Powered by Garmin"
2. **Settings Screen** - Under "Connected Devices": "Health data powered by Garmin"
3. **Wellness Data Views** - Any screen showing sleep, HRV, Body Battery: "Data from Garmin Connect"

**Logo Usage:**
✅ Using official Garmin Connect logo
✅ Logo not distorted/modified
✅ Logo clearly visible
⚠️ Need to verify minimum size requirements (check brand guidelines)

---

### **C. User Experience Flow**

**Required Documentation:**

**1. Connection Flow:**
```
User opens app
→ Navigates to Profile → Connected Devices
→ Sees Garmin card with logo and description
→ Taps "Connect"
→ Sees Garmin pre-connect screen (select history days)
→ Taps "Continue to Garmin"
→ Redirected to Garmin OAuth (browser)
→ Logs into Garmin Connect
→ Authorizes AI Run Coach
→ Redirected back to app
→ Sees "Garmin Connected!" success page
→ Returns to Connected Devices screen
→ Garmin shows "Connected" badge
→ Historical activities sync in background
```

**2. Disconnection Flow:**
```
User opens Connected Devices
→ Sees Garmin with "Connected" status
→ Taps "Disconnect" button
→ [Optional: Show confirmation dialog]
→ Device disconnected
→ Badge changes to "Connect" button
→ User can reconnect at any time
```

**3. Data Sync Flow:**
```
Garmin sends PUSH notification (new activity uploaded)
→ Your server receives notification at /api/garmin/push
→ Responds HTTP 200 immediately
→ Fetches activity details from Garmin API
→ Stores activity in database with externalSource="garmin"
→ User opens Run History
→ Sees new run with "Synced from Garmin Connect" badge
→ Taps to view details (GPS, HR, pace, splits)
```

**ACTION: Create Flow Diagrams**
- Use a tool like Figma, Lucidchart, or even PowerPoint
- Screenshot each step of the user flow
- Annotate where Garmin branding appears

---

## 3. TEAM MEMBERS AND ACCOUNT SETUP

### **A. API Blog Email Subscription**

✅ **ACTION**: Subscribe at https://developer.garmin.com/

**Required:**
- [ ] Sign up for "API Blog" email list
- [ ] Use company email (not Gmail/Outlook/Hotmail)
- [ ] Confirm subscription
- [ ] Keep screenshot as proof

---

### **B. Authorized Users**

**Current Status**: Needs setup

**Requirements:**
- ❌ No generic emails (support@, info@, contact@, dev@)
- ❌ No freemail accounts (Gmail, Outlook, Hotmail)
- ✅ Must use company domain email

**ACTION Items:**
1. If you have a company domain (e.g., @airuncoach.live):
   - Add all team members with company emails
   - Document each team member's role

2. If you DON'T have a company domain yet:
   - **Purchase domain**: airuncoach.com or airuncoach.live
   - **Set up email**: admin@airuncoach.com, dev@airuncoach.com
   - **Add to Garmin Developer Portal**

**Team Member Documentation:**
| Name | Email | Role | Access Level |
|------|-------|------|-------------|
| Daniel Johnston | daniel@airuncoach.live | Owner/Developer | Admin |
| [Team Member 2] | [email] | [role] | [access] |

---

### **C. Third-Party Integrators**

**Status**: NOT APPLICABLE (no third-party integrators)

If you hire contractors/agencies later, you'll need:
- [ ] NDA between you and third-party
- [ ] Upload NDA to Garmin
- [ ] Get approval before adding them

---

## IMMEDIATE ACTION ITEMS (Priority Order)

### **CRITICAL (BLOCKERS):**
1. ❌ **Implement PING endpoint** (`POST /api/garmin/ping`)
2. ❌ **Implement PUSH endpoint** (`POST /api/garmin/push`)
3. ❌ **Implement User Permission endpoint** (`GET /api/garmin/user-permissions/:userId`)
4. ❌ **Set up company email domain** (if not already done)
5. ❌ **Subscribe to API Blog email**

### **HIGH PRIORITY:**
6. ⚠️ **Test with 2+ Garmin Connect users**
7. ⚠️ **Add "Powered by Garmin" attribution text**
8. ⚠️ **Create UX flow screenshots**
9. ⚠️ **Document API endpoints in use**

### **MEDIUM PRIORITY:**
10. ⚠️ **Create brand compliance screenshots**
11. ⚠️ **Test PING/PUSH with Garmin Verification Tool**
12. ⚠️ **Document team members**

---

## NEXT STEPS

**Week 1:**
1. Implement PING/PUSH endpoints
2. Set up company email
3. Subscribe to API blog
4. Test with 2 users

**Week 2:**
1. Add attribution text throughout app
2. Take all required screenshots
3. Create UX flow documentation
4. Test PING/PUSH with Garmin tool

**Week 3:**
1. Compile all evidence
2. Complete Garmin submission form
3. Submit for review
4. Wait for approval (typically 2-4 weeks)

---

## GARMIN CONTACT

**Support:** https://developer.garmin.com/connect-api/support/
**Developer Portal:** https://developerportal.garmin.com/
**Brand Guidelines:** Available in Developer Portal → Resources

---

## QUESTIONS FOR GARMIN SUPPORT

Before submitting, ask Garmin:
1. Can we use OAuth 2.0 only, or do we need Consumer Key/Secret?
2. What format should PUSH notifications use (JSON, XML)?
3. How do we register our PING/PUSH endpoints?
4. Can we test PUSH in evaluation environment before production?

---

*This checklist will be updated as items are completed.*
