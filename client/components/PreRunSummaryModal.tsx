import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from './ThemedText';
import {
  IconX,
  IconSun,
  IconCloud,
  IconCloudRain,
  IconWind,
  IconThermometer,
  IconTrendingUp,
  IconNavigation,
  IconAlertTriangle,
} from './icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface PreRunSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  onStartRun: () => void;
  routeData: {
    id?: string;
    name?: string;
    actualDistance?: number;
    difficulty?: string;
    elevationGain?: number;
    waypoints?: any[];
  };
  startLocation: {
    lat: number;
    lng: number;
  } | null;
  activityType: string;
  userId?: string;
}

interface PreRunSummary {
  weatherSummary: string;
  terrainAnalysis: string;
  coachAdvice: string;
  firstTurnInstruction: string;
  warnings: string[];
  hydrationTip?: string;
  warmUpSuggestion?: string;
}

export function PreRunSummaryModal({
  visible,
  onClose,
  onStartRun,
  routeData,
  startLocation,
  activityType,
  userId,
}: PreRunSummaryModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PreRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<{
    temp?: number;
    condition?: string;
    humidity?: number;
    windSpeed?: number;
  } | null>(null);

  useEffect(() => {
    if (visible && startLocation) {
      fetchPreRunData();
    }
  }, [visible, startLocation]);

  const fetchPreRunData = async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = getApiUrl();

      const [weatherRes, summaryRes] = await Promise.all([
        fetch(
          `${baseUrl}/api/weather/current?lat=${startLocation?.lat}&lng=${startLocation?.lng}`,
          { credentials: 'include' }
        ),
        fetch(`${baseUrl}/api/ai/run-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            routeId: routeData.id,
            distance: routeData.actualDistance,
            difficulty: routeData.difficulty,
            elevationGain: routeData.elevationGain,
            activityType,
            userId,
            startLat: startLocation?.lat,
            startLng: startLocation?.lng,
            waypoints: routeData.waypoints?.slice(0, 3),
          }),
        }),
      ]);

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        setWeather({
          temp: weatherData.temp,
          condition: weatherData.condition,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed,
        });
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      } else {
        setSummary({
          weatherSummary: 'Weather data unavailable',
          terrainAnalysis: `${routeData.difficulty || 'Moderate'} route with ${routeData.elevationGain || 0}m elevation gain`,
          coachAdvice: 'Start at a comfortable pace and listen to your body.',
          firstTurnInstruction: routeData.waypoints?.[0]?.instruction || 'Follow the route',
          warnings: [],
        });
      }
    } catch (err) {
      console.error('Pre-run summary error:', err);
      setError('Could not load summary. You can still start your run.');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = () => {
    const condition = weather?.condition?.toLowerCase() || '';
    if (condition.includes('rain') || condition.includes('shower')) {
      return <IconCloudRain size={24} color={theme.primary} />;
    }
    if (condition.includes('cloud')) {
      return <IconCloud size={24} color={theme.textSecondary} />;
    }
    return <IconSun size={24} color={theme.warning} />;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        <View style={[styles.modal, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.header}>
            <ThemedText type="h2">Pre-Run Briefing</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <IconX size={24} color={theme.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                Preparing your run summary...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <ThemedText type="body" style={{ color: theme.warning, textAlign: 'center' }}>
                {error}
              </ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {weather ? (
                <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                  <View style={styles.sectionHeader}>
                    {getWeatherIcon()}
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Weather
                    </ThemedText>
                  </View>
                  <View style={styles.weatherStats}>
                    <View style={styles.weatherStat}>
                      <IconThermometer size={16} color={theme.textMuted} />
                      <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                        {weather.temp ? `${Math.round(weather.temp)}°C` : '--'}
                      </ThemedText>
                    </View>
                    <View style={styles.weatherStat}>
                      <IconWind size={16} color={theme.textMuted} />
                      <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                        {weather.windSpeed ? `${weather.windSpeed} km/h` : '--'}
                      </ThemedText>
                    </View>
                  </View>
                  {summary?.weatherSummary ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                      {summary.weatherSummary}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.sectionHeader}>
                  <IconTrendingUp size={20} color={theme.accent} />
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    Terrain
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {summary?.terrainAnalysis || `${routeData.difficulty} difficulty`}
                </ThemedText>
              </View>

              <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.sectionHeader}>
                  <IconNavigation size={20} color={theme.primary} />
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    First Turn
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {summary?.firstTurnInstruction || 'Follow the highlighted route'}
                </ThemedText>
              </View>

              {summary?.coachAdvice ? (
                <View style={[styles.section, { backgroundColor: theme.primary + '15' }]}>
                  <ThemedText type="h4" style={{ color: theme.primary, marginBottom: Spacing.xs }}>
                    Coach's Advice
                  </ThemedText>
                  <ThemedText type="body" style={{ color: theme.text }}>
                    {summary.coachAdvice}
                  </ThemedText>
                </View>
              ) : null}

              {summary?.warnings && summary.warnings.length > 0 ? (
                <View style={[styles.section, { backgroundColor: theme.warning + '15' }]}>
                  <View style={styles.sectionHeader}>
                    <IconAlertTriangle size={20} color={theme.warning} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: theme.warning }}>
                      Heads Up
                    </ThemedText>
                  </View>
                  {summary.warnings.map((warning, index) => (
                    <ThemedText
                      key={index}
                      type="small"
                      style={{ color: theme.text, marginTop: index > 0 ? Spacing.xs : 0 }}
                    >
                      {warning}
                    </ThemedText>
                  ))}
                </View>
              ) : null}

              {summary?.hydrationTip ? (
                <ThemedText type="small" style={{ color: theme.textMuted, marginTop: Spacing.md, textAlign: 'center' }}>
                  {summary.hydrationTip}
                </ThemedText>
              ) : null}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.secondaryButton, { borderColor: theme.border }]}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onStartRun}
              style={[styles.button, styles.primaryButton, { backgroundColor: theme.success }]}
            >
              <ThemedText type="body" style={{ color: theme.backgroundRoot, fontWeight: '600' }}>
                Start Run
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: Spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  errorContainer: {
    padding: Spacing.xl,
  },
  content: {
    padding: Spacing.lg,
    maxHeight: 350,
  },
  section: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  weatherStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  weatherStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {},
});
