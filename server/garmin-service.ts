import crypto from 'crypto';

const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID;
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET;

// Garmin OAuth 2.0 endpoints (PKCE flow)
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const GARMIN_API_BASE = 'https://apis.garmin.com';

// Store PKCE code verifiers temporarily (in production, use Redis or database)
const codeVerifiers = new Map<string, string>();

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate the Garmin OAuth authorization URL
 */
export function getGarminAuthUrl(redirectUri: string, state: string): string {
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store the code verifier for later token exchange
  codeVerifiers.set(state, codeVerifier);
  
  const params = new URLSearchParams({
    client_id: GARMIN_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    scope: 'activity:read activity:write health:read health:write',
  });
  
  return `${GARMIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeGarminCode(
  code: string,
  redirectUri: string,
  state: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  athleteId?: string;
}> {
  const codeVerifier = codeVerifiers.get(state);
  if (!codeVerifier) {
    throw new Error('Invalid state - PKCE code verifier not found');
  }
  
  // Clean up the code verifier
  codeVerifiers.delete(state);
  
  const tokenParams = {
    grant_type: 'authorization_code',
    code: code,
    client_id: GARMIN_CLIENT_ID!,
    client_secret: GARMIN_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  };
  
  console.log('=== GARMIN TOKEN EXCHANGE ===');
  console.log('Token URL:', GARMIN_TOKEN_URL);
  console.log('Redirect URI:', redirectUri);
  console.log('Code verifier length:', codeVerifier.length);
  console.log('Client ID present:', !!GARMIN_CLIENT_ID);
  console.log('Client Secret present:', !!GARMIN_CLIENT_SECRET);
  console.log('==============================');
  
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenParams),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Garmin token exchange failed:', errorText);
    throw new Error(`Failed to exchange Garmin code: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7776000, // Default 90 days
    athleteId: data.user_id,
  };
}

/**
 * Refresh Garmin access token
 */
export async function refreshGarminToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GARMIN_CLIENT_ID!,
      client_secret: GARMIN_CLIENT_SECRET!,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Garmin token refresh failed:', errorText);
    throw new Error(`Failed to refresh Garmin token: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 7776000,
  };
}

/**
 * Fetch user's recent activities from Garmin
 */
export async function getGarminActivities(
  accessToken: string,
  startTime?: Date,
  endTime?: Date
): Promise<any[]> {
  const params = new URLSearchParams();
  if (startTime) params.set('uploadStartTimeInSeconds', Math.floor(startTime.getTime() / 1000).toString());
  if (endTime) params.set('uploadEndTimeInSeconds', Math.floor(endTime.getTime() / 1000).toString());
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/activities?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin activities: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch detailed activity data including GPS and running dynamics
 */
export async function getGarminActivityDetail(
  accessToken: string,
  activityId: string
): Promise<any> {
  const response = await fetch(`${GARMIN_API_BASE}/activity-api/rest/activities/${activityId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin activity detail: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's daily health summary (steps, HR, sleep, stress)
 */
export async function getGarminDailySummary(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/dailies?uploadStartTimeInSeconds=${Math.floor(date.getTime() / 1000)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin daily summary: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's sleep data
 */
export async function getGarminSleepData(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startDate.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endDate.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/epochs?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin sleep data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's heart rate data
 */
export async function getGarminHeartRateData(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/allDayHeartRate?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin heart rate data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's stress data
 */
export async function getGarminStressData(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/stressDetails?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin stress data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch detailed sleep data with sleep stages
 */
export async function getGarminSleepDetails(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/sleeps?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin sleep details: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch Body Battery data
 */
export async function getGarminBodyBattery(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/bodyBattery?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin Body Battery: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch HRV (Heart Rate Variability) data
 */
export async function getGarminHRVData(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/hrv?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin HRV data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch Respiration data
 */
export async function getGarminRespirationData(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/respiration?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin respiration data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch Pulse Ox (SpO2) data
 */
export async function getGarminPulseOx(
  accessToken: string,
  date: Date
): Promise<any> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: Math.floor(startOfDay.getTime() / 1000).toString(),
    uploadEndTimeInSeconds: Math.floor(endOfDay.getTime() / 1000).toString(),
  });
  
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/pulseOx?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin Pulse Ox: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user stats including VO2 Max
 */
export async function getGarminUserStats(
  accessToken: string
): Promise<any> {
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/userStats`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin user stats: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch comprehensive wellness summary for a date range
 * Combines sleep, stress, Body Battery, HRV, and activity readiness
 */
export async function getGarminComprehensiveWellness(
  accessToken: string,
  date: Date
): Promise<{
  date: string;
  sleep: {
    totalSleepSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    sleepScore: number;
    sleepQuality: string;
  } | null;
  stress: {
    averageStressLevel: number;
    maxStressLevel: number;
    stressDuration: number;
    restDuration: number;
    activityDuration: number;
    stressQualifier: string;
  } | null;
  bodyBattery: {
    highestValue: number;
    lowestValue: number;
    currentValue: number;
    chargedValue: number;
    drainedValue: number;
  } | null;
  hrv: {
    weeklyAvg: number;
    lastNightAvg: number;
    lastNight5MinHigh: number;
    hrvStatus: string;
    feedbackPhrase: string;
  } | null;
  heartRate: {
    restingHeartRate: number;
    minHeartRate: number;
    maxHeartRate: number;
    averageHeartRate: number;
  } | null;
  readiness: {
    score: number;
    recommendation: string;
  };
}> {
  const dateStr = date.toISOString().split('T')[0];
  
  // Fetch all data in parallel
  const [sleepData, stressData, bodyBatteryData, hrvData, heartRateData] = await Promise.allSettled([
    getGarminSleepDetails(accessToken, date),
    getGarminStressData(accessToken, date),
    getGarminBodyBattery(accessToken, date),
    getGarminHRVData(accessToken, date),
    getGarminHeartRateData(accessToken, date),
  ]);
  
  // Parse sleep data
  let sleep = null;
  if (sleepData.status === 'fulfilled' && sleepData.value?.length > 0) {
    const s = sleepData.value[0];
    const totalSleep = s.durationInSeconds || 0;
    sleep = {
      totalSleepSeconds: totalSleep,
      deepSleepSeconds: s.deepSleepDurationInSeconds || 0,
      lightSleepSeconds: s.lightSleepDurationInSeconds || 0,
      remSleepSeconds: s.remSleepInSeconds || 0,
      awakeSleepSeconds: s.awakeDurationInSeconds || 0,
      sleepScore: s.sleepScores?.overall?.value || 0,
      sleepQuality: getSleepQuality(totalSleep / 3600),
    };
  }
  
  // Parse stress data
  let stress = null;
  if (stressData.status === 'fulfilled' && stressData.value?.length > 0) {
    const st = stressData.value[0];
    stress = {
      averageStressLevel: st.averageStressLevel || 0,
      maxStressLevel: st.maxStressLevel || 0,
      stressDuration: st.stressDuration || 0,
      restDuration: st.restDuration || 0,
      activityDuration: st.activityDuration || 0,
      stressQualifier: getStressQualifier(st.averageStressLevel || 0),
    };
  }
  
  // Parse Body Battery data
  let bodyBattery = null;
  if (bodyBatteryData.status === 'fulfilled' && bodyBatteryData.value?.length > 0) {
    const bb = bodyBatteryData.value[0];
    bodyBattery = {
      highestValue: bb.bodyBatteryHigh || 0,
      lowestValue: bb.bodyBatteryLow || 0,
      currentValue: bb.bodyBatteryMostRecentValue || 0,
      chargedValue: bb.bodyBatteryChargedValue || 0,
      drainedValue: bb.bodyBatteryDrainedValue || 0,
    };
  }
  
  // Parse HRV data
  let hrv = null;
  if (hrvData.status === 'fulfilled' && hrvData.value?.length > 0) {
    const h = hrvData.value[0];
    hrv = {
      weeklyAvg: h.weeklyAvg || 0,
      lastNightAvg: h.lastNightAvg || 0,
      lastNight5MinHigh: h.lastNight5MinHigh || 0,
      hrvStatus: h.status || 'unknown',
      feedbackPhrase: h.feedbackPhrase || '',
    };
  }
  
  // Parse heart rate data
  let heartRate = null;
  if (heartRateData.status === 'fulfilled' && heartRateData.value?.length > 0) {
    const hr = heartRateData.value[0];
    heartRate = {
      restingHeartRate: hr.restingHeartRate || 0,
      minHeartRate: hr.minHeartRate || 0,
      maxHeartRate: hr.maxHeartRate || 0,
      averageHeartRate: hr.averageHeartRate || 0,
    };
  }
  
  // Calculate overall readiness score
  const readiness = calculateReadinessScore(sleep, stress, bodyBattery, hrv);
  
  return {
    date: dateStr,
    sleep,
    stress,
    bodyBattery,
    hrv,
    heartRate,
    readiness,
  };
}

/**
 * Helper: Get sleep quality description
 */
function getSleepQuality(hours: number): string {
  if (hours >= 8) return 'Excellent';
  if (hours >= 7) return 'Good';
  if (hours >= 6) return 'Fair';
  if (hours >= 5) return 'Poor';
  return 'Very Poor';
}

/**
 * Helper: Get stress qualifier
 */
function getStressQualifier(level: number): string {
  if (level <= 25) return 'Resting';
  if (level <= 50) return 'Low';
  if (level <= 75) return 'Medium';
  return 'High';
}

/**
 * Helper: Calculate readiness score based on wellness metrics
 */
function calculateReadinessScore(
  sleep: any,
  stress: any,
  bodyBattery: any,
  hrv: any
): { score: number; recommendation: string } {
  let score = 50; // Base score
  let factors: string[] = [];
  
  // Sleep contribution (0-25 points)
  if (sleep) {
    const sleepHours = sleep.totalSleepSeconds / 3600;
    if (sleepHours >= 8) {
      score += 25;
    } else if (sleepHours >= 7) {
      score += 20;
    } else if (sleepHours >= 6) {
      score += 10;
    } else {
      factors.push('low sleep');
    }
  } else {
    factors.push('no sleep data');
  }
  
  // Stress contribution (0-15 points)
  if (stress) {
    if (stress.averageStressLevel <= 25) {
      score += 15;
    } else if (stress.averageStressLevel <= 50) {
      score += 10;
    } else if (stress.averageStressLevel > 75) {
      score -= 10;
      factors.push('high stress');
    }
  }
  
  // Body Battery contribution (0-10 points)
  if (bodyBattery) {
    if (bodyBattery.currentValue >= 75) {
      score += 10;
    } else if (bodyBattery.currentValue >= 50) {
      score += 5;
    } else if (bodyBattery.currentValue < 25) {
      score -= 5;
      factors.push('low energy');
    }
  }
  
  // HRV contribution
  if (hrv && hrv.hrvStatus === 'BALANCED') {
    score += 5;
  } else if (hrv && hrv.hrvStatus === 'LOW') {
    score -= 5;
    factors.push('HRV below baseline');
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Generate recommendation
  let recommendation: string;
  if (score >= 80) {
    recommendation = 'You are well-rested and ready for a challenging workout!';
  } else if (score >= 60) {
    recommendation = 'Good readiness for a moderate intensity run.';
  } else if (score >= 40) {
    recommendation = 'Consider a lighter recovery run today.';
  } else {
    recommendation = `Your body needs recovery. ${factors.length > 0 ? `Factors: ${factors.join(', ')}` : ''}`;
  }
  
  return { score, recommendation };
}

/**
 * Fetch user profile info
 */
export async function getGarminUserProfile(accessToken: string): Promise<any> {
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/user/id`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin user profile: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Parse activity data into our standard format
 */
export function parseGarminActivity(activity: any): {
  activityId: string;
  activityType: string;
  startTime: Date;
  duration: number;
  distance: number;
  calories: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  averagePace?: number;
  averageCadence?: number;
  elevationGain?: number;
  vo2Max?: number;
  trainingEffect?: number;
  recoveryTime?: number;
  polyline?: string;
  runningDynamics?: {
    verticalOscillation?: number;
    groundContactTime?: number;
    groundContactTimeBalance?: number;
    strideLength?: number;
    verticalRatio?: number;
  };
} {
  return {
    activityId: activity.activityId?.toString() || activity.summaryId?.toString(),
    activityType: activity.activityType || 'running',
    startTime: new Date(activity.startTimeInSeconds * 1000),
    duration: activity.durationInSeconds || 0,
    distance: (activity.distanceInMeters || 0) / 1000, // Convert to km
    calories: activity.activeKilocalories || activity.calories || 0,
    averageHeartRate: activity.averageHeartRateInBeatsPerMinute,
    maxHeartRate: activity.maxHeartRateInBeatsPerMinute,
    averagePace: activity.averageSpeedInMetersPerSecond 
      ? (1000 / activity.averageSpeedInMetersPerSecond / 60) // Convert to min/km
      : undefined,
    averageCadence: activity.averageRunCadenceInStepsPerMinute,
    elevationGain: activity.totalElevationGainInMeters,
    vo2Max: activity.vO2Max,
    trainingEffect: activity.trainingEffectLabel ? parseFloat(activity.trainingEffectLabel) : undefined,
    recoveryTime: activity.recoveryTimeInMinutes,
    polyline: activity.polyline,
    runningDynamics: activity.avgVerticalOscillation ? {
      verticalOscillation: activity.avgVerticalOscillation,
      groundContactTime: activity.avgGroundContactTime,
      groundContactTimeBalance: activity.avgGroundContactBalance,
      strideLength: activity.avgStrideLength,
      verticalRatio: activity.avgVerticalRatio,
    } : undefined,
  };
}

export default {
  getGarminAuthUrl,
  exchangeGarminCode,
  refreshGarminToken,
  getGarminActivities,
  getGarminActivityDetail,
  getGarminDailySummary,
  getGarminSleepData,
  getGarminSleepDetails,
  getGarminHeartRateData,
  getGarminStressData,
  getGarminBodyBattery,
  getGarminHRVData,
  getGarminRespirationData,
  getGarminPulseOx,
  getGarminUserStats,
  getGarminComprehensiveWellness,
  getGarminUserProfile,
  parseGarminActivity,
};
