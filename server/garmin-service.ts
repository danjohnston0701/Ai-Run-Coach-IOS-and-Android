import crypto from 'crypto';

const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID;
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET;

// Garmin OAuth 2.0 endpoints
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
const GARMIN_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
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
  
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: GARMIN_CLIENT_ID!,
      client_secret: GARMIN_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
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
  getGarminHeartRateData,
  getGarminStressData,
  getGarminUserProfile,
  parseGarminActivity,
};
