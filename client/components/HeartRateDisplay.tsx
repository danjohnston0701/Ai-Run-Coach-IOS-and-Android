import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing } from '../constants/theme';
import { 
  getHeartRateZone, 
  getHeartRatePercent,
  HeartRateZoneInfo,
} from '../../shared/heart-rate-utils';

const theme = Colors.dark;

interface HeartRateDisplayProps {
  heartRate: number | null;
  maxHeartRate: number;
  showZone?: boolean;
  compact?: boolean;
  source?: 'garmin' | 'samsung' | 'apple' | 'manual' | 'simulated';
}

export default function HeartRateDisplay({ 
  heartRate, 
  maxHeartRate, 
  showZone = true,
  compact = false,
  source,
}: HeartRateDisplayProps) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (heartRate && heartRate > 0) {
      const bpm = heartRate;
      const beatDuration = 60000 / bpm;
      
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: beatDuration * 0.15, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: beatDuration * 0.85, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1);
    }
  }, [heartRate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!heartRate || heartRate <= 0) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Feather name="heart" size={compact ? 16 : 20} color={theme.textMuted} />
        <Text style={[styles.noData, compact && styles.textCompact]}>--</Text>
      </View>
    );
  }

  const zone = getHeartRateZone(heartRate, maxHeartRate);
  const percent = getHeartRatePercent(heartRate, maxHeartRate);

  if (compact) {
    return (
      <View style={[styles.container, styles.containerCompact]}>
        <Animated.View style={animatedStyle}>
          <Feather name="heart" size={14} color={zone.color} />
        </Animated.View>
        <Text style={[styles.heartRate, styles.textCompact, { color: zone.color }]}>
          {heartRate}
        </Text>
        <Text style={[styles.unit, styles.textCompact]}>bpm</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Animated.View style={[styles.iconContainer, animatedStyle]}>
          <Feather name="heart" size={24} color={zone.color} />
        </Animated.View>
        <View style={styles.dataContainer}>
          <View style={styles.bpmRow}>
            <Text style={[styles.heartRate, { color: zone.color }]}>{heartRate}</Text>
            <Text style={styles.unit}>bpm</Text>
          </View>
          {showZone && (
            <View style={styles.zoneRow}>
              <View style={[styles.zoneBadge, { backgroundColor: zone.color + '30' }]}>
                <Text style={[styles.zoneText, { color: zone.color }]}>
                  Zone {zone.zone}: {zone.name}
                </Text>
              </View>
              <Text style={styles.percentText}>{percent}% max</Text>
            </View>
          )}
        </View>
      </View>
      {source && (
        <View style={styles.sourceRow}>
          <Feather name="bluetooth" size={10} color={theme.textMuted} />
          <Text style={styles.sourceText}>
            {source === 'simulated' ? 'Simulated' : source.charAt(0).toUpperCase() + source.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );
}

interface HeartRateZoneBarProps {
  zones: {
    zone1Minutes: number;
    zone2Minutes: number;
    zone3Minutes: number;
    zone4Minutes: number;
    zone5Minutes: number;
  };
  totalMinutes: number;
}

export function HeartRateZoneBar({ zones, totalMinutes }: HeartRateZoneBarProps) {
  if (totalMinutes <= 0) return null;

  const zoneData = [
    { zone: 1, minutes: zones.zone1Minutes, color: '#3B82F6', name: 'Recovery' },
    { zone: 2, minutes: zones.zone2Minutes, color: '#22C55E', name: 'Fat Burn' },
    { zone: 3, minutes: zones.zone3Minutes, color: '#EAB308', name: 'Aerobic' },
    { zone: 4, minutes: zones.zone4Minutes, color: '#F97316', name: 'Threshold' },
    { zone: 5, minutes: zones.zone5Minutes, color: '#EF4444', name: 'Max' },
  ];

  return (
    <View style={styles.zoneBarContainer}>
      <Text style={styles.zoneBarTitle}>Heart Rate Zones</Text>
      <View style={styles.zoneBar}>
        {zoneData.map((z) => {
          const widthPercent = (z.minutes / totalMinutes) * 100;
          if (widthPercent < 1) return null;
          return (
            <View
              key={z.zone}
              style={[
                styles.zoneSegment,
                { width: `${widthPercent}%`, backgroundColor: z.color },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.zoneLegend}>
        {zoneData.map((z) => (
          <View key={z.zone} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: z.color }]} />
            <Text style={styles.legendText}>
              Z{z.zone}: {Math.round(z.minutes)}m
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  containerCompact: {
    gap: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataContainer: {
    flex: 1,
    gap: 4,
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  heartRate: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  unit: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  textCompact: {
    fontSize: 14,
    fontWeight: '600',
  },
  noData: {
    fontSize: 16,
    color: theme.textMuted,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 48,
  },
  sourceText: {
    fontSize: 10,
    color: theme.textMuted,
  },
  zoneBarContainer: {
    gap: Spacing.sm,
  },
  zoneBarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  zoneBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.backgroundTertiary,
  },
  zoneSegment: {
    height: '100%',
  },
  zoneLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
});
