import cron from 'node-cron';
import { storage, ConnectedDevice } from './storage';
import { getGarminComprehensiveWellness } from './garmin-service';

const SYNC_INTERVAL_MINUTES = 60;

interface SyncResult {
  userId: string;
  deviceId: string;
  success: boolean;
  error?: string;
  dataPoints?: number;
}

async function syncGarminForUser(device: ConnectedDevice): Promise<SyncResult> {
  const result: SyncResult = {
    userId: device.userId,
    deviceId: device.id,
    success: false,
  };

  try {
    if (!device.accessToken) {
      result.error = 'No access token';
      return result;
    }

    const today = new Date();
    let dataPoints = 0;

    const wellness = await getGarminComprehensiveWellness(device.accessToken, today);
    
    if (wellness) {
      const wellnessData: Record<string, any> = {
        userId: device.userId,
        date: wellness.date,
        totalSleepSeconds: wellness.sleep?.totalSleepSeconds || null,
        sleepScore: wellness.sleep?.sleepScore || null,
        deepSleepSeconds: wellness.sleep?.deepSleepSeconds || null,
        lightSleepSeconds: wellness.sleep?.lightSleepSeconds || null,
        remSleepSeconds: wellness.sleep?.remSleepSeconds || null,
        awakeSleepSeconds: wellness.sleep?.awakeSleepSeconds || null,
        sleepQuality: wellness.sleep?.sleepQuality || null,
        restingHeartRate: wellness.heartRate?.restingHeartRate || null,
        maxHeartRate: wellness.heartRate?.maxHeartRate || null,
        minHeartRate: wellness.heartRate?.minHeartRate || null,
        averageHeartRate: wellness.heartRate?.averageHeartRate || null,
        averageStressLevel: wellness.stress?.averageStressLevel || null,
        maxStressLevel: wellness.stress?.maxStressLevel || null,
        stressDuration: wellness.stress?.stressDuration || null,
        restDuration: wellness.stress?.restDuration || null,
        stressQualifier: wellness.stress?.stressQualifier || null,
        bodyBatteryCharged: wellness.bodyBattery?.chargedValue || null,
        bodyBatteryDrained: wellness.bodyBattery?.drainedValue || null,
        bodyBatteryHigh: wellness.bodyBattery?.highestValue || null,
        bodyBatteryLow: wellness.bodyBattery?.lowestValue || null,
        bodyBatteryCurrent: wellness.bodyBattery?.currentValue || null,
        hrvStatus: wellness.hrv?.hrvStatus || null,
        hrvWeeklyAvg: wellness.hrv?.weeklyAvg || null,
        hrvLastNightAvg: wellness.hrv?.lastNightAvg || null,
        hrvFeedback: wellness.hrv?.feedbackPhrase || null,
        readinessScore: wellness.readiness?.score || null,
        readinessRecommendation: wellness.readiness?.recommendation || null,
        syncedAt: new Date(),
      };

      const existingWellness = await storage.getGarminWellnessByDate(device.userId, today);
      
      if (existingWellness) {
        await storage.updateGarminWellness(existingWellness.id, wellnessData);
      } else {
        await storage.createGarminWellness(wellnessData);
      }
      
      dataPoints++;
    }

    await storage.updateConnectedDevice(device.id, { lastSyncAt: new Date() });
    
    result.success = true;
    result.dataPoints = dataPoints;
    
    console.log(`[Scheduler] Synced Garmin data for user ${device.userId}`);
  } catch (error: any) {
    result.error = error.message;
    console.error(`[Scheduler] Failed to sync Garmin for user ${device.userId}:`, error.message);
  }

  return result;
}

async function runGarminSync(): Promise<void> {
  console.log(`[Scheduler] Starting Garmin sync for all users at ${new Date().toISOString()}`);
  
  try {
    const allDevices = await storage.getAllActiveGarminDevices();
    
    if (allDevices.length === 0) {
      console.log('[Scheduler] No active Garmin devices found');
      return;
    }

    console.log(`[Scheduler] Found ${allDevices.length} active Garmin device(s)`);
    
    const results = await Promise.allSettled(
      allDevices.map((device: ConnectedDevice) => syncGarminForUser(device))
    );
    
    const successful = results.filter((r: PromiseSettledResult<SyncResult>) => 
      r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;
    
    console.log(`[Scheduler] Garmin sync completed: ${successful} successful, ${failed} failed`);
  } catch (error: any) {
    console.error('[Scheduler] Garmin sync job failed:', error.message);
  }
}

export function startScheduler(): void {
  console.log(`[Scheduler] Starting background scheduler (sync every ${SYNC_INTERVAL_MINUTES} minutes)`);
  
  cron.schedule(`*/${SYNC_INTERVAL_MINUTES} * * * *`, () => {
    runGarminSync();
  });
  
  console.log('[Scheduler] Garmin sync scheduled');
  
  setTimeout(() => {
    console.log('[Scheduler] Running initial Garmin sync in 30 seconds...');
    runGarminSync();
  }, 30000);
}

export async function triggerManualSync(userId: string): Promise<SyncResult | null> {
  try {
    const devices = await storage.getConnectedDevices(userId);
    const garminDevice = devices.find((d: ConnectedDevice) => d.deviceType === 'garmin' && d.isActive);
    
    if (!garminDevice) {
      return null;
    }
    
    return await syncGarminForUser(garminDevice);
  } catch (error: any) {
    console.error('[Scheduler] Manual sync failed:', error.message);
    return null;
  }
}
