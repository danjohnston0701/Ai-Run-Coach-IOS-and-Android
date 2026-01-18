# AI Run Coach

## Overview
AI Run Coach is a mobile-first running and walking application built with Expo/React Native, designed to provide personalized AI-powered coaching, intelligent route planning, and comprehensive performance tracking. The project aims to be a smart, real-time adaptive running companion, offering a personal coach experience. Key capabilities include generating customized routes, providing live coaching during runs based on terrain and weather, and detailed post-run analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
The application is built with Expo SDK 54 and React Native 0.81, targeting iOS, Android, and web. It uses React Navigation v7 for navigation with a nested structure (root stack > bottom tab navigator > individual stack navigators per tab). State management leverages TanStack React Query for server state and React hooks for local state. Styling is handled with React Native StyleSheet, incorporating a custom theme system that supports dark mode. Animations are powered by Reanimated, and haptic feedback by expo-haptics. Authentication is token-based, stored securely.

### Backend Connection
The production API is hosted at `https://airuncoach.live`. The backend uses an Express server to proxy requests to the production API. All API communication is JSON-based, and authentication is session-based, storing `userId` in `AsyncStorage` after login.

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