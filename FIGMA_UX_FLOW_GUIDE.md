# Garmin UX Flow Diagram Guide for Figma
## What Garmin Wants to See

---

## Overview

Garmin wants to see a **visual representation** of the user journey from discovering the Garmin integration to successfully connecting and using Garmin data in your app. This demonstrates:

1. **User Experience Quality** - How intuitive and smooth the connection process is
2. **Brand Compliance** - Where and how Garmin branding appears
3. **Data Flow** - How data moves between Garmin Connect and your app
4. **Error Handling** - What users see when things go wrong

---

## What Tools to Use

**Option 1: Figma** (Recommended)
- Free tier available
- Easy to use
- Professional-looking diagrams
- https://figma.com

**Option 2: Lucidchart**
- Free tier available
- Flowchart-focused
- Good for technical diagrams
- https://lucidchart.com

**Option 3: PowerPoint/Keynote**
- Already installed
- Simple and quick
- Can export as PDF
- Less professional appearance

**Option 4: Draw.io / Excalidraw**
- Free and open-source
- Quick and simple
- https://draw.io or https://excalidraw.com

---

## What to Create

You need **TWO diagrams**:

### 1. **CONNECTION FLOW DIAGRAM** (User Journey)
Shows step-by-step how a user connects Garmin to AI Run Coach

### 2. **DATA SYNC FLOW DIAGRAM** (Technical Flow)
Shows how data flows from Garmin devices → Garmin Connect → AI Run Coach

---

## Diagram 1: CONNECTION FLOW DIAGRAM

### What to Include:

**Format**: Linear flowchart (left-to-right or top-to-bottom)

**Elements Needed**:
1. **Screens** - Boxes/rectangles representing each app screen
2. **Actions** - Arrows showing user taps/clicks
3. **Decisions** - Diamond shapes for OAuth approval
4. **Branding** - Highlight where Garmin logo appears
5. **Annotations** - Brief explanations of what happens

### Step-by-Step Structure:

```
STEP 1: App Home Screen
├─ User Location: Dashboard or Profile tab
├─ Action: User taps "Profile"
└─ Garmin Branding: None visible yet

    ↓ (Arrow: "User taps Profile")

STEP 2: Profile Screen
├─ Screen: List of settings
├─ Element: "Connected Devices" menu item
├─ Action: User taps "Connected Devices"
└─ Garmin Branding: None visible yet

    ↓ (Arrow: "User taps Connected Devices")

STEP 3: Connected Devices Screen (Disconnected State)
├─ Screen: List of available device integrations
├─ Garmin Card Shows:
│   ├─ Garmin Connect logo (PNG, full color) 🔴 BRAND
│   ├─ Description text
│   ├─ Feature badges (Real-time data, Post-run sync)
│   └─ "Connect" button (blue)
├─ Action: User taps "Connect" button
└─ NOTE: This is where user first sees Garmin branding

    ↓ (Arrow: "User taps Connect")

STEP 4: Garmin Pre-Connect Screen
├─ Screen: Pre-authorization information
├─ Shows:
│   ├─ Large Garmin logo at top 🔴 BRAND
│   ├─ "What you'll get" benefits list
│   ├─ Historical data import options (7/14/30 days radio buttons)
│   └─ "Continue to Garmin" button
├─ Action: User selects history days and taps "Continue to Garmin"
└─ NOTE: User chooses how much historical data to import

    ↓ (Arrow: "User taps Continue to Garmin")

STEP 5: Garmin Connect OAuth (Browser)
├─ Screen: External browser opens
├─ Shows:
│   ├─ Garmin Connect website 🔴 BRAND
│   ├─ Login form (if not already logged in)
│   └─ Authorization prompt: "AI Run Coach wants to access..."
├─ Decision Point:
│   ├─ User taps "Allow" → Continue to Step 6
│   └─ User taps "Deny" → Return to Connected Devices (not connected)
└─ NOTE: This is Garmin's official OAuth page

    ↓ (Arrow: "User taps Allow")

STEP 6: Garmin Success Page (Browser)
├─ Screen: Success confirmation page
├─ Shows:
│   ├─ "Garmin Connected! ✓" message
│   ├─ Garmin logo 🔴 BRAND
│   ├─ "Opening AI Run Coach..." text
│   └─ "Open App" button (manual fallback)
├─ Action: Auto-redirect after 1 second OR user taps "Open App"
└─ NOTE: This page is on YOUR server (ai-run-coach.replit.app)

    ↓ (Arrow: "Auto deep-link OR user taps Open App")

STEP 7: Connected Devices Screen (Connected State)
├─ Screen: Returns to Connected Devices screen
├─ Garmin Card NOW Shows:
│   ├─ Garmin Connect logo 🔴 BRAND
│   ├─ Green "Connected" badge
│   ├─ Feature badges
│   └─ Red "Disconnect" button
├─ Background: Historical activity sync starts (user doesn't see this yet)
└─ NOTE: User sees confirmation of successful connection

    ↓ (Time passes, background sync completes)

STEP 8: Previous Runs Screen
├─ Screen: User navigates to "Previous Runs" tab
├─ Shows:
│   ├─ List of historical runs
│   ├─ Runs from Garmin have small Garmin Connect logo badge 🔴 BRAND
│   ├─ Badge color: Garmin cyan blue (#00A0DC)
│   └─ Other runs (recorded in AI Run Coach) have no badge
├─ Action: User taps on a Garmin-synced run
└─ NOTE: Clear distinction between Garmin data and native data

    ↓ (Arrow: "User taps on Garmin run")

STEP 9: Run Detail Screen
├─ Screen: Full run details (map, charts, splits)
├─ Shows:
│   ├─ Run title and date
│   ├─ "Garmin Connect" badge below title 🔴 BRAND
│   ├─ Distance, pace, time, calories, HR data
│   ├─ GPS map, heart rate chart, pace chart
│   ├─ Split-by-split breakdown
│   └─ "Powered by Garmin" text at bottom 🔴 BRAND
└─ NOTE: Full attribution as per brand guidelines

    ↓ (User Experience Complete)

END: User successfully connected Garmin and can view synced data
```

---

### Visual Design Tips for Diagram 1:

**Screen Boxes**:
- Use phone/device frame shapes if available
- Include mock screenshots (take actual screenshots from your app!)
- Label each box clearly: "Screen: Connected Devices"

**Arrows**:
- Use different colors for different action types:
  - Blue: User taps/clicks
  - Green: Successful flow
  - Red: Error/cancel flow
  - Gray: Auto-redirect

**Branding Highlights**:
- Add a 🔴 RED CIRCLE or star wherever Garmin logo appears
- Create a legend: "🔴 = Garmin Branding Visible"
- This makes it easy for reviewers to see brand compliance

**Annotations**:
- Add small text boxes with notes like:
  - "User sees Garmin Connect logo for first time"
  - "OAuth handled by Garmin (secure)"
  - "Historical data syncs in background"

**Layout**:
- **Top-to-bottom** works best for mobile app flows
- Use consistent spacing between steps
- Group related screens (e.g., OAuth screens together)

---

## Diagram 2: DATA SYNC FLOW DIAGRAM

### What to Include:

**Format**: Technical architecture diagram with swimlanes

**Swimlanes** (Horizontal sections):
1. **User's Garmin Device** (top)
2. **Garmin Connect Cloud** (middle-top)
3. **AI Run Coach Backend** (middle-bottom)
4. **AI Run Coach Mobile App** (bottom)

### Step-by-Step Structure:

```
SWIMLANE 1: User's Garmin Device
┌─────────────────────────────────────────────────────┐
│ [1] User completes run with Garmin watch           │
│     - GPS data recorded                             │
│     - Heart rate tracked                            │
│     - Pace, cadence, elevation captured             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [2] Watch syncs to Garmin Connect                  │
│     - Via Bluetooth to phone                        │
│     - Or via WiFi                                   │
│     - Data uploaded to Garmin servers               │
└─────────────────────────────────────────────────────┘

========================================================

SWIMLANE 2: Garmin Connect Cloud
                        ↓
┌─────────────────────────────────────────────────────┐
│ [3] Activity saved in Garmin Connect                │
│     - Full run data stored                          │
│     - Activity ID created: 12345678                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [4] Garmin sends PUSH notification                  │
│     - POST /api/garmin/webhook/activities           │
│     - Payload: { activityId, userId, dataType }     │
│     - Sent immediately after activity saved         │
└─────────────────────────────────────────────────────┘

========================================================

SWIMLANE 3: AI Run Coach Backend
                        ↓
┌─────────────────────────────────────────────────────┐
│ [5] Backend receives PUSH notification              │
│     - Responds HTTP 200 within 30 seconds           │
│     - Acknowledges receipt to Garmin                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [6] Background job starts processing                │
│     - Runs asynchronously (doesn't block response)  │
│     - Fetches activity details from Garmin API      │
│     - GET /wellness-api/rest/activities/{id}        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [7] Data saved to database                          │
│     - externalSource: "garmin"                      │
│     - externalId: 12345678                          │
│     - GPS, HR, pace, splits, elevation              │
└─────────────────────────────────────────────────────┘

========================================================

SWIMLANE 4: AI Run Coach Mobile App
                        ↓
┌─────────────────────────────────────────────────────┐
│ [8] User opens "Previous Runs" screen               │
│     - App fetches run list from backend             │
│     - GET /api/users/{userId}/runs                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [9] New Garmin run displayed                        │
│     - Shows "Garmin Connect" badge 🔴               │
│     - User taps to view details                     │
│     - Full data displayed with charts/map           │
└─────────────────────────────────────────────────────┘

END: User sees their Garmin run in AI Run Coach
```

---

### Visual Design Tips for Diagram 2:

**Swimlanes**:
- Use horizontal sections to separate systems
- Label each swimlane clearly
- Use different background colors for each lane

**API Calls**:
- Use **solid arrows** for API requests
- Use **dashed arrows** for API responses
- Label arrows with HTTP method and endpoint
- Example: "→ POST /api/garmin/webhook/activities"

**Data Flow**:
- Use **thick arrows** for large data transfers (activities, GPS)
- Use **thin arrows** for small data (notifications, confirmations)

**Timing Indicators**:
- Add time estimates where relevant:
  - "< 30 seconds" for PUSH response
  - "1-5 minutes" for background processing
  - "Immediate" for real-time updates

**Error Paths** (Optional but impressive):
- Add red dashed lines for error flows
- Show retry logic
- Example: "If token expired → Refresh token → Retry"

---

## Screenshot Checklist

Take screenshots of your app and include them IN the diagrams:

**Required Screenshots**:
1. ✅ Connected Devices (Garmin disconnected)
2. ✅ Connected Devices (Garmin connected)
3. ✅ Garmin pre-connect screen
4. ✅ Garmin OAuth page (browser)
5. ✅ Garmin success page (browser)
6. ✅ Run history with Garmin badges
7. ✅ Run detail with "Powered by Garmin"
8. ✅ Profile/Settings with footer attribution

**How to Add to Figma**:
1. Take screenshots on your phone
2. Email/AirDrop to your Mac
3. Drag images into Figma
4. Resize to fit in phone frame shapes
5. Add arrows and annotations

---

## Example Flow Diagram Structure in Figma

**Canvas Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  GARMIN CONNECTION FLOW - AI RUN COACH APP                  │
│  (Title at top)                                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Legend Box]                                                │
│  🔴 = Garmin Branding Visible                               │
│  ─> = User Action                                           │
│  ═> = Automatic Redirect                                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────┐     ┌────────┐     ┌────────┐                  │
│  │ Screen │ ──> │ Screen │ ──> │ Screen │                  │
│  │   1    │     │   2    │     │   3    │                  │
│  └────────┘     └────────┘     └────────┘                  │
│      │              │              │                         │
│  [Notes]       [Notes]       [Notes]                        │
│                                                               │
│     (Continue flow across or down)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Export Settings

**When you're done**:

1. **Figma**: File → Export → PDF
2. **Lucidchart**: Download → PDF
3. **PowerPoint**: Export → PDF
4. **Draw.io**: File → Export as → PDF

**Name your files**:
- `ux_flow_diagram_connection.pdf`
- `ux_flow_diagram_data_sync.pdf`

**Save to**: `~/Desktop/Garmin_Submission_Evidence/`

---

## Time Estimate

- **Simple version** (PowerPoint with screenshots): 1-2 hours
- **Professional version** (Figma with annotations): 3-4 hours
- **Advanced version** (Multi-page document with detailed flows): 5-6 hours

---

## What Garmin Reviewers Look For

✅ **Clarity**: Can they understand the flow in 30 seconds?  
✅ **Brand Compliance**: Is Garmin branding clearly marked?  
✅ **User-Friendly**: Does the flow seem intuitive and not confusing?  
✅ **Error Handling**: What happens if things go wrong?  
✅ **Attribution**: Where do users see "Powered by Garmin"?  
✅ **Data Security**: OAuth handled properly (not storing passwords)?  
✅ **User Control**: Can users disconnect easily?  

---

## Quick Start (Minimal Viable Diagram)

**If you're short on time, do this**:

1. Open PowerPoint/Keynote
2. Create 9 slides (one per step in Connection Flow above)
3. Add screenshots of each screen
4. Add arrows between slides showing user actions
5. Add red circles around Garmin logos
6. Export as PDF
7. Done!

This takes 1-2 hours and meets Garmin's requirements.

---

## Questions to Ask Yourself

As you create the diagrams, ask:

1. "Where does the user first see Garmin branding?" → Mark it clearly
2. "What happens if OAuth fails?" → Show error path
3. "How do users disconnect?" → Include disconnection flow
4. "Where is data coming from?" → Label API calls
5. "What does 'Powered by Garmin' mean?" → Annotate attribution

---

## Example Annotations to Add

**Good annotations**:
- "User sees Garmin Connect logo for the first time"
- "OAuth handled securely by Garmin (PKCE flow)"
- "Historical data syncs in background (30-60 seconds)"
- "Garmin badge indicates data source"
- "Attribution per brand guidelines page 2"
- "User can disconnect at any time"

**Bad annotations** (too technical):
- "JWT token stored in SharedPreferences encrypted with AES-256"
- "Coroutine dispatcher uses IO thread pool"
- "Room database with Flow observables"

Keep it **user-focused**, not code-focused!

---

## Final Checklist

Before submitting your UX flow diagrams:

- ✅ Both diagrams created (Connection Flow + Data Sync Flow)
- ✅ All 9 steps of connection flow shown
- ✅ Garmin branding marked with 🔴 red circles
- ✅ Screenshots embedded (not just described)
- ✅ Arrows show direction of flow
- ✅ Annotations explain key steps
- ✅ "Powered by Garmin" attribution shown
- ✅ Exported as PDF
- ✅ File saved in evidence folder
- ✅ File name is clear and professional

---

**You Got This!** 🎨

The UX flow diagrams are straightforward once you break them down step-by-step. Garmin just wants to see that:
1. You understand the user journey
2. You're using their branding correctly
3. The integration is smooth and intuitive

Focus on those three things and you'll be approved! 🚀
