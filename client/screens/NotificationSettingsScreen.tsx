import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  IconBell,
  IconUsers,
  IconUserCheck,
  IconCalendar,
  IconPlay,
  IconEye,
  IconTrophy,
  IconActivity,
  IconChevronRight,
} from '@/components/icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface NotificationPreferences {
  allNotifications: boolean;
  friendRequests: boolean;
  friendAccepted: boolean;
  groupRunInvitations: boolean;
  groupRunStarting: boolean;
  liveRunInvitations: boolean;
  friendWatching: boolean;
  runCompleted: boolean;
  weeklyProgress: boolean;
}

const defaultPreferences: NotificationPreferences = {
  allNotifications: true,
  friendRequests: true,
  friendAccepted: true,
  groupRunInvitations: true,
  groupRunStarting: true,
  liveRunInvitations: true,
  friendWatching: true,
  runCompleted: true,
  weeklyProgress: true,
};

interface NotificationItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  onTestPress?: () => void;
  disabled?: boolean;
}

function NotificationItem({
  icon,
  title,
  description,
  value,
  onValueChange,
  onTestPress,
  disabled,
}: NotificationItemProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.notificationItem, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
        {icon}
      </View>
      <View style={styles.itemContent}>
        <ThemedText type="body" style={{ fontWeight: '500' }}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textMuted }}>
          {description}
        </ThemedText>
      </View>
      {onTestPress ? (
        <Pressable
          onPress={onTestPress}
          style={[styles.testButton, { backgroundColor: theme.backgroundTertiary }]}
          disabled={disabled}
        >
          <IconChevronRight size={16} color={theme.primary} />
        </Pressable>
      ) : null}
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.backgroundTertiary, true: theme.success }}
        thumbColor={Platform.OS === 'android' ? (value ? theme.success : theme.textMuted) : '#fff'}
        ios_backgroundColor={theme.backgroundTertiary}
        disabled={disabled}
      />
    </View>
  );
}

export default function NotificationSettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}/api/users/${user.id}/notification-preferences`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...defaultPreferences, ...data });
      }
    } catch (error) {
      console.log('Failed to fetch notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = useCallback(async (newPrefs: NotificationPreferences, showConfirmation = true) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}/api/users/${user.id}/notification-preferences`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newPrefs),
        }
      );
      if (showConfirmation) {
        if (response.ok) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved', 'Your notification preferences have been updated.');
        } else {
          Alert.alert('Error', 'Failed to save notification preferences. Please try again.');
        }
      }
    } catch (error) {
      console.log('Failed to save notification preferences:', error);
      if (showConfirmation) {
        Alert.alert('Error', 'Failed to save notification preferences. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  const handleToggle = useCallback((key: keyof NotificationPreferences) => {
    return async (value: boolean) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      let newPrefs: NotificationPreferences;
      
      if (key === 'allNotifications') {
        newPrefs = {
          allNotifications: value,
          friendRequests: value,
          friendAccepted: value,
          groupRunInvitations: value,
          groupRunStarting: value,
          liveRunInvitations: value,
          friendWatching: value,
          runCompleted: value,
          weeklyProgress: value,
        };
      } else {
        newPrefs = { ...preferences, [key]: value };
        const allEnabled = Object.entries(newPrefs)
          .filter(([k]) => k !== 'allNotifications')
          .every(([, v]) => v === true);
        newPrefs.allNotifications = allEnabled;
      }
      
      setPreferences(newPrefs);
      await savePreferences(newPrefs);
    };
  }, [preferences, savePreferences]);

  const handleTestNotification = useCallback(async (type: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Try to send an actual test notification via the API
    if (user?.id) {
      try {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}/api/notifications/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.id,
            type,
            title: `Test ${type} notification`,
            body: `This is a test notification for ${type}`,
          }),
        });
        
        if (response.ok) {
          Alert.alert('Test Sent', `A test ${type} notification has been sent. Check your device notifications.`);
        } else {
          Alert.alert('Note', `Test triggered, but push notifications may need to be enabled on your device and in the Profile settings.`);
        }
      } catch (error) {
        console.log('Test notification error:', error);
        Alert.alert('Note', 'To receive push notifications, ensure they are enabled in your device settings and in Profile settings.');
      }
    } else {
      Alert.alert('Note', 'Please log in to test notifications.');
    }
  }, [user?.id]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Choose which notifications you want to receive. Test buttons send a sample notification to your device.
        </ThemedText>

        <NotificationItem
          icon={<IconBell size={20} color={theme.primary} />}
          title="All Notifications"
          description="Enable or disable all notifications at once"
          value={preferences.allNotifications}
          onValueChange={handleToggle('allNotifications')}
        />

        <View style={styles.divider} />

        <NotificationItem
          icon={<IconUsers size={20} color={theme.primary} />}
          title="Friend Requests"
          description="When someone sends you a friend request"
          value={preferences.friendRequests}
          onValueChange={handleToggle('friendRequests')}
          onTestPress={() => handleTestNotification('friend request')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconUserCheck size={20} color={theme.primary} />}
          title="Friend Accepted"
          description="When someone accepts your friend request"
          value={preferences.friendAccepted}
          onValueChange={handleToggle('friendAccepted')}
          onTestPress={() => handleTestNotification('friend accepted')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconCalendar size={20} color={theme.primary} />}
          title="Group Run Invitations"
          description="When you're invited to a group run"
          value={preferences.groupRunInvitations}
          onValueChange={handleToggle('groupRunInvitations')}
          onTestPress={() => handleTestNotification('group run invitation')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconPlay size={20} color={theme.primary} />}
          title="Group Run Starting"
          description="When a group run you're in is about to start"
          value={preferences.groupRunStarting}
          onValueChange={handleToggle('groupRunStarting')}
          onTestPress={() => handleTestNotification('group run starting')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconEye size={20} color={theme.primary} />}
          title="Live Run Invitations"
          description="When a friend invites you to watch their live run"
          value={preferences.liveRunInvitations}
          onValueChange={handleToggle('liveRunInvitations')}
          onTestPress={() => handleTestNotification('live run invitation')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconEye size={20} color={theme.primary} />}
          title="Friend Watching Your Run"
          description="When a friend starts watching your live run"
          value={preferences.friendWatching}
          onValueChange={handleToggle('friendWatching')}
          onTestPress={() => handleTestNotification('friend watching')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconTrophy size={20} color={theme.primary} />}
          title="Run Completed"
          description="Summary when you complete a run"
          value={preferences.runCompleted}
          onValueChange={handleToggle('runCompleted')}
          onTestPress={() => handleTestNotification('run completed')}
          disabled={!preferences.allNotifications}
        />

        <NotificationItem
          icon={<IconActivity size={20} color={theme.primary} />}
          title="Weekly Progress"
          description="Weekly summary of your running stats"
          value={preferences.weeklyProgress}
          onValueChange={handleToggle('weeklyProgress')}
          onTestPress={() => handleTestNotification('weekly progress')}
          disabled={!preferences.allNotifications}
        />

        <View style={[styles.noteCard, { backgroundColor: theme.warning + '15', borderColor: theme.warning + '30' }]}>
          <ThemedText type="small" style={{ color: theme.warning, fontWeight: '600', marginBottom: Spacing.xs }}>
            Note:
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Push notifications must be enabled in your Profile settings first. If you don't receive test notifications, check that notifications are enabled for this app in your device settings.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  testButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  divider: {
    height: Spacing.md,
  },
  noteCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
});
