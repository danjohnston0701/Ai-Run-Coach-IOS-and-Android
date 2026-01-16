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
- `POST /api/ai/coach` - Get AI coaching message
- `POST /api/ai/tts` - Convert text to speech

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

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_DOMAIN` - Backend API endpoint
- `REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` - For CORS configuration in Replit environment
