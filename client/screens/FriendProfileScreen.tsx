import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/Button";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  IconProfile,
  IconActivity,
  IconMap,
  IconClock,
  IconTarget,
  IconAward,
  IconUserX,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface FriendProfile {
  id: string;
  name: string;
  email?: string;
  profilePic?: string;
  userCode?: string;
  fitnessLevel?: string;
  stats?: {
    totalRuns: number;
    totalDistance: number;
    totalDuration: number;
    goalsCompleted: number;
    averagePace?: number;
    currentStreak?: number;
  };
  recentRuns?: Array<{
    id: string;
    date: string;
    distance: number;
    duration: number;
    pace: number;
  }>;
}

export default function FriendProfileScreen({ route, navigation }: any) {
  const { friendId } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingFriend, setRemovingFriend] = useState(false);

  const fetchFriendProfile = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/friends/${friendId}/profile`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFriend(data);
      }
    } catch (error) {
      console.log("Failed to fetch friend profile:", error);
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    fetchFriendProfile();
  }, [fetchFriendProfile]);

  const removeFriend = async () => {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friend?.name} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingFriend(true);
            try {
              const baseUrl = getApiUrl();
              const response = await fetch(`${baseUrl}/api/friends/${friendId}`, {
                method: "DELETE",
                credentials: "include",
              });
              if (response.ok) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.goBack();
              }
            } catch (error) {
              console.log("Failed to remove friend:", error);
            } finally {
              setRemovingFriend(false);
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km >= 100 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
  };

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  };

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!friend) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.errorContainer}>
          <IconProfile size={48} color={theme.textMuted} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
            Profile Not Found
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            This profile may not be available or you may not be friends anymore.
          </ThemedText>
          <Button
            variant="outline"
            onPress={() => navigation.goBack()}
            style={{ marginTop: Spacing.xl }}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  const stats = friend.stats || {
    totalRuns: 0,
    totalDistance: 0,
    totalDuration: 0,
    goalsCompleted: 0,
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundSecondary }]}>
          {friend.profilePic ? (
            <Image source={{ uri: friend.profilePic }} style={styles.avatar} />
          ) : (
            <IconProfile size={48} color={theme.textMuted} />
          )}
        </View>
        <ThemedText type="h2" style={styles.name}>
          {friend.name}
        </ThemedText>
        {friend.userCode ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            #{friend.userCode}
          </ThemedText>
        ) : null}
        {friend.fitnessLevel ? (
          <View style={[styles.levelBadge, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              {friend.fitnessLevel}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardWrapper}>
          <StatCard
            label="Total Runs"
            value={stats.totalRuns.toString()}
            icon={<IconActivity size={20} color={theme.primary} />}
          />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard
            label="Distance"
            value={formatDistance(stats.totalDistance)}
            icon={<IconMap size={20} color={theme.success} />}
          />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard
            label="Duration"
            value={formatDuration(stats.totalDuration)}
            icon={<IconClock size={20} color={theme.warning} />}
          />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard
            label="Goals"
            value={stats.goalsCompleted.toString()}
            icon={<IconTarget size={20} color={theme.accent} />}
          />
        </View>
      </View>

      {stats.averagePace || stats.currentStreak ? (
        <Card style={styles.additionalStats}>
          {stats.averagePace ? (
            <View style={styles.additionalStatRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Average Pace
              </ThemedText>
              <ThemedText type="h4">{formatPace(stats.averagePace)}</ThemedText>
            </View>
          ) : null}
          {stats.currentStreak ? (
            <View style={styles.additionalStatRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Current Streak
              </ThemedText>
              <View style={styles.streakValue}>
                <IconAward size={18} color={theme.warning} />
                <ThemedText type="h4" style={{ marginLeft: 6 }}>
                  {stats.currentStreak} days
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {friend.recentRuns && friend.recentRuns.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Recent Runs
          </ThemedText>
          {friend.recentRuns.slice(0, 5).map((run) => (
            <Card key={run.id} style={styles.runCard}>
              <View style={styles.runHeader}>
                <ThemedText type="body" style={{ fontWeight: "500" }}>
                  {formatDistance(run.distance)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {new Date(run.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </ThemedText>
              </View>
              <View style={styles.runDetails}>
                <View style={styles.runDetail}>
                  <IconClock size={14} color={theme.textMuted} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                    {formatDuration(run.duration)}
                  </ThemedText>
                </View>
                <View style={styles.runDetail}>
                  <IconActivity size={14} color={theme.textMuted} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                    {formatPace(run.pace)}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Button
        variant="outline"
        onPress={removeFriend}
        loading={removingFriend}
        style={[styles.removeButton, { borderColor: theme.error }]}
      >
        <View style={styles.removeButtonContent}>
          <IconUserX size={18} color={theme.error} />
          <ThemedText type="body" style={{ color: theme.error, marginLeft: 8 }}>
            Remove Friend
          </ThemedText>
        </View>
      </Button>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  avatar: {
    width: 120,
    height: 120,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  levelBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
  },
  statCardWrapper: {
    width: "50%",
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  additionalStats: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  additionalStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  streakValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  runCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  runDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  runDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  removeButton: {
    marginTop: Spacing.xl,
  },
  removeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
});
