import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { GpsPoint } from "@/lib/types";

type RunSessionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RunSession">;
  route: any;
};

type RunState = "ready" | "running" | "paused" | "finished";

export default function RunSessionScreen({
  navigation,
  route,
}: RunSessionScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [runState, setRunState] = useState<RunState>("ready");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentPace, setCurrentPace] = useState("--:--");
  const [gpsTrack, setGpsTrack] = useState<GpsPoint[]>([]);
  const [kmSplits, setKmSplits] = useState<Array<{ km: number; time: number; pace: string }>>([]);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastKmRef = useRef<number>(0);
  const lastKmTimeRef = useRef<number>(0);

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (runState === "running") {
      pulseAnim.value = withRepeat(
        withTiming(1.1, { duration: 1000 }),
        -1,
        true
      );
    } else {
      pulseAnim.value = withSpring(1);
    }
  }, [runState]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const startLocationTracking = useCallback(async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          const newPoint: GpsPoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            timestamp: Date.now(),
            elevation: location.coords.altitude || undefined,
            accuracy: location.coords.accuracy || undefined,
          };

          setGpsTrack((prev) => {
            const updated = [...prev, newPoint];
            
            // Calculate distance
            if (updated.length > 1) {
              const lastPoint = updated[updated.length - 2];
              const distanceKm = calculateDistance(
                lastPoint.lat,
                lastPoint.lng,
                newPoint.lat,
                newPoint.lng
              );
              
              setDistance((prevDist) => {
                const newDistance = prevDist + distanceKm;
                
                // Check for km split
                const currentKm = Math.floor(newDistance);
                if (currentKm > lastKmRef.current) {
                  const splitTime = elapsedTime - lastKmTimeRef.current;
                  const paceSeconds = splitTime;
                  const paceMin = Math.floor(paceSeconds / 60);
                  const paceSec = Math.floor(paceSeconds % 60);
                  
                  setKmSplits((prevSplits) => [
                    ...prevSplits,
                    {
                      km: currentKm,
                      time: splitTime,
                      pace: `${paceMin}:${paceSec.toString().padStart(2, "0")}`,
                    },
                  ]);
                  
                  lastKmRef.current = currentKm;
                  lastKmTimeRef.current = elapsedTime;
                  
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                
                return newDistance;
              });
            }
            
            return updated;
          });

          // Update current pace
          if (distance > 0 && elapsedTime > 0) {
            const paceSeconds = elapsedTime / distance;
            const paceMin = Math.floor(paceSeconds / 60);
            const paceSec = Math.floor(paceSeconds % 60);
            setCurrentPace(`${paceMin}:${paceSec.toString().padStart(2, "0")}`);
          }
        }
      );
    } catch (error) {
      console.log("Location tracking error:", error);
    }
  }, [distance, elapsedTime]);

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - elapsedTime * 1000;
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [elapsedTime]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunState("running");
    startTimeRef.current = Date.now();
    lastKmTimeRef.current = 0;
    startTimer();
    startLocationTracking();
  };

  const handlePause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunState("paused");
    stopTimer();
    stopLocationTracking();
  };

  const handleResume = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunState("running");
    startTimer();
    startLocationTracking();
  };

  const handleStop = async () => {
    const confirmStop = async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRunState("finished");
      stopTimer();
      stopLocationTracking();
      
      // Save the run
      await saveRun();
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to end your run?")) {
        confirmStop();
      }
    } else {
      Alert.alert(
        "End Run",
        "Are you sure you want to end your run?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "End Run", style: "destructive", onPress: confirmStop },
        ]
      );
    }
  };

  const saveRun = async () => {
    try {
      const baseUrl = getApiUrl();
      const avgPaceSeconds = distance > 0 ? elapsedTime / distance : 0;
      const avgPaceMin = Math.floor(avgPaceSeconds / 60);
      const avgPaceSec = Math.floor(avgPaceSeconds % 60);

      const response = await fetch(`${baseUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          distance: Math.round(distance * 1000) / 1000,
          duration: elapsedTime,
          avgPace: `${avgPaceMin}:${avgPaceSec.toString().padStart(2, "0")}`,
          gpsTrack,
          paceData: kmSplits.map((s) => ({
            km: s.km,
            pace: s.pace,
            paceSeconds: s.time,
          })),
          runDate: new Date().toISOString().split("T")[0],
          runTime: new Date().toISOString().split("T")[1].split(".")[0],
        }),
      });

      if (response.ok) {
        const run = await response.json();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.replace("RunInsights", { runId: run.id });
      } else {
        throw new Error("Failed to save run");
      }
    } catch (error) {
      console.log("Save run error:", error);
      Alert.alert("Error", "Failed to save your run. Please try again.");
    }
  };

  const handleClose = () => {
    if (runState === "running" || runState === "paused") {
      if (Platform.OS === "web") {
        if (window.confirm("Are you sure you want to discard this run?")) {
          stopTimer();
          stopLocationTracking();
          navigation.goBack();
        }
      } else {
        Alert.alert(
          "Discard Run",
          "Are you sure you want to discard this run?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => {
                stopTimer();
                stopLocationTracking();
                navigation.goBack();
              },
            },
          ]
        );
      }
    } else {
      navigation.goBack();
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopLocationTracking();
    };
  }, [stopTimer, stopLocationTracking]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Close Button */}
      <Pressable
        onPress={handleClose}
        style={[
          styles.closeButton,
          {
            top: insets.top + Spacing.md,
            backgroundColor: theme.backgroundSecondary,
          },
        ]}
      >
        <Feather name="x" size={24} color={theme.text} />
      </Pressable>

      {/* Main Stats */}
      <View style={styles.mainStats}>
        {/* Distance */}
        <View style={styles.primaryStat}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            DISTANCE
          </ThemedText>
          <ThemedText style={[Typography.statLarge, { color: theme.primary }]}>
            {distance.toFixed(2)}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            km
          </ThemedText>
        </View>

        {/* Time and Pace Row */}
        <View style={styles.secondaryStats}>
          <View style={styles.stat}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              TIME
            </ThemedText>
            <ThemedText style={[Typography.stat, { color: theme.text }]}>
              {formatTime(elapsedTime)}
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              PACE
            </ThemedText>
            <ThemedText style={[Typography.stat, { color: theme.text }]}>
              {currentPace}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textMuted }}>
              /km
            </ThemedText>
          </View>
        </View>

        {/* Last Split */}
        {kmSplits.length > 0 ? (
          <View style={[styles.splitCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="flag" size={16} color={theme.success} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Km {kmSplits[kmSplits.length - 1].km}: {kmSplits[kmSplits.length - 1].pace}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {runState === "ready" ? (
          <Pressable
            onPress={handleStart}
            style={[styles.startButton, { backgroundColor: theme.success }]}
          >
            <Feather name="play" size={48} color={theme.buttonText} />
          </Pressable>
        ) : runState === "running" ? (
          <View style={styles.runningControls}>
            <Pressable
              onPress={handlePause}
              style={[styles.controlButton, { backgroundColor: theme.warning }]}
            >
              <Feather name="pause" size={32} color={theme.buttonText} />
            </Pressable>
            <Animated.View style={pulseStyle}>
              <View
                style={[
                  styles.runningIndicator,
                  { backgroundColor: theme.error + "20" },
                ]}
              >
                <View style={[styles.runningDot, { backgroundColor: theme.error }]} />
              </View>
            </Animated.View>
            <Pressable
              onPress={handleStop}
              style={[styles.controlButton, { backgroundColor: theme.error }]}
            >
              <Feather name="square" size={32} color={theme.buttonText} />
            </Pressable>
          </View>
        ) : runState === "paused" ? (
          <View style={styles.runningControls}>
            <Pressable
              onPress={handleResume}
              style={[styles.controlButton, { backgroundColor: theme.success }]}
            >
              <Feather name="play" size={32} color={theme.buttonText} />
            </Pressable>
            <ThemedText type="h4" style={{ color: theme.warning }}>
              PAUSED
            </ThemedText>
            <Pressable
              onPress={handleStop}
              style={[styles.controlButton, { backgroundColor: theme.error }]}
            >
              <Feather name="square" size={32} color={theme.buttonText} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Haversine formula to calculate distance between two GPS points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  closeButton: {
    position: "absolute",
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  mainStats: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  primaryStat: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  secondaryStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  statDivider: {
    width: 1,
    height: 60,
  },
  splitCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing["3xl"],
  },
  controls: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  startButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  runningControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
  },
  controlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  runningIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  runningDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
