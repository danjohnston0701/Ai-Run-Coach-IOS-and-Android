import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { IconCheck } from "@/components/icons/AppIcons";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const theme = Colors.dark;

type CoachSettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "CoachSettings">;
};

type CoachGender = "male" | "female";
type CoachAccent = "british" | "australian" | "american" | "irish" | "scottish" | "newzealand";
type CoachTone = "energetic" | "motivational" | "instructive" | "factual" | "abrupt";

interface CoachSettings {
  gender: CoachGender;
  accent: CoachAccent;
  tone: CoachTone;
  name: string;
}

const genderOptions: { value: CoachGender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const accentOptions: { value: CoachAccent; label: string }[] = [
  { value: "british", label: "British" },
  { value: "american", label: "American" },
  { value: "australian", label: "Australian" },
  { value: "irish", label: "Irish" },
  { value: "scottish", label: "Scottish" },
  { value: "newzealand", label: "New Zealand" },
];

const toneOptions: { value: CoachTone; label: string; description: string }[] = [
  { value: "energetic", label: "Energetic", description: "High energy, upbeat encouragement" },
  { value: "motivational", label: "Motivational", description: "Inspiring and supportive coaching" },
  { value: "instructive", label: "Instructive", description: "Clear, detailed guidance and tips" },
  { value: "factual", label: "Factual", description: "Straightforward stats and information" },
  { value: "abrupt", label: "Abrupt", description: "Short, direct commands" },
];

export default function CoachSettingsScreen({ navigation }: CoachSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, refreshUser } = useAuth();
  
  const [settings, setSettings] = useState<CoachSettings>({
    gender: (user?.coachGender as CoachGender) || "male",
    accent: (user?.coachAccent as CoachAccent) || "british",
    tone: (user?.coachTone as CoachTone) || "energetic",
    name: user?.coachName || "AI Coach",
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) {
      setSettings({
        gender: (user.coachGender as CoachGender) || "male",
        accent: (user.coachAccent as CoachAccent) || "british",
        tone: (user.coachTone as CoachTone) || "energetic",
        name: user.coachName || "AI Coach",
      });
    }
  }, [user]);

  const updateSetting = useCallback(<K extends keyof CoachSettings>(key: K, value: CoachSettings[K]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const saveSettings = useCallback(async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          coachGender: settings.gender,
          coachAccent: settings.accent,
          coachTone: settings.tone,
          coachName: settings.name,
        }),
      });

      if (response.ok) {
        await AsyncStorage.setItem("coachSettings", JSON.stringify(settings));
        await refreshUser?.();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setHasChanges(false);
        navigation.goBack();
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Save coach settings error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [user?.id, settings, refreshUser, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Coach Name</Text>
          <Text style={[styles.sectionDescription, { color: theme.textMuted }]}>
            Give your AI coach a personalized name
          </Text>
          <TextInput
            style={[
              styles.nameInput,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={settings.name}
            onChangeText={(text) => updateSetting("name", text)}
            placeholder="Enter coach name"
            placeholderTextColor={theme.textMuted}
            maxLength={20}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Voice Gender</Text>
          <Text style={[styles.sectionDescription, { color: theme.textMuted }]}>
            Choose the voice gender for your AI coach
          </Text>
          <View style={styles.optionGrid}>
            {genderOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => updateSetting("gender", option.value)}
                style={[
                  styles.optionCard,
                  { 
                    backgroundColor: settings.gender === option.value 
                      ? theme.primary + "20" 
                      : theme.backgroundSecondary,
                    borderColor: settings.gender === option.value 
                      ? theme.primary 
                      : theme.border,
                  },
                ]}
              >
                {settings.gender === option.value ? (
                  <View style={[styles.checkIcon, { backgroundColor: theme.primary }]}>
                    <IconCheck size={14} color="#FFFFFF" />
                  </View>
                ) : null}
                <Text style={[
                  styles.optionLabel, 
                  { color: settings.gender === option.value ? theme.primary : theme.text }
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Accent</Text>
          <Text style={[styles.sectionDescription, { color: theme.textMuted }]}>
            Select the accent for voice coaching
          </Text>
          <View style={styles.optionList}>
            {accentOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => updateSetting("accent", option.value)}
                style={[
                  styles.optionRow,
                  { 
                    backgroundColor: settings.accent === option.value 
                      ? theme.primary + "20" 
                      : theme.backgroundSecondary,
                    borderColor: settings.accent === option.value 
                      ? theme.primary 
                      : theme.border,
                  },
                ]}
              >
                <Text style={[
                  styles.optionRowLabel, 
                  { color: settings.accent === option.value ? theme.primary : theme.text }
                ]}>
                  {option.label}
                </Text>
                {settings.accent === option.value ? (
                  <IconCheck size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Coaching Tone</Text>
          <Text style={[styles.sectionDescription, { color: theme.textMuted }]}>
            How would you like your coach to communicate?
          </Text>
          <View style={styles.optionList}>
            {toneOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => updateSetting("tone", option.value)}
                style={[
                  styles.toneCard,
                  { 
                    backgroundColor: settings.tone === option.value 
                      ? theme.primary + "20" 
                      : theme.backgroundSecondary,
                    borderColor: settings.tone === option.value 
                      ? theme.primary 
                      : theme.border,
                  },
                ]}
              >
                <View style={styles.toneCardContent}>
                  <Text style={[
                    styles.toneLabel, 
                    { color: settings.tone === option.value ? theme.primary : theme.text }
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.toneDescription, { color: theme.textMuted }]}>
                    {option.description}
                  </Text>
                </View>
                {settings.tone === option.value ? (
                  <IconCheck size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {hasChanges ? (
        <View style={[styles.saveBar, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={saveSettings}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.backgroundRoot} />
            ) : (
              <Text style={[styles.saveButtonText, { color: theme.backgroundRoot }]}>
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  nameInput: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    fontSize: 16,
  },
  optionGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  optionCard: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: "center",
    position: "relative",
  },
  checkIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionList: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  optionRowLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  toneCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  toneCardContent: {
    flex: 1,
  },
  toneLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  toneDescription: {
    fontSize: 13,
  },
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: "rgba(10, 15, 26, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  saveButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
