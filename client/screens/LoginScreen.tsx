import React, { useState } from "react";
import { StyleSheet, View, Image, Pressable, Platform, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { IconProfile, IconMail, IconLock, IconAlertCircle } from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        setError("Please enter your name");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Registration failed');
        }
        
        await login(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const errorMessage = err.message || "Authentication failed";
      console.log('[LoginScreen] Error:', errorMessage);
      setError(errorMessage);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Login Failed', errorMessage);
      }
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSignUp(!isSignUp);
    setError("");
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing["3xl"],
        },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText type="h1" style={styles.title}>
          AI Run Coach
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
          {isSignUp
            ? "Create an account to start your journey"
            : "Welcome back! Sign in to continue"}
        </ThemedText>
      </View>

      <View style={styles.form}>
        {isSignUp ? (
          <Input
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            leftIcon={<IconProfile size={20} color={theme.textMuted} />}
            autoCapitalize="words"
            autoComplete="name"
            testID="input-name"
          />
        ) : null}

        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          leftIcon={<IconMail size={20} color={theme.textMuted} />}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="input-email"
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          leftIcon={<IconLock size={20} color={theme.textMuted} />}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          testID="input-password"
        />

        {isSignUp ? (
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            leftIcon={<IconLock size={20} color={theme.textMuted} />}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            testID="input-confirm-password"
          />
        ) : null}

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
            <IconAlertCircle size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          onPress={handleSubmit}
          loading={loading || isLoading}
          style={styles.submitButton}
          testID="button-submit"
        >
          {isSignUp ? "Create Account" : "Sign In"}
        </Button>

        <View style={styles.toggleContainer}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </ThemedText>
          <Pressable onPress={toggleMode}>
            <ThemedText type="link" style={{ marginLeft: Spacing.sm }}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: theme.textMuted, textAlign: "center" }}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  form: {
    marginBottom: Spacing["3xl"],
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
});
