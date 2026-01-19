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
  IconHeart,
  IconActivity,
  IconZap,
} from './icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl, apiRequest } from '@/lib/query-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    elevationLoss?: number;
    estimatedTime?: number;
    waypoints?: any[];
    turnInstructions?: Array<{ instruction: string; distance: number }>;
  };
  startLocation: {
    lat: number;
    lng: number;
  } | null;
  activityType: string;
  userId?: string;
  targetTime?: { hours: number; minutes: number; seconds: number } | null;
}

interface PreRunSummary {
  terrainAnalysis: string;
  coachAdvice: string;
  firstTurnInstruction: string;
  targetPace?: string;
  warnings: string[];
}

interface WellnessBriefing {
  briefing: string;
  intensityAdvice: string;
  warnings: string[];
  readinessInsight: string;
  wellness: {
    sleepHours?: number;
    sleepQuality?: string;
    bodyBattery?: number;
    stressQualifier?: string;
    hrvStatus?: string;
    readinessScore?: number;
  };
  garminConnected: boolean;
}

export function PreRunSummaryModal({
  visible,
  onClose,
  onStartRun,
  routeData,
  startLocation,
  activityType,
  userId,
  targetTime,
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
  const [wellnessBriefing, setWellnessBriefing] = useState<WellnessBriefing | null>(null);
  const [loadingWellness, setLoadingWellness] = useState(false);

  useEffect(() => {
    if (visible && startLocation) {
      fetchPreRunData();
      fetchWellnessBriefing();
    }
  }, [visible, startLocation]);

  const fetchPreRunData = async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = getApiUrl();

      // Fetch real weather from Open-Meteo via our backend
      const weatherRes = await fetch(
        `${baseUrl}/api/weather/current?lat=${startLocation?.lat}&lng=${startLocation?.lng}`,
        { credentials: 'include' }
      );

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        setWeather({
          temp: weatherData.temp,
          condition: weatherData.condition,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed,
        });
      }

      // Build fact-based summary locally (no AI needed)
      const distance = routeData.actualDistance || 0;
      const elevGain = Math.round(routeData.elevationGain || 0);
      const elevLoss = Math.round(routeData.elevationLoss || routeData.elevationGain || 0);
      
      // Terrain type
      let terrainType = "flat";
      if (elevGain > 100) terrainType = "hilly";
      else if (elevGain > 50) terrainType = "undulating";
      
      const terrainAnalysis = `${distance.toFixed(1)}km ${terrainType} circuit with ${elevGain}m climb and ${elevLoss}m descent.`;
      
      // Calculate target pace if target time is set
      let targetPace: string | undefined = undefined;
      if (targetTime && distance > 0) {
        const totalMinutes = (targetTime.hours || 0) * 60 + (targetTime.minutes || 0) + (targetTime.seconds || 0) / 60;
        if (totalMinutes > 0) {
          const paceMinPerKm = totalMinutes / distance;
          const paceMins = Math.floor(paceMinPerKm);
          const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
          targetPace = `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/km`;
        }
      }
      
      // Get first navigation instruction
      const firstTurn = routeData.turnInstructions?.[0];
      const firstTurnInstruction = firstTurn 
        ? `${firstTurn.instruction} in ${firstTurn.distance >= 1000 
            ? `${(firstTurn.distance / 1000).toFixed(1)}km` 
            : `${Math.round(firstTurn.distance)}m`}`
        : "Follow the highlighted route";
      
      // Motivational statement
      const motivationalStatements = [
        "You've got this. One step at a time.",
        "Trust your training and enjoy the run.",
        "Every kilometre is progress. Let's go!",
        "Today is your day. Make it count.",
        "Focus, breathe, and run your best.",
      ];
      const coachAdvice = motivationalStatements[Math.floor(Math.random() * motivationalStatements.length)];
      
      setSummary({
        terrainAnalysis,
        coachAdvice,
        firstTurnInstruction,
        targetPace,
        warnings: [],
      });
    } catch (err) {
      console.error('Pre-run summary error:', err);
      setError('Could not load summary. You can still start your run.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWellnessBriefing = async () => {
    setLoadingWellness(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/coaching/pre-run-briefing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          distance: routeData.actualDistance,
          elevationGain: routeData.elevationGain,
          difficulty: routeData.difficulty,
          activityType,
          weather,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setWellnessBriefing(data);
      }
    } catch (err) {
      console.error('Wellness briefing error:', err);
    } finally {
      setLoadingWellness(false);
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

  const getReadinessColor = (score: number, t: typeof theme) => {
    if (score >= 80) return t.success;
    if (score >= 60) return t.primary;
    if (score >= 40) return t.warning;
    return t.error;
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
                    <View style={styles.weatherStat}>
                      <ThemedText type="body" style={{ color: theme.textMuted }}>
                        {weather.condition || '--'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.sectionHeader}>
                  <IconTrendingUp size={20} color={theme.accent} />
                  <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                    Route Summary
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {summary?.terrainAnalysis || `${routeData.difficulty} difficulty`}
                </ThemedText>
                {routeData.estimatedTime ? (
                  <ThemedText type="small" style={{ color: theme.textMuted, marginTop: Spacing.xs }}>
                    Estimated time: {Math.floor(routeData.estimatedTime / 60)}:{(routeData.estimatedTime % 60).toString().padStart(2, '0')} minutes
                  </ThemedText>
                ) : null}
              </View>

              {wellnessBriefing?.garminConnected ? (
                <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                  <View style={styles.sectionHeader}>
                    <IconActivity size={20} color={theme.success} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Body Readiness
                    </ThemedText>
                  </View>
                  
                  <View style={styles.wellnessStats}>
                    {wellnessBriefing.wellness.readinessScore !== undefined ? (
                      <View style={styles.wellnessStat}>
                        <View style={[styles.readinessCircle, { 
                          backgroundColor: getReadinessColor(wellnessBriefing.wellness.readinessScore, theme) 
                        }]}>
                          <ThemedText type="h3" style={{ color: theme.backgroundRoot }}>
                            {wellnessBriefing.wellness.readinessScore}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textMuted, marginTop: Spacing.xs }}>
                          Readiness
                        </ThemedText>
                      </View>
                    ) : null}
                    
                    {wellnessBriefing.wellness.bodyBattery !== undefined ? (
                      <View style={styles.wellnessStat}>
                        <View style={styles.wellnessIconRow}>
                          <IconZap size={16} color={theme.warning} />
                          <ThemedText type="body" style={{ marginLeft: 4 }}>
                            {wellnessBriefing.wellness.bodyBattery}%
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textMuted }}>
                          Body Battery
                        </ThemedText>
                      </View>
                    ) : null}
                    
                    {wellnessBriefing.wellness.sleepHours !== undefined ? (
                      <View style={styles.wellnessStat}>
                        <ThemedText type="body">
                          {wellnessBriefing.wellness.sleepHours?.toFixed(1)}h
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textMuted }}>
                          Sleep
                        </ThemedText>
                      </View>
                    ) : null}
                    
                    {wellnessBriefing.wellness.stressQualifier ? (
                      <View style={styles.wellnessStat}>
                        <ThemedText type="body">
                          {wellnessBriefing.wellness.stressQualifier}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textMuted }}>
                          Stress
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  
                  {wellnessBriefing.readinessInsight ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                      {wellnessBriefing.readinessInsight}
                    </ThemedText>
                  ) : null}
                </View>
              ) : loadingWellness ? (
                <View style={[styles.section, { backgroundColor: theme.backgroundRoot, alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.textMuted, marginTop: Spacing.xs }}>
                    Loading wellness data...
                  </ThemedText>
                </View>
              ) : null}

              {wellnessBriefing?.intensityAdvice ? (
                <View style={[styles.section, { backgroundColor: theme.success + '15' }]}>
                  <View style={styles.sectionHeader}>
                    <IconHeart size={20} color={theme.success} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Coach Advice
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    {wellnessBriefing.intensityAdvice}
                  </ThemedText>
                </View>
              ) : null}

              {targetTime && (targetTime.hours > 0 || targetTime.minutes > 0 || targetTime.seconds > 0) ? (
                <View style={[styles.section, { backgroundColor: theme.backgroundRoot }]}>
                  <View style={styles.sectionHeader}>
                    <IconNavigation size={20} color={theme.success} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
                      Target
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Target time: {targetTime.hours > 0 ? `${targetTime.hours}h ` : ''}{targetTime.minutes}m {targetTime.seconds}s
                  </ThemedText>
                  {summary?.targetPace ? (
                    <ThemedText type="body" style={{ color: theme.primary, marginTop: Spacing.xs, fontWeight: '600' }}>
                      Required pace: {summary.targetPace}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

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
                  <ThemedText type="body" style={{ color: theme.text, fontStyle: 'italic', textAlign: 'center' }}>
                    "{summary.coachAdvice}"
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
  wellnessStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.sm,
  },
  wellnessStat: {
    alignItems: 'center',
  },
  wellnessIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readinessCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
