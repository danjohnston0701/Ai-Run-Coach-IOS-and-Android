import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './query-client';

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface RunData {
  userId: string;
  routeId?: string;
  distance: number;
  duration: number;
  avgPace: string;
  elevationGain?: number;
  gpsTrack: Array<{ lat: number; lng: number; timestamp: number }>;
  paceData: Array<{ km: number; pace: string; paceSeconds: number }>;
  aiCoachEnabled: boolean;
  difficulty?: string;
  runDate: string;
  runTime: string;
  targetTime?: number;
  cadenceAvg?: number;
}

interface WeaknessEvent {
  sessionKey: string;
  timestamp: number;
  type: 'pace_drop' | 'hill_struggle' | 'form_break';
  severity: 'minor' | 'moderate' | 'significant';
  kmMark: number;
  details?: string;
}

interface CoachingLog {
  sessionKey: string;
  eventType: string;
  topic: string;
  responseText: string;
  timestamp: number;
}

export async function saveRunWithRetry(
  runData: RunData,
  weaknessEvents: WeaknessEvent[] = [],
  coachingLogs: CoachingLog[] = [],
  sessionKey: string
): Promise<{ success: boolean; runId?: string; error?: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const baseUrl = getApiUrl();

      const response = await fetch(`${baseUrl}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(runData),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const run = await response.json();

      await Promise.allSettled([
        saveWeaknessEvents(baseUrl, run.id, weaknessEvents),
        linkCoachingLogs(baseUrl, run.id, sessionKey),
      ]);

      await AsyncStorage.removeItem('runSession');
      await AsyncStorage.removeItem('activeRoute');

      return { success: true, runId: run.id };
    } catch (error: any) {
      lastError = error;
      console.error(`Run save attempt ${attempt} failed:`, error.message);

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const localRun = {
    id: `local-${Date.now()}`,
    ...runData,
    weaknessEvents,
    coachingLogs,
    sessionKey,
    dbSynced: false,
  };

  try {
    const localRuns = await AsyncStorage.getItem('localRuns');
    const runs = localRuns ? JSON.parse(localRuns) : [];
    runs.push(localRun);
    await AsyncStorage.setItem('localRuns', JSON.stringify(runs));
  } catch (storageError) {
    console.error('Failed to save run locally:', storageError);
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to save run after multiple attempts',
  };
}

async function saveWeaknessEvents(
  baseUrl: string,
  runId: string,
  events: WeaknessEvent[]
): Promise<void> {
  if (events.length === 0) return;

  try {
    await fetch(`${baseUrl}/api/runs/${runId}/weakness-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ events }),
    });
  } catch (error) {
    console.error('Failed to save weakness events:', error);
  }
}

async function linkCoachingLogs(
  baseUrl: string,
  runId: string,
  sessionKey: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/runs/${runId}/link-coaching-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionKey }),
    });
  } catch (error) {
    console.error('Failed to link coaching logs:', error);
  }
}

export async function syncLocalRuns(): Promise<{
  synced: number;
  failed: number;
}> {
  let synced = 0;
  let failed = 0;

  try {
    const localRunsStr = await AsyncStorage.getItem('localRuns');
    if (!localRunsStr) return { synced, failed };

    const localRuns = JSON.parse(localRunsStr);
    const remainingRuns: any[] = [];

    for (const run of localRuns) {
      if (run.dbSynced) continue;

      const { id, weaknessEvents, coachingLogs, sessionKey, dbSynced, ...runData } = run;

      const result = await saveRunWithRetry(
        runData,
        weaknessEvents || [],
        coachingLogs || [],
        sessionKey
      );

      if (result.success) {
        synced++;
      } else {
        failed++;
        remainingRuns.push(run);
      }
    }

    await AsyncStorage.setItem('localRuns', JSON.stringify(remainingRuns));
  } catch (error) {
    console.error('Failed to sync local runs:', error);
  }

  return { synced, failed };
}

export async function getLocalRunCount(): Promise<number> {
  try {
    const localRunsStr = await AsyncStorage.getItem('localRuns');
    if (!localRunsStr) return 0;
    return JSON.parse(localRunsStr).length;
  } catch {
    return 0;
  }
}
