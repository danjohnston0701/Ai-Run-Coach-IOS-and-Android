/**
 * Garmin Companion SDK Native Module
 * 
 * This module provides real-time data streaming from Garmin devices during runs.
 * It requires a development build (not compatible with Expo Go).
 * 
 * Features:
 * - Real-time heart rate streaming
 * - Step count and cadence
 * - Accelerometer data
 * - GPS/pace from watch activity
 * 
 * Setup:
 * 1. Create a development build: npx expo run:ios or npx expo run:android
 * 2. The native module will automatically register
 */

import { Platform } from 'react-native';

// Check if native module is available (dev build only)
let GarminCompanionModule: any = null;
let emitter: any = null;
let isAvailable = false;

// Only try to load native modules in development builds
if (Platform.OS !== 'web') {
  try {
    const ExpoModulesCore = require('expo-modules-core');
    GarminCompanionModule = ExpoModulesCore.requireNativeModule('GarminCompanionSDK');
    emitter = new ExpoModulesCore.EventEmitter(GarminCompanionModule);
    isAvailable = true;
  } catch (e) {
    // Expected in Expo Go - module not available
    console.log('Garmin Companion SDK not available (requires development build)');
  }
}

// Event types
export interface GarminHeartRateEvent {
  heartRate: number;
  timestamp: number;
  heartRateZone?: number;
}

export interface GarminCadenceEvent {
  cadence: number; // steps per minute
  timestamp: number;
}

export interface GarminStepsEvent {
  steps: number;
  timestamp: number;
}

export interface GarminAccelerometerEvent {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GarminActivityEvent {
  distance: number; // meters
  pace: number; // seconds per km
  elapsedTime: number; // seconds
  timestamp: number;
}

export interface GarminConnectionEvent {
  connected: boolean;
  deviceName?: string;
  deviceId?: string;
}

// Listeners
type HeartRateListener = (event: GarminHeartRateEvent) => void;
type CadenceListener = (event: GarminCadenceEvent) => void;
type StepsListener = (event: GarminStepsEvent) => void;
type AccelerometerListener = (event: GarminAccelerometerEvent) => void;
type ActivityListener = (event: GarminActivityEvent) => void;
type ConnectionListener = (event: GarminConnectionEvent) => void;

// Event emitter is initialized above if native module is available

/**
 * Check if Garmin Companion SDK is available
 * Returns false in Expo Go, true in development builds with native module
 */
export function isGarminCompanionAvailable(): boolean {
  return isAvailable;
}

/**
 * Initialize the Garmin Companion SDK
 * Must be called before subscribing to any streams
 */
export async function initialize(): Promise<boolean> {
  if (!isAvailable) {
    console.warn('Garmin Companion SDK not available');
    return false;
  }
  
  try {
    return await GarminCompanionModule.initialize();
  } catch (error) {
    console.error('Failed to initialize Garmin Companion SDK:', error);
    return false;
  }
}

/**
 * Start scanning for Garmin devices
 */
export async function startScan(): Promise<void> {
  if (!isAvailable) return;
  await GarminCompanionModule.startScan();
}

/**
 * Stop scanning for devices
 */
export async function stopScan(): Promise<void> {
  if (!isAvailable) return;
  await GarminCompanionModule.stopScan();
}

/**
 * Connect to a specific Garmin device
 */
export async function connect(deviceId: string): Promise<boolean> {
  if (!isAvailable) return false;
  return await GarminCompanionModule.connect(deviceId);
}

/**
 * Disconnect from current device
 */
export async function disconnect(): Promise<void> {
  if (!isAvailable) return;
  await GarminCompanionModule.disconnect();
}

/**
 * Subscribe to real-time heart rate updates
 */
export function subscribeToHeartRate(listener: HeartRateListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onHeartRate', listener);
  GarminCompanionModule.subscribeToHeartRate();
  
  return () => {
    subscription.remove();
    GarminCompanionModule.unsubscribeFromHeartRate();
  };
}

/**
 * Subscribe to cadence (steps per minute) updates
 */
export function subscribeToCadence(listener: CadenceListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onCadence', listener);
  GarminCompanionModule.subscribeToCadence();
  
  return () => {
    subscription.remove();
    GarminCompanionModule.unsubscribeFromCadence();
  };
}

/**
 * Subscribe to step count updates
 */
export function subscribeToSteps(listener: StepsListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onSteps', listener);
  GarminCompanionModule.subscribeToSteps();
  
  return () => {
    subscription.remove();
    GarminCompanionModule.unsubscribeFromSteps();
  };
}

/**
 * Subscribe to accelerometer data (for advanced motion analysis)
 */
export function subscribeToAccelerometer(listener: AccelerometerListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onAccelerometer', listener);
  GarminCompanionModule.subscribeToAccelerometer();
  
  return () => {
    subscription.remove();
    GarminCompanionModule.unsubscribeFromAccelerometer();
  };
}

/**
 * Subscribe to activity updates (distance, pace, elapsed time)
 */
export function subscribeToActivity(listener: ActivityListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onActivity', listener);
  GarminCompanionModule.subscribeToActivity();
  
  return () => {
    subscription.remove();
    GarminCompanionModule.unsubscribeFromActivity();
  };
}

/**
 * Subscribe to connection state changes
 */
export function subscribeToConnection(listener: ConnectionListener): () => void {
  if (!isAvailable || !emitter) {
    return () => {};
  }
  
  const subscription = emitter.addListener('onConnection', listener);
  return () => subscription.remove();
}

/**
 * Get current connection status
 */
export async function isConnected(): Promise<boolean> {
  if (!isAvailable) return false;
  return await GarminCompanionModule.isConnected();
}

/**
 * Get connected device info
 */
export async function getConnectedDevice(): Promise<{ name: string; id: string } | null> {
  if (!isAvailable) return null;
  return await GarminCompanionModule.getConnectedDevice();
}

export default {
  isGarminCompanionAvailable,
  initialize,
  startScan,
  stopScan,
  connect,
  disconnect,
  subscribeToHeartRate,
  subscribeToCadence,
  subscribeToSteps,
  subscribeToAccelerometer,
  subscribeToActivity,
  subscribeToConnection,
  isConnected,
  getConnectedDevice,
};
