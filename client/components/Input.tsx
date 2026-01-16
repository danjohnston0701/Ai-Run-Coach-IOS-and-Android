import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  Pressable,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Colors } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      secureTextEntry,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const borderColor = useSharedValue(theme.border);

    const animatedStyle = useAnimatedStyle(() => ({
      borderColor: borderColor.value,
    }));

    const handleFocus = () => {
      setIsFocused(true);
      borderColor.value = withTiming(theme.primary, { duration: 150 });
    };

    const handleBlur = () => {
      setIsFocused(false);
      borderColor.value = withTiming(
        error ? theme.error : theme.border,
        { duration: 150 }
      );
    };

    const isSecure = secureTextEntry && !isPasswordVisible;

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            {label}
          </ThemedText>
        ) : null}
        <AnimatedView
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: error ? theme.error : theme.border,
            },
            animatedStyle,
          ]}
        >
          {leftIcon ? (
            <Feather
              name={leftIcon}
              size={20}
              color={isFocused ? theme.primary : theme.textMuted}
              style={styles.leftIcon}
            />
          ) : null}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: theme.text,
                paddingLeft: leftIcon ? 0 : Spacing.lg,
                paddingRight: rightIcon || secureTextEntry ? 0 : Spacing.lg,
              },
            ]}
            placeholderTextColor={theme.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={isSecure}
            {...props}
          />
          {secureTextEntry ? (
            <Pressable
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.rightIcon}
            >
              <Feather
                name={isPasswordVisible ? "eye-off" : "eye"}
                size={20}
                color={theme.textMuted}
              />
            </Pressable>
          ) : rightIcon ? (
            <Pressable
              onPress={onRightIconPress}
              style={styles.rightIcon}
              disabled={!onRightIconPress}
            >
              <Feather name={rightIcon} size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </AnimatedView>
        {error ? (
          <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
            {error}
          </ThemedText>
        ) : null}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    height: Spacing.inputHeight,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  leftIcon: {
    marginLeft: Spacing.lg,
    marginRight: Spacing.sm,
  },
  rightIcon: {
    paddingHorizontal: Spacing.lg,
    height: "100%",
    justifyContent: "center",
  },
  error: {
    marginTop: Spacing.xs,
  },
});
