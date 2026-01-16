import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import GoalsScreen from "@/screens/GoalsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type GoalsStackParamList = {
  Goals: undefined;
};

const Stack = createNativeStackNavigator<GoalsStackParamList>();

export default function GoalsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          headerTitle: "Goals",
        }}
      />
    </Stack.Navigator>
  );
}
