# AI Run Coach

## Overview

AI Run Coach is a mobile-first running and walking application built with Expo/React Native that provides personalized AI-powered coaching, intelligent route planning, and comprehensive performance tracking. The goal is to be the smartest running companion - like having a personal coach in your ear who knows the terrain, your fitness level, and adapts in real-time.

## User Preferences

Preferred communication style: Simple, everyday language.

## Core User Journey

### 1. Onboarding (ProfileSetup)
- User creates account (email/password)
- Enters profile: name, age, gender, height, weight
- Sets fitness level and running goals
- Configures AI coach voice preferences

### 2. Pre-Run Setup (Home Screen → PreRunScreen)
- Select activity type: Running or Walking
- Choose target distance (e.g., 5km, 10km)
- Select difficulty: Easy, Moderate, Hard
- Set target pace/time (optional)
- Enable/disable AI Coach voice
- Current location detected via GPS

### 3. Route Generation (RoutePreviewScreen) - CRITICAL
- AI generates 2-3 route options via POST /api/routes/generate-options
- Each route shows: map preview, distance, elevation, estimated time
- Routes are generated using Google Maps + OpenAI
- User selects preferred route
- Route includes turn-by-turn navigation

### 4. Active Run Session (RunSessionScreen)
- Real-time GPS tracking with map
- Live stats: distance, pace, time, elevation
- Turn-by-turn navigation with voice prompts
- AI Coach speaks encouragement and technique tips
- Phase-based coaching (warm-up → main → cooldown)
- Hill-aware coaching (detects inclines, adjusts advice)
- Weather-aware coaching (hydration, heat, wind tips)
- Session auto-saves every 5 seconds (never lose data)

### 5. Post-Run (RunInsightsScreen)
- Detailed performance summary
- Pace chart with km splits
- Elevation profile
- Map with GPS track
- AI-generated analysis and tips
- Social sharing (generates branded image)
- Save to history

### 6. Run History (HistoryScreen)
- View all past runs
- Filter by date range
- Sync local runs to cloud
- View detailed insights for any run

### 7. Events System (EventsScreen)
- Browse public events by country
- Events have schedules (weekly parkruns, one-time marathons)
- Join events and run the same route
- Admins create events from completed runs

### 8. Goals (GoalsScreen)
- Active/Completed/Abandoned tabs
- Set and track fitness goals
- Complete, abandon, or delete goals

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81, targeting iOS, Android, and web platforms
- **Navigation**: React Navigation v7 with a nested navigator pattern - a root stack containing a bottom tab navigator with five tabs (Home, History, Events, Goals, Profile), each containing its own stack navigator
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Styling**: React Native StyleSheet with a custom theme system supporting dark mode (default). Uses Reanimated for animations and expo-haptics for tactile feedback
- **Authentication**: Token-based auth stored in expo-secure-store (native) or localStorage (web), with a custom useAuth hook managing auth state

### Backend Connection
- **Production API**: https://airuncoach.live
- **CORS**: Enabled for mobile apps
- **Authentication**: Session-based with userId stored in AsyncStorage after login
- All API calls use JSON

### Project Structure
- `/client` - React Native/Expo frontend code with screens, components, hooks, and navigation
- `/server` - Express backend with routes and storage logic (proxy to production API)
- `/shared` - Shared schema definitions using Drizzle ORM and Zod validation
- `/assets` - App icons, splash screens, and static images

### Key Screens
- `LoginScreen.tsx` - Email/password authentication
- `HomeScreen.tsx` - Run configuration, distance/time selection
- `PreRunScreen.tsx` - Pre-run settings (activity type, AI coach, live tracking)
- `RoutePreviewScreen.tsx` - AI route generation and selection with map
- `RunSessionScreen.tsx` - Active run tracking with GPS
- `RunInsightsScreen.tsx` - Post-run analysis and stats
- `HistoryScreen.tsx` - Past runs list
- `EventsScreen.tsx` - Events by country with schedules
- `GoalsScreen.tsx` - Goal tracking with tabs
- `ProfileScreen.tsx` - User profile, friends, settings

### Key Design Patterns
- **Path Aliases**: `@/` maps to `./client`, `@shared/` maps to `./shared` for clean imports
- **Component Library**: Reusable themed components (Button, Card, Input, StatCard, etc.) with consistent styling
- **Error Handling**: ErrorBoundary component wrapping the app with customizable fallback UI
- **Platform Compatibility**: Components like KeyboardAwareScrollViewCompat handle platform differences between native and web

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile

### Routes
- `POST /api/routes/generate-options` - AI generates route candidates
- `POST /api/routes` - Save a route
- `GET /api/routes/user/:userId` - Get user's routes
- `GET /api/routes/:id` - Get single route

### Runs
- `POST /api/runs` - Save completed run
- `GET /api/runs/user/:userId` - Get user's runs
- `GET /api/runs/:id` - Get run details
- `POST /api/runs/:id/ai-insights` - Generate AI analysis

### Coaching
- `POST /api/ai/coach` - Get AI coaching message (enhanced with terrain/weather data)
- `POST /api/ai/tts` - Convert text to speech
- `POST /api/coaching-logs/:sessionKey` - Persist coaching log entries

### Events
- `GET /api/events/grouped` - Events by country
- `POST /api/events/from-run/:runId` - Create event (admin)

### Goals
- `GET /api/goals` - Get user's goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

## Data Models

### User
```typescript
{
  id, email, password, name,
  dob, gender, height, weight,
  fitnessLevel, runningExperience,
  weeklyGoalKm, preferredUnit,
  isAdmin, subscriptionStatus,
  coachName, coachGender, coachAccent, coachTone,
  distanceMinKm, distanceMaxKm
}
```

### Run
```typescript
{
  id, userId, routeId, eventId,
  distance, duration, avgPace,
  cadence, elevationGain, elevationLoss,
  difficulty, gpsTrack[], paceData[],
  weatherData, aiCoachEnabled,
  runDate, runTime
}
```

### RouteCandidate (from generate-options)
```typescript
{
  id: string;
  routeName: string;
  actualDistance: number;
  difficulty: string;
  waypoints: Array<{ lat: number; lng: number }>;
  polyline: string;  // Encoded polyline for map
  elevationGain: number;
  elevationLoss: number;
  estimatedTime: number;  // minutes
  turnInstructions: Array<{
    instruction: string;
    distance: number;
    maneuver: string;
    startLat: number;
    startLng: number;
  }>;
}
```

## UI/UX Theme
- **Primary Color**: Cyan (#00D4FF) - energetic, modern
- **Accent Color**: Orange (#FF6B35) - CTAs and highlights
- **Success**: Green (#00E676)
- **Warning**: Amber (#FFB300)
- **Error**: Red (#FF5252)
- **Background**: Dark blue-black (#0A0F1A)
- Dark theme optimized for outdoor visibility

## Native Features Required
- Background GPS tracking (expo-location)
- Audio playback for AI coach (expo-audio)
- Push notifications (expo-notifications)
- Offline data storage (AsyncStorage)
- Keep screen awake during run
- Haptic feedback (expo-haptics)

## Data Preservation (CRITICAL)
Run data must never be lost. The app implements:
- Auto-save every 5 seconds to local storage
- 12-hour session recovery for interrupted runs
- Offline-first with sync when online
- `dbSynced` flag tracks cloud sync status
- Manual sync option in Run History

## AI Coaching System (Advanced)

### Phase-Based Coaching
The AI coach uses different statements based on run progress:
- **Early phase** (<10% or <2km): Warm-up, posture, breathing tips. NEVER mention fatigue.
- **Mid phase** (40-50% or 3-5km): Rhythm, core engagement, form tips.
- **Late phase** (75-90%): Fatigue management, mental strength, pain acknowledgment.
- **Final phase** (90%+): Sprint, finish strong, empty the tank messages.
- **Generic**: Any time - general encouragement.

### Statement Repetition Limit
Each coaching statement can be used a maximum of 3 times per run to prevent repetitive advice.

### Hill-Aware Coaching
Triggers when grade >= 5% (uphill) or <= -5% (downhill):
- **Uphill**: "Lean into the hill, pump your arms", "Short quick steps"
- **Downhill**: "Control your descent", "Quick light steps"
- **Crest**: "Great climb! Settle back into your rhythm"

### Weather-Aware Coaching
Provides advice based on current weather conditions:
- Hot (>25°C): Hydration reminders, intensity reduction
- Cold (<5°C): Warm-up tips, extremity protection
- High humidity (>80%): Pace adjustment, cooling tips
- Windy (>25km/h): Posture tips, wind strategy
- Rain: Footing awareness, visibility tips

### Storage Keys (AsyncStorage)
```typescript
STORAGE_KEYS = {
  USER_ID: 'userId',
  USER_PROFILE: 'userProfile',
  ACTIVE_RUN_SESSION: 'activeRunSession',
  ACTIVE_ROUTE: 'activeRoute',
  RUN_HISTORY: 'runHistory',
  COACH_SETTINGS: 'coachSettings',
  LOCATION_PERMISSION: 'locationPermissionAsked'
}
```

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_DOMAIN` - Backend API endpoint
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` - For CORS configuration in Replit environment

## Recent Changes (January 2026)

### Route Preview Screen Improvements
- Map legend now shows Start (cyan) and difficulty-based finish markers (Easy=green, Moderate=yellow, Hard=red)
- Route polylines colored by difficulty level with dashed lines for hard/challenging routes
- Both route cards and fullscreen map use consistent difficulty-based coloring

### Run Session Screen Enhancements  
- Voice visualizer added to AI coach message display with animated bars and "AI COACH" label
- Navigation instructions reformatted to show "towards [street]" instead of "onto [street]"
- AI coaching triggers verified: phase-based (3 min intervals), hill-aware (5% grade), periodic API coaching (2 min), km milestones

### Technical Improvements
- MapViewCompat split into platform-specific files (.native.tsx and .web.tsx) for proper web fallback
- Profile photo storage switched from SecureStore to AsyncStorage to handle large base64 images

### Talk to Coach Feature
- Purple mic button in RunSessionScreen top bar (purple when idle, red pulsing when listening)
- Voice input via Web Speech API (web platform only, mobile shows toast to type instead)
- POST /api/ai/coaching endpoint for user questions with force priority (bypasses cooldowns)
- TTS response via expo-speech for coach answers
- Shows AI Coach avatar with message bubble during response

### Share Live Run Feature
- Share button (green when sharing, gray otherwise) to share active run with friends
- Friend selector modal showing friend list with toggle buttons (Invite/checkmark)
- Live session sync every 5 seconds during active runs via PUT /api/live-sessions/sync
- Invite notifications sent to selected friends via POST /api/live-sessions/:sessionId/invite-observer
- LiveRunViewerScreen for observers with 3-second polling, live map, and real-time stats
- Session ends automatically when run stops

### Advanced Coaching Features
- **Weakness Detection**: Monitors pace drops (75% slower than baseline) and provides encouraging coaching
- **Off-Route Detection**: Alerts when user deviates more than 50m from planned route with guidance to return
- **Weather-Aware Coaching**: Fetches current weather at run start and triggers coaching based on conditions (hot, cold, humid, windy, rain)
- **Pre-Run Summary**: Modal before starting run showing weather, terrain analysis, and personalized coach advice

### Coach Settings Screen
- CoachSettingsScreen for customizing AI coach voice preferences
- Configurable voice gender (Male/Female)
- Accent options: British, American, Australian, Irish, Scottish, New Zealand
- Tone settings: Energetic, Motivational, Instructive, Factual, Abrupt
- Settings saved to both AsyncStorage and server for offline/online support

### Run History Cloud Sync
- Cloud sync button in RunHistoryScreen header with badge showing unsynced run count
- Uploads local runs from AsyncStorage to server via POST /api/runs
- Marks runs as dbSynced after successful upload
- Success/error feedback with haptics

### API Routes Added
- GET/POST /api/weather/current and /api/weather/full - Weather data
- GET /api/geocode/reverse - Reverse geocoding
- POST /api/ai/run-summary - Pre-run briefing with weather and terrain
- GET/POST /api/runs/:id/analysis - Post-run AI analysis
- CRUD endpoints for group runs, friend requests, subscriptions, coupons, and push notifications
