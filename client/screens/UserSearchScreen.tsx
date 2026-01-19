import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { EmptyState } from '@/components/EmptyState';
import {
  IconSearch,
  IconUserPlus,
  IconUserCheck,
  IconUsers,
  IconClock,
} from '@/components/icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface SearchUser {
  id: string;
  name: string;
  email?: string;
  referralCode?: string;
  userCode?: string;
  totalRuns?: number;
  totalDistance?: number;
  friendStatus?: 'none' | 'pending' | 'accepted' | 'sent';
}

export default function UserSearchScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        `${baseUrl}/api/users/search?q=${encodeURIComponent(query.trim())}&userId=${user?.id}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.filter((u: SearchUser) => u.id !== user?.id));
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, user?.id]);

  const handleSendFriendRequest = async (targetUser: SearchUser) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingRequest(targetUser.id);

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          senderId: user?.id,
          receiverId: targetUser.id,
          fromUserId: user?.id,
          toUserId: targetUser.id,
        }),
      });

      if (response.ok) {
        setResults((prev) =>
          prev.map((u) =>
            u.id === targetUser.id ? { ...u, friendStatus: 'sent' } : u
          )
        );
        Alert.alert('Success', 'Friend request sent!');
      } else {
        const data = await response.json().catch(() => ({}));
        console.log('Friend request error:', response.status, data);
        Alert.alert('Error', data.message || data.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.log('Friend request exception:', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const renderUser = ({ item }: { item: SearchUser }) => (
    <View style={[styles.userCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primary + '30' }]}>
        <ThemedText type="h3" style={{ color: theme.primary }}>
          {item.name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.userInfo}>
        <ThemedText type="body" style={{ fontWeight: '600' }}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.primary }}>
          ID: {item.userCode || item.referralCode || item.id.slice(0, 8)}
        </ThemedText>
        {item.totalRuns !== undefined ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.totalRuns} runs · {(item.totalDistance || 0).toFixed(1)} km
          </ThemedText>
        ) : null}
      </View>
      {item.friendStatus === 'accepted' ? (
        <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
          <IconUserCheck size={16} color={theme.success} />
          <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.xs }}>
            Friends
          </ThemedText>
        </View>
      ) : item.friendStatus === 'sent' || item.friendStatus === 'pending' ? (
        <View style={[styles.statusBadge, { backgroundColor: theme.warning + '20' }]}>
          <IconClock size={16} color={theme.warning} />
          <ThemedText type="small" style={{ color: theme.warning, marginLeft: Spacing.xs }}>
            Pending
          </ThemedText>
        </View>
      ) : (
        <Pressable
          onPress={() => handleSendFriendRequest(item)}
          disabled={sendingRequest === item.id}
          style={[styles.addButton, { backgroundColor: theme.primary }]}
        >
          {sendingRequest === item.id ? (
            <ActivityIndicator size="small" color={theme.backgroundRoot} />
          ) : (
            <IconUserPlus size={18} color={theme.backgroundRoot} />
          )}
        </Pressable>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
          <IconSearch size={20} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search by name or referral code"
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <Pressable
          onPress={handleSearch}
          disabled={loading || !query.trim()}
          style={[
            styles.searchButton,
            { backgroundColor: query.trim() ? theme.primary : theme.backgroundSecondary },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.backgroundRoot} />
          ) : (
            <ThemedText
              type="small"
              style={{
                color: query.trim() ? theme.backgroundRoot : theme.textMuted,
                fontWeight: '600',
              }}
            >
              Search
            </ThemedText>
          )}
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
        ListEmptyComponent={
          searched ? (
            <EmptyState
              icon={<IconUsers size={48} color={theme.textMuted} />}
              title="No Users Found"
              description="Try searching with a different name or referral code."
            />
          ) : (
            <View style={styles.instructions}>
              <IconSearch size={48} color={theme.textMuted} />
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.lg }}>
                Search for friends by their name or referral code to connect and share your runs together.
              </ThemedText>
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  searchButton: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: {
    alignItems: 'center',
    padding: Spacing['3xl'],
  },
});
