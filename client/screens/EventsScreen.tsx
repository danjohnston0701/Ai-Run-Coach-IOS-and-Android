import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  IconUsers,
  IconAward,
  IconFlag,
  IconCompass,
  IconCalendar,
  IconMapPin,
  IconChevronRight,
  IconChevronDown,
  IconRepeat,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Event } from "@/lib/types";

const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  "Canada": "CA",
  "Australia": "AU",
  "Germany": "DE",
  "France": "FR",
  "Spain": "ES",
  "Italy": "IT",
  "Japan": "JP",
  "China": "CN",
  "Brazil": "BR",
  "Mexico": "MX",
  "Ireland": "IE",
  "New Zealand": "NZ",
  "South Africa": "ZA",
  "Netherlands": "NL",
  "Belgium": "BE",
  "Sweden": "SE",
  "Norway": "NO",
  "Denmark": "DK",
  "Finland": "FI",
  "Poland": "PL",
  "Portugal": "PT",
  "Switzerland": "CH",
  "Austria": "AT",
  "India": "IN",
  "Singapore": "SG",
  "Hong Kong": "HK",
  "Kenya": "KE",
  "Ethiopia": "ET",
};

function getCountryFlag(country: string): string {
  const code = COUNTRY_FLAGS[country];
  if (!code) return "";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getNextEventDate(event: Event): Date | null {
  if (event.scheduleType === "one_time" && event.eventDate) {
    return new Date(event.eventDate);
  }
  if (event.scheduleType === "recurring" && event.recurrencePattern) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilNext = (getDayNumber(event.recurrencePattern) - dayOfWeek + 7) % 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
    return nextDate;
  }
  return null;
}

function getDayNumber(day: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    weekly_saturday: 6,
    weekly_sunday: 0,
  };
  return days[day.toLowerCase()] ?? 6;
}

function formatNextEventDate(date: Date | null): string {
  if (!date) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return nextDate.toLocaleDateString("en-US", { weekday: "long" });
  
  return nextDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: nextDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

interface CountrySection {
  country: string;
  flag: string;
  events: Event[];
  earliestDate: Date | null;
}

function CollapsibleSection({
  section,
  isExpanded,
  onToggle,
  onEventPress,
  theme,
}: {
  section: CountrySection;
  isExpanded: boolean;
  onToggle: () => void;
  onEventPress: (event: Event) => void;
  theme: any;
}) {
  const rotation = useSharedValue(isExpanded ? 0 : -90);
  
  React.useEffect(() => {
    rotation.value = withTiming(isExpanded ? 0 : -90, { duration: 200 });
  }, [isExpanded, rotation]);
  
  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.section}>
      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        style={[
          styles.sectionHeader,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
        ]}
      >
        <View style={styles.sectionHeaderLeft}>
          <ThemedText type="h3" style={styles.flag}>
            {section.flag}
          </ThemedText>
          <View>
            <ThemedText type="h4">{section.country}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {section.events.length} event{section.events.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          {section.earliestDate ? (
            <ThemedText type="small" style={{ color: theme.primary, marginRight: Spacing.sm }}>
              Next: {formatNextEventDate(section.earliestDate)}
            </ThemedText>
          ) : null}
          <Animated.View style={animatedChevronStyle}>
            <IconChevronDown size={20} color={theme.textMuted} />
          </Animated.View>
        </View>
      </Pressable>
      
      {isExpanded ? (
        <View style={styles.sectionContent}>
          {section.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => onEventPress(event)}
              theme={theme}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function EventCard({
  event,
  onPress,
  theme,
}: {
  event: Event;
  onPress: () => void;
  theme: any;
}) {
  const typeColor = getEventTypeColor(event.eventType, theme);
  const nextDate = getNextEventDate(event);

  return (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.eventCard,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.eventHeader}>
        <View style={[styles.eventTypeIcon, { backgroundColor: typeColor + "20" }]}>
          {getEventTypeIcon(event.eventType, typeColor, theme)}
        </View>
        <View style={styles.eventHeaderText}>
          <ThemedText type="h4" numberOfLines={1}>
            {event.name}
          </ThemedText>
          <View style={styles.eventLocation}>
            <IconMapPin size={12} color={theme.textMuted} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {event.city ? `${event.city}` : event.country}
            </ThemedText>
          </View>
        </View>
        <IconChevronRight size={20} color={theme.textMuted} />
      </View>

      <View style={styles.eventDetails}>
        <View style={[styles.eventTypeBadge, { backgroundColor: typeColor + "20" }]}>
          <ThemedText type="small" style={{ color: typeColor }}>
            {formatEventType(event.eventType)}
          </ThemedText>
        </View>
        {event.scheduleType === "recurring" ? (
          <View style={styles.scheduleInfo}>
            <IconRepeat size={12} color={theme.textMuted} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {event.recurrencePattern || "Recurring"}
            </ThemedText>
          </View>
        ) : null}
        {nextDate ? (
          <View style={[styles.nextDateBadge, { backgroundColor: theme.primary + "15" }]}>
            <IconCalendar size={12} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
              {formatNextEventDate(nextDate)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {event.description ? (
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          numberOfLines={2}
        >
          {event.description}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function getEventTypeIcon(type: string | undefined, color: string, theme: any) {
  const iconColor = color || theme.textMuted;
  switch (type?.toLowerCase()) {
    case "parkrun":
      return <IconUsers size={20} color={iconColor} />;
    case "marathon":
    case "half_marathon":
      return <IconAward size={20} color={iconColor} />;
    case "10k":
    case "5k":
      return <IconFlag size={20} color={iconColor} />;
    case "trail":
      return <IconCompass size={20} color={iconColor} />;
    default:
      return <IconCalendar size={20} color={iconColor} />;
  }
}

function getEventTypeColor(type: string | undefined, theme: any): string {
  switch (type?.toLowerCase()) {
    case "parkrun":
      return theme.success;
    case "marathon":
    case "half_marathon":
      return theme.warning;
    case "10k":
    case "5k":
      return theme.primary;
    case "trail":
      return theme.accent;
    default:
      return theme.textMuted;
  }
}

function formatEventType(type?: string): string {
  if (!type) return "Event";
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function EventsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/events`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
        if (data.length > 0) {
          const countries = [...new Set(data.map((e: Event) => e.country))] as string[];
          setExpandedCountries(new Set(countries.slice(0, 2)));
        }
      }
    } catch (error) {
      console.log("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchEvents();
    setRefreshing(false);
  };

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  const countrySections = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    events.forEach((event) => {
      const country = event.country || "Unknown";
      if (!grouped[country]) {
        grouped[country] = [];
      }
      grouped[country].push(event);
    });

    const sections: CountrySection[] = Object.entries(grouped).map(([country, countryEvents]) => {
      const eventsWithDates = countryEvents.map((e) => ({
        event: e,
        nextDate: getNextEventDate(e),
      }));
      
      eventsWithDates.sort((a, b) => {
        if (!a.nextDate) return 1;
        if (!b.nextDate) return -1;
        return a.nextDate.getTime() - b.nextDate.getTime();
      });

      return {
        country,
        flag: getCountryFlag(country),
        events: eventsWithDates.map((e) => e.event),
        earliestDate: eventsWithDates[0]?.nextDate || null,
      };
    });

    sections.sort((a, b) => {
      if (!a.earliestDate) return 1;
      if (!b.earliestDate) return -1;
      return a.earliestDate.getTime() - b.earliestDate.getTime();
    });

    return sections;
  }, [events]);

  const handleEventPress = (event: Event) => {
    navigation.navigate("EventDetails", { eventId: event.id });
  };

  if (loading) {
    return <LoadingScreen message="Loading events..." />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: events.length === 0 ? 1 : undefined,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={48} color={theme.textMuted} />}
          title="No Events"
          description="Check back later for upcoming running events in your area"
        />
      ) : (
        <>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            {events.length} event{events.length !== 1 ? "s" : ""} across {countrySections.length} {countrySections.length === 1 ? "country" : "countries"}
          </ThemedText>
          {countrySections.map((section) => (
            <CollapsibleSection
              key={section.country}
              section={section}
              isExpanded={expandedCountries.has(section.country)}
              onToggle={() => toggleCountry(section.country)}
              onEventPress={handleEventPress}
              theme={theme}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  flag: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  sectionContent: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(0, 212, 255, 0.3)",
  },
  eventCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  eventHeaderText: {
    flex: 1,
  },
  eventLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  eventDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  eventTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  scheduleInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
});
