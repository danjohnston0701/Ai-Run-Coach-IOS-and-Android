/**
 * React Hook for Garmin Companion SDK
 * 
 * Provides easy-to-use hooks for real-time Garmin data in React components.
 * Falls back gracefully when running in Expo Go.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  isGarminCompanionAvailable,
  initialize,
  subscribeToHeartRate,
  subscribeToCadence,
  subscribeToSteps,
  subscribeToAccelerometer,
  subscribeToActivity,
  subscribeToConnection,
  isConnected,
  getConnectedDevice,
  connect,
  disconnect,
  startScan,
  stopScan,
  GarminHeartRateEvent,
  GarminCadenceEvent,
  GarminStepsEvent,
  GarminAccelerometerEvent,
  GarminActivityEvent,
  GarminConnectionEvent,
} from './index';

interface UseGarminCompanionResult {
  isAvailable: boolean;
  isInitialized: boolean;
  isConnected: boolean;
  deviceName: string | null;
  
  // Real-time data
  heartRate: number | null;
  heartRateZone: number | null;
  cadence: number | null;
  steps: number | null;
  distance: number | null;
  pace: number | null;
  elapsedTime: number | null;
  
  // Accelerometer (optional)
  accelerometer: { x: number; y: number; z: number } | null;
  
  // Methods
  initialize: () => Promise<boolean>;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  startDataStream: () => void;
  stopDataStream: () => void;
}

interface UseGarminCompanionOptions {
  autoInitialize?: boolean;
  autoStartStream?: boolean;
  includeAccelerometer?: boolean;
}

export function useGarminCompanion(options: UseGarminCompanionOptions = {}): UseGarminCompanionResult {
  const {
    autoInitialize = true,
    autoStartStream = false,
    includeAccelerometer = false,
  } = options;
  
  const [isAvailable] = useState(isGarminCompanionAvailable());
  const [isInitialized, setIsInitialized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateZone, setHeartRateZone] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [pace, setPace] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [accelerometer, setAccelerometer] = useState<{ x: number; y: number; z: number } | null>(null);
  
  const unsubscribesRef = useRef<(() => void)[]>([]);
  
  const initializeSDK = useCallback(async () => {
    if (!isAvailable) return false;
    const success = await initialize();
    setIsInitialized(success);
    return success;
  }, [isAvailable]);
  
  const startScanning = useCallback(async () => {
    if (!isAvailable || !isInitialized) return;
    await startScan();
  }, [isAvailable, isInitialized]);
  
  const stopScanning = useCallback(async () => {
    if (!isAvailable) return;
    await stopScan();
  }, [isAvailable]);
  
  const connectToDevice = useCallback(async (deviceId: string) => {
    if (!isAvailable || !isInitialized) return false;
    return await connect(deviceId);
  }, [isAvailable, isInitialized]);
  
  const disconnectDevice = useCallback(async () => {
    if (!isAvailable) return;
    await disconnect();
  }, [isAvailable]);
  
  const startDataStream = useCallback(() => {
    if (!isAvailable || !isInitialized) return;
    
    // Heart rate
    unsubscribesRef.current.push(
      subscribeToHeartRate((event: GarminHeartRateEvent) => {
        setHeartRate(event.heartRate);
        if (event.heartRateZone !== undefined) {
          setHeartRateZone(event.heartRateZone);
        }
      })
    );
    
    // Cadence
    unsubscribesRef.current.push(
      subscribeToCadence((event: GarminCadenceEvent) => {
        setCadence(event.cadence);
      })
    );
    
    // Steps
    unsubscribesRef.current.push(
      subscribeToSteps((event: GarminStepsEvent) => {
        setSteps(event.steps);
      })
    );
    
    // Activity (distance, pace, time)
    unsubscribesRef.current.push(
      subscribeToActivity((event: GarminActivityEvent) => {
        setDistance(event.distance);
        setPace(event.pace);
        setElapsedTime(event.elapsedTime);
      })
    );
    
    // Accelerometer (optional)
    if (includeAccelerometer) {
      unsubscribesRef.current.push(
        subscribeToAccelerometer((event: GarminAccelerometerEvent) => {
          setAccelerometer({ x: event.x, y: event.y, z: event.z });
        })
      );
    }
  }, [isAvailable, isInitialized, includeAccelerometer]);
  
  const stopDataStream = useCallback(() => {
    unsubscribesRef.current.forEach(unsub => unsub());
    unsubscribesRef.current = [];
    
    // Reset data
    setHeartRate(null);
    setHeartRateZone(null);
    setCadence(null);
    setSteps(null);
    setDistance(null);
    setPace(null);
    setElapsedTime(null);
    setAccelerometer(null);
  }, []);
  
  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && isAvailable) {
      initializeSDK();
    }
  }, [autoInitialize, isAvailable, initializeSDK]);
  
  // Connection listener
  useEffect(() => {
    if (!isAvailable || !isInitialized) return;
    
    const unsub = subscribeToConnection((event: GarminConnectionEvent) => {
      setConnected(event.connected);
      setDeviceName(event.connected ? event.deviceName || null : null);
    });
    
    // Check initial connection state
    isConnected().then(setConnected);
    getConnectedDevice().then(device => {
      if (device) setDeviceName(device.name);
    });
    
    return unsub;
  }, [isAvailable, isInitialized]);
  
  // Auto-start stream when connected
  useEffect(() => {
    if (autoStartStream && connected && isInitialized) {
      startDataStream();
    }
    
    return () => {
      if (autoStartStream) {
        stopDataStream();
      }
    };
  }, [autoStartStream, connected, isInitialized, startDataStream, stopDataStream]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDataStream();
    };
  }, [stopDataStream]);
  
  return {
    isAvailable,
    isInitialized,
    isConnected: connected,
    deviceName,
    heartRate,
    heartRateZone,
    cadence,
    steps,
    distance,
    pace,
    elapsedTime,
    accelerometer,
    initialize: initializeSDK,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnectDevice,
    startDataStream,
    stopDataStream,
  };
}

export default useGarminCompanion;
