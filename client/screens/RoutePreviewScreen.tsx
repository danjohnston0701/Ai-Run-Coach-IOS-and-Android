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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/query-client';
import {
  IconMap,
  IconMountain,
  IconTimer,
  IconRefresh,
  IconPlay,
  IconAlertCircle,
  IconCheck,
  IconTrending,
} from '@/components/icons/AppIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

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

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} min`;
}

export default function RoutePreviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const params = route.params as RoutePreviewParams;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteCandidate[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);

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
      const response = await fetch(`${baseUrl}/api/routes/generate-options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          startLat: currentLocation.lat,
          startLng: currentLocation.lng,
          targetDistance: params.targetDistance,
          difficulty: params.difficulty || 'moderate',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate routes');
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No routes were generated. Please try again.');
      }

      setRoutes(data);
      setSelectedRouteIndex(0);
      setGenerationProgress(100);
      
      setTimeout(() => {
        fitMapToRoute(data[0]);
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

    const coordinates = decodePolyline(routeData.polyline);
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

  const handleStartRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
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
  const routeCoordinates = selectedRoute ? decodePolyline(selectedRoute.polyline) : [];

  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <View style={styles.loadingCard}>
        <View style={styles.loadingIconContainer}>
          <IconMap size={48} color={theme.primary} />
        </View>
        <Text style={styles.loadingTitle}>Generating Routes</Text>
        <Text style={styles.loadingSubtitle}>
          AI is finding the best routes for your {params.targetDistance.toFixed(1)}km run...
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${generationProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(generationProgress)}%</Text>
        </View>
        
        <Text style={styles.loadingHint}>This may take 10-20 seconds</Text>
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
            <Text style={styles.elevationText}>+{Math.round(routeData.elevationGain)}m</Text>
          </View>
          <View style={styles.elevationStat}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <IconTrending size={14} color={theme.error} />
            </View>
            <Text style={styles.elevationText}>-{Math.round(routeData.elevationLoss)}m</Text>
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
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : undefined
        }
        customMapStyle={mapStyle}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {routeCoordinates.length > 0 && (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={theme.primary}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
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
        )}
      </MapView>

      <LinearGradient
        colors={['transparent', theme.backgroundRoot]}
        style={styles.gradient}
      />

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.routesHeader}>
          <Text style={styles.routesTitle}>Select Your Route</Text>
          <Text style={styles.routesSubtitle}>
            {routes.length} route{routes.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeCardsContainer}
          snapToInterval={CARD_WIDTH + Spacing.md}
          decelerationRate="fast"
        >
          {routes.map((routeData, index) => renderRouteCard(routeData, index))}
        </ScrollView>

        <Pressable
          style={styles.startButton}
          onPress={handleStartRun}
          disabled={!selectedRoute}
        >
          <IconPlay size={24} color={theme.backgroundRoot} />
          <Text style={styles.startButtonText}>START RUN</Text>
        </Pressable>
      </View>
    </View>
  );
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
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  startButtonText: {
    fontSize: Typography.h4.fontSize,
    fontWeight: '700',
    color: theme.backgroundRoot,
  },
});
