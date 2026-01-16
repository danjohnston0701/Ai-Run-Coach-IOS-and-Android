import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  IconBell,
  IconProfile,
  IconCheck,
  IconTarget,
  IconActivity,
  IconCalendar,
  IconAward,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    userId?: string;
    runId?: string;
    goalId?: string;
    eventId?: string;
  };
}

export default function NotificationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/notifications`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.log("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.log("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log("Failed to mark all as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "friend_request":
      case "friend_accepted":
        return <IconProfile size={20} color={theme.accent} />;
      case "goal_complete":
        return <IconCheck size={20} color={theme.success} />;
      case "goal_reminder":
        return <IconTarget size={20} color={theme.warning} />;
      case "run_complete":
        return <IconActivity size={20} color={theme.primary} />;
      case "event_reminder":
        return <IconCalendar size={20} color={theme.warning} />;
      case "achievement":
        return <IconAward size={20} color={theme.warning} />;
      default:
        return <IconBell size={20} color={theme.textMuted} />;
    }
  };

  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case "friend_request":
      case "friend_accepted":
        return theme.accent + "20";
      case "goal_complete":
        return theme.success + "20";
      case "goal_reminder":
        return theme.warning + "20";
      case "run_complete":
        return theme.primary + "20";
      case "event_reminder":
        return theme.warning + "20";
      case "achievement":
        return theme.warning + "20";
      default:
        return theme.textMuted + "20";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleNotificationPress = async (notification: Notification) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.data?.runId) {
      navigation.navigate("RunDetails", { runId: notification.data.runId });
    } else if (notification.data?.goalId) {
      navigation.navigate("GoalDetails", { goalId: notification.data.goalId });
    } else if (notification.data?.eventId) {
      navigation.navigate("EventDetails", { eventId: notification.data.eventId });
    } else if (notification.data?.userId) {
      navigation.navigate("FriendProfile", { friendId: notification.data.userId });
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      onPress={() => handleNotificationPress(item)}
      style={({ pressed }) => [
        styles.notificationCard,
        {
          backgroundColor: item.read ? theme.backgroundSecondary : theme.primary + "10",
          borderColor: item.read ? theme.border : theme.primary + "30",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationIconBg(item.type) }]}>
        {getNotificationIcon(item.type)}
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <ThemedText
            type="body"
            style={{ fontWeight: item.read ? "400" : "600", flex: 1 }}
            numberOfLines={1}
          >
            {item.title}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textMuted }}>
            {formatTime(item.createdAt)}
          </ThemedText>
        </View>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: 2 }}
          numberOfLines={2}
        >
          {item.message}
        </ThemedText>
      </View>
      {!item.read ? (
        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
      ) : null}
    </Pressable>
  );

  if (loading) {
    return <LoadingScreen message="Loading notifications..." />;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {unreadCount > 0 ? (
        <Pressable
          onPress={markAllAsRead}
          style={[styles.markAllButton, { backgroundColor: theme.backgroundSecondary }]}
        >
          <ThemedText type="small" style={{ color: theme.primary }}>
            Mark all as read ({unreadCount})
          </ThemedText>
        </Pressable>
      ) : null}

      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: unreadCount > 0 ? Spacing.md : headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: notifications.length === 0 ? 1 : undefined,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<IconBell size={48} color={theme.textMuted} />}
            title="No Notifications"
            description="You're all caught up! Check back later for updates."
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markAllButton: {
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  list: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
