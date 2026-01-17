import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, ScrollView, RefreshControl, Dimensions, Pressable, Share, Platform, Modal, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Haptics from "expo-haptics";

import {
  IconFlag,
  IconCpu,
  IconThermometer,
  IconDroplet,
  IconWind,
  IconMic,
  IconClock,
  IconZap,
  IconHeart,
  IconActivity,
  IconTrending,
  IconRepeat,
  IconShare,
  IconCheck,
} from "@/components/icons/AppIcons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Run } from "@/lib/types";
import { IconCalendar, IconPlus, IconX } from "@/components/icons/AppIcons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

type RunInsightsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RunInsights">;
  route: RouteProp<RootStackParamList, "RunInsights">;
};

export default function RunInsightsScreen({
  navigation,
  route,
}: RunInsightsScreenProps) {
  const { runId } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const mapRef = useRef<MapView>(null);

  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  const isFriendView = route.params?.isFriendView === true;

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    eventName: "",
    country: "",
    city: "",
    eventType: "5k",
    description: "",
    scheduleType: "one-time",
    recurringDay: "saturday",
    recurringFrequency: "weekly",
    oneTimeDate: "",
  });

  const fetchRun = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/runs/${runId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRun(data);
      }
    } catch (error) {
      console.log("Failed to fetch run:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRun();
  }, [runId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchRun();
    setRefreshing(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return theme.success;
      case "moderate":
        return theme.warning;
      case "challenging":
      case "hard":
        return theme.accent;
      case "extreme":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const handleShare = async () => {
    if (!run) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const message = `I just completed a ${run.distance.toFixed(2)} km run in ${formatTime(run.duration)}! Average pace: ${run.avgPace || "--:--"}/km. Tracked with AI Run Coach!`;
    
    try {
      await Share.share({
        message,
        title: "My Run",
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const generateAIInsights = async () => {
    if (!run || run.aiInsights) return;
    
    setGeneratingInsights(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/runs/${runId}/ai-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (response.ok) {
        await fetchRun();
      }
    } catch (error) {
      console.log("Failed to generate AI insights:", error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.eventName.trim() || !eventForm.country.trim()) {
      Alert.alert("Required Fields", "Please enter event name and country.");
      return;
    }
    
    if (eventForm.scheduleType === "one-time" && !eventForm.oneTimeDate) {
      Alert.alert("Date Required", "Please select a date for the one-time event.");
      return;
    }
    
    setCreatingEvent(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/events/from-run/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventName: eventForm.eventName,
          country: eventForm.country,
          city: eventForm.city || undefined,
          eventType: eventForm.eventType,
          description: eventForm.description || undefined,
          scheduleType: eventForm.scheduleType,
          recurringDay: eventForm.scheduleType === "recurring" ? eventForm.recurringDay : undefined,
          recurringFrequency: eventForm.scheduleType === "recurring" ? eventForm.recurringFrequency : undefined,
          oneTimeDate: eventForm.scheduleType === "one-time" ? eventForm.oneTimeDate : undefined,
        }),
      });
      
      if (response.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowEventModal(false);
        Alert.alert("Success", "Event created successfully!");
        setEventForm({
          eventName: "",
          country: "",
          city: "",
          eventType: "5k",
          description: "",
          scheduleType: "one-time",
          recurringDay: "saturday",
          recurringFrequency: "weekly",
          oneTimeDate: "",
        });
      } else {
        const error = await response.json();
        Alert.alert("Error", error.message || "Failed to create event");
      }
    } catch (error) {
      console.log("Create event error:", error);
      Alert.alert("Error", "Failed to create event. Please try again.");
    } finally {
      setCreatingEvent(false);
    }
  };

  const gpsTrackCoordinates = run?.gpsTrack?.map((point: any) => ({
    latitude: point.lat,
    longitude: point.lng,
  })) || [];

  const shouldShowCoachingLogs = (isAdmin || run?.aiCoachEnabled !== false) && !isFriendView;

  const getMapRegion = () => {
    if (gpsTrackCoordinates.length === 0) return null;
    
    let minLat = gpsTrackCoordinates[0].latitude;
    let maxLat = gpsTrackCoordinates[0].latitude;
    let minLng = gpsTrackCoordinates[0].longitude;
    let maxLng = gpsTrackCoordinates[0].longitude;
    
    gpsTrackCoordinates.forEach((coord: any) => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    });
    
    const latDelta = (maxLat - minLat) * 1.3;
    const lngDelta = (maxLng - minLng) * 1.3;
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  };

  if (loading) {
    return <LoadingScreen message="Loading run details..." />;
  }

  if (!run) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText type="h4" style={{ textAlign: "center", marginTop: 100 }}>
          Run not found
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
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
      {/* Success Banner */}
      <View style={[styles.successBanner, { backgroundColor: theme.success + "15" }]}>
        <IconCheck size={24} color={theme.success} />
        <ThemedText type="body" style={{ color: theme.success, marginLeft: Spacing.sm }}>
          Run Complete!
        </ThemedText>
      </View>

      {/* GPS Track Map */}
      {gpsTrackCoordinates.length > 0 ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={getMapRegion() || undefined}
            customMapStyle={mapStyle}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Polyline
              coordinates={gpsTrackCoordinates}
              strokeColor={theme.primary}
              strokeWidth={4}
            />
            {gpsTrackCoordinates.length > 0 ? (
              <>
                <Marker
                  coordinate={gpsTrackCoordinates[0]}
                  title="Start"
                  pinColor={theme.success}
                />
                <Marker
                  coordinate={gpsTrackCoordinates[gpsTrackCoordinates.length - 1]}
                  title="Finish"
                  pinColor={theme.error}
                />
              </>
            ) : null}
          </MapView>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatDate(run.completedAt || run.runDate)}
        </ThemedText>
        <View style={styles.titleRow}>
          <ThemedText style={[Typography.statLarge, { color: theme.primary }]}>
            {run.distance.toFixed(2)}
          </ThemedText>
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            km
          </ThemedText>
        </View>
        {run.difficulty ? (
          <View
            style={[
              styles.difficultyBadge,
              { backgroundColor: getDifficultyColor(run.difficulty) + "20" },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: getDifficultyColor(run.difficulty) }}
            >
              {run.difficulty}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* Main Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Duration"
          value={formatTime(run.duration)}
          icon={<IconClock size={24} color={theme.primary} />}
          color={theme.primary}
          style={styles.statCard}
        />
        <StatCard
          label="Avg Pace"
          value={run.avgPace || "--:--"}
          unit="/km"
          icon={<IconZap size={24} color={theme.accent} />}
          color={theme.accent}
          style={styles.statCard}
        />
        {run.avgHeartRate ? (
          <StatCard
            label="Avg Heart Rate"
            value={run.avgHeartRate.toString()}
            unit="bpm"
            icon={<IconHeart size={24} color={theme.error} />}
            color={theme.error}
            style={styles.statCard}
          />
        ) : null}
        {run.calories ? (
          <StatCard
            label="Calories"
            value={run.calories.toString()}
            unit="kcal"
            icon={<IconActivity size={24} color={theme.warning} />}
            color={theme.warning}
            style={styles.statCard}
          />
        ) : null}
        {run.elevationGain ? (
          <StatCard
            label="Elevation Gain"
            value={Math.round(run.elevationGain).toString()}
            unit="m"
            icon={<IconTrending size={24} color={theme.success} />}
            color={theme.success}
            style={styles.statCard}
          />
        ) : null}
        {run.cadence ? (
          <StatCard
            label="Cadence"
            value={run.cadence.toString()}
            unit="spm"
            icon={<IconRepeat size={24} color={theme.primary} />}
            color={theme.primary}
            style={styles.statCard}
          />
        ) : null}
      </View>

      {/* Km Splits */}
      {run.paceData && run.paceData.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Km Splits
          </ThemedText>
          <Card style={styles.splitsCard}>
            {run.paceData.map((split: any, index: number) => (
              <View
                key={index}
                style={[
                  styles.splitRow,
                  index !== run.paceData!.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.splitKm}>
                  <IconFlag size={14} color={theme.textMuted} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    Km {split.km}
                  </ThemedText>
                </View>
                <ThemedText type="h4" style={{ color: theme.primary }}>
                  {split.pace}
                </ThemedText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* AI Insights */}
      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          AI Analysis
        </ThemedText>
        {run.aiInsights ? (
          <Card gradient>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIcon, { backgroundColor: theme.primary + "20" }]}>
                <IconCpu size={20} color={theme.primary} />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Coach Insights
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ lineHeight: 24 }}>
              {run.aiInsights}
            </ThemedText>
          </Card>
        ) : (
          <Card>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Get personalized insights from your AI coach about this run.
            </ThemedText>
            <Button
              onPress={generateAIInsights}
              loading={generatingInsights}
              style={{ alignSelf: "flex-start" }}
            >
              Generate AI Insights
            </Button>
          </Card>
        )}
      </View>

      {/* Weather Data */}
      {run.weatherData ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Weather Conditions
          </ThemedText>
          <Card style={styles.weatherCard}>
            <View style={styles.weatherRow}>
              <View style={styles.weatherItem}>
                <IconThermometer size={16} color={theme.textMuted} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {run.weatherData.temperature}°C
                </ThemedText>
              </View>
              {run.weatherData.humidity ? (
                <View style={styles.weatherItem}>
                  <IconDroplet size={16} color={theme.textMuted} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    {run.weatherData.humidity}%
                  </ThemedText>
                </View>
              ) : null}
              {run.weatherData.windSpeed ? (
                <View style={styles.weatherItem}>
                  <IconWind size={16} color={theme.textMuted} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    {run.weatherData.windSpeed} km/h
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {run.weatherData.conditions ? (
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
              >
                {run.weatherData.conditions}
              </ThemedText>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/* AI Coaching Notes */}
      {shouldShowCoachingLogs && run.aiCoachingNotes && run.aiCoachingNotes.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Coaching Notes
          </ThemedText>
          {run.aiCoachingNotes.map((note: any, index: number) => (
            <Card key={index} style={styles.coachingNote}>
              <View style={styles.noteHeader}>
                <IconMic size={14} color={theme.primary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textMuted, marginLeft: Spacing.sm }}
                >
                  {formatTime(note.time)}
                </ThemedText>
              </View>
              <ThemedText type="body">{note.message}</ThemedText>
            </Card>
          ))}
        </View>
      ) : null}

      {/* Create Event Button (Admin Only) */}
      {isAdmin ? (
        <Pressable
          onPress={() => setShowEventModal(true)}
          style={[styles.createEventButton, { backgroundColor: theme.accent + "20", borderColor: theme.accent }]}
        >
          <IconCalendar size={20} color={theme.accent} />
          <ThemedText type="body" style={{ color: theme.accent, marginLeft: Spacing.sm, fontWeight: "600" }}>
            Create Event from Run
          </ThemedText>
        </Pressable>
      ) : null}

      {/* Share Button */}
      <Pressable
        onPress={handleShare}
        style={[styles.shareButton, { backgroundColor: theme.primary }]}
      >
        <IconShare size={20} color={theme.buttonText} />
        <ThemedText type="body" style={{ color: theme.buttonText, marginLeft: Spacing.sm, fontWeight: "600" }}>
          Share Run
        </ThemedText>
      </Pressable>

      {/* Done Button */}
      <Button
        onPress={() => navigation.goBack()}
        variant="secondary"
        style={{ marginTop: Spacing.md }}
      >
        Done
      </Button>

      {/* Create Event Modal */}
      <Modal
        visible={showEventModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Create Event</ThemedText>
              <Pressable onPress={() => setShowEventModal(false)}>
                <IconX size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                Event Name *
              </ThemedText>
              <Input
                value={eventForm.eventName}
                onChangeText={(text) => setEventForm({ ...eventForm, eventName: text })}
                placeholder="e.g., Saturday Morning Parkrun"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                Country *
              </ThemedText>
              <Input
                value={eventForm.country}
                onChangeText={(text) => setEventForm({ ...eventForm, country: text })}
                placeholder="e.g., United States"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                City (Optional)
              </ThemedText>
              <Input
                value={eventForm.city}
                onChangeText={(text) => setEventForm({ ...eventForm, city: text })}
                placeholder="e.g., New York"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                Event Type
              </ThemedText>
              <View style={styles.scheduleRow}>
                {["parkrun", "5k", "10k", "half_marathon", "marathon", "trail", "other"].map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setEventForm({ ...eventForm, eventType: type })}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor: eventForm.eventType === type ? theme.primary + "20" : "transparent",
                        borderColor: eventForm.eventType === type ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: eventForm.eventType === type ? theme.primary : theme.text }}
                    >
                      {type.replace("_", " ")}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                Description (Optional)
              </ThemedText>
              <Input
                value={eventForm.description}
                onChangeText={(text) => setEventForm({ ...eventForm, description: text })}
                placeholder="Brief description of the event"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                Schedule Type
              </ThemedText>
              <View style={styles.scheduleRow}>
                <Pressable
                  onPress={() => setEventForm({ ...eventForm, scheduleType: "one-time" })}
                  style={[
                    styles.scheduleOption,
                    {
                      backgroundColor: eventForm.scheduleType === "one-time" ? theme.primary + "20" : "transparent",
                      borderColor: eventForm.scheduleType === "one-time" ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: eventForm.scheduleType === "one-time" ? theme.primary : theme.text }}
                  >
                    One-Time
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setEventForm({ ...eventForm, scheduleType: "recurring" })}
                  style={[
                    styles.scheduleOption,
                    {
                      backgroundColor: eventForm.scheduleType === "recurring" ? theme.primary + "20" : "transparent",
                      borderColor: eventForm.scheduleType === "recurring" ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: eventForm.scheduleType === "recurring" ? theme.primary : theme.text }}
                  >
                    Recurring
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {eventForm.scheduleType === "one-time" ? (
              <View style={styles.formGroup}>
                <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                  Event Date *
                </ThemedText>
                <Input
                  value={eventForm.oneTimeDate}
                  onChangeText={(text) => setEventForm({ ...eventForm, oneTimeDate: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                    Frequency
                  </ThemedText>
                  <View style={styles.scheduleRow}>
                    {["daily", "weekly", "fortnightly", "monthly"].map((freq) => (
                      <Pressable
                        key={freq}
                        onPress={() => setEventForm({ ...eventForm, recurringFrequency: freq })}
                        style={[
                          styles.scheduleOption,
                          {
                            backgroundColor: eventForm.recurringFrequency === freq ? theme.primary + "20" : "transparent",
                            borderColor: eventForm.recurringFrequency === freq ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: eventForm.recurringFrequency === freq ? theme.primary : theme.text }}
                        >
                          {freq}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="small" style={[styles.formLabel, { color: theme.textSecondary }]}>
                    Day
                  </ThemedText>
                  <View style={styles.scheduleRow}>
                    {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                      <Pressable
                        key={day}
                        onPress={() => setEventForm({ ...eventForm, recurringDay: day })}
                        style={[
                          styles.scheduleOption,
                          {
                            backgroundColor: eventForm.recurringDay === day ? theme.primary + "20" : "transparent",
                            borderColor: eventForm.recurringDay === day ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: eventForm.recurringDay === day ? theme.primary : theme.text }}
                        >
                          {day.slice(0, 3)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            <Button
              onPress={handleCreateEvent}
              loading={creatingEvent}
              style={{ marginTop: Spacing.lg }}
            >
              Create Event
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: Spacing.xs,
  },
  difficultyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: "50%",
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  splitsCard: {
    padding: 0,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  splitKm: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  weatherCard: {},
  weatherRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xl,
  },
  weatherItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  coachingNote: {
    marginBottom: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  mapContainer: {
    height: 200,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  map: {
    flex: 1,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  createEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    marginBottom: Spacing.sm,
  },
  scheduleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  scheduleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  typeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
