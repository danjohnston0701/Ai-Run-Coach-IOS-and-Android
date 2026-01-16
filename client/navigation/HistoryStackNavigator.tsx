import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RunHistoryScreen from "@/screens/RunHistoryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HistoryStackParamList = {
  RunHistory: undefined;
};

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export default function HistoryStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="RunHistory"
        component={RunHistoryScreen}
        options={{
          headerTitle: "Run History",
        }}
      />
    </Stack.Navigator>
  );
}
