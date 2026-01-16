import React, { useState } from "react";
import { StyleSheet, View, Platform, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

export default function LocationPermissionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const requestLocationPermission = async () => {
    setIsLoading(true);
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== "granted") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Permission Required",
          "Location access is required for GPS tracking during your runs. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: () => {
                if (Platform.OS !== "web") {
                  Linking.openSettings().catch(() => {});
                }
              }
            }
          ]
        );
        setIsLoading(false);
        return;
      }

      let backgroundGranted = false;
      if (Platform.OS !== "web") {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = backgroundStatus === "granted";
      }

      await savePermissionToBackend(foregroundStatus === "granted", backgroundGranted);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshUser();
    } catch (error: any) {
      console.log("[LocationPermission] Error:", error.message);
      Alert.alert("Error", "Failed to request location permission. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const savePermissionToBackend = async (foreground: boolean, background: boolean) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/users/location-permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: user?.id,
          foregroundGranted: foreground,
          backgroundGranted: background,
        }),
        credentials: "include",
      });
      
      if (!response.ok) {
        console.log("[LocationPermission] Failed to save to backend");
      }
    } catch (error) {
      console.log("[LocationPermission] Backend save error:", error);
    }
  };

  const skipForNow = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshUser();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="map-pin" size={64} color={theme.primary} />
        </View>

        <ThemedText type="h1" style={styles.title}>
          Enable Location
        </ThemedText>

        <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
          AI Run Coach needs access to your device's GPS to accurately track your runs, calculate distance, pace, and route.
        </ThemedText>

        <Card style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <Feather name="navigation" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Real-time GPS tracking during runs
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <Feather name="activity" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Accurate distance and pace calculation
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <Feather name="map" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Route mapping and elevation data
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <Feather name="smartphone" size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Background tracking (screen locked)
            </ThemedText>
          </View>
        </Card>

        <View style={styles.privacyNote}>
          <Feather name="shield" size={16} color={theme.textMuted} />
          <ThemedText type="small" style={[styles.privacyText, { color: theme.textMuted }]}>
            Your location data is only used during runs and is never shared with third parties.
          </ThemedText>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button
          onPress={requestLocationPermission}
          loading={isLoading}
          style={styles.primaryButton}
        >
          Enable Location Access
        </Button>
        <Button
          variant="ghost"
          onPress={skipForNow}
          style={styles.skipButton}
        >
          Skip for Now
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  featuresCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  featureText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
  },
  privacyText: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  buttons: {
    gap: Spacing.md,
  },
  primaryButton: {
    marginBottom: 0,
  },
  skipButton: {
    marginBottom: 0,
  },
});
