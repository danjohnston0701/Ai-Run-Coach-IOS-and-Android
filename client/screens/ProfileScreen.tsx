import React, { useState, ReactNode } from "react";
import { StyleSheet, View, Pressable, Image, Alert, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  IconProfile,
  IconMic,
  IconVolume,
  IconActivity,
  IconTarget,
  IconBell,
  IconGlobe,
  IconCreditCard,
  IconChevronRight,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  color?: string;
  showArrow?: boolean;
}

function MenuItem({ icon, label, value, onPress, color, showArrow = true }: MenuItemProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? theme.backgroundTertiary : "transparent",
        },
      ]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: iconColor + "20" }]}>
        {icon}
      </View>
      <View style={styles.menuContent}>
        <ThemedText type="body">{label}</ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {showArrow ? (
        <IconChevronRight size={20} color={theme.textMuted} />
      ) : null}
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout, isLoading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    const doLogout = async () => {
      setLoggingOut(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await logout();
      } catch (error) {
        console.log("Logout error:", error);
      } finally {
        setLoggingOut(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        doLogout();
      }
    } else {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: doLogout },
        ]
      );
    }
  };

  const openWebApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL("https://airuncoach.live");
  };

  const getSubscriptionBadge = () => {
    if (user?.entitlementType === "premium" || user?.subscriptionStatus === "active") {
      return { label: "Premium", color: theme.warning };
    }
    if (user?.entitlementType === "trial") {
      return { label: "Trial", color: theme.primary };
    }
    return { label: "Free", color: theme.textMuted };
  };

  const badge = getSubscriptionBadge();

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <IconProfile size={40} color={theme.textMuted} />
          )}
        </View>
        <ThemedText type="h3" style={styles.userName}>
          {user?.name || "Runner"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: badge.color + "20" }]}>
          <ThemedText type="caption" style={{ color: badge.color }}>
            {badge.label}
          </ThemedText>
        </View>
      </View>

      {/* Coach Settings */}
      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          AI Coach
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconMic size={18} color={theme.primary} />}
            label="Coach Voice"
            value={`${user?.coachGender || "Male"} - ${user?.coachAccent || "British"}`}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconVolume size={18} color={theme.primary} />}
            label="Coach Tone"
            value={user?.coachTone || "Energetic"}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconProfile size={18} color={theme.primary} />}
            label="Coach Name"
            value={user?.coachName || "AI Coach"}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
        </Card>
      </View>

      {/* Profile Settings */}
      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Profile
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconProfile size={18} color={theme.accent} />}
            label="Personal Details"
            onPress={() => navigation.navigate("PersonalDetails")}
            color={theme.accent}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconActivity size={18} color={theme.success} />}
            label="Fitness Level"
            value={user?.fitnessLevel || "Not set"}
            onPress={() => navigation.navigate("FitnessSettings")}
            color={theme.success}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconTarget size={18} color={theme.warning} />}
            label="Goals"
            onPress={() => navigation.navigate("GoalsTab")}
            color={theme.warning}
          />
        </Card>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Settings
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconBell size={18} color={theme.primary} />}
            label="Notifications"
            onPress={() => navigation.navigate("NotificationSettings")}
            color={theme.primary}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconGlobe size={18} color={theme.textMuted} />}
            label="Open Web App"
            onPress={openWebApp}
            color={theme.textMuted}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconCreditCard size={18} color={theme.warning} />}
            label="Subscription"
            value={badge.label}
            onPress={openWebApp}
            color={theme.warning}
          />
        </Card>
      </View>

      {/* Sign Out */}
      <Button
        variant="outline"
        onPress={handleLogout}
        loading={loggingOut}
        style={styles.logoutButton}
        testID="button-logout"
      >
        Sign Out
      </Button>

      {/* Version */}
      <ThemedText
        type="caption"
        style={[styles.version, { color: theme.textMuted }]}
      >
        AI Run Coach v1.0.0
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  avatar: {
    width: 100,
    height: 100,
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
