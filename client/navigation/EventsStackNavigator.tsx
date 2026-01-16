import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import EventsScreen from "@/screens/EventsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type EventsStackParamList = {
  Events: undefined;
};

const Stack = createNativeStackNavigator<EventsStackParamList>();

export default function EventsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{
          headerTitle: "Events",
        }}
      />
    </Stack.Navigator>
  );
}
