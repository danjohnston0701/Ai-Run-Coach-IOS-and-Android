import crypto from 'crypto';

const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID;
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET;

// Garmin OAuth 2.0 endpoints (PKCE flow)
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
// Use Garmin Connect API for personal user data, not Health API
const GARMIN_CONNECT_API = 'https://connect.garmin.com/modern/proxy';

// Import database for PKCE storage
import { db } from './db';
import { sql } from 'drizzle-orm';

// Store PKCE code verifiers in database (survives server restarts)
async function storeCodeVerifier(nonce: string, verifier: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO oauth_state (nonce, code_verifier, created_at)
      VALUES (${nonce}, ${verifier}, NOW())
      ON CONFLICT (nonce) DO UPDATE SET code_verifier = ${verifier}, created_at = NOW()
    `);
    console.log(`[Garmin] Stored code verifier in database for nonce: ${nonce}`);
  } catch (error) {
    console.error(`[Garmin] Failed to store code verifier:`, error);
    throw error;
  }
}

async function getCodeVerifier(nonce: string): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT code_verifier FROM oauth_state WHERE nonce = ${nonce}
    `);
    const verifier = (result.rows[0] as any)?.code_verifier || null;
    if (verifier) {
      console.log(`[Garmin] Found code verifier in database for nonce: ${nonce}`);
    } else {
      console.log(`[Garmin] Code verifier NOT found in database for nonce: ${nonce}`);
    }
    return verifier;
  } catch (error) {
    console.error(`[Garmin] Failed to get code verifier:`, error);
    return null;
  }
}

async function deleteCodeVerifier(nonce: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM oauth_state WHERE nonce = ${nonce}`);
    console.log(`[Garmin] Deleted code verifier from database for nonce: ${nonce}`);
  } catch (error) {
    console.error(`[Garmin] Failed to delete code verifier:`, error);
  }
}

// Clean up old verifiers (older than 15 minutes) - called periodically
async function cleanupOldVerifiers(): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM oauth_state WHERE created_at < NOW() - INTERVAL '15 minutes'`);
  } catch (error) {
    console.error(`[Garmin] Failed to cleanup old verifiers:`, error);
  }
}

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
 * Get and remove code verifier for a given nonce (one-time use) - DATABASE VERSION
 */
export async function getAndRemoveCodeVerifier(nonce: string): Promise<string | null> {
  console.log(`[Garmin] Looking up code verifier for nonce: ${nonce}`);
  const verifier = await getCodeVerifier(nonce);
  if (verifier) {
    await deleteCodeVerifier(nonce);
    console.log(`[Garmin] Found and removed code verifier for nonce: ${nonce}`);
    return verifier;
  }
  console.log(`[Garmin] Code verifier NOT found for nonce: ${nonce}`);
  return null;
}

/**
 * Generate the Garmin OAuth authorization URL - ASYNC DATABASE VERSION
 */
export async function getGarminAuthUrl(redirectUri: string, state: string, nonce: string): Promise<string> {
  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Store the code verifier using database (survives server restarts)
  await storeCodeVerifier(nonce, codeVerifier);
  
  // Cleanup old verifiers periodically
  cleanupOldVerifiers().catch(err => console.error('Failed to cleanup old verifiers:', err));
  
  // Note: Garmin's scope is managed via app configuration, not in the auth request
  const params = new URLSearchParams({
    client_id: GARMIN_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
  });
  
  return `${GARMIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeGarminCode(
  code: string,
  redirectUri: string,
  nonce: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  athleteId?: string;
}> {
  const codeVerifier = await getAndRemoveCodeVerifier(nonce);
  if (!codeVerifier) {
    throw new Error('Invalid state - PKCE code verifier not found for nonce: ' + nonce);
  }
  
  // Garmin requires client_id and client_secret in the POST body (not Basic Auth)
  // Build the form body manually to ensure proper encoding
  const formParts = [
    `grant_type=authorization_code`,
    `code=${encodeURIComponent(code)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `code_verifier=${encodeURIComponent(codeVerifier)}`,
    `client_id=${encodeURIComponent(GARMIN_CLIENT_ID!)}`,
    `client_secret=${encodeURIComponent(GARMIN_CLIENT_SECRET!)}`,
  ];
  const formBody = formParts.join('&');
  
  console.log('=== GARMIN TOKEN EXCHANGE ===');
  console.log('Token URL:', GARMIN_TOKEN_URL);
  console.log('Redirect URI:', redirectUri);
  console.log('Nonce:', nonce);
  console.log('Code:', code);
  console.log('Code verifier:', codeVerifier);
  console.log('Code verifier length:', codeVerifier.length);
  console.log('Client ID:', GARMIN_CLIENT_ID);
  console.log('Client Secret (first 5 chars):', GARMIN_CLIENT_SECRET?.substring(0, 5));
  console.log('Request body:', formBody);
  console.log('==============================');
  
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
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
  // Garmin requires client_id and client_secret in the POST body
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
  // Use Garmin Connect API for OAuth 2.0 - Activity List endpoint
  // This is the correct API for accessing personal Garmin Connect data
  
  if (!startTime || !endTime) {
    throw new Error('Start and end times are required for Garmin activities fetch');
  }
  
  // Format: YYYY-MM-DD
  const startDate = startTime.toISOString().split('T')[0];
  const endDate = endTime.toISOString().split('T')[0];
  
  console.log(`📅 Fetching Garmin Connect activities from ${startDate} to ${endDate}`);
  
  // Garmin Connect activity search endpoint
  const start = 0;
  const limit = 100; // Max activities per request
  
  const response = await fetch(
    `${GARMIN_CONNECT_API}/activitylist-service/activities/search/activities?start=${start}&limit=${limit}&startDate=${startDate}&endDate=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Garmin Connect API error:', response.status, errorText);
    throw new Error(`Failed to fetch Garmin activities: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`📊 Garmin Connect API returned ${data.length || 0} activities`);
  
  // Garmin Connect returns an array of activities directly
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch detailed activity data including GPS and running dynamics
 */
export async function getGarminActivityDetail(
  accessToken: string,
  activityId: string
): Promise<any> {
  // Use Garmin Connect API for detailed activity data
  const response = await fetch(`${GARMIN_CONNECT_API}/activity-service/activity/${activityId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Garmin activity detail API error:', response.status, errorText);
    throw new Error(`Failed to fetch Garmin activity detail: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's daily health summary (steps, HR, sleep, stress)
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminDailySummary(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const response = await fetch(`${GARMIN_CONNECT_API}/usersummary-service/usersummary/daily/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin daily summary: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's sleep data (stages, scores, duration)
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminSleepData(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/dailySleepData?date=${startDateStr}&nonSleepBufferMinutes=60`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin sleep data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's all-day heart rate data
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminHeartRateData(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/dailyHeartRate/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin heart rate data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch user's stress data throughout the day
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminStressData(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/dailyStress/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
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
 * Fetch Body Battery data (Garmin's energy metric)
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminBodyBattery(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/bodyBattery/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin Body Battery: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch HRV (Heart Rate Variability) data
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminHRVData(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/daily/hrv/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
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
/**
 * Fetch Respiration rate data
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminRespirationData(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/dailyRespiration/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Garmin respiration data: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch Pulse Ox (SpO2) data
 * Uses Garmin Connect API (OAuth 2.0 compatible)
 */
export async function getGarminPulseOx(
  accessToken: string,
  date: Date
): Promise<any> {
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(`${GARMIN_CONNECT_API}/wellness-service/wellness/dailySpo2/${dateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
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

/**
 * Sync Garmin activities to database and create run sessions
 * This is called automatically after OAuth connection
 */
export async function syncGarminActivities(
  userId: string,
  accessToken: string,
  startDateISO: string,
  endDateISO: string
): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log(`📥 Starting Garmin activity sync for user ${userId}`);
  console.log(`📅 Date range: ${startDateISO} to ${endDateISO}`);
  
  const { db } = await import('./db');
  const { runs, connectedDevices } = await import('@shared/schema');
  const { eq, and, gte, lte } = await import('drizzle-orm');
  
  let syncedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  try {
    // Check if token is expired and refresh if needed
    const deviceRecords = await db
      .select()
      .from(connectedDevices)
      .where(
        and(
          eq(connectedDevices.userId, userId),
          eq(connectedDevices.deviceType, 'garmin')
        )
      )
      .limit(1);
    
    let currentAccessToken = accessToken;
    
    if (deviceRecords.length > 0) {
      const device = deviceRecords[0];
      const expiresAt = device.tokenExpiresAt;
      const now = new Date();
      
      // Refresh token if expired or expiring within 5 minutes
      if (expiresAt && expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
        console.log('🔄 Access token expired or expiring soon, refreshing...');
        try {
          const tokens = await refreshGarminToken(device.refreshToken!);
          currentAccessToken = tokens.accessToken;
          
          // Update stored tokens
          await db
            .update(connectedDevices)
            .set({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
            })
            .where(eq(connectedDevices.id, device.id));
          
          console.log('✅ Token refreshed successfully');
        } catch (refreshError: any) {
          console.error('❌ Failed to refresh token:', refreshError.message);
          throw new Error('Token expired and refresh failed. Please reconnect Garmin.');
        }
      }
    }
    
    const startDate = new Date(startDateISO);
    const endDate = new Date(endDateISO);
    
    // Garmin API limits time range to 24 hours (86400 seconds)
    // Fetch activities day by day
    console.log('🔄 Fetching activities from Garmin API (day by day)...');
    
    const allActivities: any[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      // Don't fetch future dates
      if (dayStart > new Date()) break;
      
      try {
        console.log(`📅 Fetching day: ${dayStart.toISOString().split('T')[0]}`);
        const dailyActivities = await getGarminActivities(currentAccessToken, dayStart, dayEnd);
        const activities = Array.isArray(dailyActivities) ? dailyActivities : dailyActivities.activities || [];
        allActivities.push(...activities);
        console.log(`   Found ${activities.length} activities`);
        
        // Small delay to avoid rate limiting (500ms between requests)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`⚠️  Failed to fetch activities for ${dayStart.toISOString().split('T')[0]}:`, error.message);
        // Continue with next day even if one day fails
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`📊 Total activities fetched: ${allActivities.length}`);
    const activities = allActivities;
    
    if (activities.length > 0) {
      console.log('📝 Sample activity structure:', JSON.stringify(activities[0], null, 2).substring(0, 500));
    }
    
    // Filter for running activities only
    const runningActivities = activities.filter((act: any) => {
      const typeName = (act.activityType?.activityTypeKey || act.activityType || act.sport || '').toLowerCase();
      const actName = (act.activityName || '').toLowerCase();
      return typeName.includes('run') || actName.includes('run');
    });
    console.log(`🏃 ${runningActivities.length} running activities to process`);
    
    for (const activity of runningActivities) {
      try {
        const activityId = activity.activityId || activity.id;
        const activityDate = new Date(activity.startTimeGMT || activity.beginTimestamp);
        
        // Check if this activity already exists in database
        const existing = await db
          .select()
          .from(runs)
          .where(
            and(
              eq(runs.userId, userId),
              eq(runs.externalId, activityId.toString())
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          console.log(`⏭️  Activity ${activityId} already exists, skipping`);
          skippedCount++;
          continue;
        }
        
        // Fetch detailed activity data (GPS, heart rate, etc.)
        console.log(`🔍 Fetching details for activity ${activityId}...`);
        let activityDetail = null;
        try {
          activityDetail = await getGarminActivityDetail(currentAccessToken, activityId);
        } catch (detailError: any) {
          console.warn(`⚠️  Could not fetch details for ${activityId}: ${detailError.message}`);
          // Continue with summary data only
        }
        
        // Parse and map Garmin data to our run session format
        const distance = (activity.distance || 0) / 1000; // Convert meters to km
        const duration = (activity.duration || activity.movingDuration || 0) * 1000; // Convert seconds to milliseconds
        const avgPace = distance > 0 && duration > 0 ? formatPace(duration / 1000 / distance) : null;
        const avgHeartRate = activity.averageHR || activityDetail?.averageHR || null;
        const maxHeartRate = activity.maxHR || activityDetail?.maxHR || null;
        const calories = activity.calories || activityDetail?.calories || null;
        const avgCadence = activity.averageRunCadence || activityDetail?.avgRunCadence || null;
        const elevationGain = activity.elevationGain || activityDetail?.elevationGain || null;
        const elevationLoss = activity.elevationLoss || activityDetail?.elevationLoss || null;
        
        // Extract GPS track
        const gpsTrack = activityDetail?.geoPolylineDTO?.polyline || 
                        activityDetail?.summaryPolyline || 
                        activity.summaryPolyline || 
                        null;
        
        // Extract heart rate data
        const heartRateData = activityDetail?.heartRateSamples || 
                             activityDetail?.timeSeriesData?.heartRate || 
                             null;
        
        // Extract pace/speed data
        const paceData = activityDetail?.timeSeriesData?.speed || 
                        activityDetail?.speedSamples || 
                        null;
        
        // Extract splits/laps
        const kmSplits = activityDetail?.laps?.map((lap: any, index: number) => ({
          km: index + 1,
          time: lap.duration,
          pace: formatPace(lap.duration / (lap.distance / 1000)),
          avgHeartRate: lap.averageHR,
          maxHeartRate: lap.maxHR,
          cadence: lap.avgRunCadence,
          elevation: lap.elevationGain
        })) || null;
        
        // Starting location
        const startLat = activity.startLatitude || activityDetail?.startLatitude || null;
        const startLng = activity.startLongitude || activityDetail?.startLongitude || null;
        
        // Activity name/description
        const activityName = activity.activityName || 
                            `${activity.activityType || 'Run'} - ${activityDate.toLocaleDateString()}`;
        
        // Insert into database
        console.log(`💾 Saving activity ${activityId} to database...`);
        await db.insert(runs).values({
          userId,
          externalId: activityId.toString(),
          externalSource: 'garmin',
          distance,
          duration: Math.floor(duration),
          avgPace,
          avgHeartRate,
          maxHeartRate,
          minHeartRate: activityDetail?.minHR || null,
          calories,
          cadence: avgCadence,
          elevation: elevationGain,
          elevationGain,
          elevationLoss,
          difficulty: determineDifficulty(distance, duration, elevationGain),
          startLat,
          startLng,
          gpsTrack: gpsTrack ? { encoded: gpsTrack } : null,
          heartRateData: heartRateData ? { samples: heartRateData } : null,
          paceData: paceData ? { samples: paceData } : null,
          kmSplits,
          completedAt: activityDate,
          name: activityName,
          aiCoachEnabled: false,
          runDate: activityDate.toISOString().split('T')[0],
          runTime: activityDate.toTimeString().split(' ')[0],
          terrainType: activity.activityType || 'road',
          isPublic: false
        });
        
        syncedCount++;
        console.log(`✅ Successfully synced activity ${activityId}`);
        
      } catch (activityError: any) {
        console.error(`❌ Error syncing activity: ${activityError.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);
    return { synced: syncedCount, skipped: skippedCount, errors: errorCount };
    
  } catch (error: any) {
    console.error('❌ Fatal error during Garmin sync:', error);
    throw error;
  }
}

/**
 * Helper function to format pace (min/km)
 */
function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Helper function to determine run difficulty based on metrics
 */
function determineDifficulty(distanceKm: number, durationMs: number, elevationGain?: number | null): string {
  const avgPaceMinPerKm = (durationMs / 1000) / distanceKm / 60;
  const elevation = elevationGain || 0;
  
  // Simple difficulty heuristic
  if (avgPaceMinPerKm > 7 && elevation < 100) return 'easy';
  if (avgPaceMinPerKm < 4.5 || elevation > 300) return 'hard';
  return 'moderate';
}

export default {
  getGarminAuthUrl,
  exchangeGarminCode,
  refreshGarminToken,
  getGarminActivities,
  getGarminActivityDetail,
  syncGarminActivities,
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
