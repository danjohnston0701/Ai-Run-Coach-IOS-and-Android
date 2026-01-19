/**
 * BLE Heart Rate Service
 * 
 * Connects to Bluetooth heart rate monitors including:
 * - Garmin watches in "Broadcast Heart Rate" mode
 * - Apple Watch (when broadcasting)
 * - Dedicated HR chest straps (Polar, Wahoo, etc.)
 * - Any standard Bluetooth Heart Rate Profile device
 * 
 * NOTE: Real Bluetooth Low Energy requires a development build.
 * In Expo Go, this service provides simulated data for testing.
 */

import { Platform } from 'react-native';

export interface HeartRateDevice {
  id: string;
  name: string;
  rssi?: number; // Signal strength
  isConnected: boolean;
  batteryLevel?: number;
}

export interface HeartRateReading {
  bpm: number;
  timestamp: number;
  deviceId: string;
  contactDetected?: boolean;
  energyExpended?: number; // Cumulative kJ
  rrIntervals?: number[]; // For HRV calculation
}

type HeartRateCallback = (reading: HeartRateReading) => void;
type DeviceCallback = (devices: HeartRateDevice[]) => void;
type ConnectionCallback = (device: HeartRateDevice | null) => void;

class BLEHeartRateService {
  private isScanning = false;
  private connectedDevice: HeartRateDevice | null = null;
  private heartRateCallbacks: HeartRateCallback[] = [];
  private deviceCallbacks: DeviceCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private discoveredDevices: HeartRateDevice[] = [];
  
  // Check if real BLE is available (requires dev build)
  isRealBLEAvailable(): boolean {
    // In Expo Go, we can't access real BLE
    // This would return true in a development/production build with BLE module
    return false; // Will be true when using react-native-ble-plx in dev build
  }
  
  // Check if we're in simulation mode
  isSimulationMode(): boolean {
    return !this.isRealBLEAvailable();
  }
  
  // Start scanning for heart rate devices
  async startScan(): Promise<void> {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.discoveredDevices = [];
    
    if (this.isSimulationMode()) {
      // Simulate discovering devices
      setTimeout(() => {
        this.discoveredDevices = [
          {
            id: 'sim-garmin-hr',
            name: 'Garmin HR Broadcast',
            rssi: -65,
            isConnected: false,
          },
          {
            id: 'sim-polar-h10',
            name: 'Polar H10',
            rssi: -72,
            isConnected: false,
          },
        ];
        this.notifyDeviceCallbacks();
      }, 1500);
    } else {
      // Real BLE scanning would go here
      // Using react-native-ble-plx or similar
      console.log('Real BLE scanning requires development build');
    }
  }
  
  // Stop scanning
  stopScan(): void {
    this.isScanning = false;
  }
  
  // Connect to a heart rate device
  async connect(deviceId: string): Promise<boolean> {
    const device = this.discoveredDevices.find(d => d.id === deviceId);
    if (!device) return false;
    
    if (this.isSimulationMode()) {
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connectedDevice = {
        ...device,
        isConnected: true,
        batteryLevel: 85,
      };
      
      this.notifyConnectionCallbacks();
      this.startSimulatedReadings();
      return true;
    } else {
      // Real BLE connection would go here
      console.log('Real BLE connection requires development build');
      return false;
    }
  }
  
  // Disconnect from current device
  async disconnect(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    this.connectedDevice = null;
    this.notifyConnectionCallbacks();
  }
  
  // Get currently connected device
  getConnectedDevice(): HeartRateDevice | null {
    return this.connectedDevice;
  }
  
  // Subscribe to heart rate readings
  onHeartRate(callback: HeartRateCallback): () => void {
    this.heartRateCallbacks.push(callback);
    return () => {
      const index = this.heartRateCallbacks.indexOf(callback);
      if (index > -1) this.heartRateCallbacks.splice(index, 1);
    };
  }
  
  // Subscribe to device discovery
  onDevicesDiscovered(callback: DeviceCallback): () => void {
    this.deviceCallbacks.push(callback);
    return () => {
      const index = this.deviceCallbacks.indexOf(callback);
      if (index > -1) this.deviceCallbacks.splice(index, 1);
    };
  }
  
  // Subscribe to connection changes
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) this.connectionCallbacks.splice(index, 1);
    };
  }
  
  // Start simulated heart rate readings (for Expo Go testing)
  private startSimulatedReadings(): void {
    if (this.simulationInterval) return;
    
    let baseHR = 120;
    let trend = 0;
    
    this.simulationInterval = setInterval(() => {
      // Simulate realistic heart rate variations
      trend += (Math.random() - 0.5) * 2;
      trend = Math.max(-10, Math.min(10, trend));
      
      const variation = (Math.random() - 0.5) * 6;
      const bpm = Math.round(Math.max(60, Math.min(185, baseHR + trend + variation)));
      
      // Occasionally shift the base (simulating effort changes)
      if (Math.random() < 0.02) {
        baseHR = 100 + Math.random() * 60;
      }
      
      const reading: HeartRateReading = {
        bpm,
        timestamp: Date.now(),
        deviceId: this.connectedDevice?.id || 'simulation',
        contactDetected: true,
        rrIntervals: [Math.round(60000 / bpm) + Math.round((Math.random() - 0.5) * 20)],
      };
      
      this.notifyHeartRateCallbacks(reading);
    }, 1000);
  }
  
  private notifyHeartRateCallbacks(reading: HeartRateReading): void {
    this.heartRateCallbacks.forEach(cb => cb(reading));
  }
  
  private notifyDeviceCallbacks(): void {
    this.deviceCallbacks.forEach(cb => cb(this.discoveredDevices));
  }
  
  private notifyConnectionCallbacks(): void {
    this.connectionCallbacks.forEach(cb => cb(this.connectedDevice));
  }
  
  // Clean up
  destroy(): void {
    this.disconnect();
    this.heartRateCallbacks = [];
    this.deviceCallbacks = [];
    this.connectionCallbacks = [];
  }
}

// Singleton instance
export const bleHeartRateService = new BLEHeartRateService();

// React hook for using BLE heart rate
import { useState, useEffect, useCallback } from 'react';

export function useBLEHeartRate() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<HeartRateDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<HeartRateDevice | null>(null);
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [isSimulation, setIsSimulation] = useState(true);
  
  useEffect(() => {
    setIsSimulation(bleHeartRateService.isSimulationMode());
    
    const unsubDevices = bleHeartRateService.onDevicesDiscovered(setDevices);
    const unsubConnection = bleHeartRateService.onConnectionChange(setConnectedDevice);
    const unsubHR = bleHeartRateService.onHeartRate((reading) => {
      setCurrentHR(reading.bpm);
    });
    
    return () => {
      unsubDevices();
      unsubConnection();
      unsubHR();
    };
  }, []);
  
  const startScan = useCallback(async () => {
    setIsScanning(true);
    await bleHeartRateService.startScan();
    // Stop scanning after 10 seconds
    setTimeout(() => {
      bleHeartRateService.stopScan();
      setIsScanning(false);
    }, 10000);
  }, []);
  
  const stopScan = useCallback(() => {
    bleHeartRateService.stopScan();
    setIsScanning(false);
  }, []);
  
  const connect = useCallback(async (deviceId: string) => {
    const success = await bleHeartRateService.connect(deviceId);
    return success;
  }, []);
  
  const disconnect = useCallback(async () => {
    await bleHeartRateService.disconnect();
  }, []);
  
  return {
    isScanning,
    devices,
    connectedDevice,
    currentHR,
    isSimulation,
    startScan,
    stopScan,
    connect,
    disconnect,
  };
}
