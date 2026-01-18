import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { EmptyState } from '@/components/EmptyState';
import {
  IconBell,
  IconUsers,
  IconTrophy,
  IconHeart,
  IconCalendar,
  IconCheck,
  IconTrash,
} from '@/components/icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface Notification {
  id: string;
  type: 'friend_request' | 'run_complete' | 'achievement' | 'event' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionData?: any;
}

function getNotificationIcon(type: string, color: string) {
  switch (type) {
    case 'friend_request':
      return <IconUsers size={20} color={color} />;
    case 'run_complete':
      return <IconCheck size={20} color={color} />;
    case 'achievement':
      return <IconTrophy size={20} color={color} />;
    case 'event':
      return <IconCalendar size={20} color={color} />;
    default:
      return <IconBell size={20} color={color} />;
  }
}

function getNotificationColor(type: string, theme: any): string {
  switch (type) {
    case 'friend_request':
      return theme.primary;
    case 'run_complete':
      return theme.success;
    case 'achievement':
      return theme.warning;
    case 'event':
      return theme.accent;
    default:
      return theme.textMuted;
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationCenterScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}/api/notifications?userId=${user?.id}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include',
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const markAllAsRead = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user?.id }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (notification.actionData) {
      switch (notification.type) {
        case 'friend_request':
          navigation.navigate('Profile');
          break;
        case 'run_complete':
          if (notification.actionData.runId) {
            navigation.navigate('RunInsights', { runId: notification.actionData.runId });
          }
          break;
        case 'event':
          navigation.navigate('MainTabs', { screen: 'EventsTab' });
          break;
        default:
          break;
      }
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const color = getNotificationColor(item.type, theme);

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={[
          styles.notificationCard,
          {
            backgroundColor: item.isRead ? theme.backgroundSecondary : theme.primary + '10',
            borderColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: color + '20' },
          ]}
        >
          {getNotificationIcon(item.type, color)}
        </View>
        <View style={styles.content}>
          <ThemedText
            type="body"
            style={{ fontWeight: item.isRead ? '400' : '600' }}
          >
            {item.title}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 2 }}
            numberOfLines={2}
          >
            {item.message}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textMuted, marginTop: Spacing.xs }}
          >
            {formatTimeAgo(item.createdAt)}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => deleteNotification(item.id)}
          hitSlop={8}
          style={styles.deleteButton}
        >
          <IconTrash size={16} color={theme.textMuted} />
        </Pressable>
      </Pressable>
    );
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {notifications.length > 0 && unreadCount > 0 ? (
        <View
          style={[
            styles.headerActions,
            { paddingTop: headerHeight + Spacing.md, backgroundColor: theme.backgroundRoot },
          ]}
        >
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </ThemedText>
          <Pressable onPress={markAllAsRead}>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>
              Mark all as read
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: unreadCount > 0 ? Spacing.sm : headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<IconBell size={48} color={theme.textMuted} />}
            title="No Notifications"
            description="You're all caught up! Notifications about your runs, friends, and achievements will appear here."
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
});
