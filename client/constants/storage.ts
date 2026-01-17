export const STORAGE_KEYS = {
  USER_ID: 'userId',
  USER_PROFILE: 'userProfile',
  ACTIVE_RUN_SESSION: 'activeRunSession',
  ACTIVE_ROUTE: 'activeRoute',
  RUN_HISTORY: 'runHistory',
  COACH_SETTINGS: 'coachSettings',
  LOCATION_PERMISSION: 'locationPermissionAsked',
} as const;

export const getMigrationKey = (userId: string) => 
  `dataMigrationCompleted_v1_${userId}`;

export const AUTO_SAVE_INTERVAL = 5000;
export const MAX_SESSION_AGE_HOURS = 12;
export const MAX_SESSION_AGE_MS = MAX_SESSION_AGE_HOURS * 60 * 60 * 1000;
