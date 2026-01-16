import React, { useState } from "react";
import { StyleSheet, View, Platform, Linking, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IconLocation, IconRunning, IconMap, IconTimer, IconShield } from "@/components/icons/AppIcons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing } from "@/constants/theme";

const LOCATION_PERMISSION_KEY = "location_permission_granted";

export async function getLocalLocationPermission(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(LOCATION_PERMISSION_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setLocalLocationPermission(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, granted ? "true" : "false");
  } catch (error) {
    console.log("[LocationPermission] Failed to save locally:", error);
  }
}

export default function LocationPermissionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setLocationPermission } = useAuth();
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

      if (Platform.OS !== "web") {
        await Location.requestBackgroundPermissionsAsync();
      }

      await setLocalLocationPermission(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocationPermission(true);
    } catch (error: any) {
      console.log("[LocationPermission] Error:", error.message);
      Alert.alert("Error", "Failed to request location permission. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const skipForNow = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLocalLocationPermission(true);
    setLocationPermission(true);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.content}>
        <Image
          source={require("../../assets/images/location-icon.png")}
          style={styles.locationIcon}
          resizeMode="contain"
        />

        <ThemedText type="h1" style={styles.title}>
          Enable Location
        </ThemedText>

        <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
          AI Run Coach needs access to your device's GPS to accurately track your runs, calculate distance, pace, and route.
        </ThemedText>

        <Card style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <IconLocation size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Real-time GPS tracking during runs
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <IconRunning size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Accurate distance and pace calculation
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <IconMap size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Route mapping and elevation data
            </ThemedText>
          </View>
          <View style={styles.featureRow}>
            <IconTimer size={20} color={theme.primary} />
            <ThemedText type="body" style={styles.featureText}>
              Background tracking (screen locked)
            </ThemedText>
          </View>
        </Card>

        <View style={styles.privacyNote}>
          <IconShield size={18} color={theme.textSecondary} />
          <ThemedText type="small" style={[styles.privacyText, { color: theme.textSecondary }]}>
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
  locationIcon: {
    width: 120,
    height: 120,
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
