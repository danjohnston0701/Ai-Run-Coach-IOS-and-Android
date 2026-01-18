// API Response Types for AI Run Coach

export interface User {
  id: string;
  userCode?: string;
  email: string;
  name: string;
  dob?: string;
  gender?: string;
  height?: string;
  weight?: string;
  fitnessLevel?: string;
  desiredFitnessLevel?: string;
  coachName?: string;
  coachGender?: string;
  coachAccent?: string;
  coachTone?: string;
  profilePic?: string;
  distanceMinKm?: number;
  distanceMaxKm?: number;
  distanceDecimalsEnabled?: boolean;
  isAdmin?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  entitlementType?: string;
  entitlementExpiresAt?: string;
  createdAt?: string;
}

export interface Route {
  id: string;
  userId?: string;
  name?: string;
  distance: number;
  difficulty: string;
  startLat: number;
  startLng: number;
  endLat?: number;
  endLng?: number;
  waypoints?: Array<{ lat: number; lng: number }>;
  polyline?: string;
  elevation?: number;
  elevationGain?: number;
  elevationLoss?: number;
  elevationProfile?: Array<{ distance: number; elevation: number }>;
  maxInclinePercent?: number;
  maxInclineDegrees?: number;
  maxDeclinePercent?: number;
  maxDeclineDegrees?: number;
  estimatedTime?: number;
  terrainType?: string;
  startLocationLabel?: string;
  turnInstructions?: Array<{ instruction: string; distance: number }>;
  isFavorite?: boolean;
  lastStartedAt?: string;
  createdAt?: string;
  source?: string;
  sourceRunId?: string;
}

export interface RunAnalysis {
  highlights: string[];
  struggles: string[];
  personalBests?: Array<{
    type: string;
    value: string;
    description: string;
  }>;
  improvementTips: string[];
  nextRunSuggestions?: string;
  overallScore?: number; // 1-100
  effortLevel?: string; // easy, moderate, hard, max
}

export interface Run {
  id: string;
  userId: string;
  routeId?: string;
  eventId?: string;
  groupRunId?: string;
  name?: string;
  distance: number;
  duration: number;
  runDate?: string;
  runTime?: string;
  avgPace?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  cadence?: number;
  elevation?: number;
  elevationGain?: number;
  elevationLoss?: number;
  difficulty?: string;
  startLat?: number;
  startLng?: number;
  gpsTrack?: Array<{ lat: number; lng: number; timestamp: number; elevation?: number }>;
  heartRateData?: Array<{ timestamp: number; value: number }>;
  paceData?: Array<{ km: number; pace: string; paceSeconds: number }>;
  weatherData?: {
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    conditions?: string;
  };
  aiInsights?: string;
  aiAnalysis?: RunAnalysis;
  aiCoachingNotes?: Array<{ time: number; message: string }>;
  aiCoachEnabled?: boolean;
  completedAt?: string;
  targetTime?: number;
  targetTimeAnalysis?: string;
}

export interface Event {
  id: string;
  name: string;
  country: string;
  city?: string;
  description?: string;
  eventType?: string;
  routeId: string;
  sourceRunId?: string;
  createdByUserId: string;
  scheduleType?: string;
  specificDate?: string;
  recurrencePattern?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  isActive?: boolean;
  createdAt?: string;
  route?: Route;
}

export interface Goal {
  id: string;
  userId: string;
  type: string;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  targetDate?: string;
  distanceTarget?: string;
  timeTargetSeconds?: number;
  healthTarget?: string;
  targetWeightKg?: number;
  startingWeightKg?: number;
  weeklyRunTarget?: number;
  monthlyDistanceTarget?: number;
  eventName?: string;
  eventLocation?: string;
  notes?: string;
  progressPercent?: number;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveRunSession {
  id: string;
  sessionKey?: string;
  userId: string;
  routeId?: string;
  isActive?: boolean;
  currentLat?: number;
  currentLng?: number;
  currentPace?: string;
  currentHeartRate?: number;
  elapsedTime?: number;
  distanceCovered?: number;
  difficulty?: string;
  cadence?: number;
  gpsTrack?: Array<{ lat: number; lng: number; timestamp: number }>;
  kmSplits?: Array<{ km: number; time: number; pace: string }>;
  sharedWithFriends?: boolean;
  startedAt?: string;
  lastSyncedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read?: boolean;
  data?: Record<string, unknown>;
  createdAt?: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection?: string;
  conditions: string;
  uvIndex?: number;
  precipitation?: number;
}

// Utility types
export type Difficulty = 'easy' | 'moderate' | 'challenging' | 'hard' | 'extreme';

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  elevation?: number;
  accuracy?: number;
}

export interface KmSplit {
  km: number;
  time: number;
  pace: string;
  paceSeconds: number;
  elevationChange?: number;
}
