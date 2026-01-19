import React, { useState, useEffect, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  Pressable, 
  RefreshControl, 
  Image,
  Switch,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { 
  IconTarget, 
  IconClock, 
  IconCloud, 
  IconMap, 
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconTrophy,
  IconPlus,
  IconChevronRight,
  IconRunning,
  IconPlay,
  IconHistory,
  IconMountain,
  IconWatch,
  IconCheck,
} from "@/components/icons/AppIcons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getStoredToken } from "@/lib/token-storage";

interface Goal {
  id: number;
  title: string;
  targetDistance?: number;
  targetTime?: string;
  progress?: number;
}

interface WeatherData {
  temperature: number;
  conditions: string;
}

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

interface RecentRoute {
  id: number;
  distance: number;
  elevation: number;
  address: string;
  difficulty: string;
  status: string;
}

interface PreviousRun {
  id: number;
  distance: number;
  avgPace: string;
  date: string;
  difficulty: string;
}

interface GarminStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  deviceName: string | null;
}

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  // Route planning state
  const [targetDistance, setTargetDistance] = useState(5);
  const [targetTimeEnabled, setTargetTimeEnabled] = useState(false);
  const [targetHours, setTargetHours] = useState("0");
  const [targetMinutes, setTargetMinutes] = useState("25");
  const [targetSeconds, setTargetSeconds] = useState("00");

  // Recent routes and previous runs
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [previousRun, setPreviousRun] = useState<PreviousRun | null>(null);

  // Garmin connection status
  const [garminStatus, setGarminStatus] = useState<GarminStatus>({
    isConnected: false,
    lastSyncAt: null,
    deviceName: null,
  });

  useEffect(() => {
    fetchGoals();
    fetchWeather();
    fetchLocation();
    fetchRecentRoutes();
    fetchPreviousRun();
    fetchGarminStatus();
    
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  // Calculate target time based on 5 min/km pace when distance changes
  const calculateDefaultTime = useCallback((distance: number) => {
    const totalMinutes = distance * 5; // 5 minutes per km
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    setTargetHours(hours.toString());
    setTargetMinutes(minutes.toString().padStart(2, '0'));
    setTargetSeconds("00");
  }, []);

  const fetchGoals = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/goals`, {
        credentials: "include",
      });
      if (response.ok) {
        const goals = await response.json();
        // Get the most recent active goal
        const active = goals.find((g: any) => g.status === "active" || !g.completed);
        setActiveGoal(active || null);
      }
    } catch (error) {
      console.log("Failed to fetch goals:", error);
    }
  };

  const fetchWeather = async () => {
    try {
      // Get current location for weather
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      // Use Open-Meteo free API (no API key required)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&current=temperature_2m,weather_code`;
      const response = await fetch(weatherUrl);
      if (response.ok) {
        const data = await response.json();
        const weatherCode = data.current?.weather_code || 0;
        const conditions = getWeatherCondition(weatherCode);
        setWeather({
          temperature: Math.round(data.current?.temperature_2m || 0),
          conditions,
        });
      }
    } catch (error) {
      console.log("Failed to fetch weather:", error);
    }
  };

  const getWeatherCondition = (code: number): string => {
    if (code === 0) return "Clear";
    if (code <= 3) return "Partly Cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 67) return "Rainy";
    if (code <= 77) return "Snowy";
    if (code <= 99) return "Stormy";
    return "Cloudy";
  };

  const fetchRecentRoutes = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/routes`, {
        credentials: "include",
      });
      if (response.ok) {
        const routes = await response.json();
        setRecentRoutes(routes.slice(0, 4));
      }
    } catch (error) {
      console.log("Failed to fetch routes:", error);
    }
  };

  const fetchPreviousRun = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/runs`, {
        credentials: "include",
      });
      if (response.ok) {
        const runs = await response.json();
        if (runs.length > 0) {
          const lastRun = runs[0];
          setPreviousRun({
            id: lastRun.id,
            distance: parseFloat(lastRun.distance) || 0,
            avgPace: lastRun.avgPace || "--'--\"",
            date: lastRun.date || new Date().toLocaleDateString(),
            difficulty: lastRun.difficulty || "moderate",
          });
        }
      }
    } catch (error) {
      console.log("Failed to fetch runs:", error);
    }
  };

  const fetchLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermissionGranted(status === "granted");
      if (status !== "granted") {
        setLoadingLocation(false);
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      
      if (address) {
        const addressString = [
          address.streetNumber,
          address.street,
          address.city,
          address.postalCode,
          address.country,
        ]
          .filter(Boolean)
          .join(", ");
        
        setLocation({
          address: addressString || "Location found",
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.log("Failed to fetch location:", error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchGarminStatus = async () => {
    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      const response = await fetch(`${baseUrl}/api/connected-devices`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const devices = await response.json();
        const garminDevice = devices.find((d: any) => d.deviceType === "garmin" && d.isActive);
        if (garminDevice) {
          setGarminStatus({
            isConnected: true,
            lastSyncAt: garminDevice.lastSyncAt,
            deviceName: garminDevice.deviceName || "Garmin",
          });
        } else {
          setGarminStatus({
            isConnected: false,
            lastSyncAt: null,
            deviceName: null,
          });
        }
      }
    } catch (error) {
      console.log("Failed to fetch Garmin status:", error);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchGoals(), fetchWeather(), fetchLocation(), fetchRecentRoutes(), fetchPreviousRun(), fetchGarminStatus()]);
    setRefreshing(false);
  };

  const handleRefreshLocation = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchLocation();
  };

  const handleMapMyRun = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Navigate to pre-run setup screen with current distance/time settings
    navigation.navigate("PreRun", {
      mode: 'route',
      initialDistance: targetDistance,
      initialTimeEnabled: targetTimeEnabled,
      initialHours: parseInt(targetHours) || 0,
      initialMinutes: parseInt(targetMinutes) || 0,
      initialSeconds: parseInt(targetSeconds) || 0,
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const handleDistanceChange = useCallback((value: number) => {
    const distance = Math.round(value);
    setTargetDistance(distance);
    if (targetTimeEnabled) {
      calculateDefaultTime(distance);
    }
  }, [targetTimeEnabled, calculateDefaultTime]);

  const handleToggleTargetTime = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newEnabled = !targetTimeEnabled;
    setTargetTimeEnabled(newEnabled);
    if (newEnabled) {
      calculateDefaultTime(targetDistance);
    }
  };

  const handleRunWithoutRoute = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("PreRun", {
      mode: 'free',
      initialDistance: targetDistance,
      initialTimeEnabled: targetTimeEnabled,
      initialHours: parseInt(targetHours) || 0,
      initialMinutes: parseInt(targetMinutes) || 0,
      initialSeconds: parseInt(targetSeconds) || 0,
    });
  };

  const handleRoutePress = (route: RecentRoute) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("RunSession", {
      routeId: route.id,
      targetDistance: route.distance,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* Welcome Header */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeText}>
          <ThemedText type="h2" style={{ color: theme.primary }}>
            {(user?.name || "Runner").toUpperCase()}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Welcome, Plan your run with Coach Carter
          </ThemedText>
        </View>
        <Pressable
          onPress={() => navigation.navigate("ProfileTab")}
          style={[styles.avatarContainer, { borderColor: theme.primary, backgroundColor: theme.primary + "20" }]}
        >
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <IconRunning size={32} color={theme.primary} />
          )}
        </Pressable>
      </View>

      {/* Goal Card */}
      <Pressable onPress={() => navigation.navigate("GoalsTab")}>
        <Card style={[styles.goalCard, { borderColor: theme.border }]}>
          <View style={styles.goalContent}>
            <View style={[styles.goalIcon, { backgroundColor: theme.primary + "20" }]}>
              {activeGoal ? (
                <IconTarget size={24} color={theme.primary} />
              ) : (
                <IconTrophy size={24} color={theme.textMuted} />
              )}
            </View>
            <View style={styles.goalInfo}>
              {activeGoal ? (
                <>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    TIME TARGET
                  </ThemedText>
                  <ThemedText type="h4">{activeGoal.title}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textMuted }}>
                    {activeGoal.targetDistance}K • Target: {activeGoal.targetTime}
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="body">No active goal</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textMuted }}>
                    Set a goal to track your progress
                  </ThemedText>
                </>
              )}
            </View>
            {activeGoal ? (
              <IconChevronRight size={20} color={theme.textMuted} />
            ) : (
              <IconPlus size={20} color={theme.primary} />
            )}
          </View>
        </Card>
      </Pressable>

      {/* Time & Weather Bar */}
      <View style={[styles.weatherBar, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.weatherItem}>
          <IconClock size={16} color={theme.text} />
          <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
            {formatTime(currentTime)}
          </ThemedText>
        </View>
        <ThemedText type="body" style={{ color: theme.textMuted }}>•</ThemedText>
        <View style={styles.weatherItem}>
          <IconCloud size={16} color={theme.text} />
          <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
            {weather ? `${weather.temperature}°` : "--°"}
          </ThemedText>
        </View>
      </View>

      {/* Garmin Connection Indicator */}
      <Pressable 
        onPress={() => navigation.navigate("ProfileTab", { screen: "ConnectedDevices" })}
        style={[
          styles.garminIndicator, 
          { 
            backgroundColor: garminStatus.isConnected 
              ? theme.success + "15" 
              : theme.backgroundSecondary,
            borderColor: garminStatus.isConnected 
              ? theme.success + "40" 
              : theme.border,
          }
        ]}
      >
        <View style={styles.garminLeft}>
          <View style={[
            styles.garminIconContainer, 
            { backgroundColor: garminStatus.isConnected ? theme.success + "20" : theme.backgroundSecondary }
          ]}>
            <IconWatch size={18} color={garminStatus.isConnected ? theme.success : theme.textMuted} />
          </View>
          <View style={styles.garminInfo}>
            <View style={styles.garminTitleRow}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {garminStatus.isConnected ? "Garmin Connected" : "Connect Garmin"}
              </ThemedText>
              {garminStatus.isConnected ? (
                <View style={[styles.connectedBadge, { backgroundColor: theme.success + "20" }]}>
                  <IconCheck size={10} color={theme.success} />
                </View>
              ) : null}
            </View>
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              {garminStatus.isConnected 
                ? `Last sync: ${formatLastSync(garminStatus.lastSyncAt)}`
                : "Tap to connect your watch"
              }
            </ThemedText>
          </View>
        </View>
        <IconChevronRight size={16} color={theme.textMuted} />
      </Pressable>

      {/* Location Card - hidden on native when permission granted (device GPS is more accurate) */}
      {(Platform.OS === "web" || !locationPermissionGranted) ? (
        <Card style={[styles.locationCard, { borderColor: theme.primary }]}>
          <View style={styles.locationHeader}>
            <View style={styles.locationLabel}>
              <IconMapPin size={16} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.xs, color: theme.text }}>
                Location
              </ThemedText>
            </View>
            <View style={styles.locationActions}>
              <Pressable onPress={handleRefreshLocation} style={styles.locationAction}>
                <ThemedText type="link">Refresh</ThemedText>
              </Pressable>
              <Pressable style={styles.locationAction}>
                <ThemedText type="link">Search</ThemedText>
              </Pressable>
            </View>
          </View>
          {location ? (
            <>
              <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
                {location.address}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.primary, marginTop: Spacing.xs }}>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </ThemedText>
            </>
          ) : (
            <ThemedText type="body" style={{ color: theme.textMuted, marginTop: Spacing.sm }}>
              {loadingLocation ? "Getting location..." : "Enable location access"}
            </ThemedText>
          )}
        </Card>
      ) : null}

      {/* Target Distance */}
      <View style={styles.section}>
        <View style={styles.distanceHeader}>
          <ThemedText type="h4">TARGET DISTANCE</ThemedText>
          <View style={styles.distanceValue}>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {targetDistance}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textMuted, marginLeft: Spacing.xs }}>
              km
            </ThemedText>
          </View>
        </View>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={42}
            step={1}
            value={targetDistance}
            onValueChange={handleDistanceChange}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.backgroundSecondary}
            thumbTintColor={theme.primary}
          />
        </View>
      </View>

      {/* Target Time */}
      <Pressable onPress={handleToggleTargetTime}>
        <Card style={styles.targetTimeCard}>
          <View style={styles.targetTimeHeader}>
            <View style={styles.targetTimeLeft}>
              <View style={[styles.targetTimeIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <IconClock size={20} color={theme.primary} />
              </View>
              <View>
                <ThemedText type="h4">TARGET TIME</ThemedText>
                <ThemedText type="small" style={{ color: theme.textMuted }}>
                  {targetTimeEnabled ? "Set your goal time" : "Tap to enable"}
                </ThemedText>
              </View>
            </View>
            <View style={[
              styles.toggleBadge, 
              { backgroundColor: targetTimeEnabled ? theme.primary : theme.backgroundSecondary }
            ]}>
              <ThemedText 
                type="small" 
                style={{ color: targetTimeEnabled ? theme.buttonText : theme.textMuted }}
              >
                {targetTimeEnabled ? "ON" : "OFF"}
              </ThemedText>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Time Inputs - shown when enabled */}
      {targetTimeEnabled ? (
        <View style={styles.timeInputs}>
          <View style={styles.timeInputGroup}>
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              HOURS
            </ThemedText>
            <View style={[styles.timeInput, { backgroundColor: theme.backgroundSecondary }]}>
              <TextInput
                style={[styles.timeInputText, { color: theme.primary }]}
                value={targetHours}
                onChangeText={setTargetHours}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          <ThemedText type="h3" style={{ color: theme.textMuted, marginTop: Spacing.xl }}>:</ThemedText>
          <View style={styles.timeInputGroup}>
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              MINUTES
            </ThemedText>
            <View style={[styles.timeInput, { backgroundColor: theme.backgroundSecondary }]}>
              <TextInput
                style={[styles.timeInputText, { color: theme.primary }]}
                value={targetMinutes}
                onChangeText={setTargetMinutes}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          <ThemedText type="h3" style={{ color: theme.textMuted, marginTop: Spacing.xl }}>:</ThemedText>
          <View style={styles.timeInputGroup}>
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              SECONDS
            </ThemedText>
            <View style={[styles.timeInput, { backgroundColor: theme.backgroundSecondary }]}>
              <TextInput
                style={[styles.timeInputText, { color: theme.primary }]}
                value={targetSeconds}
                onChangeText={setTargetSeconds}
                keyboardType="number-pad"
                maxLength={2}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Recent Routes */}
      {recentRoutes.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">RECENT ROUTES</ThemedText>
            <Pressable onPress={() => navigation.navigate("HistoryTab")}>
              <View style={styles.viewAllButton}>
                <ThemedText type="link">View All</ThemedText>
                <IconChevronRight size={16} color={theme.primary} />
              </View>
            </Pressable>
          </View>
          {recentRoutes.map((route) => (
            <Pressable key={route.id} onPress={() => handleRoutePress(route)}>
              <Card style={styles.routeCard}>
                <View style={styles.routeContent}>
                  <View style={styles.routeLeft}>
                    <View style={[styles.difficultyBadge, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText type="small" style={{ color: theme.warning }}>
                        {route.difficulty?.toUpperCase() || "MODERATE"}
                      </ThemedText>
                    </View>
                    <ThemedText type="h4" style={{ color: theme.primary, marginLeft: Spacing.md }}>
                      {route.distance?.toFixed(1) || "0"} km
                    </ThemedText>
                  </View>
                  <IconChevronRight size={20} color={theme.textMuted} />
                </View>
                <ThemedText type="body" style={{ marginTop: Spacing.xs }}>
                  {route.address || "Unknown location"}
                </ThemedText>
                <View style={styles.routeMeta}>
                  <IconMountain size={14} color={theme.textMuted} />
                  <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: Spacing.xs }}>
                    {route.elevation || 0}m
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textMuted, marginLeft: Spacing.lg }}>
                    {route.status || "Never started"}
                  </ThemedText>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Map My Run Button */}
      <Pressable
        onPress={handleMapMyRun}
        style={[styles.mapButton, { backgroundColor: theme.primary }]}
      >
        <IconMapPin size={20} color={theme.backgroundRoot} />
        <ThemedText type="h4" style={{ color: theme.backgroundRoot, marginLeft: Spacing.sm }}>
          MAP MY RUN
        </ThemedText>
      </Pressable>

      {/* Run Without Route Button */}
      <Pressable
        onPress={handleRunWithoutRoute}
        style={[styles.freeRunButton, { backgroundColor: theme.backgroundSecondary }]}
      >
        <IconPlay size={20} color={theme.text} />
        <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
          RUN WITHOUT ROUTE
        </ThemedText>
      </Pressable>

      {/* Previous Runs */}
      {previousRun ? (
        <Pressable onPress={() => navigation.navigate("HistoryTab")}>
          <Card style={styles.previousRunCard}>
            <View style={styles.previousRunHeader}>
              <IconHistory size={20} color={theme.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                PREVIOUS RUNS
              </ThemedText>
            </View>
            <View style={styles.previousRunStats}>
              <View style={styles.previousRunStat}>
                <ThemedText type="small" style={{ color: theme.textMuted }}>DISTANCE</ThemedText>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  {previousRun.distance?.toFixed(2) || "0.00"} km
                </ThemedText>
              </View>
              <View style={styles.previousRunStat}>
                <ThemedText type="small" style={{ color: theme.textMuted }}>AVG PACE</ThemedText>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  {previousRun.avgPace}/km
                </ThemedText>
              </View>
            </View>
            <View style={styles.previousRunMeta}>
              <View style={styles.previousRunMetaItem}>
                <ThemedText type="small" style={{ color: theme.textMuted }}>DATE</ThemedText>
                <ThemedText type="body">{previousRun.date}</ThemedText>
              </View>
              <View style={styles.previousRunMetaItem}>
                <ThemedText type="small" style={{ color: theme.textMuted }}>LEVEL</ThemedText>
                <View style={[styles.difficultyBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="small" style={{ color: theme.warning }}>
                    {previousRun.difficulty || "moderate"}
                  </ThemedText>
                </View>
              </View>
            </View>
            <Pressable 
              style={[styles.viewDashboardButton, { borderColor: theme.primary }]}
              onPress={() => navigation.navigate("HistoryTab")}
            >
              <ThemedText type="body" style={{ color: theme.primary }}>
                View Run Dashboard
              </ThemedText>
              <IconChevronRight size={16} color={theme.primary} />
            </Pressable>
          </Card>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  welcomeLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  menuButton: {
    marginRight: Spacing.md,
    marginTop: Spacing.xs,
  },
  welcomeText: {
    flex: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  goalCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  goalContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  goalInfo: {
    flex: 1,
  },
  weatherBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  weatherItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  locationAction: {},
  section: {
    marginBottom: Spacing.xl,
  },
  distanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: Spacing.md,
  },
  distanceValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  sliderContainer: {
    paddingHorizontal: Spacing.xs,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  targetTimeCard: {
    marginBottom: Spacing.xl,
  },
  targetTimeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  targetTimeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  targetTimeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  toggleBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  timeInputs: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  timeInputGroup: {
    alignItems: "center",
  },
  timeInput: {
    width: 80,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  timeInputText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  freeRunButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  routeCard: {
    marginBottom: Spacing.md,
  },
  routeContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routeLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  previousRunCard: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  previousRunHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  previousRunStats: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  previousRunStat: {
    flex: 1,
  },
  previousRunMeta: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  previousRunMetaItem: {
    gap: Spacing.xs,
  },
  viewDashboardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  garminIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  garminLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  garminIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  garminInfo: {
    gap: 2,
  },
  garminTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  connectedBadge: {
    width: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
