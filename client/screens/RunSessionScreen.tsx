import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
  Image,
  Text,
} from "react-native";
import aiCoachAvatar from "../../assets/images/ai-coach-avatar.png";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapViewCompat, PolylineCompat, MarkerCompat } from "@/components/MapViewCompat";
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
  type: "encouragement" | "pace" | "navigation" | "milestone" | "terrain" | "weather" | string;
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
  const mapRef = useRef<any>(null);

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
  const [sessionKey] = useState(`session-${Date.now()}`);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentGrade, setCurrentGrade] = useState<number>(0);
  const [weatherData, setWeatherData] = useState<{
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    conditions?: string;
  } | null>(null);
  const [targetTimeSeconds, setTargetTimeSeconds] = useState<number | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastKmRef = useRef<number>(0);
  const lastKmTimeRef = useRef<number>(0);
  const lastElevationRef = useRef<number | null>(null);
  const lastCoachTimeRef = useRef<number>(0);
  const lastPhaseCoachTimeRef = useRef<number>(0);
  const lastHillCoachTimeRef = useRef<number>(0);
  const lastDistanceForGradeRef = useRef<number>(0);
  const recentCoachingTopicsRef = useRef<string[]>([]);
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
        // Extract target time from params
        if (route.params?.targetTime) {
          const tt = route.params.targetTime;
          const seconds = (tt.hours || 0) * 3600 + (tt.minutes || 0) * 60 + (tt.seconds || 0);
          if (seconds > 0) {
            setTargetTimeSeconds(seconds);
          }
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

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const saveCoachingLog = useCallback(async (log: {
    eventType: string;
    topic: string;
    responseText: string;
  }) => {
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/coaching-logs/${sessionKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...log,
          timestamp: Date.now(),
          userId: user?.id,
        }),
      });
    } catch (error) {
      console.log("Save coaching log error:", error);
    }
  }, [sessionKey, user]);

  const phaseCoachingStatements: Record<string, string[]> = {
    early: [
      "Keep your posture tall, imagine a string lifting the top of your head.",
      "Settle into a steady, rhythmic breathing pattern.",
      "Start easy and let your body warm up naturally.",
      "Find your rhythm, focus on relaxed breathing.",
    ],
    mid: [
      "You're in the groove now. Stay relaxed and maintain your rhythm.",
      "Lightly engage your core to keep your torso stable.",
      "Think quick and elastic, lifting the foot up and through.",
      "Great form! Keep those shoulders low and relaxed.",
    ],
    late: [
      "If you're starting to tire, take a deep breath and reset.",
      "Pain fades, pride lasts. Push through this stretch.",
      "When it gets tough, focus on the next 100 meters.",
      "You've got this! Stay mentally strong.",
    ],
    final: [
      "You're almost there! Give it everything you have left.",
      "The finish line is calling. Dig deep and finish strong!",
      "Empty the tank. Leave nothing behind!",
      "Sprint to the finish! You've earned this!",
    ],
    generic: [
      "Remember to smile! It helps you relax.",
      "One step at a time. That's how every journey is conquered.",
      "Great running! Keep up the momentum.",
      "Stay focused on your form and breathing.",
    ],
  };

  const statementUsageRef = useRef<Record<string, number>>({});
  const MAX_STATEMENT_USES = 3;

  const getRunPhase = useCallback((): string => {
    const targetDist = routeData?.actualDistance;
    if (targetDist) {
      const percent = (distance / targetDist) * 100;
      if (percent >= 90) return "final";
      if (percent >= 75) return "late";
      if (percent >= 40 && percent <= 50) return "mid";
      if (percent <= 10) return "early";
      return "generic";
    }
    if (distance <= 2) return "early";
    if (distance >= 3 && distance <= 5) return "mid";
    return "generic";
  }, [distance, routeData]);

  const getAvailableStatement = useCallback((phase: string): string => {
    const statements = phaseCoachingStatements[phase] || phaseCoachingStatements.generic;
    const available = statements.filter(
      (s) => (statementUsageRef.current[s] || 0) < MAX_STATEMENT_USES
    );
    if (available.length === 0) {
      return statements[Math.floor(Math.random() * statements.length)];
    }
    const selected = available[Math.floor(Math.random() * available.length)];
    statementUsageRef.current[selected] = (statementUsageRef.current[selected] || 0) + 1;
    return selected;
  }, []);

  const triggerPhaseCoaching = useCallback(async () => {
    if (!aiCoachEnabled || Date.now() - lastPhaseCoachTimeRef.current < 180000) return;
    
    const phase = getRunPhase();
    const statement = getAvailableStatement(phase);
    
    lastPhaseCoachTimeRef.current = Date.now();
    
    setCoachMessages((prev) => [
      ...prev.slice(-4),
      {
        text: statement,
        timestamp: Date.now(),
        type: "encouragement",
      },
    ]);
    
    await saveCoachingLog({
      eventType: "phase_coaching",
      topic: phase,
      responseText: statement,
    });
  }, [aiCoachEnabled, getRunPhase, getAvailableStatement, saveCoachingLog]);

  const hillCoachingStatements = {
    uphill: [
      "Lean slightly into this hill, pump your arms.",
      "Short, quick steps. Focus on effort, not pace.",
      "You're climbing well. Power through this section.",
      "Hill coming up! Get ready to adjust your stride.",
    ],
    downhill: [
      "Control your descent. Quick, light steps.",
      "Don't overstride downhill - it's hard on your knees.",
      "Let gravity help but stay in control.",
    ],
    crest: [
      "Great climb! You've conquered that hill. Now settle back into your rhythm.",
      "Well done on that incline! Level ground ahead.",
    ],
  };

  const triggerHillCoaching = useCallback(async (grade: number, previousGrade: number) => {
    if (!aiCoachEnabled || Date.now() - lastHillCoachTimeRef.current < 60000) return;
    
    const HILL_THRESHOLD = 5;
    let hillType: "uphill" | "downhill" | "crest" | null = null;
    
    if (grade >= HILL_THRESHOLD) {
      hillType = "uphill";
    } else if (grade <= -HILL_THRESHOLD) {
      hillType = "downhill";
    } else if (previousGrade >= HILL_THRESHOLD && grade < HILL_THRESHOLD) {
      hillType = "crest";
    }
    
    if (!hillType) return;
    
    lastHillCoachTimeRef.current = Date.now();
    const statements = hillCoachingStatements[hillType];
    const statement = statements[Math.floor(Math.random() * statements.length)];
    
    setCoachMessages((prev) => [
      ...prev.slice(-4),
      {
        text: statement,
        timestamp: Date.now(),
        type: "terrain",
      },
    ]);
    
    await saveCoachingLog({
      eventType: "hill_coaching",
      topic: hillType,
      responseText: statement,
    });
  }, [aiCoachEnabled, saveCoachingLog]);

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
          distanceKm: distance,
          totalDistanceKm: routeData?.actualDistance,
          currentPace,
          elapsedSeconds: elapsedTime,
          userFitnessLevel: user?.fitnessLevel || "intermediate",
          userName: user?.name,
          exerciseType: routeData?.difficulty?.includes("walk") ? "walking" : "running",
          terrain: {
            currentAltitude: lastElevationRef.current,
            currentGrade: currentGrade,
            totalElevationGain: elevationGain,
          },
          weather: weatherData,
          recentCoachingTopics: recentCoachingTopicsRef.current.slice(-3),
          kmSplits: kmSplits.map((split) => ({
            km: split.km,
            pace: split.pace,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          if (data.topic) {
            recentCoachingTopicsRef.current = [
              ...recentCoachingTopicsRef.current.slice(-4),
              data.topic,
            ];
          }
          
          setCoachMessages((prev) => [
            ...prev.slice(-4),
            {
              text: data.message,
              timestamp: Date.now(),
              type: data.topic || "encouragement",
            },
          ]);
          
          await saveCoachingLog({
            eventType: "ai_coach",
            topic: data.topic || "real_time_coaching",
            responseText: data.message,
          });
        }
      } else {
        console.log("Coach API error:", response.status);
      }
    } catch (error) {
      console.log("Coach message error:", error);
      showToast("Coach temporarily unavailable");
    }
  }, [aiCoachEnabled, distance, elapsedTime, currentPace, routeData, user, currentGrade, elevationGain, weatherData, kmSplits, saveCoachingLog, showToast]);

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
            
            const distanceSinceLastGrade = distance - lastDistanceForGradeRef.current;
            if (distanceSinceLastGrade >= 0.05) {
              const previousGrade = currentGrade;
              const horizontalDist = distanceSinceLastGrade * 1000;
              const newGrade = horizontalDist > 0 ? (elevDiff / horizontalDist) * 100 : 0;
              setCurrentGrade(newGrade);
              lastDistanceForGradeRef.current = distance;
              
              triggerHillCoaching(newGrade, previousGrade);
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
      const phaseInterval = setInterval(triggerPhaseCoaching, 180000);
      return () => {
        clearInterval(coachInterval);
        clearInterval(phaseInterval);
      };
    }
  }, [runState, aiCoachEnabled, getCoachMessage, triggerPhaseCoaching]);

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
          targetTime: targetTimeSeconds && targetTimeSeconds > 0 ? targetTimeSeconds : undefined,
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

  const formatNavigationInstruction = (instruction: string) => {
    if (!instruction) return '';
    let formatted = instruction
      .replace(/Turn left onto /gi, 'Turn left towards ')
      .replace(/Turn right onto /gi, 'Turn right towards ')
      .replace(/Continue onto /gi, 'Continue on ')
      .replace(/Head (north|south|east|west|northeast|northwest|southeast|southwest) on /gi, 'Head $1 on ');
    return formatted;
  };

  const gpsTrackCoordinates = gpsTrack.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const hasRoute = routeCoordinates.length > 0;
  const latestCoachMessage = coachMessages.length > 0 ? coachMessages[coachMessages.length - 1].text : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.statusIndicators}>
            <View style={[styles.statusPill, { backgroundColor: theme.success + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.success }]}>GPS</Text>
            </View>
            <Pressable 
              onPress={() => setAiCoachEnabled(!aiCoachEnabled)}
              style={[styles.statusPill, { backgroundColor: aiCoachEnabled ? theme.primary + '30' : theme.backgroundSecondary }]}
            >
              {aiCoachEnabled ? (
                <IconVolume size={14} color={theme.primary} />
              ) : (
                <IconVolumeX size={14} color={theme.textMuted} />
              )}
              <Text style={[styles.statusText, { color: aiCoachEnabled ? theme.primary : theme.textMuted }]}>
                COACH {aiCoachEnabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.topActions}>
            <Pressable onPress={handleClose} style={styles.topActionButton}>
              <IconX size={20} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TIME</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{formatTime(elapsedTime)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>DISTANCE</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{distance.toFixed(2)}</Text>
            <Text style={[styles.statUnit, { color: theme.textMuted }]}>km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AVG PACE</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{currentPace}</Text>
            <Text style={[styles.statUnit, { color: theme.textMuted }]}>/km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>CADENCE</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>--</Text>
            <Text style={[styles.statUnit, { color: theme.textMuted }]}>spm</Text>
          </View>
        </View>

        <View style={styles.mainControlSection}>
          {runState === "ready" ? (
            <Pressable
              onPress={handleStart}
              style={[styles.startRunButton, { backgroundColor: theme.success }]}
            >
              <IconPlay size={24} color={theme.backgroundRoot} />
              <Text style={[styles.startRunText, { color: theme.backgroundRoot }]}>START RUN</Text>
            </Pressable>
          ) : runState === "running" ? (
            <View style={styles.runningControlsRow}>
              <Pressable
                onPress={handleStop}
                style={[styles.controlButtonSmall, { backgroundColor: theme.backgroundSecondary }]}
              >
                <IconSquare size={24} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={handlePause}
                style={[styles.pauseButton, { backgroundColor: theme.primary }]}
              >
                <IconPause size={32} color={theme.backgroundRoot} />
              </Pressable>
            </View>
          ) : runState === "paused" ? (
            <View style={styles.runningControlsRow}>
              <Pressable
                onPress={handleStop}
                style={[styles.controlButtonSmall, { backgroundColor: theme.error }]}
              >
                <IconSquare size={24} color={theme.buttonText} />
              </Pressable>
              <Pressable
                onPress={handleResume}
                style={[styles.pauseButton, { backgroundColor: theme.success }]}
              >
                <IconPlay size={32} color={theme.backgroundRoot} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {hasRoute ? (
          <View style={styles.mapSection}>
            <Pressable 
              onPress={() => setShowMap(!showMap)}
              style={styles.mapHeader}
            >
              <View style={styles.mapHeaderLeft}>
                <IconNavigation size={16} color={theme.primary} />
                <Text style={[styles.mapHeaderText, { color: theme.text }]}>
                  {showMap ? 'HIDE MAP' : 'SHOW MAP'}
                </Text>
              </View>
              {showMap ? (
                <IconChevronUp size={20} color={theme.text} />
              ) : (
                <IconChevronDown size={20} color={theme.text} />
              )}
            </Pressable>

            {showMap ? (
              <View style={styles.mapContainer}>
                <MapViewCompat
                  mapRef={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: routeCoordinates[0]?.latitude || 0,
                    longitude: routeCoordinates[0]?.longitude || 0,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <PolylineCompat
                    coordinates={routeCoordinates}
                    strokeColor={theme.primary}
                    strokeWidth={4}
                  />
                  {gpsTrackCoordinates.length > 1 ? (
                    <PolylineCompat
                      coordinates={gpsTrackCoordinates}
                      strokeColor={theme.success}
                      strokeWidth={5}
                    />
                  ) : null}
                  {routeCoordinates.length > 0 ? (
                    <>
                      <MarkerCompat
                        coordinate={routeCoordinates[0]}
                        title="Start"
                        pinColor={theme.success}
                      />
                      <MarkerCompat
                        coordinate={routeCoordinates[routeCoordinates.length - 1]}
                        title="Finish"
                        pinColor={theme.error}
                      />
                    </>
                  ) : null}
                  {currentLocation ? (
                    <MarkerCompat
                      coordinate={{
                        latitude: currentLocation.lat,
                        longitude: currentLocation.lng,
                      }}
                    >
                      <View style={styles.currentLocationMarker}>
                        <View style={[styles.currentLocationDot, { backgroundColor: theme.primary }]} />
                      </View>
                    </MarkerCompat>
                  ) : null}
                </MapViewCompat>

                {currentInstruction ? (
                  <Animated.View
                    entering={FadeIn}
                    style={[styles.navigationCard, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <View style={[styles.navIcon, { backgroundColor: theme.warning }]}>
                      <IconNavigation size={16} color={theme.backgroundRoot} />
                    </View>
                    <Text style={[styles.navText, { color: theme.text }]}>
                      In {formatDistanceToTurn(distanceToNextTurn)}: {formatNavigationInstruction(currentInstruction.instruction)}
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.coachSection}>
          <View style={styles.coachAvatarContainer}>
            <Image source={aiCoachAvatar} style={styles.coachAvatar} resizeMode="contain" />
          </View>
          
          <View style={[styles.coachMessageBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.coachMessageText, { color: theme.primary }]}>
              {latestCoachMessage || (runState === 'ready' 
                ? '"GPS locked! Tap \'Start Run\' when you\'re ready."'
                : '"Keep up the great work!"')}
            </Text>
          </View>

          {runState === 'running' ? (
            <View style={styles.voiceVisualizerRow}>
              {[...Array(20)].map((_, i) => (
                <Animated.View 
                  key={i} 
                  style={[
                    styles.voiceBarAnimated, 
                    { 
                      backgroundColor: theme.primary,
                      height: 4 + Math.random() * 20,
                    }
                  ]} 
                />
              ))}
            </View>
          ) : null}
        </View>

        {kmSplits.length > 0 ? (
          <View style={[styles.splitCard, { backgroundColor: theme.backgroundSecondary }]}>
            <IconFlag size={16} color={theme.success} />
            <Text style={[styles.splitText, { color: theme.text }]}>
              Km {kmSplits[kmSplits.length - 1].km}: {kmSplits[kmSplits.length - 1].pace}
            </Text>
          </View>
        ) : null}

      </ScrollView>

      {toastMessage ? (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.toast, { backgroundColor: theme.backgroundSecondary, top: insets.top + 60 }]}
        >
          <Text style={[styles.toastText, { color: theme.text }]}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statusIndicators: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  topActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  topActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statUnit: {
    fontSize: 10,
    fontWeight: "400",
  },
  mainControlSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  startRunButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.pill,
    gap: Spacing.md,
  },
  startRunText: {
    fontSize: 18,
    fontWeight: "700",
  },
  runningControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  controlButtonSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSection: {
    marginBottom: Spacing.lg,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mapHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  mapHeaderText: {
    fontSize: 14,
    fontWeight: "600",
  },
  mapContainer: {
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  navigationCard: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    flex: 1,
    fontSize: 13,
  },
  coachSection: {
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  coachAvatarContainer: {
    width: 140,
    height: 140,
    marginBottom: Spacing.md,
  },
  coachAvatar: {
    width: "100%",
    height: "100%",
  },
  coachMessageBox: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    maxWidth: "100%",
  },
  coachMessageText: {
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
  },
  voiceVisualizerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 30,
    marginTop: Spacing.lg,
    gap: 2,
  },
  voiceBarAnimated: {
    width: 3,
    borderRadius: 2,
  },
  splitCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  splitText: {
    fontSize: 14,
    fontWeight: "500",
  },
  toast: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    zIndex: 100,
  },
  toastText: {
    fontSize: 14,
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
