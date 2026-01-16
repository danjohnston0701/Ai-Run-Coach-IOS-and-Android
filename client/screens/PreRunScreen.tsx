import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  IconMapPin,
  IconClock,
  IconBroadcast,
  IconUsers,
  IconMicrophone,
  IconX,
  IconChevronRight,
} from '@/components/icons/AppIcons';

type ActivityType = 'run' | 'walk';

const theme = Colors.dark;

export default function PreRunScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const mode = route.params?.mode || 'route';
  const isRouteMode = mode === 'route';

  // Get initial values from navigation params (from HomeScreen)
  const initialDistance = route.params?.initialDistance ?? 5;
  const initialTimeEnabled = route.params?.initialTimeEnabled ?? false;
  const initialHours = route.params?.initialHours ?? 0;
  const initialMinutes = route.params?.initialMinutes ?? 25;
  const initialSeconds = route.params?.initialSeconds ?? 0;

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [distanceEnabled, setDistanceEnabled] = useState(true);
  const [distanceKm, setDistanceKm] = useState(initialDistance);
  const [timeEnabled, setTimeEnabled] = useState(initialTimeEnabled);
  const [timeHours, setTimeHours] = useState(initialHours);
  const [timeMinutes, setTimeMinutes] = useState(initialMinutes);
  const [timeSeconds, setTimeSeconds] = useState(initialSeconds);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);

  const minDistance = user?.distanceMinKm || 1;
  const maxDistance = user?.distanceMaxKm || 50;

  const handleGenerateRoute = () => {
    if (isRouteMode) {
      navigation.navigate('RoutePreview', {
        mode,
        activityType,
        targetDistance: distanceEnabled ? distanceKm : 5,
        targetTime: timeEnabled ? { hours: timeHours, minutes: timeMinutes, seconds: timeSeconds } : null,
        liveTracking: liveTrackingEnabled,
        aiCoach: aiCoachEnabled,
        difficulty: 'moderate',
      });
    } else {
      navigation.navigate('RunSession', {
        mode,
        activityType,
        targetDistance: distanceEnabled ? distanceKm : null,
        targetTime: timeEnabled ? { hours: timeHours, minutes: timeMinutes, seconds: timeSeconds } : null,
        liveTracking: liveTrackingEnabled,
        aiCoach: aiCoachEnabled,
      });
    }
  };

  const handleRunWithFriends = () => {
    console.log('Run with friends');
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const formatTime = () => {
    if (!timeEnabled) return 'No time goal';
    const parts = [];
    if (timeHours > 0) parts.push(`${timeHours}h`);
    if (timeMinutes > 0) parts.push(`${timeMinutes}m`);
    if (timeSeconds > 0) parts.push(`${timeSeconds}s`);
    return parts.length > 0 ? `${parts.join(' ')} goal` : 'No time goal';
  };

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              {isRouteMode ? 'MAP MY RUN SETUP' : 'FREE RUN SETUP'}
            </Text>
            <Text style={styles.subtitle}>
              {isRouteMode ? 'Configure your AI-generated route' : 'Configure your free run'}
            </Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <IconX size={24} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <View style={styles.activityToggle}>
            <Pressable
              style={[
                styles.activityButton,
                activityType === 'run' && styles.activityButtonActive,
              ]}
              onPress={() => setActivityType('run')}
            >
              <Text
                style={[
                  styles.activityButtonText,
                  activityType === 'run' && styles.activityButtonTextActive,
                ]}
              >
                Run
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.activityButton,
                activityType === 'walk' && styles.activityButtonActive,
              ]}
              onPress={() => setActivityType('walk')}
            >
              <Text
                style={[
                  styles.activityButtonText,
                  activityType === 'walk' && styles.activityButtonTextActive,
                ]}
              >
                Walk
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconCircle}>
                <IconMapPin size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Target Distance</Text>
                <Text style={styles.cardSubtitle}>{distanceKm} km goal</Text>
              </View>
            </View>
            <Pressable
              style={[styles.toggle, distanceEnabled && styles.toggleActive]}
              onPress={() => setDistanceEnabled(!distanceEnabled)}
            >
              <Text style={styles.toggleText}>{distanceEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>
          {distanceEnabled ? (
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={minDistance}
                maximumValue={maxDistance}
                value={distanceKm}
                onValueChange={(value) => setDistanceKm(Math.round(value))}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>{minDistance} km</Text>
                <Text style={[styles.sliderLabel, styles.sliderValue]}>{distanceKm} km</Text>
                <Text style={styles.sliderLabel}>{maxDistance} km</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconCircle}>
                <IconClock size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Target Time</Text>
                <Text style={styles.cardSubtitle}>{formatTime()}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.toggle, timeEnabled && styles.toggleActive]}
              onPress={() => setTimeEnabled(!timeEnabled)}
            >
              <Text style={styles.toggleText}>{timeEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>
          {timeEnabled ? (
            <>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeInputLabel}>HOURS</Text>
                <Text style={styles.timeInputLabel}>MIN</Text>
                <Text style={styles.timeInputLabel}>SEC</Text>
              </View>
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.timeInput}
                  value={timeHours.toString()}
                  onChangeText={(text) => setTimeHours(parseInt(text) || 0)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={timeMinutes.toString().padStart(2, '0')}
                  onChangeText={(text) => setTimeMinutes(Math.min(59, parseInt(text) || 0))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={timeSeconds.toString().padStart(2, '0')}
                  onChangeText={(text) => setTimeSeconds(Math.min(59, parseInt(text) || 0))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconCircle}>
                <IconBroadcast size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Live Tracking</Text>
                <Text style={styles.cardSubtitle}>Share your location with friends</Text>
              </View>
            </View>
            <Pressable
              style={[styles.toggle, liveTrackingEnabled && styles.toggleActive]}
              onPress={() => setLiveTrackingEnabled(!liveTrackingEnabled)}
            >
              <Text style={styles.toggleText}>{liveTrackingEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.card} onPress={handleRunWithFriends}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconCircle}>
                <IconUsers size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Run with Friends</Text>
                <Text style={styles.cardSubtitle}>Create a group run and invite friends</Text>
              </View>
            </View>
            <IconChevronRight size={24} color={theme.textSecondary} />
          </View>
        </Pressable>

        <View style={styles.aiCoachContainer}>
          <View style={styles.aiCoachRow}>
            <IconMicrophone size={20} color={theme.warning} />
            <Text style={styles.aiCoachLabel}>AI Coach</Text>
          </View>
          <View style={styles.aiCoachToggleRow}>
            <Text style={styles.aiCoachStatus}>{aiCoachEnabled ? 'On' : 'Off'}</Text>
            <Pressable
              style={[styles.switchTrack, aiCoachEnabled && styles.switchTrackActive]}
              onPress={() => setAiCoachEnabled(!aiCoachEnabled)}
            >
              <View style={[styles.switchThumb, aiCoachEnabled && styles.switchThumbActive]} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable onPress={handleGenerateRoute}>
          <LinearGradient
            colors={[theme.primary, theme.primaryDark]}
            style={styles.generateButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <IconMapPin size={20} color={theme.backgroundRoot} />
            <Text style={styles.generateButtonText}>
              {isRouteMode ? 'GENERATE ROUTE' : 'START RUN'}
            </Text>
          </LinearGradient>
        </Pressable>
        {distanceEnabled ? (
          <Text style={styles.targetLabel}>Target: {distanceKm} km</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundRoot,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '700',
    color: theme.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.body.fontSize,
    color: theme.textSecondary,
  },
  activityToggle: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
  },
  activityButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  activityButtonActive: {
    backgroundColor: theme.primary,
  },
  activityButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activityButtonTextActive: {
    color: theme.backgroundRoot,
  },
  card: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundRoot,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: theme.text,
  },
  cardSubtitle: {
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
    marginTop: 2,
  },
  toggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: theme.backgroundRoot,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  toggleText: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
    color: theme.text,
  },
  sliderContainer: {
    marginTop: Spacing.lg,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
  },
  sliderValue: {
    color: theme.primary,
    fontWeight: '600',
  },
  timeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.lg,
  },
  timeInputLabel: {
    fontSize: Typography.caption.fontSize,
    color: theme.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  timeInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  timeInput: {
    backgroundColor: theme.backgroundRoot,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.h3.fontSize,
    fontWeight: '600',
    color: theme.primary,
    textAlign: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: theme.border,
  },
  timeSeparator: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '600',
    color: theme.textSecondary,
    marginHorizontal: Spacing.sm,
  },
  aiCoachContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  aiCoachRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCoachLabel: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: theme.text,
    marginLeft: Spacing.sm,
  },
  aiCoachToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCoachStatus: {
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
    marginRight: Spacing.sm,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.border,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: theme.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.text,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.backgroundRoot,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  generateButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: theme.backgroundRoot,
    marginLeft: Spacing.sm,
  },
  targetLabel: {
    textAlign: 'center',
    fontSize: Typography.small.fontSize,
    color: theme.textSecondary,
    marginTop: Spacing.sm,
  },
});
