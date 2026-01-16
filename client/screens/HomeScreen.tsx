import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Pressable, RefreshControl, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

const iconMap = require("../../assets/icons/icon-map.png");
const iconRunning = require("../../assets/icons/icon-running.png");
const iconTimer = require("../../assets/icons/icon-timer.png");
const iconTrending = require("../../assets/icons/icon-trending.png");
const iconPlay = require("../../assets/icons/icon-play.png");
const iconProfile = require("../../assets/icons/icon-profile.png");
const iconCalendar = require("../../assets/icons/icon-calendar.png");
const iconTarget = require("../../assets/icons/icon-target.png");
const iconChart = require("../../assets/icons/icon-chart.png");

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatCard } from "@/components/StatCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRuns: 0,
    avgPace: "--:--",
    thisWeekDistance: 0,
  });

  useEffect(() => {
    checkLocationPermission();
    fetchDashboardData();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === "granted");
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");
    if (status === "granted") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/runs`, {
        credentials: "include",
      });
      if (response.ok) {
        const runs = await response.json();
        setRecentRuns(runs.slice(0, 3));
        
        // Calculate stats
        const totalDistance = runs.reduce((acc: number, run: any) => acc + (run.distance || 0), 0);
        const totalRuns = runs.length;
        
        // Calculate average pace
        const totalDuration = runs.reduce((acc: number, run: any) => acc + (run.duration || 0), 0);
        const avgPaceSeconds = totalDistance > 0 ? totalDuration / totalDistance : 0;
        const avgPaceMin = Math.floor(avgPaceSeconds / 60);
        const avgPaceSec = Math.floor(avgPaceSeconds % 60);
        const avgPace = totalDistance > 0 ? `${avgPaceMin}:${avgPaceSec.toString().padStart(2, "0")}` : "--:--";

        // This week's distance
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const thisWeekDistance = runs
          .filter((run: any) => new Date(run.completedAt) >= weekStart)
          .reduce((acc: number, run: any) => acc + (run.distance || 0), 0);

        setStats({
          totalDistance: Math.round(totalDistance * 10) / 10,
          totalRuns,
          avgPace,
          thisWeekDistance: Math.round(thisWeekDistance * 10) / 10,
        });
      }
    } catch (error) {
      console.log("Failed to fetch dashboard data:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleStartRun = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!locationPermission) {
      await requestLocationPermission();
      return;
    }
    navigation.navigate("RunSession");
  };

  const formatDistance = (km: number) => {
    return km >= 1 ? `${km.toFixed(1)}` : `${(km * 1000).toFixed(0)}m`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <View>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Welcome back,
          </ThemedText>
          <ThemedText type="h2">{user?.name || "Runner"}</ThemedText>
        </View>
        <Pressable
          onPress={() => navigation.navigate("ProfileTab")}
          style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}
        >
          {user?.profilePic ? (
            <Image
              source={{ uri: user.profilePic }}
              style={styles.avatar}
            />
          ) : (
            <Image source={iconProfile} style={{ width: 24, height: 24, tintColor: theme.textMuted }} />
          )}
        </Pressable>
      </View>

      {/* Start Run Button */}
      <Card gradient style={styles.startRunCard}>
        <View style={styles.startRunContent}>
          <View style={styles.startRunInfo}>
            <ThemedText type="h3">Ready to Run?</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              {locationPermission
                ? "Tap to start your AI-coached run"
                : "Enable location to start tracking"}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleStartRun}
            style={[styles.startButton, { backgroundColor: theme.primary }]}
          >
            <Image 
              source={locationPermission ? iconPlay : iconMap} 
              style={{ width: 28, height: 28, tintColor: theme.buttonText }} 
            />
          </Pressable>
        </View>
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Total Distance"
          value={stats.totalDistance.toString()}
          unit="km"
          icon={iconMap}
          color={theme.primary}
          style={styles.statCard}
        />
        <StatCard
          label="Total Runs"
          value={stats.totalRuns.toString()}
          icon={iconRunning}
          color={theme.accent}
          style={styles.statCard}
        />
        <StatCard
          label="Avg Pace"
          value={stats.avgPace}
          unit="/km"
          icon={iconTimer}
          color={theme.success}
          style={styles.statCard}
        />
        <StatCard
          label="This Week"
          value={stats.thisWeekDistance.toString()}
          unit="km"
          icon={iconTrending}
          color={theme.warning}
          style={styles.statCard}
        />
      </View>

      {/* Recent Runs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Recent Runs</ThemedText>
          <Pressable onPress={() => navigation.navigate("HistoryTab")}>
            <ThemedText type="link">See All</ThemedText>
          </Pressable>
        </View>
        {recentRuns.length > 0 ? (
          recentRuns.map((run) => (
            <Card
              key={run.id}
              style={styles.runCard}
              onPress={() => navigation.navigate("RunInsights", { runId: run.id })}
            >
              <View style={styles.runCardContent}>
                <View style={styles.runInfo}>
                  <ThemedText type="h4">{formatDistance(run.distance)} km</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {new Date(run.completedAt).toLocaleDateString()}
                  </ThemedText>
                </View>
                <View style={styles.runStats}>
                  <View style={styles.runStat}>
                    <Image source={iconTimer} style={{ width: 14, height: 14, tintColor: theme.textMuted }} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                      {formatDuration(run.duration)}
                    </ThemedText>
                  </View>
                  <View style={styles.runStat}>
                    <Image source={iconTrending} style={{ width: 14, height: 14, tintColor: theme.textMuted }} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                      {run.avgPace || "--:--"}/km
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Image source={iconMap} style={{ width: 32, height: 32, tintColor: theme.textMuted }} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}
              >
                No runs yet. Start your first run!
              </ThemedText>
            </View>
          </Card>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Quick Actions
        </ThemedText>
        <View style={styles.actionsGrid}>
          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => navigation.navigate("EventsTab")}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.primary + "20" }]}>
              <Image source={iconCalendar} style={{ width: 20, height: 20, tintColor: theme.primary }} />
            </View>
            <ThemedText type="small">Events</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => navigation.navigate("GoalsTab")}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.accent + "20" }]}>
              <Image source={iconTarget} style={{ width: 20, height: 20, tintColor: theme.accent }} />
            </View>
            <ThemedText type="small">Goals</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => navigation.navigate("HistoryTab")}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.success + "20" }]}>
              <Image source={iconChart} style={{ width: 20, height: 20, tintColor: theme.success }} />
            </View>
            <ThemedText type="small">History</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionCard, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => navigation.navigate("ProfileTab")}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.warning + "20" }]}>
              <Image source={iconProfile} style={{ width: 20, height: 20, tintColor: theme.warning }} />
            </View>
            <ThemedText type="small">Settings</ThemedText>
          </Pressable>
        </View>
      </View>
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
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 48,
    height: 48,
  },
  startRunCard: {
    marginBottom: Spacing.xl,
  },
  startRunContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  startRunInfo: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  startButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: "50%",
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  runCard: {
    marginBottom: Spacing.sm,
  },
  runCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runInfo: {},
  runStats: {
    alignItems: "flex-end",
  },
  runStat: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyCard: {
    padding: Spacing["2xl"],
  },
  emptyContent: {
    alignItems: "center",
  },
  actionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionCard: {
    width: "23%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
});
