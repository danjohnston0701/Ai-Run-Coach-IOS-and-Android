# Garmin Companion SDK Native Module

This module integrates the Garmin Health Companion SDK for real-time data streaming from Garmin devices during runs.

## Overview

The Garmin Companion SDK allows your app to receive live data streams from a paired Garmin watch while the user runs with their native Garmin Run app. This is the "Companion SDK + Health API" approach.

### Live Data During Runs (via Companion SDK)
- **Real-time heart rate** - Continuous HR streaming
- **Cadence** - Steps per minute
- **Step count** - Total steps during activity
- **Accelerometer** - Raw motion data for advanced analysis
- **Activity context** - Distance, pace, elapsed time from watch

### Historical Data (via Health API - already implemented)
- Sleep stages and quality scores
- Stress levels and Body Battery
- HRV (Heart Rate Variability)
- VO2 Max and training metrics
- Skin temperature

## Requirements

This module requires a **development build** - it is NOT compatible with Expo Go.

### Prerequisites
1. Expo SDK 54+
2. Xcode (for iOS) or Android Studio (for Android)
3. Garmin Developer account with Companion SDK access
4. Physical Garmin device with Companion SDK support

## Installation

### 1. Create Development Build

```bash
# iOS
npx expo run:ios

# Android  
npx expo run:android
```

### 2. Add Native Dependencies

The native code is located in:
- iOS: `ios/GarminCompanionSDK/`
- Android: `android/app/src/main/java/com/garmincompanionsdk/`

### 3. Configure Garmin SDK

**iOS (Info.plist):**
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Connect to your Garmin watch for real-time coaching</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
</array>
```

**Android (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
```

## Usage

### Basic Usage with Hook

```typescript
import { useGarminCompanion } from '@/modules/garmin-companion-sdk/useGarminCompanion';

function RunSessionScreen() {
  const {
    isAvailable,
    isConnected,
    heartRate,
    cadence,
    distance,
    pace,
    startDataStream,
    stopDataStream,
  } = useGarminCompanion({ 
    autoInitialize: true,
    autoStartStream: true,
  });

  if (!isAvailable) {
    return <Text>Garmin SDK requires development build</Text>;
  }

  return (
    <View>
      <Text>HR: {heartRate} bpm</Text>
      <Text>Cadence: {cadence} spm</Text>
      <Text>Distance: {(distance / 1000).toFixed(2)} km</Text>
      <Text>Pace: {formatPace(pace)}</Text>
    </View>
  );
}
```

### Manual Control

```typescript
import GarminCompanion from '@/modules/garmin-companion-sdk';

// Initialize
const success = await GarminCompanion.initialize();

// Scan for devices
await GarminCompanion.startScan();

// Connect
await GarminCompanion.connect(deviceId);

// Subscribe to heart rate
const unsubscribe = GarminCompanion.subscribeToHeartRate((event) => {
  console.log('HR:', event.heartRate);
});

// Cleanup
unsubscribe();
await GarminCompanion.disconnect();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Run Experience                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐          ┌──────────────────────────┐ │
│  │   Garmin Watch   │          │    AI Run Coach App      │ │
│  │                  │          │                          │ │
│  │  ┌────────────┐  │   BLE    │  ┌────────────────────┐  │ │
│  │  │ Native Run │  │ ◀──────▶ │  │ Companion SDK     │  │ │
│  │  │    App     │  │  Stream  │  │ (Real-time data)  │  │ │
│  │  └────────────┘  │          │  └─────────┬──────────┘  │ │
│  │                  │          │            │              │ │
│  │  Records full    │          │            ▼              │ │
│  │  activity data   │          │  ┌────────────────────┐  │ │
│  │                  │          │  │   AI Coach Engine   │  │ │
│  └──────────────────┘          │  │                    │  │ │
│           │                    │  │ - HR Zone coaching │  │ │
│           │                    │  │ - Cadence tips     │  │ │
│           ▼                    │  │ - Pace guidance    │  │ │
│  ┌──────────────────┐          │  └─────────┬──────────┘  │ │
│  │  Garmin Connect  │          │            │              │ │
│  │                  │          │            ▼              │ │
│  │  Full activity   │  OAuth   │  ┌────────────────────┐  │ │
│  │  data + wellness │ ◀──────▶ │  │  Health API Sync   │  │ │
│  │  metrics         │          │  │  (Historical data) │  │ │
│  └──────────────────┘          │  └────────────────────┘  │ │
│                                │                          │ │
└────────────────────────────────┴──────────────────────────┘ │
                                                              │
```

## Fallback Behavior

When running in Expo Go (development without native module):
- `isGarminCompanionAvailable()` returns `false`
- All subscription functions return no-op cleanup functions
- The app gracefully degrades to simulation mode

## Testing Without Hardware

For development/testing without a physical Garmin device:
1. Use the existing simulation mode in `RunSessionScreen`
2. Mock the Companion SDK events for UI testing
3. Test the Health API integration separately (already works in Expo Go)

## Supported Garmin Devices

The Companion SDK works with most recent Garmin watches:
- Forerunner series (245, 255, 265, 745, 945, 955, 965)
- Fenix series (6, 7)
- Enduro series
- Venu series
- vivoactive 4/5

Check Garmin's developer documentation for the complete compatibility list.

## Troubleshooting

### "Garmin SDK not available"
- You're running in Expo Go - create a development build

### Device not found during scan
- Ensure Bluetooth is enabled on phone
- Garmin watch must be in range and awake
- Check that Companion SDK is enabled on watch

### No heart rate data
- Start an activity on the Garmin watch first
- Ensure the watch has HR sensor enabled
- Check Bluetooth permissions in app settings
