import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapViewCompat, PolylineCompat, MarkerCompat } from "@/components/MapViewCompat";
import { IconX, IconNavigation } from "@/components/icons/AppIcons";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const theme = Colors.dark;

type LiveRunViewerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "LiveRunViewer">;
  route: {
    params: {
      sessionId: string;
      runnerId?: string;
      runnerName?: string;
    };
  };
};

interface LiveSession {
  id: string;
  sessionKey: string;
  userId: string;
  isActive: boolean;
  currentLat?: number;
  currentLng?: number;
  currentPace?: string;
  elapsedTime: number;
  distanceCovered: number;
  difficulty?: string;
  cadence?: number;
  gpsTrack: Array<{ lat: number; lng: number; timestamp: number }>;
  kmSplits: Array<{ km: number; time: number; pace: string }>;
  startedAt?: string;
  lastSyncedAt?: string;
}

export default function LiveRunViewerScreen({
  navigation,
  route,
}: LiveRunViewerScreenProps) {
  const insets = useSafeAreaInsets();
  const { sessionId, runnerName } = route.params;
  const mapRef = useRef<any>(null);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runEnded, setRunEnded] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/live-sessions/${sessionId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isActive) {
          setSession(data);
          setError(null);
        } else {
          setRunEnded(true);
        }
      } else {
        setError("Unable to load live session");
      }
    } catch (err) {
      console.error("Fetch live session error:", err);
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    const pollInterval = setInterval(fetchSession, 3000);
    return () => clearInterval(pollInterval);
  }, [fetchSession]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const gpsTrackCoordinates = session?.gpsTrack?.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  })) || [];

  const currentPosition = session?.currentLat && session?.currentLng
    ? { latitude: session.currentLat, longitude: session.currentLng }
    : gpsTrackCoordinates.length > 0
    ? gpsTrackCoordinates[gpsTrackCoordinates.length - 1]
    : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading live session...
        </Text>
      </View>
    );
  }

  if (runEnded) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <Text style={[styles.endedTitle, { color: theme.text }]}>Run Completed!</Text>
        <Text style={[styles.endedSubtitle, { color: theme.textSecondary }]}>
          {runnerName || "Your friend"} has finished their run.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.closeButtonLarge, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.closeButtonText, { color: theme.backgroundRoot }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.closeButtonLarge, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>
            LIVE
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.text }]}>
            {runnerName || "Friend"}'s Run
          </Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <IconX size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TIME</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {formatTime(session?.elapsedTime || 0)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>DISTANCE</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {(session?.distanceCovered || 0).toFixed(2)}
          </Text>
          <Text style={[styles.statUnit, { color: theme.textMuted }]}>km</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>PACE</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {session?.currentPace || "--:--"}
          </Text>
          <Text style={[styles.statUnit, { color: theme.textMuted }]}>/km</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        {currentPosition ? (
          <MapViewCompat
            mapRef={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: currentPosition.latitude,
              longitude: currentPosition.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={{
              latitude: currentPosition.latitude,
              longitude: currentPosition.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {gpsTrackCoordinates.length > 1 ? (
              <PolylineCompat
                coordinates={gpsTrackCoordinates}
                strokeColor={theme.primary}
                strokeWidth={4}
              />
            ) : null}
            {gpsTrackCoordinates.length > 0 ? (
              <MarkerCompat
                coordinate={gpsTrackCoordinates[0]}
                title="Start"
                pinColor={theme.success}
              />
            ) : null}
            {currentPosition ? (
              <MarkerCompat coordinate={currentPosition}>
                <View style={styles.runnerMarker}>
                  <View style={[styles.runnerDot, { backgroundColor: theme.primary }]} />
                </View>
              </MarkerCompat>
            ) : null}
          </MapViewCompat>
        ) : (
          <View style={[styles.map, styles.centerContent]}>
            <Text style={[styles.noLocationText, { color: theme.textMuted }]}>
              Waiting for location data...
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.liveIndicator, { backgroundColor: theme.error + '20' }]}>
        <View style={[styles.liveDot, { backgroundColor: theme.error }]} />
        <Text style={[styles.liveText, { color: theme.error }]}>LIVE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
  },
  endedTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  endedSubtitle: {
    fontSize: 16,
    marginBottom: Spacing["3xl"],
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  closeButtonLarge: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
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
    fontSize: 24,
    fontWeight: "700",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "400",
  },
  mapContainer: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  noLocationText: {
    fontSize: 14,
  },
  runnerMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 212, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  runnerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
