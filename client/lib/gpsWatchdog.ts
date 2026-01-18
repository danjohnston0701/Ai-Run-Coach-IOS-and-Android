import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';

const WATCHDOG_INTERVAL_MS = 10000;
const MAX_RECOVERY_ATTEMPTS = 5;
const MAX_SPEED_MS = 12.5;
const GPS_WINDOW_SIZE = 5;
const LOCATION_STALENESS_MS = 15000;

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

interface GPSWatchdogCallbacks {
  onRecoveryStarted?: () => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: () => void;
  onGPSLost?: () => void;
  onLocationUpdate?: (point: GPSPoint) => void;
  onSpikeFiltered?: (point: GPSPoint) => void;
}

class GPSWatchdog {
  private watchdogTimer: NodeJS.Timeout | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private lastLocation: GPSPoint | null = null;
  private recoveryAttempts = 0;
  private isRecovering = false;
  private callbacks: GPSWatchdogCallbacks = {};
  private recentPoints: GPSPoint[] = [];
  private appState: AppStateStatus = 'active';
  private appStateSubscription: { remove: () => void } | null = null;
  private enabled = false;

  async start(callbacks: GPSWatchdogCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.recoveryAttempts = 0;
    this.isRecovering = false;
    this.recentPoints = [];
    this.enabled = true;

    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    const success = await this.startLocationTracking();
    if (success) {
      this.startWatchdog();
    }
    return success;
  }

  stop() {
    this.enabled = false;
    this.stopWatchdog();
    this.stopLocationTracking();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.recentPoints = [];
    this.lastLocation = null;
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (this.appState === 'background' && nextAppState === 'active') {
      if (this.enabled && !this.isRecovering) {
        await this.attemptRecovery();
      }
    }
    this.appState = nextAppState;
  };

  private async startLocationTracking(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (location) => {
          const point: GPSPoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            timestamp: location.timestamp,
            accuracy: location.coords.accuracy || undefined,
            speed: location.coords.speed || undefined,
          };

          if (this.isValidPoint(point)) {
            this.lastLocation = point;
            this.addToWindow(point);
            this.callbacks.onLocationUpdate?.(point);
          } else {
            this.callbacks.onSpikeFiltered?.(point);
          }
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      return false;
    }
  }

  private stopLocationTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  private startWatchdog() {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      this.checkGPSHealth();
    }, WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private checkGPSHealth() {
    if (!this.enabled || this.isRecovering) return;

    const now = Date.now();
    const isStale = !this.lastLocation || 
      (now - this.lastLocation.timestamp) > LOCATION_STALENESS_MS;

    if (isStale) {
      this.attemptRecovery();
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (this.isRecovering || this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        this.callbacks.onRecoveryFailed?.();
        this.callbacks.onGPSLost?.();
      }
      return;
    }

    this.isRecovering = true;
    this.recoveryAttempts++;
    this.callbacks.onRecoveryStarted?.();

    try {
      this.stopLocationTracking();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const success = await this.startLocationTracking();
      
      if (success) {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        this.lastLocation = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: location.timestamp,
          accuracy: location.coords.accuracy || undefined,
          speed: location.coords.speed || undefined,
        };

        this.recoveryAttempts = 0;
        this.callbacks.onRecoverySuccess?.();
      } else {
        throw new Error('Failed to restart location tracking');
      }
    } catch (error) {
      console.error('GPS recovery attempt failed:', error);
      if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        this.callbacks.onRecoveryFailed?.();
        this.callbacks.onGPSLost?.();
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private isValidPoint(point: GPSPoint): boolean {
    if (!this.lastLocation) return true;

    const timeDiff = (point.timestamp - this.lastLocation.timestamp) / 1000;
    if (timeDiff <= 0) return false;

    const distance = this.calculateDistance(
      this.lastLocation.lat,
      this.lastLocation.lng,
      point.lat,
      point.lng
    );

    const speed = distance / timeDiff;

    if (speed > MAX_SPEED_MS) {
      return false;
    }

    if (point.accuracy && point.accuracy > 50) {
      return false;
    }

    return true;
  }

  private addToWindow(point: GPSPoint) {
    this.recentPoints.push(point);
    if (this.recentPoints.length > GPS_WINDOW_SIZE) {
      this.recentPoints.shift();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getSmoothedLocation(): GPSPoint | null {
    if (this.recentPoints.length === 0) return null;
    if (this.recentPoints.length === 1) return this.recentPoints[0];

    const avgLat = this.recentPoints.reduce((sum, p) => sum + p.lat, 0) / this.recentPoints.length;
    const avgLng = this.recentPoints.reduce((sum, p) => sum + p.lng, 0) / this.recentPoints.length;

    return {
      lat: avgLat,
      lng: avgLng,
      timestamp: this.recentPoints[this.recentPoints.length - 1].timestamp,
    };
  }

  getLastLocation(): GPSPoint | null {
    return this.lastLocation;
  }

  getRecoveryAttempts(): number {
    return this.recoveryAttempts;
  }

  isGPSHealthy(): boolean {
    if (!this.lastLocation) return false;
    return (Date.now() - this.lastLocation.timestamp) < LOCATION_STALENESS_MS;
  }
}

export const gpsWatchdog = new GPSWatchdog();
