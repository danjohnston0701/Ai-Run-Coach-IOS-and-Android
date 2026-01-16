import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

import {
  IconX,
  IconFlag,
  IconPlay,
  IconPause,
  IconSquare,
  IconNavigation,
  IconVolume,
  IconVolumeX,
  IconChevronUp,
  IconChevronDown,
} from "@/components/icons/AppIcons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { GpsPoint } from "@/lib/types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type RunSessionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RunSession">;
  route: any;
};

type RunState = "ready" | "running" | "paused" | "finished";

interface TurnInstruction {
  instruction: string;
  distance: number;
  maneuver: string;
  startLat: number;
  startLng: number;
}

interface RouteData {
  id: string;
  routeName: string;
  polyline: string;
  turnInstructions: TurnInstruction[];
  elevationGain: number;
  elevationLoss: number;
  actualDistance: number;
  difficulty: string;
}

interface CoachMessage {
  text: string;
  timestamp: number;
  type: "encouragement" | "pace" | "navigation" | "milestone";
}

const theme = Colors.dark;

function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

function findNearestTurnInstruction(
  lat: number,
  lng: number,
  instructions: TurnInstruction[]
): { instruction: TurnInstruction | null; distanceToTurn: number; index: number } {
  let nearestInstruction: TurnInstruction | null = null;
  let minDistance = Infinity;
  let nearestIndex = -1;

  instructions.forEach((inst, index) => {
    const dist = calculateDistance(lat, lng, inst.startLat, inst.startLng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestInstruction = inst;
      nearestIndex = index;
    }
  });

  return { instruction: nearestInstruction, distanceToTurn: minDistance * 1000, index: nearestIndex };
}

export default function RunSessionScreen({
  navigation,
  route,
}: RunSessionScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [runState, setRunState] = useState<RunState>("ready");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentPace, setCurrentPace] = useState("--:--");
  const [gpsTrack, setGpsTrack] = useState<GpsPoint[]>([]);
  const [kmSplits, setKmSplits] = useState<Array<{ km: number; time: number; pace: string }>>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [currentInstruction, setCurrentInstruction] = useState<TurnInstruction | null>(null);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number>(0);
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [showMap, setShowMap] = useState(true);
  const [elevationGain, setElevationGain] = useState(0);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastKmRef = useRef<number>(0);
  const lastKmTimeRef = useRef<number>(0);
  const lastElevationRef = useRef<number | null>(null);
  const lastCoachTimeRef = useRef<number>(0);
  const completedInstructionsRef = useRef<Set<number>>(new Set());

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    loadRouteData();
    activateKeepAwakeAsync();
    checkForRecoverySession();

    return () => {
      deactivateKeepAwake();
    };
  }, []);

  const loadRouteData = async () => {
    try {
      const storedRoute = await AsyncStorage.getItem("activeRoute");
      if (storedRoute) {
        const parsed = JSON.parse(storedRoute);
        setRouteData(parsed);
        if (parsed.polyline) {
          const coords = decodePolyline(parsed.polyline);
          setRouteCoordinates(coords);
        }
        if (route.params?.aiCoach !== undefined) {
          setAiCoachEnabled(route.params.aiCoach);
        }
      }
    } catch (error) {
      console.log("Error loading route data:", error);
    }
  };

  const checkForRecoverySession = async () => {
    try {
      const savedSession = await AsyncStorage.getItem("runSession");
      if (savedSession) {
        const session = JSON.parse(savedSession);
        const sessionAge = Date.now() - session.lastSaveTime;
        const twelveHours = 12 * 60 * 60 * 1000;

        if (sessionAge < twelveHours && session.gpsTrack?.length > 0) {
          if (Platform.OS === "web") {
            if (window.confirm("Found an interrupted run session. Would you like to resume?")) {
              restoreSession(session);
            } else {
              await AsyncStorage.removeItem("runSession");
            }
          } else {
            Alert.alert(
              "Resume Run",
              "Found an interrupted run session. Would you like to resume?",
              [
                { text: "Discard", style: "destructive", onPress: () => AsyncStorage.removeItem("runSession") },
                { text: "Resume", onPress: () => restoreSession(session) },
              ]
            );
          }
        } else {
          await AsyncStorage.removeItem("runSession");
        }
      }
    } catch (error) {
      console.log("Error checking recovery session:", error);
    }
  };

  const restoreSession = (session: any) => {
    setElapsedTime(session.elapsedTime || 0);
    setDistance(session.distance || 0);
    setGpsTrack(session.gpsTrack || []);
    setKmSplits(session.kmSplits || []);
    lastKmRef.current = Math.floor(session.distance || 0);
    lastKmTimeRef.current = session.lastKmTime || 0;
    setRunState("paused");
  };

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

  const autoSaveSession = useCallback(async () => {
    try {
      const sessionData = {
        elapsedTime,
        distance,
        gpsTrack,
        kmSplits,
        lastKmTime: lastKmTimeRef.current,
        routeId: routeData?.id,
        lastSaveTime: Date.now(),
      };
      await AsyncStorage.setItem("runSession", JSON.stringify(sessionData));
    } catch (error) {
      console.log("Auto-save error:", error);
    }
  }, [elapsedTime, distance, gpsTrack, kmSplits, routeData]);

  const startAutoSave = useCallback(() => {
    autoSaveRef.current = setInterval(() => {
      autoSaveSession();
    }, 5000);
  }, [autoSaveSession]);

  const stopAutoSave = useCallback(() => {
    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
      autoSaveRef.current = null;
    }
  }, []);

  const getCoachMessage = useCallback(async () => {
    if (!aiCoachEnabled || Date.now() - lastCoachTimeRef.current < 60000) return;
    
    lastCoachTimeRef.current = Date.now();
    
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/ai/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user?.id,
          distance,
          elapsedTime,
          currentPace,
          targetDistance: routeData?.actualDistance,
          difficulty: routeData?.difficulty,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          setCoachMessages((prev) => [
            ...prev.slice(-4),
            {
              text: data.message,
              timestamp: Date.now(),
              type: "encouragement",
            },
          ]);
        }
      }
    } catch (error) {
      console.log("Coach message error:", error);
    }
  }, [aiCoachEnabled, distance, elapsedTime, currentPace, routeData, user]);

  const updateNavigationInstruction = useCallback((lat: number, lng: number) => {
    if (!routeData?.turnInstructions?.length) return;

    const { instruction, distanceToTurn, index } = findNearestTurnInstruction(
      lat,
      lng,
      routeData.turnInstructions
    );

    if (instruction && !completedInstructionsRef.current.has(index)) {
      setCurrentInstruction(instruction);
      setDistanceToNextTurn(distanceToTurn);

      if (distanceToTurn < 20 && index >= 0) {
        completedInstructionsRef.current.add(index);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (index + 1 < routeData.turnInstructions.length) {
          const nextInst = routeData.turnInstructions[index + 1];
          setCurrentInstruction(nextInst);
        }
      }
    }
  }, [routeData]);

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

          setCurrentLocation({ lat: newPoint.lat, lng: newPoint.lng });
          updateNavigationInstruction(newPoint.lat, newPoint.lng);

          if (newPoint.elevation && lastElevationRef.current !== null) {
            const elevDiff = newPoint.elevation - lastElevationRef.current;
            if (elevDiff > 0) {
              setElevationGain((prev) => prev + elevDiff);
            }
          }
          if (newPoint.elevation) {
            lastElevationRef.current = newPoint.elevation;
          }

          setGpsTrack((prev) => {
            const updated = [...prev, newPoint];

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

                const currentKm = Math.floor(newDistance);
                if (currentKm > lastKmRef.current) {
                  const splitTime = elapsedTime - lastKmTimeRef.current;
                  const paceMin = Math.floor(splitTime / 60);
                  const paceSec = Math.floor(splitTime % 60);

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
                  
                  setCoachMessages((prev) => [
                    ...prev.slice(-4),
                    {
                      text: `${currentKm} km complete! Pace: ${paceMin}:${paceSec.toString().padStart(2, "0")}/km`,
                      timestamp: Date.now(),
                      type: "milestone",
                    },
                  ]);
                }

                return newDistance;
              });
            }

            return updated;
          });

          if (distance > 0 && elapsedTime > 0) {
            const paceSeconds = elapsedTime / distance;
            const paceMin = Math.floor(paceSeconds / 60);
            const paceSec = Math.floor(paceSeconds % 60);
            setCurrentPace(`${paceMin}:${paceSec.toString().padStart(2, "0")}`);
          }

          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: newPoint.lat,
              longitude: newPoint.lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 500);
          }
        }
      );
    } catch (error) {
      console.log("Location tracking error:", error);
    }
  }, [distance, elapsedTime, updateNavigationInstruction]);

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

  useEffect(() => {
    if (runState === "running" && aiCoachEnabled) {
      const coachInterval = setInterval(getCoachMessage, 120000);
      return () => clearInterval(coachInterval);
    }
  }, [runState, aiCoachEnabled, getCoachMessage]);

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunState("running");
    startTimeRef.current = Date.now();
    lastKmTimeRef.current = 0;
    startTimer();
    startLocationTracking();
    startAutoSave();
  };

  const handlePause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunState("paused");
    stopTimer();
    stopLocationTracking();
    await autoSaveSession();
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
      stopAutoSave();
      await AsyncStorage.removeItem("runSession");
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
          userId: user?.id,
          routeId: routeData?.id,
          distance: Math.round(distance * 1000) / 1000,
          duration: elapsedTime,
          avgPace: `${avgPaceMin}:${avgPaceSec.toString().padStart(2, "0")}`,
          elevationGain: Math.round(elevationGain),
          gpsTrack,
          paceData: kmSplits.map((s) => ({
            km: s.km,
            pace: s.pace,
            paceSeconds: s.time,
          })),
          aiCoachEnabled,
          difficulty: routeData?.difficulty,
          runDate: new Date().toISOString().split("T")[0],
          runTime: new Date().toISOString().split("T")[1].split(".")[0],
        }),
      });

      if (response.ok) {
        const run = await response.json();
        await AsyncStorage.removeItem("activeRoute");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.replace("RunInsights", { runId: run.id });
      } else {
        throw new Error("Failed to save run");
      }
    } catch (error) {
      console.log("Save run error:", error);
      const localRun = {
        id: `local-${Date.now()}`,
        distance,
        duration: elapsedTime,
        gpsTrack,
        kmSplits,
        runDate: new Date().toISOString().split("T")[0],
        dbSynced: false,
      };
      const localRuns = await AsyncStorage.getItem("localRuns");
      const runs = localRuns ? JSON.parse(localRuns) : [];
      runs.push(localRun);
      await AsyncStorage.setItem("localRuns", JSON.stringify(runs));
      Alert.alert("Saved Locally", "Your run was saved locally and will sync when you're back online.");
      navigation.goBack();
    }
  };

  const handleClose = () => {
    if (runState === "running" || runState === "paused") {
      if (Platform.OS === "web") {
        if (window.confirm("Are you sure you want to discard this run?")) {
          stopTimer();
          stopLocationTracking();
          stopAutoSave();
          AsyncStorage.removeItem("runSession");
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
                stopAutoSave();
                AsyncStorage.removeItem("runSession");
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
      stopAutoSave();
    };
  }, [stopTimer, stopLocationTracking, stopAutoSave]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDistanceToTurn = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const gpsTrackCoordinates = gpsTrack.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
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
        <IconX size={24} color={theme.text} />
      </Pressable>

      <Pressable
        onPress={() => setAiCoachEnabled(!aiCoachEnabled)}
        style={[
          styles.coachButton,
          {
            top: insets.top + Spacing.md,
            backgroundColor: aiCoachEnabled ? theme.primary + "30" : theme.backgroundSecondary,
          },
        ]}
      >
        {aiCoachEnabled ? (
          <IconVolume size={20} color={theme.primary} />
        ) : (
          <IconVolumeX size={20} color={theme.textMuted} />
        )}
      </Pressable>

      {showMap && routeCoordinates.length > 0 ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: routeCoordinates[0]?.latitude || 0,
              longitude: routeCoordinates[0]?.longitude || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            customMapStyle={mapStyle}
          >
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={theme.textMuted}
              strokeWidth={4}
              lineDashPattern={[10, 5]}
            />
            {gpsTrackCoordinates.length > 1 ? (
              <Polyline
                coordinates={gpsTrackCoordinates}
                strokeColor={theme.primary}
                strokeWidth={5}
              />
            ) : null}
            {routeCoordinates.length > 0 ? (
              <>
                <Marker
                  coordinate={routeCoordinates[0]}
                  title="Start"
                  pinColor={theme.success}
                />
                <Marker
                  coordinate={routeCoordinates[routeCoordinates.length - 1]}
                  title="Finish"
                  pinColor={theme.error}
                />
              </>
            ) : null}
            {currentLocation ? (
              <Marker
                coordinate={{
                  latitude: currentLocation.lat,
                  longitude: currentLocation.lng,
                }}
              >
                <View style={styles.currentLocationMarker}>
                  <View style={[styles.currentLocationDot, { backgroundColor: theme.primary }]} />
                </View>
              </Marker>
            ) : null}
          </MapView>

          {currentInstruction ? (
            <Animated.View
              entering={FadeIn}
              style={[styles.navigationCard, { backgroundColor: theme.backgroundSecondary }]}
            >
              <IconNavigation size={24} color={theme.primary} />
              <View style={styles.navigationText}>
                <ThemedText style={[Typography.bodySmall, { color: theme.textSecondary }]}>
                  In {formatDistanceToTurn(distanceToNextTurn)}
                </ThemedText>
                <ThemedText style={[Typography.body, { color: theme.text }]} numberOfLines={1}>
                  {currentInstruction.instruction}
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => setShowMap(!showMap)}
        style={[styles.mapToggle, { backgroundColor: theme.backgroundSecondary }]}
      >
        {showMap ? (
          <IconChevronUp size={20} color={theme.text} />
        ) : (
          <IconChevronDown size={20} color={theme.text} />
        )}
      </Pressable>

      {coachMessages.length > 0 ? (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.coachMessage, { backgroundColor: theme.primary + "20" }]}
        >
          <ThemedText style={[Typography.body, { color: theme.primary }]}>
            {coachMessages[coachMessages.length - 1].text}
          </ThemedText>
        </Animated.View>
      ) : null}

      <View style={styles.mainStats}>
        <View style={styles.primaryStat}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            DISTANCE
          </ThemedText>
          <ThemedText style={[Typography.statLarge, { color: theme.primary }]}>
            {distance.toFixed(2)}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            km
          </ThemedText>
        </View>

        <View style={styles.secondaryStats}>
          <View style={styles.stat}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              TIME
            </ThemedText>
            <ThemedText style={[Typography.stat, { color: theme.text }]}>
              {formatTime(elapsedTime)}
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
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

        {kmSplits.length > 0 ? (
          <View style={[styles.splitCard, { backgroundColor: theme.backgroundSecondary }]}>
            <IconFlag size={16} color={theme.success} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Km {kmSplits[kmSplits.length - 1].km}: {kmSplits[kmSplits.length - 1].pace}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {runState === "ready" ? (
          <Pressable
            onPress={handleStart}
            style={[styles.startButton, { backgroundColor: theme.success }]}
          >
            <IconPlay size={48} color={theme.buttonText} />
          </Pressable>
        ) : runState === "running" ? (
          <View style={styles.runningControls}>
            <Pressable
              onPress={handlePause}
              style={[styles.controlButton, { backgroundColor: theme.warning }]}
            >
              <IconPause size={32} color={theme.buttonText} />
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
              <IconSquare size={32} color={theme.buttonText} />
            </Pressable>
          </View>
        ) : runState === "paused" ? (
          <View style={styles.runningControls}>
            <Pressable
              onPress={handleResume}
              style={[styles.controlButton, { backgroundColor: theme.success }]}
            >
              <IconPlay size={32} color={theme.buttonText} />
            </Pressable>
            <ThemedText type="h4" style={{ color: theme.warning }}>
              PAUSED
            </ThemedText>
            <Pressable
              onPress={handleStop}
              style={[styles.controlButton, { backgroundColor: theme.error }]}
            >
              <IconSquare size={32} color={theme.buttonText} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  coachButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.35,
    marginTop: 80,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  mapToggle: {
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.sm,
  },
  navigationCard: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  navigationText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  coachMessage: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  mainStats: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  primaryStat: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
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
  currentLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 212, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
