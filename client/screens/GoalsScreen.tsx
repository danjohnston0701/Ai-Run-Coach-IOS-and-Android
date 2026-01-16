import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  IconCalendar,
  IconClock,
  IconHeart,
  IconRepeat,
  IconTarget,
  IconCheck,
  IconChevronRight,
  IconMap,
  IconFlag,
  IconPlus,
  IconX,
  IconTrash,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Goal } from "@/lib/types";

type GoalTab = "active" | "completed" | "abandoned";

const TABS: { key: GoalTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "abandoned", label: "Abandoned" },
];

export default function GoalsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<GoalTab>("active");

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

  const updateGoalStatus = async (goalId: string, status: string) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        await fetchGoals();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log("Failed to update goal:", error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/goals/${goalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        await fetchGoals();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log("Failed to delete goal:", error);
    }
  };

  const handleGoalAction = (goal: Goal, action: "complete" | "abandon" | "reactivate" | "delete") => {
    const actionMessages = {
      complete: { title: "Complete Goal", message: "Mark this goal as completed?", status: "completed" },
      abandon: { title: "Abandon Goal", message: "Are you sure you want to abandon this goal?", status: "abandoned" },
      reactivate: { title: "Reactivate Goal", message: "Reactivate this goal?", status: "active" },
      delete: { title: "Delete Goal", message: "Are you sure you want to delete this goal? This cannot be undone.", status: null },
    };

    const { title, message, status } = actionMessages[action];

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: action === "delete" ? "Delete" : "Confirm",
        style: action === "delete" || action === "abandon" ? "destructive" : "default",
        onPress: async () => {
          if (status) {
            await updateGoalStatus(goal.id, status);
          } else {
            await deleteGoal(goal.id);
          }
        },
      },
    ]);
  };

  const getGoalTypeIcon = (type: string, color: string) => {
    switch (type) {
      case "event":
        return <IconCalendar size={20} color={color} />;
      case "distance_time":
        return <IconClock size={20} color={color} />;
      case "health_wellbeing":
        return <IconHeart size={20} color={color} />;
      case "consistency":
        return <IconRepeat size={20} color={color} />;
      default:
        return <IconTarget size={20} color={color} />;
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

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => g.status === activeTab);
  }, [goals, activeTab]);

  const goalCounts = useMemo(() => {
    return {
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      abandoned: goals.filter((g) => g.status === "abandoned").length,
    };
  }, [goals]);

  const renderGoalActions = (goal: Goal) => {
    if (activeTab === "active") {
      return (
        <View style={styles.actionButtons}>
          <Pressable
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleGoalAction(goal, "complete");
            }}
            style={[styles.actionButton, { backgroundColor: theme.success + "20" }]}
          >
            <IconCheck size={16} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, marginLeft: 4 }}>
              Complete
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleGoalAction(goal, "abandon");
            }}
            style={[styles.actionButton, { backgroundColor: theme.error + "20" }]}
          >
            <IconX size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, marginLeft: 4 }}>
              Abandon
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.actionButtons}>
        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleGoalAction(goal, "reactivate");
          }}
          style={[styles.actionButton, { backgroundColor: theme.primary + "20" }]}
        >
          <IconRepeat size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            Reactivate
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleGoalAction(goal, "delete");
          }}
          style={[styles.actionButton, { backgroundColor: theme.error + "20" }]}
        >
          <IconTrash size={16} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.error, marginLeft: 4 }}>
            Delete
          </ThemedText>
        </Pressable>
      </View>
    );
  };

  const renderGoal = ({ item }: { item: Goal }) => {
    const typeColor = getGoalTypeColor(item.type);
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
            opacity: pressed ? 0.95 : 1,
          },
        ]}
      >
        <View style={styles.goalHeader}>
          <View style={[styles.goalTypeIcon, { backgroundColor: typeColor + "20" }]}>
            {getGoalTypeIcon(item.type, typeColor)}
          </View>
          <View style={styles.goalHeaderText}>
            <ThemedText type="h4" numberOfLines={1}>
              {item.title}
            </ThemedText>
            {item.targetDate ? (
              <View style={styles.targetDate}>
                <IconCalendar size={12} color={theme.textMuted} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  Target: {formatDate(item.targetDate)}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {item.status === "completed" ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.success + "20" }]}>
              <IconCheck size={14} color={theme.success} />
            </View>
          ) : item.status === "abandoned" ? (
            <View style={[styles.statusBadge, { backgroundColor: theme.error + "20" }]}>
              <IconX size={14} color={theme.error} />
            </View>
          ) : (
            <IconChevronRight size={20} color={theme.textMuted} />
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
          <ThemedText type="small" style={{ color: statusColor, marginLeft: Spacing.sm }}>
            {progress}%
          </ThemedText>
        </View>

        <View style={styles.goalDetails}>
          {item.distanceTarget ? (
            <View style={styles.detailItem}>
              <IconMap size={12} color={theme.textMuted} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.distanceTarget.replace(/_/g, " ")}
              </ThemedText>
            </View>
          ) : null}
          {item.weeklyRunTarget ? (
            <View style={styles.detailItem}>
              <IconRepeat size={12} color={theme.textMuted} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.weeklyRunTarget}x/week
              </ThemedText>
            </View>
          ) : null}
          {item.eventName ? (
            <View style={styles.detailItem}>
              <IconFlag size={12} color={theme.textMuted} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.eventName}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {renderGoalActions(item)}
      </Pressable>
    );
  };

  const getEmptyStateForTab = () => {
    switch (activeTab) {
      case "active":
        return {
          title: "No Active Goals",
          description: "Set your first running goal and start tracking your progress",
          actionLabel: "Create Goal",
          onAction: () => navigation.navigate("CreateGoal"),
        };
      case "completed":
        return {
          title: "No Completed Goals",
          description: "Complete your first goal to see it here",
        };
      case "abandoned":
        return {
          title: "No Abandoned Goals",
          description: "Goals you abandon will appear here",
        };
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading your goals..." />;
  }

  const emptyState = getEmptyStateForTab();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.tabContainer,
          {
            paddingTop: headerHeight + Spacing.md,
            backgroundColor: theme.backgroundRoot,
            borderBottomColor: theme.border,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = goalCounts[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.key);
              }}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? theme.primary : "transparent",
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: isActive ? theme.buttonText : theme.text,
                  fontWeight: "600",
                }}
              >
                {tab.label}
              </ThemedText>
              {count > 0 ? (
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.3)"
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: isActive ? theme.buttonText : theme.textSecondary,
                      fontSize: 11,
                    }}
                  >
                    {count}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: filteredGoals.length === 0 ? 1 : undefined,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredGoals}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<IconTarget size={48} color={theme.textMuted} />}
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.actionLabel}
            onAction={emptyState.onAction}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />

      {activeTab === "active" ? (
        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("CreateGoal");
          }}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.primary,
              bottom: tabBarHeight + Spacing.lg,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <IconPlus size={24} color={theme.buttonText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
  list: {
    flex: 1,
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
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
