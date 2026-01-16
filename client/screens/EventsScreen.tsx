import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Event } from "@/lib/types";

export default function EventsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/events`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
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

  const getEventTypeIcon = (type?: string): keyof typeof Feather.glyphMap => {
    switch (type?.toLowerCase()) {
      case "parkrun":
        return "users";
      case "marathon":
      case "half_marathon":
        return "award";
      case "10k":
      case "5k":
        return "flag";
      case "trail":
        return "compass";
      default:
        return "calendar";
    }
  };

  const getEventTypeColor = (type?: string) => {
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
  };

  const formatEventType = (type?: string) => {
    if (!type) return "Event";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get unique countries
  const countries = [...new Set(events.map((e) => e.country))].sort();

  // Filter events by country
  const filteredEvents = selectedCountry
    ? events.filter((e) => e.country === selectedCountry)
    : events;

  const renderEvent = ({ item }: { item: Event }) => {
    const typeColor = getEventTypeColor(item.eventType);
    const typeIcon = getEventTypeIcon(item.eventType);

    return (
      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("EventDetails", { eventId: item.id });
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
            <Feather name={typeIcon} size={20} color={typeColor} />
          </View>
          <View style={styles.eventHeaderText}>
            <ThemedText type="h4" numberOfLines={1}>
              {item.name}
            </ThemedText>
            <View style={styles.eventLocation}>
              <Feather name="map-pin" size={12} color={theme.textMuted} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.city ? `${item.city}, ` : ""}{item.country}
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textMuted} />
        </View>

        <View style={styles.eventDetails}>
          <View style={[styles.eventTypeBadge, { backgroundColor: typeColor + "20" }]}>
            <ThemedText type="caption" style={{ color: typeColor }}>
              {formatEventType(item.eventType)}
            </ThemedText>
          </View>
          {item.scheduleType === "recurring" ? (
            <View style={styles.scheduleInfo}>
              <Feather name="repeat" size={12} color={theme.textMuted} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.recurrencePattern || "Recurring"}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
            numberOfLines={2}
          >
            {item.description}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading events..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Country Filter */}
      {countries.length > 1 ? (
        <View
          style={[
            styles.filterContainer,
            {
              paddingTop: headerHeight + Spacing.md,
              backgroundColor: theme.backgroundRoot,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[null, ...countries]}
            keyExtractor={(item) => item || "all"}
            contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            renderItem={({ item }) => (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCountry(item);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedCountry === item
                        ? theme.primary
                        : theme.backgroundSecondary,
                    borderColor:
                      selectedCountry === item ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: selectedCountry === item ? theme.buttonText : theme.text,
                    fontWeight: "500",
                  }}
                >
                  {item || "All"}
                </ThemedText>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: countries.length > 1 ? Spacing.md : headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: filteredEvents.length === 0 ? 1 : undefined,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="No Events"
            description="Check back later for upcoming running events in your area"
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  list: {
    flex: 1,
  },
  eventCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
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
    marginTop: Spacing.md,
  },
  eventTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.md,
  },
  scheduleInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
});
