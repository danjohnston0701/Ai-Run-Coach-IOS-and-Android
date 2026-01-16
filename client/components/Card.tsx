import React from "react";
import { StyleSheet, Pressable, ViewStyle, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface CardProps {
  elevation?: number;
  title?: string;
  subtitle?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gradient?: boolean;
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  elevation = 1,
  title,
  subtitle,
  description,
  children,
  onPress,
  style,
  gradient = false,
  testID,
}: CardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const getBackgroundColor = () => {
    switch (elevation) {
      case 1:
        return theme.backgroundDefault;
      case 2:
        return theme.backgroundSecondary;
      case 3:
        return theme.backgroundTertiary;
      default:
        return theme.backgroundDefault;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const content = (
    <>
      {title ? (
        <View style={styles.header}>
          <ThemedText type="h4" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {description ? (
        <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      ) : null}
      {children}
    </>
  );

  const cardStyle = [
    styles.card,
    {
      backgroundColor: gradient ? "transparent" : getBackgroundColor(),
      borderColor: theme.border,
    },
    style,
  ];

  if (gradient) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        testID={testID}
        style={[cardStyle, animatedStyle]}
      >
        <LinearGradient
          colors={[theme.cardGradientStart, theme.cardGradientEnd]}
          style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.xl }]}
        />
        <View style={styles.gradientContent}>{content}</View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      testID={testID}
      style={[cardStyle, animatedStyle]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  gradientContent: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.sm,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  description: {
    marginBottom: Spacing.md,
  },
});
