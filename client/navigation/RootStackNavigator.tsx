import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import RunSessionScreen from "@/screens/RunSessionScreen";
import RunInsightsScreen from "@/screens/RunInsightsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RunSession: { routeId?: string } | undefined;
  RunInsights: { runId: string };
  EventDetails: { eventId: string };
  GoalDetails: { goalId: string };
  CreateGoal: undefined;
  CoachSettings: undefined;
  PersonalDetails: undefined;
  FitnessSettings: undefined;
  NotificationSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
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
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
