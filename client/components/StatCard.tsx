import React from "react";
import { StyleSheet, View, ViewStyle, Text } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  color?: string;
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  color,
  style,
  size = "md",
}: StatCardProps) {
  const { theme } = useTheme();
  const accentColor = color || theme.primary;

  const getValueSize = () => {
    switch (size) {
      case "sm":
        return Typography.h4;
      case "md":
        return Typography.stat;
      case "lg":
        return Typography.statLarge;
      default:
        return Typography.stat;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: accentColor + "20" }]}>
            <Text style={styles.iconEmoji}>{icon}</Text>
          </View>
        ) : null}
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.valueContainer}>
        <ThemedText style={[getValueSize(), { color: theme.text }]}>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="small" style={[styles.unit, { color: theme.textMuted }]}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  iconEmoji: {
    fontSize: 14,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unit: {
    marginLeft: Spacing.xs,
    fontWeight: "500",
  },
});
