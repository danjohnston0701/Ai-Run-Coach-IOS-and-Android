import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, Text } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import HistoryStackNavigator from "@/navigation/HistoryStackNavigator";
import EventsStackNavigator from "@/navigation/EventsStackNavigator";
import GoalsStackNavigator from "@/navigation/GoalsStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";

export type MainTabParamList = {
  HomeTab: undefined;
  HistoryTab: undefined;
  EventsTab: undefined;
  GoalsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: "History",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsStackNavigator}
        options={{
          title: "Events",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>📅</Text>
          ),
        }}
      />
      <Tab.Screen
        name="GoalsTab"
        component={GoalsStackNavigator}
        options={{
          title: "Goals",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>🎯</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22 }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
