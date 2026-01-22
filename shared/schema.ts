import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  dob: text("dob"),
  gender: text("gender"),
  height: text("height"),
  weight: text("weight"),
  fitnessLevel: text("fitness_level"),
  desiredFitnessLevel: text("desired_fitness_level"),
  coachName: text("coach_name").default("AI Coach"),
  profilePic: text("profile_pic"),
  createdAt: timestamp("created_at").defaultNow(),
  isAdmin: boolean("is_admin").default(false),
  coachGender: text("coach_gender").default("male"),
  coachAccent: text("coach_accent").default("british"),
  coachTone: text("coach_tone").default("energetic"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionTier: text("subscription_tier"),
  subscriptionStatus: text("subscription_status"),
  entitlementType: text("entitlement_type"),
  entitlementExpiresAt: timestamp("entitlement_expires_at"),
  distanceMinKm: real("distance_min_km").default(0),
  distanceMaxKm: real("distance_max_km").default(50),
  distanceDecimalsEnabled: boolean("distance_decimals_enabled").default(false),
  userCode: text("user_code").unique(),
});

// Friends table
export const friends = pgTable("friends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  friendId: varchar("friend_id").notNull().references(() => users.id),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Friend Requests table
export const friendRequests = pgTable("friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Routes table
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name"),
  distance: real("distance").notNull(),
  difficulty: text("difficulty").notNull(),
  startLat: real("start_lat").notNull(),
  startLng: real("start_lng").notNull(),
  endLat: real("end_lat"),
  endLng: real("end_lng"),
  waypoints: jsonb("waypoints"),
  elevation: real("elevation"),
  estimatedTime: integer("estimated_time"),
  terrainType: text("terrain_type"),
  createdAt: timestamp("created_at").defaultNow(),
  polyline: text("polyline"),
  elevationGain: real("elevation_gain"),
  elevationLoss: real("elevation_loss"),
  elevationProfile: jsonb("elevation_profile"),
  startLocationLabel: text("start_location_label"),
  isFavorite: boolean("is_favorite").default(false),
  lastStartedAt: timestamp("last_started_at"),
  maxInclinePercent: real("max_incline_percent"),
  maxInclineDegrees: real("max_incline_degrees"),
  maxDeclinePercent: real("max_decline_percent"),
  maxDeclineDegrees: real("max_decline_degrees"),
  turnInstructions: jsonb("turn_instructions"),
  source: text("source").default("ai"),
  sourceRunId: varchar("source_run_id"),
});

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("parkrun"),
  country: text("country").notNull(),
  city: text("city"),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  distance: real("distance"),
  difficulty: text("difficulty").default("moderate"),
  startLat: real("start_lat"),
  startLng: real("start_lng"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  scheduleType: text("schedule_type").default("recurring"),
  specificDate: timestamp("specific_date"),
  recurrencePattern: text("recurrence_pattern"),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  sourceRunId: varchar("source_run_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
});

// Runs table
export const runs = pgTable("runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  routeId: varchar("route_id").references(() => routes.id),
  distance: real("distance").notNull(),
  duration: integer("duration").notNull(),
  avgPace: text("avg_pace"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  calories: integer("calories"),
  cadence: integer("cadence"),
  elevation: real("elevation"),
  difficulty: text("difficulty"),
  startLat: real("start_lat"),
  startLng: real("start_lng"),
  gpsTrack: jsonb("gps_track"),
  heartRateData: jsonb("heart_rate_data"),
  paceData: jsonb("pace_data"),
  aiInsights: text("ai_insights"),
  aiCoachingNotes: jsonb("ai_coaching_notes"),
  completedAt: timestamp("completed_at").defaultNow(),
  weatherData: jsonb("weather_data"),
  groupRunId: varchar("group_run_id"),
  name: text("name"),
  aiCoachEnabled: boolean("ai_coach_enabled"),
  runDate: text("run_date"),
  runTime: text("run_time"),
  elevationGain: real("elevation_gain"),
  elevationLoss: real("elevation_loss"),
  eventId: varchar("event_id").references(() => events.id),
});

// Goals table
export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  priority: integer("priority").default(1),
  targetDate: timestamp("target_date"),
  distanceTarget: text("distance_target"),
  timeTargetSeconds: integer("time_target_seconds"),
  healthTarget: text("health_target"),
  targetWeightKg: real("target_weight_kg"),
  startingWeightKg: real("starting_weight_kg"),
  weeklyRunTarget: integer("weekly_run_target"),
  monthlyDistanceTarget: real("monthly_distance_target"),
  eventName: text("event_name"),
  eventLocation: text("event_location"),
  notes: text("notes"),
  progressPercent: integer("progress_percent").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification Preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  friendRequest: boolean("friend_request").default(true),
  friendAccepted: boolean("friend_accepted").default(true),
  groupRunInvite: boolean("group_run_invite").default(true),
  groupRunStarting: boolean("group_run_starting").default(true),
  runCompleted: boolean("run_completed").default(false),
  weeklyProgress: boolean("weekly_progress").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  liveRunInvite: boolean("live_run_invite").default(true),
  liveObserverJoined: boolean("live_observer_joined").default(true),
});

// Live Run Sessions table
export const liveRunSessions = pgTable("live_run_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  routeId: varchar("route_id").references(() => routes.id),
  isActive: boolean("is_active").default(true),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
  currentPace: text("current_pace"),
  currentHeartRate: integer("current_heart_rate"),
  elapsedTime: integer("elapsed_time").default(0),
  distanceCovered: real("distance_covered").default(0),
  sharedWithFriends: boolean("shared_with_friends").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  sessionKey: text("session_key"),
  difficulty: text("difficulty"),
  cadence: integer("cadence"),
  gpsTrack: jsonb("gps_track"),
  kmSplits: jsonb("km_splits"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
});

// Group Runs table
export const groupRuns = pgTable("group_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hostUserId: varchar("host_user_id").notNull().references(() => users.id),
  routeId: varchar("route_id").references(() => routes.id),
  mode: text("mode").notNull().default("route"),
  title: text("title"),
  description: text("description"),
  targetDistance: real("target_distance"),
  targetPace: text("target_pace"),
  inviteToken: text("invite_token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  plannedStartAt: timestamp("planned_start_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Group Run Participants table
export const groupRunParticipants = pgTable("group_run_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupRunId: varchar("group_run_id").notNull().references(() => groupRuns.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("participant"),
  invitationStatus: text("invitation_status").notNull().default("pending"),
  runId: varchar("run_id").references(() => runs.id),
  joinedAt: timestamp("joined_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  inviteExpiresAt: timestamp("invite_expires_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  readyToStart: boolean("ready_to_start").default(false),
});

// Push Subscriptions table
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  userAgent: text("user_agent"),
  lastUsedAt: timestamp("last_used_at"),
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  isActive: boolean("is_active").default(true),
});

// Route Ratings table
export const routeRatings = pgTable("route_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  runId: varchar("run_id").references(() => runs.id),
  rating: integer("rating").notNull(),
  templateName: text("template_name"),
  backtrackRatio: real("backtrack_ratio"),
  routeDistance: real("route_distance"),
  startLat: real("start_lat"),
  startLng: real("start_lng"),
  polylineHash: text("polyline_hash"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Run Analyses table
export const runAnalyses = pgTable("run_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => runs.id),
  analysis: jsonb("analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupon Codes table
export const couponCodes = pgTable("coupon_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  value: integer("value"),
  durationDays: integer("duration_days"),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Coupons table
export const userCoupons = pgTable("user_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  couponId: varchar("coupon_id").notNull().references(() => couponCodes.id),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Garmin Wellness Metrics table (sleep, stress, Body Battery, HRV, etc.)
export const garminWellnessMetrics = pgTable("garmin_wellness_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD format
  
  // Sleep metrics
  totalSleepSeconds: integer("total_sleep_seconds"),
  deepSleepSeconds: integer("deep_sleep_seconds"),
  lightSleepSeconds: integer("light_sleep_seconds"),
  remSleepSeconds: integer("rem_sleep_seconds"),
  awakeSleepSeconds: integer("awake_sleep_seconds"),
  sleepScore: integer("sleep_score"),
  sleepQuality: text("sleep_quality"),
  sleepStartTimeGMT: text("sleep_start_time_gmt"),
  sleepEndTimeGMT: text("sleep_end_time_gmt"),
  sleepLevelsMap: jsonb("sleep_levels_map"), // Detailed sleep stages
  
  // Stress metrics
  averageStressLevel: integer("average_stress_level"),
  maxStressLevel: integer("max_stress_level"),
  stressDuration: integer("stress_duration"), // seconds
  restDuration: integer("rest_duration"), // seconds
  activityDuration: integer("activity_duration"), // seconds
  lowStressDuration: integer("low_stress_duration"), // seconds
  mediumStressDuration: integer("medium_stress_duration"), // seconds
  highStressDuration: integer("high_stress_duration"), // seconds
  stressQualifier: text("stress_qualifier"),
  
  // Body Battery metrics
  bodyBatteryHigh: integer("body_battery_high"),
  bodyBatteryLow: integer("body_battery_low"),
  bodyBatteryCurrent: integer("body_battery_current"),
  bodyBatteryCharged: integer("body_battery_charged"),
  bodyBatteryDrained: integer("body_battery_drained"),
  bodyBatteryVersion: real("body_battery_version"),
  
  // HRV metrics
  hrvWeeklyAvg: real("hrv_weekly_avg"),
  hrvLastNightAvg: real("hrv_last_night_avg"),
  hrvLastNight5MinHigh: real("hrv_last_night_5min_high"),
  hrvStatus: text("hrv_status"),
  hrvFeedback: text("hrv_feedback"),
  hrvBaselineLowUpper: real("hrv_baseline_low_upper"),
  hrvBaselineBalancedLower: real("hrv_baseline_balanced_lower"),
  hrvBaselineBalancedUpper: real("hrv_baseline_balanced_upper"),
  hrvStartTimeGMT: text("hrv_start_time_gmt"),
  hrvEndTimeGMT: text("hrv_end_time_gmt"),
  hrvReadings: jsonb("hrv_readings"), // Detailed HRV readings array
  
  // Heart rate metrics
  restingHeartRate: integer("resting_heart_rate"),
  minHeartRate: integer("min_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  averageHeartRate: integer("average_heart_rate"),
  heartRateTimeOffsetValues: jsonb("heart_rate_time_offset_values"), // Detailed HR data
  
  // Readiness
  readinessScore: integer("readiness_score"),
  readinessRecommendation: text("readiness_recommendation"),
  
  // Respiration metrics
  avgWakingRespirationValue: real("avg_waking_respiration_value"),
  highestRespirationValue: real("highest_respiration_value"),
  lowestRespirationValue: real("lowest_respiration_value"),
  avgSleepRespirationValue: real("avg_sleep_respiration_value"),
  
  // Pulse Ox metrics
  avgSpO2: real("avg_spo2"),
  minSpO2: real("min_spo2"),
  avgAltitude: real("avg_altitude"),
  onDemandReadings: jsonb("on_demand_readings"), // Manual SpO2 readings
  sleepSpO2Readings: jsonb("sleep_spo2_readings"), // Sleep SpO2 readings
  
  // Activity/Daily metrics
  steps: integer("steps"),
  distanceMeters: integer("distance_meters"),
  activeKilocalories: integer("active_kilocalories"),
  bmrKilocalories: integer("bmr_kilocalories"),
  floorsClimbed: integer("floors_climbed"),
  floorsDescended: integer("floors_descended"),
  moderateIntensityDuration: integer("moderate_intensity_duration"),
  vigorousIntensityDuration: integer("vigorous_intensity_duration"),
  intensityDuration: integer("intensity_duration"),
  sedentaryDuration: integer("sedentary_duration"),
  sleepingDuration: integer("sleeping_duration"),
  activeDuration: integer("active_duration"),
  
  // Raw data for debugging
  rawData: jsonb("raw_data"),
  
  syncedAt: timestamp("synced_at").defaultNow(),
});

// Garmin Activities table (stores full activity data from Garmin)
export const garminActivities = pgTable("garmin_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  runId: varchar("run_id").references(() => runs.id), // Link to our runs table
  garminActivityId: text("garmin_activity_id").notNull().unique(),
  
  // Basic activity info
  activityName: text("activity_name"),
  activityType: text("activity_type"), // running, walking, cycling, etc.
  eventType: text("event_type"), // race, workout, training, etc.
  startTimeInSeconds: integer("start_time_in_seconds"),
  startTimeOffsetInSeconds: integer("start_time_offset_in_seconds"),
  durationInSeconds: integer("duration_in_seconds"),
  distanceInMeters: real("distance_in_meters"),
  
  // Heart rate data
  averageHeartRateInBeatsPerMinute: integer("average_heart_rate"),
  maxHeartRateInBeatsPerMinute: integer("max_heart_rate"),
  heartRateZones: jsonb("heart_rate_zones"), // Zone breakdown
  
  // Pace/Speed data
  averageSpeedInMetersPerSecond: real("average_speed"),
  maxSpeedInMetersPerSecond: real("max_speed"),
  averagePaceInMinutesPerKilometer: real("average_pace"),
  
  // Power data (for running power)
  averagePowerInWatts: real("average_power"),
  maxPowerInWatts: real("max_power"),
  normalizedPowerInWatts: real("normalized_power"),
  
  // Running dynamics
  averageRunCadenceInStepsPerMinute: real("average_cadence"),
  maxRunCadenceInStepsPerMinute: real("max_cadence"),
  averageStrideLength: real("average_stride_length"),
  groundContactTime: real("ground_contact_time"), // ms
  groundContactBalance: real("ground_contact_balance"), // %
  verticalOscillation: real("vertical_oscillation"), // cm
  verticalRatio: real("vertical_ratio"), // %
  
  // Elevation data
  startLatitude: real("start_latitude"),
  startLongitude: real("start_longitude"),
  totalElevationGainInMeters: real("elevation_gain"),
  totalElevationLossInMeters: real("elevation_loss"),
  minElevationInMeters: real("min_elevation"),
  maxElevationInMeters: real("max_elevation"),
  
  // Calories
  activeKilocalories: integer("active_kilocalories"),
  deviceActivateKilocalories: integer("device_active_kilocalories"),
  bmrKilocalories: integer("bmr_kilocalories"),
  
  // Training effect
  aerobicTrainingEffect: real("aerobic_training_effect"), // 1.0 - 5.0
  anaerobicTrainingEffect: real("anaerobic_training_effect"), // 1.0 - 5.0
  trainingEffectLabel: text("training_effect_label"),
  
  // Recovery
  vo2Max: real("vo2_max"),
  lactateThresholdBpm: integer("lactate_threshold_bpm"),
  lactateThresholdSpeed: real("lactate_threshold_speed"),
  recoveryTimeInMinutes: integer("recovery_time"),
  
  // Laps and splits
  laps: jsonb("laps"), // Array of lap data
  splits: jsonb("splits"), // km/mile splits
  samples: jsonb("samples"), // Time series data (GPS, HR, pace, etc.)
  
  // Environmental
  averageTemperature: real("average_temperature"),
  minTemperature: real("min_temperature"),
  maxTemperature: real("max_temperature"),
  
  // Device info
  deviceName: text("device_name"),
  
  // Full raw data
  rawData: jsonb("raw_data"),
  
  // Metadata
  isProcessed: boolean("is_processed").default(false),
  aiAnalysisGenerated: boolean("ai_analysis_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Garmin Body Composition table
export const garminBodyComposition = pgTable("garmin_body_composition", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  measurementTimeInSeconds: integer("measurement_time_in_seconds"),
  measurementDate: text("measurement_date"), // YYYY-MM-DD
  
  weightInGrams: integer("weight_in_grams"),
  bmi: real("bmi"),
  bodyFatPercentage: real("body_fat_percentage"),
  bodyWaterPercentage: real("body_water_percentage"),
  boneMassInGrams: integer("bone_mass_in_grams"),
  muscleMassInGrams: integer("muscle_mass_in_grams"),
  physiqueRating: integer("physique_rating"),
  visceralFatRating: integer("visceral_fat_rating"),
  metabolicAge: integer("metabolic_age"),
  
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Device Data table (for Garmin, Samsung, Apple, Coros, Strava data)
export const deviceData = pgTable("device_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  runId: varchar("run_id").references(() => runs.id),
  deviceType: text("device_type").notNull(), // 'garmin' | 'samsung' | 'apple' | 'coros' | 'strava'
  activityId: text("activity_id"), // External activity ID from device
  heartRateZones: jsonb("heart_rate_zones"), // Zone breakdown { zone1Minutes, zone2Minutes, etc }
  vo2Max: real("vo2_max"), // Fitness level metric
  trainingEffect: real("training_effect"), // 1.0 - 5.0
  recoveryTime: integer("recovery_time"), // Hours until recovered
  stressLevel: integer("stress_level"), // 0-100
  bodyBattery: integer("body_battery"), // 0-100
  restingHeartRate: integer("resting_heart_rate"),
  caloriesBurned: integer("calories_burned"),
  rawData: jsonb("raw_data"), // Full device response for debugging
  syncedAt: timestamp("synced_at").defaultNow(),
});

// Connected Devices table
export const connectedDevices = pgTable("connected_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  deviceType: text("device_type").notNull(), // 'garmin' | 'samsung' | 'apple' | 'coros' | 'strava'
  deviceName: text("device_name"),
  deviceId: text("device_id"), // External device/athlete ID
  accessToken: text("access_token"), // Encrypted OAuth token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  tokenExpiresAt: timestamp("token_expires_at"),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Garmin Companion Real-time Data table
export const garminRealtimeData = pgTable("garmin_realtime_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  runId: varchar("run_id").references(() => runs.id),
  sessionId: text("session_id").notNull(), // Companion app session ID
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Heart Rate
  heartRate: integer("heart_rate"), // bpm
  heartRateZone: integer("heart_rate_zone"), // 1-5
  
  // Location & Movement
  latitude: real("latitude"),
  longitude: real("longitude"),
  altitude: real("altitude"), // meters
  speed: real("speed"), // m/s
  pace: real("pace"), // seconds per km
  
  // Running Dynamics (from Garmin HRM-Pro or watch)
  cadence: integer("cadence"), // steps per minute
  strideLength: real("stride_length"), // meters
  groundContactTime: real("ground_contact_time"), // milliseconds
  groundContactBalance: real("ground_contact_balance"), // percentage left/right
  verticalOscillation: real("vertical_oscillation"), // centimeters
  verticalRatio: real("vertical_ratio"), // percentage
  
  // Power & Performance (if available)
  power: integer("power"), // watts
  
  // Environmental
  temperature: real("temperature"), // celsius
  
  // Activity Status
  activityType: text("activity_type"), // running, walking, cycling
  isMoving: boolean("is_moving").default(true),
  isPaused: boolean("is_paused").default(false),
  
  // Cumulative stats at this point
  cumulativeDistance: real("cumulative_distance"), // meters
  cumulativeAscent: real("cumulative_ascent"), // meters
  cumulativeDescent: real("cumulative_descent"), // meters
  elapsedTime: integer("elapsed_time"), // seconds
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Garmin Companion Sessions table
export const garminCompanionSessions = pgTable("garmin_companion_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  runId: varchar("run_id").references(() => runs.id),
  sessionId: text("session_id").notNull().unique(), // Unique session identifier from companion app
  deviceId: text("device_id"), // Garmin device ID/serial
  deviceModel: text("device_model"), // e.g., "Forerunner 965"
  activityType: text("activity_type").default("running"),
  status: text("status").notNull().default("active"), // active, paused, completed, abandoned
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  lastDataAt: timestamp("last_data_at"),
  dataPointCount: integer("data_point_count").default(0),
  
  // Session summary (populated on end)
  totalDistance: real("total_distance"),
  totalDuration: integer("total_duration"), // seconds
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  avgCadence: integer("avg_cadence"),
  avgPace: real("avg_pace"),
  totalAscent: real("total_ascent"),
  totalDescent: real("total_descent"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertRunSchema = createInsertSchema(runs).omit({ id: true, completedAt: true });
export const insertRouteSchema = createInsertSchema(routes).omit({ id: true, createdAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFriendSchema = createInsertSchema(friends).omit({ id: true, createdAt: true });
export const insertFriendRequestSchema = createInsertSchema(friendRequests).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Run = typeof runs.$inferSelect;
export type InsertRun = z.infer<typeof insertRunSchema>;
export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Friend = typeof friends.$inferSelect;
export type InsertFriend = z.infer<typeof insertFriendSchema>;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type LiveRunSession = typeof liveRunSessions.$inferSelect;
export type GroupRun = typeof groupRuns.$inferSelect;
export type GroupRunParticipant = typeof groupRunParticipants.$inferSelect;
export type Event = typeof events.$inferSelect;
export type RouteRating = typeof routeRatings.$inferSelect;
export type RunAnalysis = typeof runAnalyses.$inferSelect;
export type DeviceData = typeof deviceData.$inferSelect;
export type ConnectedDevice = typeof connectedDevices.$inferSelect;
export type GarminWellnessMetric = typeof garminWellnessMetrics.$inferSelect;
export type GarminActivity = typeof garminActivities.$inferSelect;
export type GarminBodyComposition = typeof garminBodyComposition.$inferSelect;
export type GarminRealtimeData = typeof garminRealtimeData.$inferSelect;
export type GarminCompanionSession = typeof garminCompanionSessions.$inferSelect;
