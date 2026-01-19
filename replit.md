# AI Run Coach

## Overview
AI Run Coach is a mobile-first running and walking application built with Expo/React Native, designed to provide personalized AI-powered coaching, intelligent route planning, and comprehensive performance tracking. The project aims to be a smart, real-time adaptive running companion, offering a personal coach experience. Key capabilities include generating customized routes, providing live coaching during runs based on terrain and weather, and detailed post-run analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
The application is built with Expo SDK 54 and React Native 0.81, targeting iOS, Android, and web. It uses React Navigation v7 for navigation with a nested structure (root stack > bottom tab navigator > individual stack navigators per tab). State management leverages TanStack React Query for server state and React hooks for local state. Styling is handled with React Native StyleSheet, incorporating a custom theme system that supports dark mode. Animations are powered by Reanimated, and haptic feedback by expo-haptics. Authentication is token-based, stored securely.

### Backend Connection
The backend uses an Express server running on port 5000 that connects directly to a Neon PostgreSQL database (configured via EXTERNAL_DATABASE_URL). All API communication is JSON-based with JWT-based authentication for proper mobile support. JWT tokens are stored securely in expo-secure-store (mobile) or localStorage (web) and sent via Authorization Bearer headers. The mobile app uses EXPO_PUBLIC_DOMAIN:5000 for API requests.

### Project Structure
The project is organized into `/client` (React Native frontend), `/server` (Express backend proxy), `/shared` (shared schema definitions using Drizzle ORM and Zod), and `/assets` (static assets).

### Key Features and Design Patterns
- **User Journey**: Includes comprehensive onboarding, pre-run setup with activity and goal selection, AI-powered route generation with turn-by-turn navigation, real-time active run sessions with live stats and AI coaching, detailed post-run insights, run history, event browsing, and goal tracking.
- **AI Coaching System**: Provides phase-based coaching (warm-up, mid-run, late-run, final phase), hill-aware coaching (adjusts advice for inclines/declines), and weather-aware coaching (provides tips based on current weather conditions). It also includes weakness detection (for pace drops) and off-route detection.
- **Route Generation**: AI generates 2-3 route options using Google Maps and OpenAI, displaying map previews, distance, elevation, and estimated time. Routes include turn-by-turn navigation and are visually represented with a blue-to-green gradient for direction and difficulty-based coloring.
- **Data Preservation**: Implements critical data preservation mechanisms including auto-saving every 5 seconds to local storage, 12-hour session recovery for interrupted runs, and an offline-first approach with cloud synchronization.
- **Native Features**: Utilizes background GPS tracking, audio playback for AI coach, push notifications, offline data storage, screen wake lock, and haptic feedback.
- **UI/UX Theme**: Employs a dark theme optimized for outdoor visibility with a primary cyan (`#00D4FF`) color, accent orange (`#FF6B35`), and standard success/warning/error colors.
- **Advanced Coaching**: Features include user-initiated "Talk to Coach" for questions, share live run functionality for real-time tracking by friends, and a pre-run summary modal with weather and terrain analysis.
- **Customizable Coach Settings**: Users can customize AI coach voice preferences (gender, accent, tone) via a dedicated settings screen.
- **Real-time Database Sync**: Run progress is synced to the database every 30 seconds during active runs, with a final save on completion.
- **Cadence Detection**: Real-time steps-per-minute (SPM) tracking using device motion sensors (DeviceMotion from expo-sensors).
- **GPS Watchdog**: Monitors GPS signal health every 10 seconds with automatic recovery attempts (max 5 attempts).
- **Speech Queue**: Manages TTS messages with priority levels and duplicate prevention for smooth AI coach audio.
- **Navigation Engine**: Provides turn-by-turn navigation with waypoint protection and intelligent turn grouping.
- **Route Rating**: Users can rate routes (1-5 stars) after completing runs, with optional comments.
- **Post-Run AI Analysis**: Comprehensive run analysis including highlights, struggles, personal bests, improvement tips, and overall performance scores.
- **Smartwatch Integration**: Connected Devices screen supports Apple Watch, Samsung, Garmin, COROS, and Strava connections. Displays real-time heart rate during runs (simulated in Expo Go, real data requires development build). Heart rate data includes zone calculation (5 zones based on max HR) and is used in AI coaching prompts for zone-specific guidance.
- **Heart Rate Zones**: Zone 1 (0-60% max) Recovery, Zone 2 (60-70%) Aerobic, Zone 3 (70-80%) Tempo, Zone 4 (80-90%) Threshold, Zone 5 (90-100%) Maximum. Max HR calculated as 220 - age.

## Recent Changes (January 2026)
- **Garmin OAuth Integration**: Full OAuth 2.0 with PKCE authentication flow for Garmin Connect. Endpoints: `/api/auth/garmin` (initiate), `/api/auth/garmin/callback` (callback), `/api/garmin/sync` (sync activities), `/api/garmin/health-summary` (health data), `/api/garmin/import-activity` (import runs). Works in Expo Go via WebBrowser.openAuthSessionAsync.
- Garmin service (server/garmin-service.ts) supports: activity sync, health summaries, heart rate data, stress data, sleep data, running dynamics, VO2 max, training effect
- Updated ConnectedDevicesScreen to use real OAuth for Garmin (opens browser auth flow)
- Integrated core run utilities (speechQueue, cadenceDetector, gpsWatchdog, navigationEngine) into RunSessionScreen
- Added RouteRatingModal component that triggers after completing route-based runs
- Enhanced RunInsightsScreen with structured AI analysis display (highlights, struggles, PBs, improvement tips)
- Added navigation links to Profile screen for Subscription, NotificationCenter, GroupRuns, and UserSearch screens
- Implemented timestamp-based timer for accurate elapsed time tracking during runs
- Added proper cleanup of all run utilities on session stop/pause/close operations
- Fixed friends syncing by passing userId to the /api/friends endpoint
- Updated UserSearchScreen to display full name and user ID in search results
- Created NotificationSettingsScreen with granular push notification controls (all on/off, individual event toggles)
- Added Distance Scale settings in ProfileScreen (min/max km, decimals toggle with 30km max range limit)
- Added Push Notifications toggle with MANAGE button in ProfileScreen
- Enhanced error handling in ProfileScreen and UserSearchScreen for API calls
- Added detailed debug logging for friend request operations

## Known Limitations
- **Hot Module Reload during Development**: During development, Metro's hot module reload may reset component state when code changes are made. This is normal development behavior and does not affect the production experience.

## External Dependencies
- **Google Maps**: Used for route generation and mapping.
- **OpenAI**: Powers AI route generation and intelligent coaching.
- **Expo/React Native**: Core framework for mobile application development.
- **React Navigation**: Handles navigation within the application.
- **TanStack React Query**: Manages server state.
- **Drizzle ORM**: Used for shared schema definitions.
- **Zod**: Provides schema validation.
- **PostgreSQL**: Database solution.
- **expo-location**: For GPS tracking.
- **expo-audio**: For audio playback (AI coach voice).
- **expo-notifications**: For push notifications.
- **AsyncStorage / expo-secure-store**: For local data storage.
- **Web Speech API**: For voice input (web platform).
- **Express**: Backend server technology.