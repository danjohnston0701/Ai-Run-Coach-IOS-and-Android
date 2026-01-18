import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import LocationPermissionScreen from "@/screens/LocationPermissionScreen";
import PreRunScreen from "@/screens/PreRunScreen";
import RoutePreviewScreen from "@/screens/RoutePreviewScreen";
import RunSessionScreen from "@/screens/RunSessionScreen";
import RunInsightsScreen from "@/screens/RunInsightsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import FriendProfileScreen from "@/screens/FriendProfileScreen";
import LiveRunViewerScreen from "@/screens/LiveRunViewerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

export type RootStackParamList = {
  Login: undefined;
  LocationPermission: undefined;
  Main: undefined;
  PreRun: { 
    mode: 'route' | 'free';
    initialDistance?: number;
    initialTimeEnabled?: boolean;
    initialHours?: number;
    initialMinutes?: number;
    initialSeconds?: number;
  };
  RoutePreview: {
    mode: 'route' | 'free';
    activityType: 'run' | 'walk';
    targetDistance: number;
    targetTime: { hours: number; minutes: number; seconds: number } | null;
    liveTracking: boolean;
    aiCoach: boolean;
    difficulty?: string;
  };
  RunSession: { 
    mode?: 'route' | 'free';
    activityType?: 'run' | 'walk';
    targetDistance?: number | null;
    targetTime?: { hours: number; minutes: number; seconds: number } | null;
    liveTracking?: boolean;
    aiCoach?: boolean;
    routeId?: string;
  } | undefined;
  RunInsights: { runId: string; isFriendView?: boolean };
  EventDetails: { eventId: string };
  GoalDetails: { goalId: string };
  CreateGoal: undefined;
  CoachSettings: undefined;
  PersonalDetails: undefined;
  FitnessSettings: undefined;
  NotificationSettings: undefined;
  Notifications: undefined;
  FriendProfile: { friendId: string };
  LiveRunViewer: { sessionId: string; runnerId?: string; runnerName?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, locationPermissionGranted } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  const needsLocationPermission = isAuthenticated && !locationPermissionGranted;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : needsLocationPermission ? (
        <Stack.Screen
          name="LocationPermission"
          component={LocationPermissionScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PreRun"
            component={PreRunScreen}
            options={{
              headerTitle: "Run Setup",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="RoutePreview"
            component={RoutePreviewScreen}
            options={{
              headerTitle: "Choose Route",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="RunSession"
            component={RunSessionScreen}
            options={{
              headerTitle: "Run Session",
              presentation: "fullScreenModal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="RunInsights"
            component={RunInsightsScreen}
            options={{
              headerTitle: "Run Details",
            }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerTitle: "Notifications",
            }}
          />
          <Stack.Screen
            name="FriendProfile"
            component={FriendProfileScreen}
            options={{
              headerTitle: "Friend",
            }}
          />
          <Stack.Screen
            name="LiveRunViewer"
            component={LiveRunViewerScreen}
            options={{
              headerTitle: "Live Run",
              headerShown: false,
              presentation: "fullScreenModal",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
