import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { Platform } from 'react-native';

const ROLLING_WINDOW_MS = 15000;
const MIN_STEP_THRESHOLD = 0.8;
const MAX_STEP_THRESHOLD = 3.5;
const MIN_STEP_INTERVAL_MS = 200;
const MAX_STEP_INTERVAL_MS = 1000;

interface StepEvent {
  timestamp: number;
  magnitude: number;
}

class CadenceDetector {
  private subscription: { remove: () => void } | null = null;
  private stepEvents: StepEvent[] = [];
  private lastStepTime = 0;
  private lastMagnitude = 0;
  private isRising = false;
  private enabled = false;
  private onCadenceUpdate: ((spm: number) => void) | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  async start(onCadenceUpdate: (spm: number) => void): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('Cadence detection not available on web');
      return false;
    }

    this.onCadenceUpdate = onCadenceUpdate;
    this.stepEvents = [];
    this.lastStepTime = 0;
    this.lastMagnitude = 0;
    this.isRising = false;

    try {
      const isAvailable = await DeviceMotion.isAvailableAsync();
      if (!isAvailable) {
        console.log('DeviceMotion not available');
        return false;
      }

      DeviceMotion.setUpdateInterval(50);

      this.subscription = DeviceMotion.addListener(this.handleMotionUpdate);
      this.enabled = true;

      this.updateInterval = setInterval(() => {
        if (this.onCadenceUpdate) {
          const spm = this.calculateSPM();
          this.onCadenceUpdate(spm);
        }
      }, 2000);

      return true;
    } catch (error) {
      console.error('Failed to start cadence detection:', error);
      return false;
    }
  }

  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.enabled = false;
    this.stepEvents = [];
    this.onCadenceUpdate = null;
  }

  private handleMotionUpdate = (data: DeviceMotionMeasurement) => {
    if (!this.enabled || !data.acceleration) return;

    const { x, y, z } = data.acceleration;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    if (magnitude > this.lastMagnitude) {
      this.isRising = true;
    } else if (this.isRising && magnitude < this.lastMagnitude) {
      this.isRising = false;
      
      if (
        this.lastMagnitude >= MIN_STEP_THRESHOLD &&
        this.lastMagnitude <= MAX_STEP_THRESHOLD
      ) {
        const timeSinceLastStep = now - this.lastStepTime;
        
        if (
          this.lastStepTime === 0 ||
          (timeSinceLastStep >= MIN_STEP_INTERVAL_MS &&
            timeSinceLastStep <= MAX_STEP_INTERVAL_MS)
        ) {
          this.stepEvents.push({
            timestamp: now,
            magnitude: this.lastMagnitude,
          });
          this.lastStepTime = now;

          this.stepEvents = this.stepEvents.filter(
            (event) => now - event.timestamp < ROLLING_WINDOW_MS
          );
        }
      }
    }

    this.lastMagnitude = magnitude;
  };

  private calculateSPM(): number {
    const now = Date.now();
    const recentSteps = this.stepEvents.filter(
      (event) => now - event.timestamp < ROLLING_WINDOW_MS
    );

    if (recentSteps.length < 2) {
      return 0;
    }

    const oldestStep = recentSteps[0];
    const newestStep = recentSteps[recentSteps.length - 1];
    const timeSpanMs = newestStep.timestamp - oldestStep.timestamp;

    if (timeSpanMs < 1000) {
      return 0;
    }

    const stepsPerMs = (recentSteps.length - 1) / timeSpanMs;
    const stepsPerMinute = Math.round(stepsPerMs * 60000);

    return Math.max(0, Math.min(220, stepsPerMinute));
  }

  getCurrentSPM(): number {
    return this.calculateSPM();
  }

  isActive(): boolean {
    return this.enabled;
  }
}

export const cadenceDetector = new CadenceDetector();
