import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Goal } from "@/lib/types";

export default function GoalsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/goals`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.log("Failed to fetch goals:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchGoals();
    setRefreshing(false);
  };

  const getGoalTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "event":
        return "calendar";
      case "distance_time":
        return "clock";
      case "health_wellbeing":
        return "heart";
      case "consistency":
        return "repeat";
      default:
        return "target";
    }
  };

  const getGoalTypeColor = (type: string) => {
    switch (type) {
      case "event":
        return theme.warning;
      case "distance_time":
        return theme.primary;
      case "health_wellbeing":
        return theme.error;
      case "consistency":
        return theme.success;
      default:
        return theme.accent;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
        return theme.success;
      case "abandoned":
        return theme.error;
      default:
        return theme.primary;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderGoal = ({ item }: { item: Goal }) => {
    const typeColor = getGoalTypeColor(item.type);
    const typeIcon = getGoalTypeIcon(item.type);
    const statusColor = getStatusColor(item.status);
    const progress = item.progressPercent || 0;

    return (
      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("GoalDetails", { goalId: item.id });
        }}
        style={({ pressed }) => [
          styles.goalCard,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.goalHeader}>
          <View style={[styles.goalTypeIcon, { backgroundColor: typeColor + "20" }]}>
            <Feather name={typeIcon} size={20} color={typeColor} />
          </View>
          <View style={styles.goalHeaderText}>
            <ThemedText type="h4" numberOfLines={1}>
              {item.title}
            </ThemedText>
            {item.targetDate ? (
              <View style={styles.targetDate}>
                <Feather name="calendar" size={12} color={theme.textMuted} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  Target: {formatDate(item.targetDate)}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {item.status === "completed" ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check" size={14} color={theme.success} />
            </View>
          ) : (
            <Feather name="chevron-right" size={20} color={theme.textMuted} />
          )}
        </View>

        {item.description ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
            numberOfLines={2}
          >
            {item.description}
          </ThemedText>
        ) : null}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: statusColor,
                  width: `${Math.min(progress, 100)}%`,
                },
              ]}
            />
          </View>
          <ThemedText type="caption" style={{ color: statusColor, marginLeft: Spacing.sm }}>
            {progress}%
          </ThemedText>
        </View>

        {/* Goal Details */}
        <View style={styles.goalDetails}>
          {item.distanceTarget ? (
            <View style={styles.detailItem}>
              <Feather name="map" size={12} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.distanceTarget.replace(/_/g, " ")}
              </ThemedText>
            </View>
          ) : null}
          {item.weeklyRunTarget ? (
            <View style={styles.detailItem}>
              <Feather name="repeat" size={12} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.weeklyRunTarget}x/week
              </ThemedText>
            </View>
          ) : null}
          {item.eventName ? (
            <View style={styles.detailItem}>
              <Feather name="flag" size={12} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.eventName}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading your goals..." />;
  }

  // Separate active and completed goals
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: goals.length === 0 ? 1 : undefined,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={[...activeGoals, ...completedGoals]}
      keyExtractor={(item) => item.id}
      renderItem={renderGoal}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        activeGoals.length > 0 && completedGoals.length > 0 ? (
          <ThemedText type="h4" style={styles.sectionHeader}>
            Active Goals
          </ThemedText>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="target"
          title="No Goals Yet"
          description="Set your first running goal and track your progress towards achieving it"
          actionLabel="Create Goal"
          onAction={() => navigation.navigate("CreateGoal")}
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
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  goalCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  goalTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  goalHeaderText: {
    flex: 1,
  },
  targetDate: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  goalDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
});
