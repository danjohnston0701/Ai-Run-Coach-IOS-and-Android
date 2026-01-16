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
  IconMenu,
} from "@/components/icons/AppIcons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

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

  // Route planning state
  const [targetDistance, setTargetDistance] = useState(5);
  const [targetTimeEnabled, setTargetTimeEnabled] = useState(false);
  const [targetHours, setTargetHours] = useState("0");
  const [targetMinutes, setTargetMinutes] = useState("30");
  const [targetSeconds, setTargetSeconds] = useState("00");

  useEffect(() => {
    fetchGoals();
    fetchWeather();
    fetchLocation();
    
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
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

  const fetchLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.getForegroundPermissionsAsync();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchGoals(), fetchWeather(), fetchLocation()]);
    setRefreshing(false);
  };

  const handleRefreshLocation = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchLocation();
  };

  const handleMapMyRun = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Navigate to run session with route planning params
    const targetTime = targetTimeEnabled 
      ? `${targetHours}:${targetMinutes.padStart(2, '0')}:${targetSeconds.padStart(2, '0')}`
      : null;
    
    navigation.navigate("RunSession", {
      targetDistance,
      targetTime,
      startLocation: location,
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
    setTargetDistance(Math.round(value));
  }, []);

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
        <View style={styles.welcomeLeft}>
          <Pressable style={styles.menuButton}>
            <IconMenu size={24} color={theme.textMuted} />
          </Pressable>
          <View style={styles.welcomeText}>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {(user?.name || "Runner").toUpperCase()}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Welcome, Plan your run with Coach Carter
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate("ProfileTab")}
          style={[styles.avatarContainer, { borderColor: theme.primary }]}
        >
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <Image 
              source={require("../../assets/icon.png")} 
              style={styles.avatar}
            />
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

      {/* Location Card */}
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
          <Switch
            value={targetTimeEnabled}
            onValueChange={(value) => {
              setTargetTimeEnabled(value);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            trackColor={{ false: theme.backgroundSecondary, true: theme.primary + "50" }}
            thumbColor={targetTimeEnabled ? theme.primary : theme.textMuted}
            style={{ opacity: 0, position: "absolute" }}
          />
        </View>
        
        {targetTimeEnabled ? (
          <View style={styles.timeInputs}>
            <View style={styles.timeInputGroup}>
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
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
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
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
              <ThemedText type="caption" style={{ color: theme.textMuted }}>
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
      </Card>

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
});
