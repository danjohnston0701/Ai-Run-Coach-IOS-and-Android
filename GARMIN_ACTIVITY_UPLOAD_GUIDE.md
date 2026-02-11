# Garmin Activity Upload API - Two-Way Sync Implementation
## AI Run Coach → Garmin Connect Integration

**Implementation Date**: February 2026  
**Status**: ✅ IMPLEMENTED  
**Type**: READ + WRITE (Two-Way Sync)  

---

## Overview

AI Run Coach now supports **bi-directional sync** with Garmin Connect:

- ✅ **READ (Import)**: Activities from Garmin devices → AI Run Coach
- ✅ **WRITE (Upload)**: Activities from AI Run Coach app → Garmin Connect

This allows users to:
- Track runs with their Garmin watch → View in AI Run Coach with AI coaching
- Track runs in AI Run Coach app (phone GPS) → See in Garmin Connect

---

## Technical Implementation

### 1. TCX File Generation

Activities are converted to **TCX (Training Center XML)** format, Garmin's preferred format:

```typescript
generateTCXFile(runData):
  - Converts AI Run Coach run data to TCX XML
  - Includes GPS trackpoints (lat/long/altitude)
  - Includes heart rate data (if available)
  - Includes pace, distance, duration, calories
  - Adds "Uploaded from AI Run Coach" note
```

**TCX Format Includes**:
- Activity metadata (start time, duration, distance, calories)
- GPS track (array of latitude/longitude/altitude points)
- Heart rate data (average, max, per-trackpoint)
- Timestamp for each GPS point

---

### 2. Upload API Endpoint

**Endpoint**: `POST /api/garmin/upload-run`  
**Auth**: Required (user must be logged in)  
**Body**: `{ "runId": "uuid-of-run" }`  

**Workflow**:
```
1. Validate user owns the run
2. Check if run already uploaded (prevent duplicates)
3. Verify Garmin connection active
4. Refresh OAuth token if needed
5. Generate TCX file from run data
6. Upload to Garmin Upload API
7. Store Garmin activity ID in database
8. Mark run as uploaded_to_garmin = true
```

---

### 3. Database Schema Updates

**New columns in `runs` table**:

```sql
ALTER TABLE runs 
ADD COLUMN uploaded_to_garmin BOOLEAN DEFAULT FALSE,
ADD COLUMN garmin_activity_id VARCHAR(255);
```

**Purpose**:
- `uploaded_to_garmin`: Track which AI Run Coach runs have been synced to Garmin
- `garmin_activity_id`: Link to Garmin Connect activity for reference

**Indexes**:
```sql
CREATE INDEX idx_runs_uploaded_to_garmin ON runs(uploaded_to_garmin);
CREATE INDEX idx_runs_garmin_activity_id ON runs(garmin_activity_id);
```

---

### 4. Smart Duplicate Prevention

**Prevents uploading**:
- ✅ Runs already uploaded (checks `uploaded_to_garmin` flag)
- ✅ Runs that came FROM Garmin (checks `externalSource == 'garmin'`)
  - Don't upload Garmin-sourced runs back to Garmin (circular sync)

---

## API Documentation

### Upload Run to Garmin

**Request**:
```bash
POST /api/garmin/upload-run
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "runId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Run uploaded to Garmin Connect successfully",
  "garminActivityId": "12345678901"
}
```

**Already Uploaded (200)**:
```json
{
  "success": true,
  "message": "Run already uploaded to Garmin",
  "garminActivityId": "12345678901",
  "alreadyUploaded": true
}
```

**Error Responses**:

**400 - Missing runId**:
```json
{
  "error": "runId is required"
}
```

**400 - Garmin not connected**:
```json
{
  "error": "Garmin not connected. Please connect Garmin first."
}
```

**400 - Garmin-sourced run**:
```json
{
  "error": "Cannot upload Garmin-sourced runs back to Garmin"
}
```

**403 - Unauthorized**:
```json
{
  "error": "Unauthorized - run belongs to different user"
}
```

**404 - Run not found**:
```json
{
  "error": "Run not found"
}
```

**500 - Upload failed**:
```json
{
  "success": false,
  "error": "Upload failed: 401 Unauthorized"
}
```

---

## User Experience Flow

### Scenario 1: Sync Garmin Run to AI Run Coach (READ - Existing)

```
1. User completes run with Garmin watch
2. Watch syncs to Garmin Connect
3. Garmin sends PUSH notification to AI Run Coach
4. AI Run Coach fetches activity details
5. Activity saved with externalSource = "garmin"
6. Run appears in AI Run Coach with Garmin badge
7. User views full details with AI coaching insights
```

### Scenario 2: Sync AI Run Coach Run to Garmin (WRITE - NEW!)

```
1. User completes run in AI Run Coach app (phone GPS)
2. Run saved to AI Run Coach database
3. User opens run detail screen
4. Sees "Upload to Garmin Connect" button
5. Taps button → upload starts
6. Loading indicator shows "Uploading to Garmin..."
7. Success message: "Uploaded to Garmin Connect ✓"
8. Button changes to "View on Garmin" (disabled)
9. Run now appears in both:
   - AI Run Coach (original source)
   - Garmin Connect (synced copy)
```

---

## Android App Integration (TODO)

### 1. Add Upload Button to Run Detail Screen

**Location**: `RunSummaryScreen.kt`

**UI Element**:
```kotlin
// Add after "Powered by Garmin" text
if (runSession?.externalSource != "garmin" && 
    runSession?.uploadedToGarmin != true &&
    hasGarminConnected) {
    
    Button(
        onClick = { viewModel.uploadToGarmin(runId) },
        enabled = !isUploading
    ) {
        if (isUploading) {
            CircularProgressIndicator(size = 16.dp)
            Spacer(width = 8.dp)
            Text("Uploading to Garmin...")
        } else {
            Icon(painterResource(R.drawable.ic_garmin_logo))
            Spacer(width = 8.dp)
            Text("Upload to Garmin Connect")
        }
    }
}

// If already uploaded
if (runSession?.uploadedToGarmin == true) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(Color(0xFF00A0DC).copy(alpha = 0.1f))
            .padding(12.dp)
    ) {
        Icon(Icons.Default.CheckCircle, tint = Color(0xFF00A0DC))
        Spacer(width = 8.dp)
        Text(
            "Synced to Garmin Connect ✓",
            color = Color(0xFF00A0DC)
        )
    }
}
```

---

### 2. Add ViewModel Function

**Location**: `RunSummaryViewModel.kt`

```kotlin
fun uploadToGarmin(runId: String) {
    viewModelScope.launch {
        _isUploading.value = true
        
        try {
            val response = apiService.uploadRunToGarmin(runId)
            
            if (response.success) {
                _uploadStatus.value = "✓ Uploaded to Garmin Connect"
                _runSession.value = _runSession.value?.copy(
                    uploadedToGarmin = true,
                    garminActivityId = response.garminActivityId
                )
            } else {
                _uploadStatus.value = "Upload failed: ${response.error}"
            }
        } catch (e: Exception) {
            _uploadStatus.value = "Upload failed: ${e.message}"
        } finally {
            _isUploading.value = false
        }
    }
}
```

---

### 3. Add API Service Method

**Location**: `ApiService.kt`

```kotlin
data class UploadRunRequest(
    val runId: String
)

data class UploadRunResponse(
    val success: Boolean,
    val message: String? = null,
    val garminActivityId: String? = null,
    val error: String? = null,
    val alreadyUploaded: Boolean? = null
)

@POST("/api/garmin/upload-run")
suspend fun uploadRunToGarmin(@Body request: UploadRunRequest): UploadRunResponse
```

---

### 4. Update RunSession Model

**Add new fields**:
```kotlin
data class RunSession(
    // ... existing fields ...
    
    // Garmin sync (two-way)
    val externalSource: String? = null,       // "garmin" if from Garmin
    val externalId: String? = null,           // Garmin activity ID if imported
    val uploadedToGarmin: Boolean = false,    // TRUE if uploaded TO Garmin
    val garminActivityId: String? = null      // Garmin activity ID if uploaded
)
```

---

## Garmin Production Approval Requirements

### Activity Upload API Usage

**Required for**: Training/Courses API approval (separate from Wellness API)

**Garmin Brand Guidelines Compliance**:

1. ✅ **Attribution Required**: "Synced to Garmin Connect" badge
2. ✅ **Logo Usage**: Garmin Connect logo on upload button
3. ✅ **User Control**: Users can choose whether to upload
4. ✅ **No Forced Sync**: Upload is manual, not automatic

**Production Checklist**:

- ✅ TCX file generation implemented
- ✅ Upload endpoint implemented
- ✅ Duplicate prevention implemented
- ✅ Token refresh handling implemented
- ✅ Error handling implemented
- ⏳ Android UI implementation (TODO)
- ⏳ User testing with 2+ users (TODO)
- ⏳ Garmin verification tool testing (TODO)

---

## Testing Instructions

### 1. Deploy Backend to Replit

```bash
cd ~/workspace
git pull origin main
psql $DATABASE_URL -f db/migrations/add_garmin_upload_columns.sql
# Click "Republish" button
```

### 2. Test Upload API (curl)

```bash
# Get your JWT token from the app
JWT_TOKEN="your_jwt_token_here"

# Get a run ID (from AI Run Coach, not from Garmin)
RUN_ID="550e8400-e29b-41d4-a716-446655440000"

# Test upload
curl -X POST https://ai-run-coach.replit.app/api/garmin/upload-run \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"$RUN_ID\"}"

# Expected: {"success":true,"message":"Run uploaded to Garmin Connect successfully","garminActivityId":"12345678901"}
```

### 3. Verify in Garmin Connect

1. Open Garmin Connect app or website
2. Go to Activities
3. Look for activity with name "AI Run Coach - [date]"
4. Verify GPS track, heart rate, distance, duration match original

### 4. Test Duplicate Prevention

```bash
# Upload same run again
curl -X POST https://ai-run-coach.replit.app/api/garmin/upload-run \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"runId\":\"$RUN_ID\"}"

# Expected: {"success":true,"message":"Run already uploaded to Garmin","alreadyUploaded":true}
```

---

## Security & Privacy Considerations

### Data Flow Security

✅ **OAuth 2.0**: All uploads use OAuth 2.0 Bearer tokens  
✅ **User Authorization**: Users must explicitly grant upload permissions  
✅ **Data Validation**: TCX files validated before upload  
✅ **Error Handling**: Failures don't expose sensitive data  

### User Privacy

✅ **User Control**: Upload is manual (user-initiated)  
✅ **No Auto-Sync**: AI Run Coach runs NOT automatically uploaded  
✅ **Delete Support**: Users can delete from Garmin Connect directly  
✅ **Transparent**: Users see which runs are synced (badges/indicators)  

### Rate Limiting

⚠️ **Consideration**: Garmin may rate-limit upload requests  
✅ **Mitigation**: One upload per user action (no batch uploads)  
✅ **Retry Logic**: Fails gracefully with clear error messages  

---

## Benefits of Two-Way Sync

### For Users

1. **Unified History**: All runs in both apps (Garmin + AI Run Coach)
2. **Device Flexibility**: 
   - Garmin watch runs → AI Run Coach analysis
   - Phone GPS runs → Garmin Connect tracking
3. **Training Ecosystem**: Data accessible in entire Garmin ecosystem
4. **Backup**: Runs backed up in two places

### For AI Run Coach

1. **User Retention**: Users don't have to choose between apps
2. **Competitive Advantage**: Few running apps offer two-way Garmin sync
3. **Premium Feature**: Can be monetized in Pro tier
4. **Ecosystem Integration**: Positions AI Run Coach as Garmin-friendly

---

## Known Limitations

### 1. Garmin API Constraints

- **File Size**: TCX files must be < 10MB
- **Activity Type**: Only running activities supported (no cycling/swimming yet)
- **Upload Rate**: Unknown rate limits (may be throttled)

### 2. Data Fidelity

- **GPS Resolution**: May differ from native Garmin recording
- **Sensor Data**: Advanced running dynamics not available from phone GPS
- **Accuracy**: Phone GPS less accurate than dedicated Garmin device

### 3. Current Implementation

- **Manual Upload**: User must tap button (no auto-sync)
- **One-Way Initial**: Upload to Garmin, but edits in Garmin don't sync back
- **No Delete Sync**: Deleting from Garmin doesn't delete from AI Run Coach

---

## Future Enhancements (Roadmap)

### Phase 1 (Current - February 2026)
- ✅ Manual upload to Garmin Connect
- ✅ Duplicate prevention
- ✅ TCX file generation
- ⏳ Android UI implementation

### Phase 2 (Q2 2026)
- 🔮 Auto-upload option (user preference)
- 🔮 Batch upload (upload multiple runs at once)
- 🔮 Upload history log (show which runs uploaded when)
- 🔮 iOS implementation

### Phase 3 (Q3 2026)
- 🔮 Edit sync (edits in Garmin → update in AI Run Coach)
- 🔮 Delete sync (delete in Garmin → mark in AI Run Coach)
- 🔮 Conflict resolution (if run edited in both apps)

### Phase 4 (Q4 2026)
- 🔮 Support other activity types (cycling, walking, swimming)
- 🔮 Support FIT file format (more detailed than TCX)
- 🔮 Upload to other platforms (Strava, TrainingPeaks, etc.)

---

## Support & Troubleshooting

### Common Issues

**"Garmin not connected"**
- Solution: User must connect Garmin first in Connected Devices

**"Cannot upload Garmin-sourced runs back to Garmin"**
- Solution: This is intentional (prevents circular sync). Run already exists in Garmin.

**"Upload failed: 401 Unauthorized"**
- Solution: OAuth token expired. Backend auto-refreshes, but user may need to reconnect.

**"Upload failed: 413 Request Entity Too Large"**
- Solution: Run has too much GPS data (>10MB). Implement GPS point thinning.

**"Upload failed: 429 Too Many Requests"**
- Solution: Garmin rate limit hit. Wait and try again later.

---

## Contact & Support

**Developer**: Daniel Johnston  
**Email**: daniel@airuncoach.com  
**Documentation**: This file + `GARMIN_SUBMISSION_DOCUMENT.md`  

**Garmin Developer Support**: developer@garmin.com  
**Garmin API Blog**: https://developer.garmin.com/blog  

---

**Last Updated**: February 2026  
**Status**: Backend implementation complete, Android UI in progress  
**Next Steps**: 
1. Run database migration on Neon.com
2. Deploy to Replit
3. Implement Android UI
4. Test with 2+ users
5. Submit for Training/Courses API approval
