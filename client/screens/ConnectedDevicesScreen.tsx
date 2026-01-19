import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Colors, Spacing } from '../constants/theme';
import { getApiUrl } from '../lib/query-client';
import { getStoredToken } from '../lib/token-storage';
import { useAuth } from '../contexts/AuthContext';
import { useRoute } from '@react-navigation/native';
import { useBLEHeartRate, HeartRateDevice } from '../services/ble-heart-rate';

const theme = {
  ...Colors.dark,
  background: Colors.dark.backgroundRoot,
  surface: Colors.dark.backgroundSecondary,
  surfaceLight: Colors.dark.backgroundTertiary,
};

type DeviceType = 'apple' | 'samsung' | 'garmin' | 'coros' | 'strava';

interface GarminWellnessData {
  sleepHours?: number;
  sleepQuality?: string;
  bodyBattery?: number;
  stressQualifier?: string;
  hrvStatus?: string;
  readinessScore?: number;
}

interface DeviceInfo {
  type: DeviceType;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  realTimeHR: boolean;
  postRunSync: boolean;
  supported: boolean;
  requiresDevBuild: boolean;
}

const SUPPORTED_DEVICES: DeviceInfo[] = [
  {
    type: 'apple',
    name: 'Apple Watch',
    icon: 'watch',
    description: 'Connect via Apple HealthKit for real-time heart rate and health metrics',
    realTimeHR: true,
    postRunSync: true,
    supported: Platform.OS === 'ios',
    requiresDevBuild: true,
  },
  {
    type: 'samsung',
    name: 'Samsung Galaxy Watch',
    icon: 'watch',
    description: 'Connect via Samsung Health SDK for real-time heart rate tracking',
    realTimeHR: true,
    postRunSync: true,
    supported: Platform.OS === 'android',
    requiresDevBuild: true,
  },
  {
    type: 'garmin',
    name: 'Garmin',
    icon: 'activity',
    description: 'Connect via Garmin Connect OAuth for activity sync and health data',
    realTimeHR: false, // Real-time requires companion app
    postRunSync: true,
    supported: true,
    requiresDevBuild: false, // OAuth works in Expo Go
  },
  {
    type: 'coros',
    name: 'COROS',
    icon: 'compass',
    description: 'Connect via COROS API for post-run activity sync',
    realTimeHR: false,
    postRunSync: true,
    supported: true,
    requiresDevBuild: false,
  },
  {
    type: 'strava',
    name: 'Strava',
    icon: 'trending-up',
    description: 'Connect via Strava API for post-run activity sync',
    realTimeHR: false,
    postRunSync: true,
    supported: true,
    requiresDevBuild: false,
  },
];

interface ConnectedDevice {
  id: string;
  deviceType: string;
  deviceName: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
}

export default function ConnectedDevicesScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectingDevice, setConnectingDevice] = useState<DeviceType | null>(null);
  const [syncingWellness, setSyncingWellness] = useState(false);
  const [garminWellness, setGarminWellness] = useState<GarminWellnessData | null>(null);
  
  // BLE Heart Rate
  const {
    isScanning,
    devices: bleDevices,
    connectedDevice: bleConnectedDevice,
    currentHR,
    isSimulation,
    startScan,
    connect: connectBLE,
    disconnect: disconnectBLE,
  } = useBLEHeartRate();

  const { data: connectedDevices = [], isLoading } = useQuery<ConnectedDevice[]>({
    queryKey: ['/api/connected-devices'],
    enabled: !!user,
  });

  const connectMutation = useMutation({
    mutationFn: async (deviceType: DeviceType) => {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/connected-devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceType }),
      });
      if (!response.ok) throw new Error('Failed to connect device');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connected-devices'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/connected-devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to disconnect device');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connected-devices'] });
    },
  });

  // Sync Garmin wellness data
  const handleSyncWellness = useCallback(async () => {
    setSyncingWellness(true);
    try {
      const token = await getStoredToken();
      const baseUrl = getApiUrl();
      
      // Sync wellness data from Garmin
      const syncResponse = await fetch(`${baseUrl}/api/garmin/wellness/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!syncResponse.ok) {
        throw new Error('Failed to sync wellness data');
      }
      
      const syncResult = await syncResponse.json();
      
      // Get today's wellness data
      const today = new Date().toISOString().split('T')[0];
      const wellnessResponse = await fetch(`${baseUrl}/api/garmin/wellness/${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (wellnessResponse.ok) {
        const data = await wellnessResponse.json();
        if (data.wellness) {
          setGarminWellness({
            sleepHours: data.wellness.totalSleepSeconds ? data.wellness.totalSleepSeconds / 3600 : undefined,
            sleepQuality: data.wellness.sleepQuality,
            bodyBattery: data.wellness.bodyBatteryCurrent,
            stressQualifier: data.wellness.stressQualifier,
            hrvStatus: data.wellness.hrvStatus,
            readinessScore: data.wellness.readinessScore,
          });
        }
      }
      
      Alert.alert('Success', `Wellness data synced! ${syncResult.message || ''}`);
    } catch (error: any) {
      console.error('Wellness sync error:', error);
      Alert.alert('Error', error.message || 'Failed to sync wellness data');
    } finally {
      setSyncingWellness(false);
    }
  }, []);

  const handleConnect = useCallback(async (device: DeviceInfo) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Garmin uses OAuth - open browser for authorization
    if (device.type === 'garmin') {
      setConnectingDevice(device.type);
      try {
        const token = await getStoredToken();
        
        // Create the redirect URL for the OAuth callback to use
        const appRedirectUrl = Linking.createURL('/connected-devices');
        console.log('Garmin OAuth redirect URL:', appRedirectUrl);
        
        // Pass the app redirect URL when initiating OAuth so it's encoded in state
        const authEndpoint = new URL('/api/auth/garmin', getApiUrl());
        authEndpoint.searchParams.set('app_redirect', appRedirectUrl);
        
        const response = await fetch(authEndpoint.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to initiate Garmin authorization');
        }
        
        const { authUrl } = await response.json();
        
        // Open Garmin OAuth in browser
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          appRedirectUrl
        );
        
        if (result.type === 'success') {
          // Refresh the connected devices list
          queryClient.invalidateQueries({ queryKey: ['/api/connected-devices'] });
          Alert.alert('Success', 'Garmin connected successfully! Your activities will now sync.');
        }
      } catch (error: any) {
        console.error('Garmin OAuth error:', error);
        Alert.alert('Error', error.message || 'Failed to connect to Garmin');
      } finally {
        setConnectingDevice(null);
      }
      return;
    }
    
    // Apple Watch and Samsung require development build for native access
    if (device.type === 'apple' || device.type === 'samsung') {
      Alert.alert(
        'Development Build Required',
        `Connecting to ${device.name} requires native device access that's not available in Expo Go.\n\nThis feature will work when the app is published to the App Store or Google Play.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Simulate Connection', 
            onPress: async () => {
              setConnectingDevice(device.type);
              try {
                await connectMutation.mutateAsync(device.type);
                Alert.alert('Connected', `${device.name} simulated connection successful. Heart rate data will be simulated during runs.`);
              } catch (error) {
                Alert.alert('Error', 'Failed to connect device');
              } finally {
                setConnectingDevice(null);
              }
            }
          },
        ]
      );
      return;
    }
    
    // COROS and Strava - simple API connection
    setConnectingDevice(device.type);
    try {
      await connectMutation.mutateAsync(device.type);
      Alert.alert('Connected', `${device.name} connected successfully`);
    } catch (error) {
      Alert.alert('Error', 'Failed to connect device');
    } finally {
      setConnectingDevice(null);
    }
  }, [connectMutation, queryClient]);

  const handleDisconnect = useCallback(async (deviceId: string, deviceName: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Disconnect Device',
      `Are you sure you want to disconnect ${deviceName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectMutation.mutateAsync(deviceId);
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect device');
            }
          },
        },
      ]
    );
  }, [disconnectMutation]);

  const isDeviceConnected = (deviceType: DeviceType) => {
    return connectedDevices.some(d => d.deviceType === deviceType && d.isActive);
  };

  const getConnectedDevice = (deviceType: DeviceType) => {
    return connectedDevices.find(d => d.deviceType === deviceType && d.isActive);
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return 'Never synced';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Connected Devices</Text>
        <Text style={styles.subtitle}>
          Connect your fitness watch to track heart rate during runs and sync health metrics
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Feather name="heart" size={20} color={theme.error} />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>Real-Time Heart Rate</Text>
          <Text style={styles.infoText}>
            Get live heart rate data during runs and heart rate zone coaching from your AI coach
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.deviceList}>
          {SUPPORTED_DEVICES.map((device) => {
            const connected = isDeviceConnected(device.type);
            const connectedDevice = getConnectedDevice(device.type);
            const isConnecting = connectingDevice === device.type;

            return (
              <View key={device.type} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <View style={[styles.deviceIcon, connected && styles.deviceIconConnected]}>
                    <Feather 
                      name={device.icon} 
                      size={24} 
                      color={connected ? theme.background : theme.textSecondary} 
                    />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    {connected ? (
                      <Text style={styles.deviceStatus}>
                        Connected {connectedDevice?.lastSyncAt ? `- ${formatLastSync(connectedDevice.lastSyncAt)}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.deviceDescription}>{device.description}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.deviceFeatures}>
                  <View style={styles.featureBadge}>
                    <Feather 
                      name={device.realTimeHR ? "check-circle" : "x-circle"} 
                      size={14} 
                      color={device.realTimeHR ? theme.success : theme.textMuted} 
                    />
                    <Text style={[styles.featureText, !device.realTimeHR && styles.featureDisabled]}>
                      Real-time HR
                    </Text>
                  </View>
                  <View style={styles.featureBadge}>
                    <Feather 
                      name={device.postRunSync ? "check-circle" : "x-circle"} 
                      size={14} 
                      color={device.postRunSync ? theme.success : theme.textMuted} 
                    />
                    <Text style={[styles.featureText, !device.postRunSync && styles.featureDisabled]}>
                      Post-run sync
                    </Text>
                  </View>
                  {device.requiresDevBuild && (
                    <View style={styles.featureBadge}>
                      <Feather name="smartphone" size={14} color={theme.warning} />
                      <Text style={[styles.featureText, { color: theme.warning }]}>
                        Requires app install
                      </Text>
                    </View>
                  )}
                </View>

                {/* Garmin Wellness Data Display */}
                {device.type === 'garmin' && connected && garminWellness ? (
                  <View style={styles.wellnessContainer}>
                    <Text style={styles.wellnessTitle}>Today's Wellness</Text>
                    <View style={styles.wellnessGrid}>
                      {garminWellness.readinessScore !== undefined ? (
                        <View style={styles.wellnessItem}>
                          <Text style={styles.wellnessValue}>{garminWellness.readinessScore}</Text>
                          <Text style={styles.wellnessLabel}>Readiness</Text>
                        </View>
                      ) : null}
                      {garminWellness.bodyBattery !== undefined ? (
                        <View style={styles.wellnessItem}>
                          <Text style={styles.wellnessValue}>{garminWellness.bodyBattery}%</Text>
                          <Text style={styles.wellnessLabel}>Body Battery</Text>
                        </View>
                      ) : null}
                      {garminWellness.sleepHours !== undefined ? (
                        <View style={styles.wellnessItem}>
                          <Text style={styles.wellnessValue}>{garminWellness.sleepHours.toFixed(1)}h</Text>
                          <Text style={styles.wellnessLabel}>Sleep</Text>
                        </View>
                      ) : null}
                      {garminWellness.stressQualifier ? (
                        <View style={styles.wellnessItem}>
                          <Text style={styles.wellnessValue}>{garminWellness.stressQualifier}</Text>
                          <Text style={styles.wellnessLabel}>Stress</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <View style={styles.buttonRow}>
                  {/* Sync Wellness Button for Garmin */}
                  {device.type === 'garmin' && connected ? (
                    <Pressable
                      style={[styles.syncButton, syncingWellness && styles.buttonDisabled]}
                      onPress={handleSyncWellness}
                      disabled={syncingWellness}
                    >
                      {syncingWellness ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={16} color={theme.primary} />
                          <Text style={styles.syncButtonText}>Sync Wellness</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[
                      styles.connectButton,
                      connected && styles.disconnectButton,
                      !device.supported && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      if (connected && connectedDevice) {
                        handleDisconnect(connectedDevice.id, device.name);
                      } else {
                        handleConnect(device);
                      }
                    }}
                    disabled={!device.supported || isConnecting}
                  >
                    {isConnecting ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <>
                        <Feather 
                          name={connected ? "x" : "link"} 
                          size={16} 
                          color={connected ? theme.error : theme.text} 
                        />
                        <Text style={[styles.buttonText, connected && styles.disconnectText]}>
                          {!device.supported 
                            ? `Not available on ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`
                            : connected 
                              ? 'Disconnect' 
                              : 'Connect'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Bluetooth Heart Rate Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bluetooth Heart Rate</Text>
        <Text style={styles.sectionSubtitle}>
          Connect to a Bluetooth heart rate monitor for real-time HR during runs
        </Text>
      </View>
      
      <View style={styles.bleCard}>
        {bleConnectedDevice ? (
          <View style={styles.bleConnected}>
            <View style={styles.bleDeviceRow}>
              <View style={[styles.deviceIcon, styles.deviceIconConnected]}>
                <Feather name="heart" size={24} color={theme.background} />
              </View>
              <View style={styles.bleDeviceInfo}>
                <Text style={styles.bleDeviceName}>{bleConnectedDevice.name}</Text>
                <Text style={styles.bleDeviceStatus}>
                  {currentHR ? `${currentHR} BPM` : 'Connected'}
                  {isSimulation ? ' (Simulated)' : ''}
                </Text>
              </View>
              <Pressable
                style={styles.bleDisconnectButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  disconnectBLE();
                }}
              >
                <Feather name="x" size={20} color={theme.error} />
              </Pressable>
            </View>
            {bleConnectedDevice.batteryLevel ? (
              <View style={styles.bleBattery}>
                <Feather name="battery" size={14} color={theme.textSecondary} />
                <Text style={styles.bleBatteryText}>{bleConnectedDevice.batteryLevel}%</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View>
            <Pressable
              style={[styles.scanButton, isScanning && styles.scanButtonActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                startScan();
              }}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Feather name="bluetooth" size={20} color={theme.text} />
              )}
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan for HR Monitors'}
              </Text>
            </Pressable>
            
            {bleDevices.length > 0 ? (
              <View style={styles.bleDeviceList}>
                {bleDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    style={styles.bleDeviceItem}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const success = await connectBLE(device.id);
                      if (success) {
                        Alert.alert('Connected', `${device.name} connected successfully`);
                      }
                    }}
                  >
                    <View style={styles.bleDeviceItemIcon}>
                      <Feather name="heart" size={18} color={theme.primary} />
                    </View>
                    <View style={styles.bleDeviceItemInfo}>
                      <Text style={styles.bleDeviceItemName}>{device.name}</Text>
                      <Text style={styles.bleDeviceItemSignal}>
                        Signal: {device.rssi ? `${Math.min(100, Math.max(0, 100 + device.rssi))}%` : 'Unknown'}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            
            {isSimulation ? (
              <View style={styles.simulationNote}>
                <Feather name="info" size={14} color={theme.warning} />
                <Text style={styles.simulationNoteText}>
                  Bluetooth requires a development build. Data will be simulated in Expo Go.
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.garminTip}>
        <Feather name="zap" size={16} color={theme.primary} />
        <Text style={styles.garminTipText}>
          Garmin users: Enable "Broadcast Heart Rate" in your watch settings to stream live HR while using Garmin's native run tracking.
        </Text>
      </View>

      <View style={styles.privacyNote}>
        <Feather name="shield" size={16} color={theme.textMuted} />
        <Text style={styles.privacyText}>
          Your health data is encrypted and never shared with third parties.
          You can disconnect devices at any time.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  loadingContainer: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
  },
  deviceList: {
    gap: Spacing.md,
  },
  deviceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconConnected: {
    backgroundColor: theme.success,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 13,
    color: theme.success,
  },
  deviceDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  deviceFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featureText: {
    fontSize: 12,
    color: theme.text,
  },
  featureDisabled: {
    color: theme.textMuted,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: theme.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  disconnectButton: {
    backgroundColor: theme.surfaceLight,
    borderWidth: 1,
    borderColor: theme.border,
  },
  buttonDisabled: {
    backgroundColor: theme.surfaceLight,
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.background,
  },
  disconnectText: {
    color: theme.error,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 18,
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  bleCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  bleConnected: {
    gap: Spacing.md,
  },
  bleDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bleDeviceInfo: {
    flex: 1,
  },
  bleDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  bleDeviceStatus: {
    fontSize: 14,
    color: theme.success,
    marginTop: 2,
  },
  bleDisconnectButton: {
    padding: Spacing.sm,
  },
  bleBattery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  bleBatteryText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: theme.primary,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  scanButtonActive: {
    backgroundColor: theme.surfaceLight,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.background,
  },
  bleDeviceList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  bleDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceLight,
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.md,
  },
  bleDeviceItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleDeviceItemInfo: {
    flex: 1,
  },
  bleDeviceItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  bleDeviceItemSignal: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  simulationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderRadius: 8,
  },
  simulationNoteText: {
    flex: 1,
    fontSize: 12,
    color: theme.warning,
    lineHeight: 16,
  },
  garminTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
  },
  garminTipText: {
    flex: 1,
    fontSize: 13,
    color: theme.primary,
    lineHeight: 18,
  },
  wellnessContainer: {
    backgroundColor: theme.surfaceLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  wellnessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 10,
  },
  wellnessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  wellnessItem: {
    alignItems: 'center',
    minWidth: 70,
    marginBottom: 4,
  },
  wellnessValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  wellnessLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary,
    gap: 8,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
});
