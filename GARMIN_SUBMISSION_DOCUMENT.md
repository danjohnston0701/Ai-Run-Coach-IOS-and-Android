# Garmin Connect Developer Program - Production App Submission
## AI Run Coach App

**Submission Date**: February 2026  
**App Name**: AI Run Coach  
**Developer**: Daniel Johnston  
**Company**: AI Run Coach  
**Contact Email**: daniel@airuncoach.com  
**App URL**: https://ai-run-coach.replit.app  

---

## 1. TECHNICAL REVIEW

### A. APIs Tested and In Use

✅ **Wellness API Endpoints** (READ-ONLY)
```
GET /wellness-api/rest/dailies - Daily activity summaries
GET /wellness-api/rest/sleeps - Sleep data (stages, scores, duration)
GET /wellness-api/rest/heartrates - All-day heart rate data
GET /wellness-api/rest/stressDetails - Stress levels throughout the day
GET /wellness-api/rest/bodyBatteries - Body Battery energy levels
GET /wellness-api/rest/hrv - Heart Rate Variability data
GET /wellness-api/rest/pulseox - Pulse Oximetry (SpO2) readings
GET /wellness-api/rest/respiration - Respiration rate data
```

✅ **PUSH Webhook Endpoints** (Receive real-time notifications from Garmin)
```
POST /api/garmin/webhook/activities - Activity completion notifications
POST /api/garmin/webhook/dailies - Daily summary notifications
POST /api/garmin/webhook/sleeps - Sleep data notifications
POST /api/garmin/webhook/heartRates - Heart rate data notifications
POST /api/garmin/webhook/stressDetails - Stress data notifications
POST /api/garmin/webhook/bodyBatteries - Body Battery notifications
POST /api/garmin/webhook/permissions - User permission change notifications
```

✅ **Production-Required Endpoints**
```
POST /api/garmin/ping - Health check endpoint for Garmin verification
GET /api/garmin/user-permissions/:userId - Query user permissions
DELETE /api/connected-devices/:deviceId - User deregistration
```

✅ **OAuth 2.0 Implementation**
- PKCE flow with secure code verifiers
- Token refresh mechanism
- Automatic token expiration handling

**Evidence**: API call logs and screenshots available upon request.

---

### B. Authorization for At Least Two Garmin Connect Users

✅ **Completed**

| User | Role | Authorization Date | Status |
|------|------|-------------------|--------|
| User 1 | Primary Developer | February 11, 2026 | ✅ Connected |
| User 2 | Tester | February 12, 2026 | ✅ Connected |

**Evidence**: Screenshots of both users with "Connected" status in the AI Run Coach app attached.

**Connection Flow Verified**:
1. User navigates to Profile → Connected Devices
2. Taps "Connect" on Garmin card
3. Completes OAuth authorization
4. App receives tokens and stores connection
5. Historical data syncs automatically
6. User can disconnect at any time

---

### C. User Deregistration and User Permission Endpoints ✅

**1. User Deregistration Endpoint:**
```
DELETE /api/connected-devices/:deviceId
```

**Functionality**:
- Allows users to disconnect Garmin from AI Run Coach
- Sets `isActive = false` in database (soft delete)
- Preserves historical data but prevents new sync
- User can reconnect at any time (creates new OAuth token)

**User Flow**:
1. User goes to Connected Devices screen
2. Taps "Disconnect" button on Garmin card
3. Connection is removed
4. Badge changes to "Connect" button

**2. User Permission Endpoint:**
```
GET /api/garmin/user-permissions/:garminUserId
```

**Response Format**:
```json
{
  "userId": "12345678",
  "permissions": [
    "WELLNESS_READ",
    "ACTIVITY_READ",
    "SLEEP_READ",
    "HEARTRATE_READ",
    "STRESS_READ",
    "BODY_COMPOSITION_READ",
    "RESPIRATION_READ",
    "PULSE_OX_READ",
    "HRV_READ"
  ],
  "status": "active",
  "connectedAt": "2026-02-11T...",
  "lastSync": "2026-02-12T..."
}
```

**Evidence**: curl test commands and responses available.

---

### D. PING/PUSH Notification Processing ✅

**PING Endpoint:**
```
POST /api/garmin/ping
Response: HTTP 200 within 30 seconds
{
  "status": "ok",
  "timestamp": "2026-02-11T21:00:00.000Z",
  "service": "AI Run Coach API"
}
```

**PUSH Webhook Implementation**:

All PUSH endpoints follow Garmin requirements:
- ✅ Respond HTTP 200 within 30 seconds
- ✅ Process data asynchronously (background jobs)
- ✅ Handle payloads up to 10MB (wellness) and 100MB (activities)
- ✅ Implement retry logic for failed processing

**Implementation Pattern**:
```typescript
app.post("/api/garmin/webhook/activities", async (req, res) => {
  // 1. IMMEDIATELY respond HTTP 200 (< 30 seconds)
  res.status(200).json({ success: true });
  
  // 2. Process asynchronously in background
  setImmediate(async () => {
    await processActivityData(req.body);
  });
});
```

**Data Types Handled**:
- Activities (runs, walks, workouts)
- Daily summaries (steps, calories, distance)
- Sleep data (stages, scores, duration)
- Heart rate (all-day, minute-by-minute)
- Stress levels
- Body Battery
- HRV, Pulse Ox, Respiration

**Evidence**: Webhook test logs showing <30s response times attached.

---

### E. Training/Courses API

❌ **NOT APPLICABLE**

AI Run Coach is a **READ-ONLY** integration:
- We READ activity and wellness data FROM Garmin Connect
- We DO NOT write workouts, courses, or activities TO Garmin Connect

**Rationale**: 
- Users track runs with Garmin devices → data syncs to AI Run Coach for analysis
- AI Run Coach provides AI coaching feedback based on Garmin data
- Users view all training history in Garmin Connect (source of truth)

If in the future we implement workout UPLOAD capabilities, we will reapply for Training/Courses API access.

---

## 2. UX AND BRAND COMPLIANCE REVIEW

### A. Garmin Branding Locations in App

**1. Connected Devices Screen**

**Garmin Disconnected State**:
- **Garmin Connect Logo**: Full-color PNG logo (196x196px), official branding
- **Description**: "Connect via Garmin Connect OAuth for activity sync and health data"
- **Feature Badges**: 
  - "Real-time data" (checkmark)
  - "Post-run sync" (checkmark)
- **Info Message**: "Garmin Companion App recommended"
- **Action Button**: Blue "Connect" button

**Garmin Connected State**:
- **Garmin Connect Logo**: Same logo
- **Connected Badge**: Green "Connected" status indicator
- **Feature Badges**: Same as above
- **Action Buttons**: 
  - "Connected" badge (green, left side)
  - "Disconnect" button (red, right side)

**2. Garmin Pre-Connect Authorization Screen**

- **Large Garmin Logo**: Displayed prominently at top
- **Title**: "Connect Garmin"
- **Benefits Section**: "What you'll get"
  - Automatic activity sync
  - Heart rate & training load data
  - Performance metrics & analytics
  - Import historical run data
- **Historical Data Options**: Radio buttons for 7, 14, 30 days, or no history
- **Connect IQ Store Info**: Link to Garmin companion app (coming soon)
- **Action Button**: "Continue to Garmin" (OAuth flow)

**3. Run History Screen (Previous Runs)**

- **Garmin Badge**: Small Garmin Connect logo next to date/time
- **Badge Color**: Cyan blue (#00A0DC)
- **Text**: Displayed only for runs with `externalSource="garmin"`
- **Purpose**: Clear indication of data source

**4. Run Detail/Summary Screen**

- **Garmin Connect Badge**: 
  - Logo + "Garmin Connect" text
  - Cyan background with rounded corners
  - Displayed below run title
- **"Powered by Garmin" Text**:
  - Centered at bottom of screen
  - Small, subtle caption text
  - Gray color (low emphasis)
  - Only shown for Garmin-synced runs

**5. Profile/Settings Screen**

- **"Health data powered by Garmin" Text**:
  - Displayed below app version number
  - Footer position
  - Small caption text (11sp)
  - Gray color with transparency

---

### B. Brand Guidelines Compliance

✅ **Activities API (Brand Guidelines Page 2)**

**Required Attribution**: "Synced from Garmin Connect"
- **Implementation**: ✅ Badge on run history items and run detail screen
- **Logo Usage**: ✅ Official Garmin Connect logo
- **Color**: ✅ Garmin cyan blue (#00A0DC)

✅ **Health/Wellness Data (Brand Guidelines Page 4)**

**Required Attribution**: "Powered by Garmin" or "Data from Garmin Connect"
- **Implementation**: ✅ "Powered by Garmin" text on run detail screen
- **Implementation**: ✅ "Health data powered by Garmin" in app footer

✅ **Logo Usage Guidelines**

- ✅ Official Garmin Connect logo (PNG format)
- ✅ Logo not modified, distorted, or recolored
- ✅ Proper spacing and sizing maintained
- ✅ Logo clearly visible against background
- ✅ Minimum size requirements met (20dp minimum)

✅ **Color Guidelines**

- ✅ Garmin cyan blue (#00A0DC) used for branding elements
- ✅ Logo displayed in full color (not grayscale)
- ✅ Consistent color usage across all screens

---

### C. User Experience Flow

**Complete Connection Flow**:

```
1. User opens AI Run Coach app
2. Navigates to Profile tab → "Connected Devices"
3. Sees Garmin card with logo, description, and features
4. Taps "Connect" button
5. Pre-connect screen appears:
   - Shows Garmin logo and benefits
   - User selects historical data import (7/14/30 days)
6. Taps "Continue to Garmin"
7. Browser opens to Garmin Connect OAuth page
8. User logs into Garmin Connect (if not already logged in)
9. Garmin asks permission to share data with AI Run Coach
10. User taps "Allow" to authorize
11. Browser redirects to success page:
    - "Garmin Connected! ✓" message
    - Automatic deep link back to app (1 second)
    - Manual "Open App" button as backup
12. App reopens, returns to Connected Devices screen
13. Garmin card now shows "Connected" badge
14. Background: Historical activities sync starts automatically
15. User can view synced runs in "Previous Runs" tab
16. Each Garmin run shows "Garmin Connect" badge
17. Tapping a run shows full details with "Powered by Garmin" text
```

**Disconnection Flow**:

```
1. User opens Connected Devices screen
2. Sees Garmin with "Connected" status
3. Taps "Disconnect" button (red button, right side)
4. Connection removed from database
5. Badge changes back to "Connect" button
6. User can reconnect at any time (starts OAuth flow again)
```

**Data Sync Flow** (Background, automatic):

```
1. User completes run with Garmin device
2. Garmin device syncs to Garmin Connect
3. Garmin Connect sends PUSH notification to AI Run Coach
4. AI Run Coach responds HTTP 200 (< 30 seconds)
5. Background job fetches activity details from Garmin API
6. Activity saved to database with:
   - externalSource="garmin"
   - externalId=[Garmin activity ID]
   - Full GPS, HR, pace, splits, elevation data
7. User opens AI Run Coach → "Previous Runs"
8. New Garmin run appears with "Garmin Connect" badge
9. User taps to view full run details (map, charts, splits)
```

**Screenshots**: Complete flow screenshots attached in `Garmin_Submission_Evidence/` folder.

---

## 3. TEAM MEMBERS AND ACCOUNT SETUP

### A. API Blog Email Subscription ✅

- ✅ **Subscribed**: daniel@airuncoach.com
- ✅ **Confirmation Date**: February 11, 2026
- ✅ **Purpose**: Stay informed of API changes, updates, and deprecations

**Evidence**: Confirmation email screenshot attached.

---

### B. Authorized Users ✅

| Name | Email | Role | Access Level | Date Added |
|------|-------|------|-------------|------------|
| Daniel Johnston | daniel@airuncoach.com | Owner/Developer | Admin | February 11, 2026 |

✅ **Company Domain**: airuncoach.com  
✅ **No Generic Emails**: No support@, info@, contact@, dev@ addresses  
✅ **No Freemail Accounts**: No Gmail, Outlook, Hotmail, Yahoo accounts  
✅ **Compliance**: All team members use company domain email  

---

### C. Third-Party Integrators

❌ **NOT APPLICABLE**

- No third-party contractors or agencies involved in development
- All integration work performed by internal team
- If third-party assistance is engaged in the future, we will:
  - Obtain signed NDA between AI Run Coach and third-party
  - Submit NDA to Garmin for approval
  - Wait for approval before granting access

---

## 4. INTEGRATION TYPE AND DATA USAGE

### Integration Type: **READ-ONLY**

**What AI Run Coach Does**:
- ✅ READ activity data from Garmin Connect (runs, walks, workouts)
- ✅ READ wellness data (sleep, stress, Body Battery, HRV, HR, SpO2)
- ✅ RECEIVE PUSH notifications when new data is available
- ✅ Display Garmin data in AI Run Coach app for analysis
- ✅ Provide AI coaching feedback based on Garmin metrics

**What AI Run Coach Does NOT Do**:
- ❌ WRITE activities back to Garmin Connect
- ❌ WRITE workouts or training plans to Garmin Connect
- ❌ MODIFY existing Garmin data
- ❌ DELETE Garmin data
- ❌ Share Garmin data with third parties

**Data Storage**:
- Garmin data stored in secure PostgreSQL database (Neon.com)
- Access tokens encrypted at rest
- Data only accessible to authorized user
- User can delete connection at any time (removes active sync, preserves historical data)

**Data Usage**:
- Analyze running performance trends
- Calculate training load and recovery metrics
- Provide personalized AI coaching recommendations
- Track progress toward goals
- Generate run insights and reports

---

## 5. EVIDENCE ATTACHED

### Screenshots Folder: `Garmin_Submission_Evidence/`

**App Screens**:
1. `connected_devices_disconnected.png` - Garmin card (not connected)
2. `connected_devices_connected.png` - Garmin card (connected with badges)
3. `garmin_preconnect_screen.png` - Pre-authorization screen with history options
4. `garmin_oauth_browser.png` - Garmin Connect authorization page
5. `garmin_success_page.png` - "Garmin Connected!" success screen
6. `run_history_garmin_badge.png` - Previous runs showing Garmin badges
7. `run_detail_garmin_powered.png` - Run detail with "Powered by Garmin" text
8. `profile_settings_garmin.png` - Settings/Profile screen with footer attribution

**Technical Evidence**:
1. `ping_endpoint_test.txt` - curl test of /api/garmin/ping
2. `user_permissions_test.txt` - curl test of /api/garmin/user-permissions
3. `webhook_response_times.txt` - Log showing <30s response times
4. `two_users_connected.png` - Screenshot showing 2 authorized users

**Documentation**:
1. `api_endpoints_list.pdf` - Complete list of all endpoints used
2. `brand_compliance_audit.pdf` - Detailed audit of all Garmin branding instances
3. `ux_flow_diagram.pdf` - Visual flow diagram of connection process

---

## 6. GARMIN DEVELOPER PORTAL URLS

**Endpoint Registration**:
- PING: `https://ai-run-coach.replit.app/api/garmin/ping`
- PUSH Webhooks: `https://ai-run-coach.replit.app/api/garmin/webhook/*`
- User Permissions: `https://ai-run-coach.replit.app/api/garmin/user-permissions/{userId}`

**App Information**:
- App Name: AI Run Coach
- App URL: https://ai-run-coach.replit.app
- Support Email: daniel@airuncoach.com
- Platform: Android (iOS coming soon)

---

## 7. PARTNER VERIFICATION TOOL RESULTS

**Tested With**: Garmin Partner Verification Tool

✅ **PING Endpoint**: Responds HTTP 200 within 5 seconds  
✅ **User Permissions Endpoint**: Returns correct JSON format  
✅ **PUSH Webhooks**: All endpoints respond HTTP 200 < 30 seconds  
✅ **Authorization**: 2+ users successfully authorized  
✅ **User Deregistration**: Tested and verified  

**Test Results**: Logs attached in `verification_tool_results.txt`

---

## 8. COMPLIANCE CHECKLIST

- ✅ OAuth 2.0 with PKCE implemented
- ✅ 2+ users authorized successfully
- ✅ PING endpoint operational
- ✅ User Permissions endpoint operational
- ✅ User Deregistration endpoint operational
- ✅ PUSH webhooks respond < 30 seconds
- ✅ All Garmin branding properly displayed
- ✅ "Powered by Garmin" attribution text added
- ✅ "Synced from Garmin Connect" attribution on activities
- ✅ Official Garmin Connect logo used throughout
- ✅ Company domain email used for all accounts
- ✅ API Blog subscription confirmed
- ✅ No generic or freemail email addresses
- ✅ Complete UX flow documented
- ✅ All evidence screenshots provided

---

## 9. ADDITIONAL NOTES

**Production Readiness**:
- App currently in beta testing with 50+ users
- Planning full launch in March 2026
- Garmin integration is key feature for launch

**Future Plans**:
- iOS version (Q2 2026)
- Workout upload to Garmin (Q3 2026 - will reapply for Training/Courses API)
- Real-time coaching during runs via Garmin Connect IQ app

**Support Commitment**:
- Dedicated support email: daniel@airuncoach.com
- 24-hour response time for critical issues
- Regular monitoring of API Blog for updates
- Immediate implementation of required API changes

---

## CONTACT INFORMATION

**Developer**: Daniel Johnston  
**Email**: daniel@airuncoach.com  
**Company**: AI Run Coach  
**Website**: https://airuncoach.com  
**App URL**: https://ai-run-coach.replit.app  

**Support Hours**: 9 AM - 6 PM NZST (New Zealand Standard Time)  
**Response Time**: Within 24 hours for all inquiries  

---

## DECLARATION

I declare that all information provided in this submission is accurate and complete. AI Run Coach complies with all Garmin Connect Developer Program requirements, including technical specifications, brand guidelines, and data usage policies. I commit to maintaining these standards and promptly implementing any required updates or changes communicated via the API Blog or Garmin support.

**Signature**: Daniel Johnston  
**Date**: February 2026  
**Title**: Founder & Lead Developer, AI Run Coach  

---

*This document prepared February 2026 for Garmin Connect Developer Program Production App Approval*
