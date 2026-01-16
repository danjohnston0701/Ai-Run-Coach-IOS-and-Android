import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  IconChevronRight,
  IconClock,
  IconZap,
  IconHeart,
  IconTrending,
  IconMic,
  IconMap,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Run } from "@/lib/types";

export default function RunHistoryScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/runs`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRuns(data);
      }
    } catch (error) {
      console.log("Failed to fetch runs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchRuns();
    setRefreshing(false);
  };

  const formatDistance = (km: number) => {
    return km >= 1 ? `${km.toFixed(2)} km` : `${(km * 1000).toFixed(0)} m`;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return theme.success;
      case "moderate":
        return theme.warning;
      case "challenging":
      case "hard":
        return theme.accent;
      case "extreme":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const renderRun = ({ item }: { item: Run }) => (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate("RunInsights", { runId: item.id });
      }}
      style={({ pressed }) => [
        styles.runCard,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.runHeader}>
        <View style={styles.runDate}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(item.completedAt || item.runDate || "")}
          </ThemedText>
          {item.difficulty ? (
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(item.difficulty) + "20" },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: getDifficultyColor(item.difficulty) }}
              >
                {item.difficulty}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <IconChevronRight size={20} color={theme.textMuted} />
      </View>

      <View style={styles.runMainStats}>
        <View style={styles.distanceContainer}>
          <ThemedText type="h2" style={{ color: theme.primary }}>
            {formatDistance(item.distance)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.runStats}>
        <View style={styles.statItem}>
          <IconClock size={14} color={theme.textMuted} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
            {formatDuration(item.duration)}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <IconZap size={14} color={theme.textMuted} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
            {item.avgPace || "--:--"}/km
          </ThemedText>
        </View>
        {item.avgHeartRate ? (
          <View style={styles.statItem}>
            <IconHeart size={14} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
              {item.avgHeartRate} bpm
            </ThemedText>
          </View>
        ) : null}
        {item.elevationGain ? (
          <View style={styles.statItem}>
            <IconTrending size={14} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
              {Math.round(item.elevationGain)}m
            </ThemedText>
          </View>
        ) : null}
      </View>

      {item.aiCoachEnabled ? (
        <View style={[styles.aiCoachBadge, { backgroundColor: theme.primary + "20" }]}>
          <IconMic size={12} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            AI Coached
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  if (loading) {
    return <LoadingScreen message="Loading your runs..." />;
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: runs.length === 0 ? 1 : undefined,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={runs}
      keyExtractor={(item) => item.id}
      renderItem={renderRun}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon={<IconMap size={48} color={theme.textMuted} />}
          title="No Runs Yet"
          description="Start your first run and track your progress with AI coaching"
          actionLabel="Start Running"
          onAction={() => navigation.navigate("HomeTab")}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  runCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  runDate: {
    flexDirection: "row",
    alignItems: "center",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.sm,
  },
  runMainStats: {
    marginBottom: Spacing.md,
  },
  distanceContainer: {},
  runStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiCoachBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.md,
  },
});
