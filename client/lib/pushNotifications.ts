import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getApiUrl } from './query-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  token: string | null;
  granted: boolean;
}

export async function registerForPushNotifications(
  userId?: string
): Promise<PushNotificationState> {
  if (Platform.OS === 'web') {
    return { token: null, granted: false };
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return { token: null, granted: false };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const token = tokenData.data;

    if (userId && token) {
      await registerTokenWithServer(userId, token);
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00D4FF',
      });
    }

    return { token, granted: true };
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return { token: null, granted: false };
  }
}

async function registerTokenWithServer(userId: string, token: string): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    await fetch(`${baseUrl}/api/push-subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
      }),
    });
  } catch (error) {
    console.error('Failed to register push token with server:', error);
  }
}

export async function unregisterPushNotifications(userId?: string): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    await fetch(`${baseUrl}/api/push-subscriptions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId }),
    });
  } catch (error) {
    console.error('Failed to unregister push notifications:', error);
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  triggerSeconds?: number
): Promise<string> {
  const trigger = triggerSeconds
    ? { type: 'timeInterval' as const, seconds: triggerSeconds }
    : null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
