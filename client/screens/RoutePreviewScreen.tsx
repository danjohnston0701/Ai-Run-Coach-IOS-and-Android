import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { MapViewCompat, PolylineCompat, MarkerCompat } from '@/components/MapViewCompat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/query-client';
import { getStoredToken } from '@/lib/token-storage';
import { speechQueue } from '@/lib/speechQueue';
import {
  IconMap,
  IconMountain,
  IconTimer,
  IconRefresh,
  IconPlay,
  IconAlertCircle,
  IconCheck,
  IconTrending,
  IconBrain,
  IconSparkles,
  IconPlus,
  IconX,
} from '@/components/icons/AppIcons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface TurnInstruction {
  instruction: string;
  distance: number;
  maneuver: string;
  startLat: number;
  startLng: number;
}

interface RouteCandidate {
  id: string;
  routeName: string;
  actualDistance: number;
  difficulty: string;
  waypoints: Array<{ lat: number; lng: number }>;
  polyline: string;
  elevationGain: number;
  elevationLoss: number;
  estimatedTime: number;
  turnInstructions: TurnInstruction[];
}

interface RoutePreviewParams {
  mode: 'route' | 'free';
  activityType: 'run' | 'walk';
  targetDistance: number;
  targetTime: { hours: number; minutes: number; seconds: number } | null;
  liveTracking: boolean;
  aiCoach: boolean;
  difficulty?: string;
}

const theme = Colors.dark;

function decodePolylineCompat(encoded: string): Array<{ latitude: number; longitude: number }> {
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

function getDifficultyColor(difficulty: string): string {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return theme.success;
    case 'moderate':
      return theme.warning;
    case 'hard':
    case 'challenging':
      return theme.error;
    default:
      return theme.primary;
  }
}

function getDifficultyOrder(difficulty: string): number {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 0;
    case 'moderate':
      return 1;
    case 'hard':
    case 'challenging':
      return 2;
    default:
      return 1;
  }
}

function interpolateColor(startColor: string, endColor: string, factor: number): string {
  const start = {
    r: parseInt(startColor.slice(1, 3), 16),
    g: parseInt(startColor.slice(3, 5), 16),
    b: parseInt(startColor.slice(5, 7), 16),
  };
  const end = {
    r: parseInt(endColor.slice(1, 3), 16),
    g: parseInt(endColor.slice(3, 5), 16),
    b: parseInt(endColor.slice(5, 7), 16),
  };
  const r = Math.round(start.r + (end.r - start.r) * factor);
  const g = Math.round(start.g + (end.g - start.g) * factor);
  const b = Math.round(start.b + (end.b - start.b) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const GRADIENT_START_COLOR = '#00D4FF';
const GRADIENT_END_COLOR = '#00E676';

function GradientPolyline({ coordinates, strokeWidth = 3 }: { coordinates: Array<{ latitude: number; longitude: number }>; strokeWidth?: number }) {
  if (coordinates.length < 2) return null;
  
  const segments = [];
  const numSegments = Math.min(coordinates.length - 1, 20);
  const pointsPerSegment = Math.max(1, Math.floor(coordinates.length / numSegments));
  
  for (let i = 0; i < numSegments; i++) {
    const startIdx = i * pointsPerSegment;
    const endIdx = i === numSegments - 1 ? coordinates.length : (i + 1) * pointsPerSegment + 1;
    const segmentCoords = coordinates.slice(startIdx, Math.min(endIdx, coordinates.length));
    
    if (segmentCoords.length >= 2) {
      const factor = i / (numSegments - 1);
      const color = interpolateColor(GRADIENT_START_COLOR, GRADIENT_END_COLOR, factor);
      
      segments.push(
        <PolylineCompat
          key={`segment-${i}`}
          coordinates={segmentCoords}
          strokeColor={color}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
        />
      );
    }
  }
  
  return <>{segments}</>;
}

function formatTime(minutes: number | undefined | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes)) {
    return '--';
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

function formatElevation(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '--';
  }
  return Math.round(value).toString();
}

function calculateRegionForCoordinates(coordinates: Array<{ latitude: number; longitude: number }>) {
  if (coordinates.length === 0) return null;
  
  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;
  
  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });
  
  const latDelta = (maxLat - minLat) * 1.4;
  const lngDelta = (maxLng - minLng) * 1.4;
  
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDelta, 0.01),
    longitudeDelta: Math.max(lngDelta, 0.01),
  };
}

export default function RoutePreviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const mapRef = useRef<any>(null);

  const params = route.params as RoutePreviewParams;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [fullscreenMapIndex, setFullscreenMapIndex] = useState<number | null>(null);
  const [mapZoomLevels, setMapZoomLevels] = useState<{[key: number]: number}>({});
  const [showPreRunSummary, setShowPreRunSummary] = useState(false);
  const [preRunSummary, setPreRunSummary] = useState<{
    terrainSummary: string;
    coachAdvice: string;
    temperature?: number;
    conditions?: string;
    windSpeed?: number;
    targetPace?: string;
    estimatedTime?: string;
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      generateRoutes();
    }
  }, [currentLocation]);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 8;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to generate routes');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (err) {
      console.error('Failed to get location:', err);
      setError('Failed to get your current location. Please try again.');
      setLoading(false);
    }
  };

  const generateRoutes = async () => {
    if (!currentLocation || !user) return;

    setLoading(true);
    setError(null);
    setGenerationProgress(0);

    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      
      console.log('[RouteGen] API URL:', baseUrl);
      console.log('[RouteGen] Has token:', !!token);
      console.log('[RouteGen] Location:', currentLocation);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const url = `${baseUrl}/api/routes/generate-options`;
      console.log('[RouteGen] Fetching:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.id,
          startLat: currentLocation.lat,
          startLng: currentLocation.lng,
          distance: params.targetDistance,
          difficulty: params.difficulty || 'moderate',
          activityType: params.activityType || 'run',
        }),
      });

      console.log('[RouteGen] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[RouteGen] Error response:', errorText);
        let errorMessage = 'Failed to generate routes';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Route generation response:', JSON.stringify(data));
      
      // Handle different response formats - API might return { routes: [...] } or just [...]
      const rawRoutes = Array.isArray(data) ? data : (data.routes || data.options || data.candidates || []);
      
      if (!rawRoutes || rawRoutes.length === 0) {
        throw new Error('No routes were generated. Please try again.');
      }

      // Transform routes to match expected interface
      const routesArray = rawRoutes.map((route: any) => ({
        id: route.id,
        routeName: route.routeName || route.name || 'Route',
        actualDistance: route.actualDistance || route.distance || 0,
        difficulty: route.difficulty || 'moderate',
        waypoints: route.waypoints || [],
        polyline: route.polyline || '',
        elevationGain: route.elevationGain ?? route.elevation?.gain ?? route.elevation_gain ?? 0,
        elevationLoss: route.elevationLoss ?? route.elevation?.loss ?? route.elevation_loss ?? 0,
        estimatedTime: route.estimatedTime || route.estimated_time || 0,
        turnInstructions: route.turnInstructions || route.turn_instructions || [],
        terrainType: route.terrainType || route.terrain_type || 'mixed',
        description: route.description || '',
      }));

      setRoutes(routesArray);
      setSelectedRouteIndex(0);
      setGenerationProgress(100);
      
      setTimeout(() => {
        fitMapToRoute(routesArray[0]);
      }, 300);
    } catch (err: any) {
      console.error('Route generation error:', err);
      setError(err.message || 'Failed to generate routes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fitMapToRoute = (routeData: RouteCandidate) => {
    if (!mapRef.current || !routeData) return;

    const coordinates = decodePolylineCompat(routeData.polyline);
    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 60, right: 40, bottom: 200, left: 40 },
        animated: true,
      });
    }
  };

  const handleRouteSelect = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRouteIndex(index);
    fitMapToRoute(routes[index]);
  };

  const fetchPreRunSummary = async () => {
    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute || !currentLocation) return;

    setLoadingSummary(true);
    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      
      // Fetch real weather data from Open-Meteo via our backend
      let weatherData: { temp?: number; condition?: string; windSpeed?: number } = {};
      try {
        const weatherRes = await fetch(
          `${baseUrl}/api/weather/current?lat=${currentLocation.lat}&lng=${currentLocation.lng}`,
          { credentials: 'include' }
        );
        if (weatherRes.ok) {
          const data = await weatherRes.json();
          weatherData = {
            temp: data.temp,
            condition: data.condition,
            windSpeed: data.windSpeed,
          };
        }
      } catch (e) {
        console.log('Weather fetch failed');
      }
      
      // Fetch Garmin wellness data if available
      let wellnessData: { bodyBattery?: number; sleepHours?: number; stressQualifier?: string; readinessScore?: number } = {};
      try {
        if (token) {
          const wellnessRes = await fetch(`${baseUrl}/api/coaching/pre-run-briefing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              distance: selectedRoute.actualDistance,
              elevationGain: selectedRoute.elevationGain,
              difficulty: selectedRoute.difficulty,
              activityType: params.activityType,
              weather: weatherData,
            }),
          });
          if (wellnessRes.ok) {
            const data = await wellnessRes.json();
            if (data.garminConnected && data.wellness) {
              wellnessData = {
                bodyBattery: data.wellness.bodyBattery,
                sleepHours: data.wellness.sleepHours,
                stressQualifier: data.wellness.stressQualifier,
                readinessScore: data.wellness.readinessScore,
              };
            }
          }
        }
      } catch (e) {
        console.log('Wellness fetch failed');
      }
      
      // Build fact-based terrain summary
      const distance = selectedRoute.actualDistance;
      const elevGain = Math.round(selectedRoute.elevationGain || 0);
      const elevLoss = Math.round(selectedRoute.elevationLoss || selectedRoute.elevationGain || 0);
      
      let terrainType = "flat";
      if (elevGain > 100) terrainType = "hilly";
      else if (elevGain > 50) terrainType = "undulating";
      
      const terrainSummary = `${distance.toFixed(1)}km ${terrainType} circuit with ${elevGain}m climb and ${elevLoss}m descent.`;
      
      // Calculate target pace if target time is set
      let targetPace: string | undefined = undefined;
      let targetPaceForSpeech: string | undefined = undefined;
      if (params.targetTime && distance > 0) {
        const targetTime = params.targetTime;
        const totalMinutes = (targetTime.hours || 0) * 60 + (targetTime.minutes || 0) + (targetTime.seconds || 0) / 60;
        if (totalMinutes > 0) {
          const paceMinPerKm = totalMinutes / distance;
          const paceMins = Math.floor(paceMinPerKm);
          const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
          targetPace = `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/km`;
          targetPaceForSpeech = `${paceMins} minutes ${paceSecs > 0 ? `and ${paceSecs} seconds` : ''} per kilometre`;
        }
      }
      
      // Estimated time based on route data (only show if target time is set)
      let estimatedTime: string | undefined = undefined;
      if (params.targetTime && selectedRoute.estimatedTime) {
        const mins = Math.floor(selectedRoute.estimatedTime);
        const secs = Math.round((selectedRoute.estimatedTime - mins) * 60);
        estimatedTime = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      
      // Motivational statement
      const motivationalStatements = [
        "You've got this. One step at a time.",
        "Trust your training and enjoy the run.",
        "Every kilometre is progress. Let's go!",
        "Today is your day. Make it count.",
        "Focus, breathe, and run your best.",
      ];
      const coachAdvice = motivationalStatements[Math.floor(Math.random() * motivationalStatements.length)];

      setPreRunSummary({
        terrainSummary,
        coachAdvice,
        temperature: weatherData.temp,
        conditions: weatherData.condition,
        windSpeed: weatherData.windSpeed,
        targetPace,
        estimatedTime,
      });
      
      // Build comprehensive audio briefing
      let audioBriefingParts: string[] = [];
      
      // Distance and terrain
      audioBriefingParts.push(`Today's ${params.activityType === 'walk' ? 'walk' : 'run'} is ${distance.toFixed(1)} kilometres`);
      
      // Elevation summary
      if (elevGain > 10 || elevLoss > 10) {
        if (terrainType === 'hilly') {
          audioBriefingParts.push(`with ${elevGain} metres of climbing. Expect some challenging hills.`);
        } else if (terrainType === 'undulating') {
          audioBriefingParts.push(`with ${elevGain} metres of elevation gain. Some gentle rolling terrain ahead.`);
        } else {
          audioBriefingParts.push(`on mostly flat terrain.`);
        }
      } else {
        audioBriefingParts.push(`on flat terrain.`);
      }
      
      // Target pace (only if set)
      if (targetPaceForSpeech) {
        audioBriefingParts.push(`Your target pace is ${targetPaceForSpeech}.`);
      }
      
      // Garmin body readiness data
      if (wellnessData.readinessScore !== undefined) {
        if (wellnessData.readinessScore >= 80) {
          audioBriefingParts.push(`Your body readiness is excellent at ${wellnessData.readinessScore}. You're primed for a great session.`);
        } else if (wellnessData.readinessScore >= 60) {
          audioBriefingParts.push(`Your body readiness is ${wellnessData.readinessScore}. You're in good shape for this ${params.activityType === 'walk' ? 'walk' : 'run'}.`);
        } else if (wellnessData.readinessScore >= 40) {
          audioBriefingParts.push(`Your body readiness is ${wellnessData.readinessScore}. Consider taking it easy today.`);
        } else {
          audioBriefingParts.push(`Your body readiness is low at ${wellnessData.readinessScore}. Listen to your body and don't push too hard.`);
        }
      } else if (wellnessData.bodyBattery !== undefined) {
        if (wellnessData.bodyBattery >= 70) {
          audioBriefingParts.push(`Your body battery is at ${wellnessData.bodyBattery}%. You've got plenty of energy.`);
        } else if (wellnessData.bodyBattery >= 40) {
          audioBriefingParts.push(`Your body battery is at ${wellnessData.bodyBattery}%. Pace yourself wisely.`);
        } else {
          audioBriefingParts.push(`Your body battery is low at ${wellnessData.bodyBattery}%. Consider a lighter effort today.`);
        }
      }
      
      // Sleep info if no readiness/battery
      if (!wellnessData.readinessScore && !wellnessData.bodyBattery && wellnessData.sleepHours) {
        const sleepHrs = Math.round(wellnessData.sleepHours * 10) / 10;
        if (sleepHrs >= 7) {
          audioBriefingParts.push(`You got ${sleepHrs} hours of sleep. Well rested.`);
        } else if (sleepHrs >= 5) {
          audioBriefingParts.push(`You got ${sleepHrs} hours of sleep. Be mindful of your energy levels.`);
        }
      }
      
      // Motivational close
      audioBriefingParts.push(coachAdvice);
      
      const fullBriefing = audioBriefingParts.join(' ');
      speechQueue.enqueueCoach(fullBriefing);
    } catch (error) {
      console.error('Pre-run summary error:', error);
      const errorAdvice = "Remember to warm up and start at a comfortable pace!";
      setPreRunSummary({
        terrainSummary: `This ${selectedRoute?.actualDistance?.toFixed(1) || '?'}km route awaits you.`,
        coachAdvice: errorAdvice,
      });
      speechQueue.enqueueCoach(errorAdvice);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleStartRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPreRunSummary(true);
    await fetchPreRunSummary();
  };

  const confirmStartRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowPreRunSummary(false);
    
    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute) return;

    try {
      await AsyncStorage.setItem('activeRoute', JSON.stringify(selectedRoute));
    } catch (err) {
      console.error('Failed to save route:', err);
    }

    navigation.replace('RunSession', {
      mode: params.mode,
      activityType: params.activityType,
      targetDistance: params.targetDistance,
      targetTime: params.targetTime,
      liveTracking: params.liveTracking,
      aiCoach: params.aiCoach,
      routeId: selectedRoute.id,
      routeName: selectedRoute.routeName,
      routeDistance: selectedRoute.actualDistance,
      polyline: selectedRoute.polyline,
      turnInstructions: selectedRoute.turnInstructions,
      elevationGain: selectedRoute.elevationGain,
      elevationLoss: selectedRoute.elevationLoss,
      waypoints: selectedRoute.waypoints,
      autoStart: true,
    });
  };

  const handleRetry = () => {
    setError(null);
    if (currentLocation) {
      generateRoutes();
    } else {
      getCurrentLocation();
    }
  };

  const selectedRoute = routes[selectedRouteIndex];
  const routeCoordinates = selectedRoute ? decodePolylineCompat(selectedRoute.polyline) : [];

  const coachName = user?.coachName || 'Coach';
  
  const sparkleRotation = useSharedValue(0);
  const sparkleScale = useSharedValue(1);
  const dot1Opacity = useSharedValue(0.3);
  const dot2Opacity = useSharedValue(0.3);
  const dot3Opacity = useSharedValue(0.3);

  useEffect(() => {
    if (loading) {
      sparkleRotation.value = withRepeat(
        withSequence(
          withTiming(-15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      sparkleScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      dot1Opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        ),
        -1,
        true
      );
      dot2Opacity.value = withRepeat(
        withDelay(200, withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        )),
        -1,
        true
      );
      dot3Opacity.value = withRepeat(
        withDelay(400, withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        )),
        -1,
        true
      );
    }
  }, [loading]);

  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sparkleRotation.value}deg` },
      { scale: sparkleScale.value }
    ],
  }));

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1Opacity.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2Opacity.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3Opacity.value }));

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <View style={styles.thinkingContainer}>
        <View style={styles.brainContainer}>
          <View style={styles.brainCircle}>
            <IconBrain size={56} color={theme.primary} />
          </View>
          <Animated.View style={[styles.sparkleContainer, sparkleAnimatedStyle]}>
            <IconSparkles size={28} color="#FFD700" />
          </Animated.View>
        </View>
        
        <Text style={styles.thinkingTitle}>{coachName} is thinking...</Text>
        
        <Text style={styles.analyzingText}>Analyzing terrain and finding the best routes</Text>
        
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.loadingDot, dot1Style]} />
          <Animated.View style={[styles.loadingDot, dot2Style]} />
          <Animated.View style={[styles.loadingDot, dot3Style]} />
        </View>
      </View>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContainer}>
      <View style={styles.errorCard}>
        <View style={styles.errorIconContainer}>
          <IconAlertCircle size={48} color={theme.error} />
        </View>
        <Text style={styles.errorTitle}>Route Generation Failed</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        
        <Pressable style={styles.retryButton} onPress={handleRetry}>
          <IconRefresh size={20} color={theme.backgroundRoot} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRouteCard = (routeData: RouteCandidate, index: number) => {
    const isSelected = index === selectedRouteIndex;
    const difficultyColor = getDifficultyColor(routeData.difficulty);

    return (
      <Pressable
        key={routeData.id}
        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
        onPress={() => handleRouteSelect(index)}
      >
        {isSelected && (
          <View style={styles.selectedBadge}>
            <IconCheck size={14} color={theme.backgroundRoot} />
          </View>
        )}
        
        <View style={styles.routeCardHeader}>
          <Text style={styles.routeName} numberOfLines={1}>
            {routeData.routeName}
          </Text>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
            <Text style={[styles.difficultyText, { color: difficultyColor }]}>
              {routeData.difficulty}
            </Text>
          </View>
        </View>

        <View style={styles.routeStats}>
          <View style={styles.routeStat}>
            <IconMap size={16} color={theme.primary} />
            <Text style={styles.routeStatValue}>{routeData.actualDistance.toFixed(2)} km</Text>
          </View>
          
          <View style={styles.routeStat}>
            <IconTimer size={16} color={theme.primary} />
            <Text style={styles.routeStatValue}>{formatTime(routeData.estimatedTime)}</Text>
          </View>
        </View>

        <View style={styles.elevationRow}>
          <View style={styles.elevationStat}>
            <IconTrending size={14} color={theme.success} />
            <Text style={styles.elevationText}>+{formatElevation(routeData.elevationGain)}m</Text>
          </View>
          <View style={styles.elevationStat}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <IconTrending size={14} color={theme.error} />
            </View>
            <Text style={styles.elevationText}>-{formatElevation(routeData.elevationLoss)}m</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        {renderLoading()}
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        {renderError()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>CHOOSE YOUR ROUTE</Text>
          <Text style={styles.pageSubtitle}>
            Select from {routes.length} route options for your {params.targetDistance.toFixed(1)}km run
          </Text>
          
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GRADIENT_START_COLOR }]} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            <LinearGradient
              colors={[GRADIENT_START_COLOR, GRADIENT_END_COLOR]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.legendGradientLine}
            />
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GRADIENT_END_COLOR }]} />
              <Text style={styles.legendText}>Finish</Text>
            </View>
          </View>
        </View>

        {renderRoutesByDifficulty()}
        
        <Pressable style={styles.regenerateButton} onPress={handleRetry}>
          <IconRefresh size={18} color={theme.text} />
          <Text style={styles.regenerateText}>Generate New Routes</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[styles.startButton, !selectedRoute && styles.startButtonDisabled]}
          onPress={handleStartRun}
          disabled={!selectedRoute}
        >
          <IconPlay size={24} color={theme.backgroundRoot} />
          <Text style={styles.startButtonText}>SELECT A ROUTE</Text>
        </Pressable>
      </View>
      
      {renderFullscreenMap()}
      {renderPreRunSummaryModal()}
    </View>
  );

  function renderPreRunSummaryModal() {
    if (!showPreRunSummary) return null;
    const selectedRoute = routes[selectedRouteIndex];

    return (
      <Modal
        visible={showPreRunSummary}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreRunSummary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.preRunModal}>
            <View style={styles.preRunModalHeader}>
              <Text style={styles.preRunModalTitle}>Pre-Run Briefing</Text>
              <Pressable
                style={styles.preRunCloseButton}
                onPress={() => setShowPreRunSummary(false)}
              >
                <IconX size={24} color={theme.text} />
              </Pressable>
            </View>

            {loadingSummary ? (
              <View style={styles.preRunLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.preRunLoadingText}>Preparing your briefing...</Text>
              </View>
            ) : (
              <ScrollView style={styles.preRunScrollContent} showsVerticalScrollIndicator={false}>
                {preRunSummary?.temperature !== undefined && (
                  <View style={styles.preRunSection}>
                    <View style={styles.preRunSectionHeader}>
                      <View style={[styles.preRunSectionIcon, { backgroundColor: theme.primary + '20' }]}>
                        <IconAlertCircle size={20} color={theme.primary} />
                      </View>
                      <Text style={styles.preRunSectionTitle}>Weather</Text>
                    </View>
                    <View style={styles.weatherStats}>
                      <Text style={styles.weatherStatText}>{Math.round(preRunSummary.temperature)}°C</Text>
                      {preRunSummary.conditions && (
                        <Text style={styles.weatherStatText}>{preRunSummary.conditions}</Text>
                      )}
                      {preRunSummary.windSpeed !== undefined && (
                        <Text style={styles.weatherStatText}>{preRunSummary.windSpeed} km/h wind</Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.preRunSection}>
                  <View style={styles.preRunSectionHeader}>
                    <View style={[styles.preRunSectionIcon, { backgroundColor: theme.success + '20' }]}>
                      <IconMountain size={20} color={theme.success} />
                    </View>
                    <Text style={styles.preRunSectionTitle}>Route Summary</Text>
                  </View>
                  <Text style={styles.preRunSectionText}>
                    {preRunSummary?.terrainSummary || 'Loading terrain data...'}
                  </Text>
                  {preRunSummary?.estimatedTime && (
                    <Text style={[styles.preRunSectionText, { marginTop: 4, color: theme.textMuted }]}>
                      Estimated time: {preRunSummary.estimatedTime} minutes
                    </Text>
                  )}
                </View>

                {params.targetTime && (params.targetTime.hours > 0 || params.targetTime.minutes > 0 || params.targetTime.seconds > 0) && (
                  <View style={styles.preRunSection}>
                    <View style={styles.preRunSectionHeader}>
                      <View style={[styles.preRunSectionIcon, { backgroundColor: theme.warning + '20' }]}>
                        <IconTimer size={20} color={theme.warning} />
                      </View>
                      <Text style={styles.preRunSectionTitle}>Target</Text>
                    </View>
                    <Text style={styles.preRunSectionText}>
                      Target time: {params.targetTime.hours > 0 ? `${params.targetTime.hours}h ` : ''}{params.targetTime.minutes}m {params.targetTime.seconds}s
                    </Text>
                    {preRunSummary?.targetPace && (
                      <Text style={[styles.preRunSectionText, { marginTop: 4, color: theme.primary, fontWeight: '600' }]}>
                        Required pace: {preRunSummary.targetPace}
                      </Text>
                    )}
                  </View>
                )}

                <View style={[styles.preRunSection, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={styles.preRunCoachAdvice}>
                    "{preRunSummary?.coachAdvice || 'Focus on your breathing and enjoy the run!'}"
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.preRunModalFooter}>
              <Pressable
                style={styles.preRunCancelButton}
                onPress={() => setShowPreRunSummary(false)}
              >
                <Text style={styles.preRunCancelText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.preRunStartButton, loadingSummary && styles.preRunStartButtonDisabled]}
                onPress={confirmStartRun}
                disabled={loadingSummary}
              >
                <IconPlay size={20} color={theme.backgroundRoot} />
                <Text style={styles.preRunStartText}>Start Run</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderRoutesByDifficulty() {
    const sortedRoutes = [...routes].map((r, idx) => ({ route: r, originalIndex: idx }))
      .sort((a, b) => getDifficultyOrder(a.route.difficulty) - getDifficultyOrder(b.route.difficulty));
    
    const grouped: { [key: string]: Array<{ route: RouteCandidate; originalIndex: number }> } = {
      easy: [],
      moderate: [],
      hard: [],
    };
    
    sortedRoutes.forEach(item => {
      const diff = item.route.difficulty?.toLowerCase() || 'moderate';
      if (diff === 'easy') grouped.easy.push(item);
      else if (diff === 'hard' || diff === 'challenging') grouped.hard.push(item);
      else grouped.moderate.push(item);
    });
    
    const sections = [
      { key: 'easy', title: 'EASY ROUTES', color: theme.success, routes: grouped.easy },
      { key: 'moderate', title: 'MODERATE ROUTES', color: theme.warning, routes: grouped.moderate },
      { key: 'hard', title: 'HARD ROUTES', color: theme.error, routes: grouped.hard },
    ].filter(s => s.routes.length > 0);
    
    return (
      <>
        {sections.map(section => (
          <View key={section.key}>
            <Text style={[styles.sectionHeader, { color: section.color }]}>
              {section.title}
            </Text>
            {section.routes.map(({ route, originalIndex }) => 
              renderVerticalRouteCard(route, originalIndex)
            )}
          </View>
        ))}
      </>
    );
  }

  function renderVerticalRouteCard(routeData: RouteCandidate, index: number) {
    const isSelected = index === selectedRouteIndex;
    const difficultyColor = getDifficultyColor(routeData.difficulty);
    const cardCoordinates = decodePolylineCompat(routeData.polyline);
    const calculatedRegion = calculateRegionForCoordinates(cardCoordinates);
    
    const elevGain = routeData.elevationGain ?? (routeData as any).elevation_gain;
    const elevLoss = routeData.elevationLoss ?? (routeData as any).elevation_loss;

    return (
      <Pressable
        key={routeData.id}
        style={[styles.verticalCard, isSelected && styles.verticalCardSelected]}
        onPress={() => handleRouteSelect(index)}
      >
        <View style={styles.cardDifficultyBadge}>
          <View style={[styles.difficultyDot, { backgroundColor: difficultyColor }]} />
          <Text style={[styles.difficultyLabel, { color: difficultyColor }]}>
            {routeData.difficulty?.toUpperCase() || 'MODERATE'}
          </Text>
        </View>

        {isSelected && (
          <View style={styles.selectedCheckmark}>
            <IconCheck size={16} color={theme.backgroundRoot} />
          </View>
        )}

        <View style={styles.mapControlsContainer}>
          <Pressable 
            style={styles.mapControlButton}
            onPress={() => setFullscreenMapIndex(index)}
          >
            <IconMap size={16} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.cardMapContainer}>
          <MapViewCompat
            style={styles.cardMap}
            initialRegion={calculatedRegion || undefined}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {cardCoordinates.length > 0 && (
              <>
                <GradientPolyline coordinates={cardCoordinates} strokeWidth={3} />
                <MarkerCompat
                  coordinate={cardCoordinates[0]}
                  pinColor={GRADIENT_START_COLOR}
                />
                <MarkerCompat
                  coordinate={cardCoordinates[cardCoordinates.length - 1]}
                  pinColor={GRADIENT_END_COLOR}
                />
              </>
            )}
          </MapViewCompat>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardMainStats}>
            <View style={styles.cardStatLarge}>
              <IconMap size={18} color={theme.primary} />
              <Text style={styles.cardStatValueLarge}>{routeData.actualDistance?.toFixed(1) || '--'} km</Text>
            </View>
            <View style={styles.cardStatLarge}>
              <IconMountain size={18} color={theme.textSecondary} />
              <Text style={styles.cardStatValueLarge}>{formatElevation(elevGain)}m</Text>
            </View>
          </View>
          
          <View style={styles.cardElevationStats}>
            <View style={styles.cardElevationItem}>
              <IconTrending size={14} color={theme.success} />
              <Text style={styles.cardElevationText}>Climb: {formatElevation(elevGain)}m</Text>
            </View>
            <View style={styles.cardElevationItem}>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <IconTrending size={14} color={theme.error} />
              </View>
              <Text style={styles.cardElevationText}>Descent: {formatElevation(elevLoss)}m</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  function renderFullscreenMap() {
    if (fullscreenMapIndex === null) return null;
    
    const routeData = routes[fullscreenMapIndex];
    if (!routeData) return null;
    
    const cardCoordinates = decodePolylineCompat(routeData.polyline);
    const calculatedRegion = calculateRegionForCoordinates(cardCoordinates);
    const zoomLevel = mapZoomLevels[fullscreenMapIndex] || 1;
    const difficultyColor = getDifficultyColor(routeData.difficulty);
    const isExpert = routeData.difficulty?.toLowerCase() === 'hard' || routeData.difficulty?.toLowerCase() === 'challenging';
    
    const zoomedRegion = calculatedRegion ? {
      ...calculatedRegion,
      latitudeDelta: calculatedRegion.latitudeDelta / zoomLevel,
      longitudeDelta: calculatedRegion.longitudeDelta / zoomLevel,
    } : undefined;
    
    const handleZoomIn = () => {
      setMapZoomLevels(prev => ({
        ...prev,
        [fullscreenMapIndex]: Math.min((prev[fullscreenMapIndex] || 1) * 1.5, 10)
      }));
    };
    
    const handleZoomOut = () => {
      setMapZoomLevels(prev => ({
        ...prev,
        [fullscreenMapIndex]: Math.max((prev[fullscreenMapIndex] || 1) / 1.5, 0.5)
      }));
    };

    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreenMapIndex(null)}
      >
        <View style={styles.fullscreenMapContainer}>
          <MapViewCompat
            style={styles.fullscreenMap}
            initialRegion={zoomedRegion}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
          >
            {cardCoordinates.length > 0 && (
              <>
                <GradientPolyline coordinates={cardCoordinates} strokeWidth={4} />
                <MarkerCompat
                  coordinate={cardCoordinates[0]}
                  pinColor={GRADIENT_START_COLOR}
                />
                <MarkerCompat
                  coordinate={cardCoordinates[cardCoordinates.length - 1]}
                  pinColor={GRADIENT_END_COLOR}
                />
              </>
            )}
          </MapViewCompat>
          
          <View style={[styles.fullscreenHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable 
              style={styles.fullscreenCloseButton}
              onPress={() => setFullscreenMapIndex(null)}
            >
              <IconX size={24} color={theme.text} />
            </Pressable>
            <Text style={styles.fullscreenTitle}>{routeData.routeName}</Text>
          </View>
          
          <View style={[styles.fullscreenZoomControls, { bottom: insets.bottom + 100 }]}>
            <Pressable style={styles.zoomButton} onPress={handleZoomIn}>
              <IconPlus size={20} color={theme.text} />
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable style={styles.zoomButton} onPress={handleZoomOut}>
              <Text style={styles.zoomMinusText}>-</Text>
            </Pressable>
          </View>
          
          <View style={[styles.fullscreenStats, { bottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.fullscreenStatItem}>
              <Text style={styles.fullscreenStatLabel}>Distance</Text>
              <Text style={styles.fullscreenStatValue}>{routeData.actualDistance?.toFixed(1)} km</Text>
            </View>
            <View style={styles.fullscreenStatItem}>
              <Text style={styles.fullscreenStatLabel}>Climb</Text>
              <Text style={styles.fullscreenStatValue}>{formatElevation(routeData.elevationGain)}m</Text>
            </View>
            <View style={styles.fullscreenStatItem}>
              <Text style={styles.fullscreenStatLabel}>Descent</Text>
              <Text style={styles.fullscreenStatValue}>{formatElevation(routeData.elevationLoss)}m</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#304a7d' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#255763' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#023e58' }],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundRoot,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing['3xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  loadingTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.sm,
  },
  loadingSubtitle: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  progressContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.backgroundTertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.small.fontSize,
    color: theme.primary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  loadingHint: {
    fontSize: Typography.caption.fontSize,
    color: theme.textMuted,
    marginTop: Spacing.sm,
  },
  thinkingContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  brainContainer: {
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  brainCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
  },
  sparkleContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  thinkingTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  analyzingText: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
  },
  errorCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing['3xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  errorTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  retryButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: theme.backgroundRoot,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
  },
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
  },
  routesHeader: {
    marginBottom: Spacing.md,
  },
  routesTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: '700',
    color: theme.text,
  },
  routesSubtitle: {
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
    marginTop: 2,
  },
  routeCardsContainer: {
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  routeCard: {
    width: CARD_WIDTH,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.backgroundSecondary,
  },
  selectedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  routeName: {
    fontSize: Typography.h4.fontSize,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  difficultyText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  routeStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  routeStatValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: theme.text,
  },
  elevationRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  elevationStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  elevationText: {
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    flex: 1,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    fontSize: Typography.h4.fontSize,
    fontWeight: '700',
    color: theme.backgroundRoot,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.xs,
  },
  pageSubtitle: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
    marginBottom: Spacing.lg,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: Typography.body.fontSize,
    color: theme.text,
  },
  legendGradientLine: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginHorizontal: Spacing.md,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  legendSeparator: {
    width: 1,
    height: 16,
    backgroundColor: theme.border,
    marginHorizontal: Spacing.md,
  },
  legendLine: {
    flex: 1,
    height: 3,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
  },
  verticalCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  verticalCardSelected: {
    borderColor: theme.primary,
  },
  cardDifficultyBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundRoot + 'CC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    zIndex: 10,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  difficultyLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
  },
  selectedCheckmark: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardMapContainer: {
    height: 180,
    width: '100%',
  },
  cardMap: {
    flex: 1,
  },
  cardContent: {
    padding: Spacing.lg,
  },
  cardMainStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  cardStatLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardStatValueLarge: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
    color: theme.text,
  },
  cardElevationStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  cardElevationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardElevationText: {
    fontSize: Typography.small.fontSize,
    color: theme.success,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  regenerateText: {
    fontSize: Typography.body.fontSize,
    color: theme.text,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: theme.backgroundRoot,
    borderTopWidth: 1,
    borderTopColor: theme.backgroundSecondary,
  },
  mapControlsContainer: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md + 40,
    zIndex: 10,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  mapControlButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: theme.backgroundRoot + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMapContainer: {
    flex: 1,
    backgroundColor: theme.backgroundRoot,
  },
  fullscreenMap: {
    flex: 1,
  },
  fullscreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: theme.backgroundRoot + 'DD',
    gap: Spacing.md,
  },
  fullscreenCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenTitle: {
    flex: 1,
    fontSize: Typography.h4.fontSize,
    fontWeight: '600',
    color: theme.text,
  },
  fullscreenZoomControls: {
    position: 'absolute',
    right: Spacing.lg,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: theme.backgroundRoot,
  },
  zoomMinusText: {
    fontSize: 24,
    color: theme.text,
    fontWeight: '300',
  },
  fullscreenStats: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
  },
  fullscreenStatItem: {
    alignItems: 'center',
  },
  fullscreenStatLabel: {
    fontSize: Typography.caption.fontSize,
    color: theme.textSecondary,
    marginBottom: Spacing.xs,
  },
  fullscreenStatValue: {
    fontSize: Typography.h4.fontSize,
    fontWeight: '700',
    color: theme.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  preRunModal: {
    backgroundColor: theme.backgroundSecondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
  },
  preRunModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  preRunModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  preRunCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundRoot,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preRunLoading: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.lg,
  },
  preRunLoadingText: {
    fontSize: 16,
    color: theme.textMuted,
  },
  preRunScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  preRunSection: {
    marginBottom: Spacing.xl,
  },
  preRunSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  preRunSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preRunSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  preRunSectionText: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 22,
    marginLeft: 48,
  },
  preRunCoachAdvice: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 24,
    marginLeft: 48,
    fontStyle: 'italic',
  },
  weatherStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginLeft: 48,
    marginTop: Spacing.sm,
  },
  weatherStatText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '600',
  },
  preRunModalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  preRunCancelButton: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.backgroundRoot,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preRunCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  preRunStartButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  preRunStartButtonDisabled: {
    opacity: 0.6,
  },
  preRunStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.backgroundRoot,
  },
});
