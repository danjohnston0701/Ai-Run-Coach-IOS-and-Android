import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { EmptyState } from '@/components/EmptyState';
import {
  IconUsers,
  IconPlus,
  IconMapPin,
  IconCalendar,
  IconClock,
  IconCheck,
  IconX,
  IconUserPlus,
} from '@/components/icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface GroupRun {
  id: string;
  name: string;
  description?: string;
  organizerId: string;
  organizerName: string;
  scheduledAt: string;
  meetingPoint: string;
  meetingLat?: number;
  meetingLng?: number;
  distance?: number;
  difficulty?: string;
  maxParticipants?: number;
  participantCount: number;
  isJoined: boolean;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

export default function GroupRunsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [groupRuns, setGroupRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newRun, setNewRun] = useState({
    name: '',
    description: '',
    meetingPoint: '',
    distance: '',
    difficulty: 'moderate',
    maxParticipants: '',
    scheduledAt: new Date(Date.now() + 86400000),
  });
  const [creating, setCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchGroupRuns = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/group-runs`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setGroupRuns(data);
      }
    } catch (error) {
      console.error('Failed to fetch group runs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupRuns();
  }, [fetchGroupRuns]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroupRuns();
  }, [fetchGroupRuns]);

  const handleJoinRun = async (runId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/group-runs/${runId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user?.id }),
      });

      if (response.ok) {
        setGroupRuns((prev) =>
          prev.map((run) =>
            run.id === runId
              ? { ...run, isJoined: true, participantCount: run.participantCount + 1 }
              : run
          )
        );
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to join group run');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join group run');
    }
  };

  const handleCreateRun = async () => {
    if (!newRun.name.trim() || !newRun.meetingPoint.trim()) {
      Alert.alert('Error', 'Please fill in the name and meeting point');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);

    try {
      const baseUrl = getApiUrl();

      let meetingCoords: { lat: number | undefined; lng: number | undefined } = { lat: undefined, lng: undefined };
      try {
        const geocode = await Location.geocodeAsync(newRun.meetingPoint);
        if (geocode.length > 0) {
          meetingCoords = {
            lat: geocode[0].latitude,
            lng: geocode[0].longitude,
          };
        }
      } catch {}

      const response = await fetch(`${baseUrl}/api/group-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizerId: user?.id,
          organizerName: user?.name,
          name: newRun.name.trim(),
          description: newRun.description.trim() || undefined,
          meetingPoint: newRun.meetingPoint.trim(),
          meetingLat: meetingCoords.lat,
          meetingLng: meetingCoords.lng,
          distance: newRun.distance ? parseFloat(newRun.distance) : undefined,
          difficulty: newRun.difficulty,
          maxParticipants: newRun.maxParticipants ? parseInt(newRun.maxParticipants) : undefined,
          scheduledAt: newRun.scheduledAt.toISOString(),
        }),
      });

      if (response.ok) {
        const createdRun = await response.json();
        setGroupRuns((prev) => [createdRun, ...prev]);
        setShowCreateModal(false);
        setNewRun({
          name: '',
          description: '',
          meetingPoint: '',
          distance: '',
          difficulty: 'moderate',
          maxParticipants: '',
          scheduledAt: new Date(Date.now() + 86400000),
        });
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to create group run');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create group run');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderGroupRun = ({ item }: { item: GroupRun }) => (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('GroupRunDetail', { runId: item.id });
      }}
      style={[styles.runCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
    >
      <View style={styles.runHeader}>
        <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
          {item.name}
        </ThemedText>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'scheduled'
                  ? theme.primary + '20'
                  : item.status === 'active'
                  ? theme.success + '20'
                  : theme.textMuted + '20',
            },
          ]}
        >
          <ThemedText
            type="small"
            style={{
              color:
                item.status === 'scheduled'
                  ? theme.primary
                  : item.status === 'active'
                  ? theme.success
                  : theme.textMuted,
            }}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.runDetails}>
        <View style={styles.detailRow}>
          <IconCalendar size={14} color={theme.textMuted} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
            {formatDate(item.scheduledAt)}
          </ThemedText>
          <View style={{ marginLeft: Spacing.md }}>
            <IconClock size={14} color={theme.textMuted} />
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
            {formatTime(item.scheduledAt)}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <IconMapPin size={14} color={theme.textMuted} />
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}
            numberOfLines={1}
          >
            {item.meetingPoint}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <IconUsers size={14} color={theme.textMuted} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
            {item.participantCount}
            {item.maxParticipants ? ` / ${item.maxParticipants}` : ''} participants
          </ThemedText>
        </View>
      </View>

      {!item.isJoined && item.status === 'scheduled' ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleJoinRun(item.id);
          }}
          style={[styles.joinButton, { backgroundColor: theme.primary }]}
        >
          <IconUserPlus size={16} color={theme.backgroundRoot} />
          <ThemedText
            type="small"
            style={{ color: theme.backgroundRoot, fontWeight: '600', marginLeft: Spacing.xs }}
          >
            Join
          </ThemedText>
        </Pressable>
      ) : item.isJoined ? (
        <View style={[styles.joinedBadge, { backgroundColor: theme.success + '20' }]}>
          <IconCheck size={16} color={theme.success} />
          <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.xs }}>
            Joined
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={groupRuns}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupRun}
        contentContainerStyle={[
          styles.list,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<IconUsers size={48} color={theme.textMuted} />}
            title="No Group Runs"
            description="Be the first to organize a group run! Tap the + button to create one."
          />
        }
      />

      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreateModal(true);
        }}
        style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + Spacing.lg }]}
      >
        <IconPlus size={24} color={theme.backgroundRoot} />
      </Pressable>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h2">Create Group Run</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <IconX size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                Run Name *
              </ThemedText>
              <TextInput
                value={newRun.name}
                onChangeText={(text) => setNewRun((prev) => ({ ...prev, name: text }))}
                placeholder="e.g., Saturday Morning Run"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              />

              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                Meeting Point *
              </ThemedText>
              <TextInput
                value={newRun.meetingPoint}
                onChangeText={(text) => setNewRun((prev) => ({ ...prev, meetingPoint: text }))}
                placeholder="Address or location description"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              />

              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                Description
              </ThemedText>
              <TextInput
                value={newRun.description}
                onChangeText={(text) => setNewRun((prev) => ({ ...prev, description: text }))}
                placeholder="Tell participants about this run"
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    Distance (km)
                  </ThemedText>
                  <TextInput
                    value={newRun.distance}
                    onChangeText={(text) => setNewRun((prev) => ({ ...prev, distance: text }))}
                    placeholder="5"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                    Max Participants
                  </ThemedText>
                  <TextInput
                    value={newRun.maxParticipants}
                    onChangeText={(text) => setNewRun((prev) => ({ ...prev, maxParticipants: text }))}
                    placeholder="20"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  />
                </View>
              </View>

              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.md }}>
                Date & Time
              </ThemedText>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={[styles.input, styles.dateInput, { backgroundColor: theme.backgroundSecondary }]}
              >
                <IconCalendar size={16} color={theme.textMuted} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                  {newRun.scheduledAt.toLocaleString()}
                </ThemedText>
              </Pressable>

              {showDatePicker ? (
                <DateTimePicker
                  value={newRun.scheduledAt}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: DateTimePickerEvent, date?: Date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setNewRun((prev) => ({ ...prev, scheduledAt: date }));
                    }
                  }}
                  minimumDate={new Date()}
                />
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={[styles.modalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateRun}
                disabled={creating}
                style={[styles.modalButton, { backgroundColor: theme.primary, marginLeft: Spacing.md }]}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={theme.backgroundRoot} />
                ) : (
                  <ThemedText type="body" style={{ color: theme.backgroundRoot, fontWeight: '600' }}>
                    Create
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  runCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  runDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.sm,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
