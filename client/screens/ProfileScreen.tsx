import React, { useState, useEffect, useCallback, ReactNode } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Image,
  Alert,
  Platform,
  Linking,
  TextInput,
  FlatList,
  Modal,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  IconProfile,
  IconMic,
  IconVolume,
  IconActivity,
  IconTarget,
  IconBell,
  IconGlobe,
  IconCreditCard,
  IconChevronRight,
  IconCamera,
  IconUsers,
  IconUserPlus,
  IconUserX,
  IconUserCheck,
  IconCopy,
  IconSearch,
  IconX,
  IconSettings,
} from "@/components/icons/AppIcons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getStoredToken, updateStoredUserPhoto } from "@/lib/auth";

interface Friend {
  id: string;
  name: string;
  email?: string;
  profilePic?: string;
  userCode?: string;
}

interface FriendRequest {
  id: string;
  fromUser: Friend;
  status: string;
  createdAt: string;
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  color?: string;
  showArrow?: boolean;
  badge?: number;
}

function MenuItem({ icon, label, value, onPress, color, showArrow = true, badge }: MenuItemProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? theme.backgroundTertiary : "transparent",
        },
      ]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: iconColor + "20" }]}>
        {icon}
      </View>
      <View style={styles.menuContent}>
        <ThemedText type="body">{label}</ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {badge && badge > 0 ? (
        <View style={[styles.badgeCount, { backgroundColor: theme.error }]}>
          <ThemedText type="small" style={{ color: "#fff", fontSize: 11 }}>
            {badge}
          </ThemedText>
        </View>
      ) : null}
      {showArrow ? <IconChevronRight size={20} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout, isLoading, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [showPhotoConfirmModal, setShowPhotoConfirmModal] = useState(false);

  const [distanceMin, setDistanceMin] = useState<string>(String(user?.distanceMinKm ?? 1));
  const [distanceMax, setDistanceMax] = useState<string>(String(user?.distanceMaxKm ?? 50));
  const [decimalsEnabled, setDecimalsEnabled] = useState(user?.distanceDecimalsEnabled ?? false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState((user as any)?.pushNotificationsEnabled ?? false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    if (user) {
      setDistanceMin(String(user.distanceMinKm ?? 1));
      setDistanceMax(String(user.distanceMaxKm ?? 50));
      setDecimalsEnabled(user.distanceDecimalsEnabled ?? false);
      setPushNotificationsEnabled((user as any)?.pushNotificationsEnabled ?? false);
    }
  }, [user]);

  const saveDistancePreferences = useCallback(async () => {
    if (!user?.id) return;
    
    const minVal = parseFloat(distanceMin) || 1;
    const maxVal = parseFloat(distanceMax) || 50;
    
    if (decimalsEnabled && (maxVal - minVal) > 30) {
      Alert.alert("Invalid Range", "When decimals are enabled, the maximum range between min and max is 30km.");
      return;
    }
    
    if (minVal >= maxVal) {
      Alert.alert("Invalid Range", "Minimum must be less than maximum.");
      return;
    }
    
    setSavingPreferences(true);
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          distanceMinKm: minVal,
          distanceMaxKm: maxVal,
          distanceDecimalsEnabled: decimalsEnabled,
        }),
      });
      await refreshUser();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log("Failed to save distance preferences:", error);
      Alert.alert("Error", "Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  }, [user?.id, distanceMin, distanceMax, decimalsEnabled, refreshUser]);

  const handleDecimalsToggle = useCallback(async (value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDecimalsEnabled(value);
    
    const minVal = parseFloat(distanceMin) || 1;
    const maxVal = parseFloat(distanceMax) || 50;
    
    if (value && (maxVal - minVal) > 30) {
      setDistanceMax(String(minVal + 30));
    }
  }, [distanceMin, distanceMax]);

  const handlePushToggle = useCallback(async (value: boolean) => {
    if (!user?.id) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPushNotificationsEnabled(value);
    
    try {
      const baseUrl = getApiUrl();
      await fetch(`${baseUrl}/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pushNotificationsEnabled: value }),
      });
    } catch (error) {
      console.log("Failed to update push notification setting:", error);
    }
  }, [user?.id]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) return;
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/friends?userId=${user.id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Friends API response:", JSON.stringify(data).slice(0, 500));
        // Handle both formats: { friends: [], requests: [] } or direct array
        if (Array.isArray(data)) {
          setFriends(data);
          setFriendRequests([]);
        } else {
          setFriends(data.friends || data.accepted || []);
          setFriendRequests(data.requests || data.pending || []);
        }
      }
    } catch (error) {
      console.log("Failed to fetch friends:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleLogout = async () => {
    const doLogout = async () => {
      setLoggingOut(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await logout();
      } catch (error) {
        console.log("Logout error:", error);
      } finally {
        setLoggingOut(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) {
        doLogout();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const openWebApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL("https://airuncoach.live");
  };

  const copyUserCode = async () => {
    if (user?.userCode) {
      await Clipboard.setStringAsync(user.userCode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === "web") {
        alert("User code copied to clipboard!");
      } else {
        Alert.alert("Copied", "Your user code has been copied to the clipboard.");
      }
    }
  };

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take photos.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Photo library permission is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets[0]) {
      // Show custom confirmation modal with "Confirm" button
      setPendingPhotoUri(result.assets[0].uri);
      setShowPhotoConfirmModal(true);
    }
  };

  const confirmPhotoUpload = async () => {
    if (pendingPhotoUri) {
      setShowPhotoConfirmModal(false);
      await uploadProfilePhoto(pendingPhotoUri);
      setPendingPhotoUri(null);
    }
  };

  const cancelPhotoUpload = () => {
    setShowPhotoConfirmModal(false);
    setPendingPhotoUri(null);
  };

  const uploadProfilePhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const baseUrl = getApiUrl();
      const token = await getStoredToken();
      
      // Build headers with authorization if available
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      // Try uploading to different possible endpoints
      const possibleEndpoints = [
        "/api/user/profile-photo",
        "/api/users/profile-photo", 
        "/api/profile/photo",
        `/api/users/${user?.id}/profile-photo`,
      ];
      
      let uploadSuccess = false;
      
      for (const endpoint of possibleEndpoints) {
        if (uploadSuccess) break;
        
        try {
          const formData = new FormData();
          
          if (Platform.OS === "web") {
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append("photo", blob, "photo.jpg");
            formData.append("image", blob, "photo.jpg");
          } else {
            const filename = uri.split("/").pop() || "photo.jpg";
            const fileObj = {
              uri,
              name: filename,
              type: "image/jpeg",
            };
            formData.append("photo", fileObj as any);
            formData.append("image", fileObj as any);
          }
          
          console.log("Trying endpoint:", `${baseUrl}${endpoint}`);
          
          const uploadResponse = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers,
            credentials: "include",
            body: formData,
          });
          
          console.log("Response status:", uploadResponse.status);
          
          if (uploadResponse.ok) {
            uploadSuccess = true;
            console.log("Upload succeeded at:", endpoint);
            
            // Try to get the new photo URL from the response
            try {
              const responseData = await uploadResponse.json();
              console.log("Upload response data:", responseData);
              
              // The response might contain the new photo URL in various fields
              const newPhotoUrl = responseData.profilePic || responseData.photoUrl || 
                                  responseData.url || responseData.imageUrl ||
                                  responseData.user?.profilePic;
              
              if (newPhotoUrl) {
                // Update local storage with the new photo URL
                await updateStoredUserPhoto(newPhotoUrl);
              }
            } catch (parseError) {
              console.log("Could not parse upload response:", parseError);
            }
            
            // Refresh from local storage (not server to avoid logout)
            await refreshUser?.();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Profile photo updated successfully!");
            break;
          } else {
            const errorText = await uploadResponse.text();
            console.log(`Endpoint ${endpoint} failed:`, uploadResponse.status, errorText);
          }
        } catch (endpointError) {
          console.log(`Endpoint ${endpoint} error:`, endpointError);
        }
      }
      
      if (!uploadSuccess) {
        throw new Error("All upload endpoints failed");
      }
    } catch (error) {
      console.log("Failed to upload photo:", error);
      Alert.alert("Error", "Failed to upload profile photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    if (Platform.OS === "web") {
      pickImage(false);
    } else {
      Alert.alert("Update Profile Photo", "Choose an option", [
        { text: "Take Photo", onPress: () => pickImage(true) },
        { text: "Choose from Library", onPress: () => pickImage(false) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.log("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toUserId: userId }),
      });
      if (response.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Friend request sent!");
        setShowSearchModal(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (error) {
      console.log("Failed to send friend request:", error);
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/friends/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId, accept }),
      });
      if (response.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchFriends();
      }
    } catch (error) {
      console.log("Failed to respond to request:", error);
    }
  };

  const removeFriend = async (friendId: string) => {
    Alert.alert("Remove Friend", "Are you sure you want to remove this friend?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const baseUrl = getApiUrl();
            const response = await fetch(`${baseUrl}/api/friends/${friendId}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (response.ok) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchFriends();
            }
          } catch (error) {
            console.log("Failed to remove friend:", error);
          }
        },
      },
    ]);
  };

  const getSubscriptionBadge = () => {
    if (user?.entitlementType === "premium" || user?.subscriptionStatus === "active") {
      return { label: "Premium", color: theme.warning };
    }
    if (user?.entitlementType === "trial") {
      return { label: "Trial", color: theme.primary };
    }
    return { label: "Free", color: theme.textMuted };
  };

  const badge = getSubscriptionBadge();

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowFriendsModal(false);
        navigation.navigate("FriendProfile", { friendId: item.id });
      }}
      style={({ pressed }) => [
        styles.friendItem,
        { backgroundColor: pressed ? theme.backgroundTertiary : theme.backgroundSecondary },
      ]}
    >
      <View style={[styles.friendAvatar, { backgroundColor: theme.backgroundTertiary }]}>
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.friendAvatarImage} />
        ) : (
          <IconProfile size={20} color={theme.textMuted} />
        )}
      </View>
      <View style={styles.friendInfo}>
        <ThemedText type="body">{item.name}</ThemedText>
        {item.userCode ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            #{item.userCode}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        onPress={() => removeFriend(item.id)}
        hitSlop={8}
        style={[styles.removeButton, { backgroundColor: theme.error + "20" }]}
      >
        <IconUserX size={16} color={theme.error} />
      </Pressable>
    </Pressable>
  );

  const renderSearchResult = ({ item }: { item: Friend }) => (
    <View style={[styles.friendItem, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.friendAvatar, { backgroundColor: theme.backgroundTertiary }]}>
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.friendAvatarImage} />
        ) : (
          <IconProfile size={20} color={theme.textMuted} />
        )}
      </View>
      <View style={styles.friendInfo}>
        <ThemedText type="body">{item.name}</ThemedText>
        {item.userCode ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            #{item.userCode}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        onPress={() => sendFriendRequest(item.id)}
        style={[styles.addButton, { backgroundColor: theme.primary }]}
      >
        <IconUserPlus size={16} color={theme.buttonText} />
      </Pressable>
    </View>
  );

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.friendItem, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.friendAvatar, { backgroundColor: theme.backgroundTertiary }]}>
        {item.fromUser.profilePic ? (
          <Image source={{ uri: item.fromUser.profilePic }} style={styles.friendAvatarImage} />
        ) : (
          <IconProfile size={20} color={theme.textMuted} />
        )}
      </View>
      <View style={styles.friendInfo}>
        <ThemedText type="body">{item.fromUser.name}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Friend request
        </ThemedText>
      </View>
      <View style={styles.requestActions}>
        <Pressable
          onPress={() => respondToRequest(item.id, true)}
          style={[styles.acceptButton, { backgroundColor: theme.success }]}
        >
          <IconUserCheck size={16} color={theme.buttonText} />
        </Pressable>
        <Pressable
          onPress={() => respondToRequest(item.id, false)}
          style={[styles.declineButton, { backgroundColor: theme.error }]}
        >
          <IconX size={16} color={theme.buttonText} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <Pressable
          onPress={showPhotoOptions}
          style={[
            styles.avatarContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              opacity: uploadingPhoto ? 0.6 : 1,
            },
          ]}
        >
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={styles.avatar} />
          ) : (
            <IconProfile size={40} color={theme.textMuted} />
          )}
          <View style={[styles.cameraButton, { backgroundColor: theme.primary }]}>
            <IconCamera size={14} color={theme.buttonText} />
          </View>
        </Pressable>
        <ThemedText type="h3" style={styles.userName}>
          {user?.name || "Runner"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>

        {user?.userCode ? (
          <Pressable onPress={copyUserCode} style={styles.userCodeContainer}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              User Code: #{user.userCode}
            </ThemedText>
            <View style={{ marginLeft: 6 }}>
              <IconCopy size={14} color={theme.primary} />
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.subscriptionBadge, { backgroundColor: badge.color + "20" }]}>
          <ThemedText type="small" style={{ color: badge.color }}>
            {badge.label}
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Friends
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconUsers size={18} color={theme.accent} />}
            label="My Friends"
            value={`${friends.length} friend${friends.length !== 1 ? "s" : ""}`}
            onPress={() => setShowFriendsModal(true)}
            color={theme.accent}
            badge={friendRequests.length}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconUserPlus size={18} color={theme.success} />}
            label="Add Friends"
            onPress={() => navigation.navigate("UserSearch")}
            color={theme.success}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconUsers size={18} color={theme.primary} />}
            label="Group Runs"
            onPress={() => navigation.navigate("GroupRuns")}
            color={theme.primary}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          AI Coach
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconMic size={18} color={theme.primary} />}
            label="Coach Voice"
            value={`${user?.coachGender || "Male"} - ${user?.coachAccent || "British"}`}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconVolume size={18} color={theme.primary} />}
            label="Coach Tone"
            value={user?.coachTone || "Energetic"}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconProfile size={18} color={theme.primary} />}
            label="Coach Name"
            value={user?.coachName || "AI Coach"}
            onPress={() => navigation.navigate("CoachSettings")}
            color={theme.primary}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Profile
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconProfile size={18} color={theme.accent} />}
            label="Personal Details"
            onPress={() => navigation.navigate("PersonalDetails")}
            color={theme.accent}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconActivity size={18} color={theme.success} />}
            label="Fitness Level"
            value={user?.fitnessLevel || "Not set"}
            onPress={() => navigation.navigate("FitnessSettings")}
            color={theme.success}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconTarget size={18} color={theme.warning} />}
            label="Goals"
            onPress={() => navigation.navigate("GoalsTab")}
            color={theme.warning}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + "20" }]}>
            <IconSettings size={18} color={theme.primary} />
          </View>
          <ThemedText type="h4">Distance Scale</ThemedText>
        </View>
        <Card style={styles.menuCard}>
          <ThemedText type="small" style={{ color: theme.textMuted, marginBottom: Spacing.md, paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
            Customize the distance slider range on the home screen. Default is 0-50km.
          </ThemedText>
          <View style={styles.distanceInputRow}>
            <View style={styles.distanceInputGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                MINIMUM (KM)
              </ThemedText>
              <TextInput
                value={distanceMin}
                onChangeText={setDistanceMin}
                keyboardType="decimal-pad"
                style={[styles.distanceInput, { backgroundColor: theme.backgroundTertiary, color: theme.text }]}
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={styles.distanceInputGroup}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                MAXIMUM (KM)
              </ThemedText>
              <TextInput
                value={distanceMax}
                onChangeText={setDistanceMax}
                keyboardType="decimal-pad"
                style={[styles.distanceInput, { backgroundColor: theme.backgroundTertiary, color: theme.text }]}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: Spacing.md }]} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                Enable Decimals
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textMuted }}>
                Show 1 decimal place (e.g., 3.2km). Max range limited to 30km when enabled.
              </ThemedText>
            </View>
            <Switch
              value={decimalsEnabled}
              onValueChange={handleDecimalsToggle}
              trackColor={{ false: theme.backgroundTertiary, true: theme.success }}
              thumbColor={Platform.OS === "android" ? (decimalsEnabled ? theme.success : theme.textMuted) : "#fff"}
              ios_backgroundColor={theme.backgroundTertiary}
            />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + "20" }]}>
            <IconBell size={18} color={theme.primary} />
          </View>
          <ThemedText type="h4">Notifications</ThemedText>
          <Pressable
            onPress={() => navigation.navigate("NotificationSettings")}
            style={[styles.manageButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="small" style={{ color: theme.backgroundRoot, fontWeight: "600" }}>
              MANAGE
            </ThemedText>
          </Pressable>
        </View>
        <Card style={styles.menuCard}>
          <View style={styles.toggleRow}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.primary + "20", marginRight: Spacing.md }]}>
              <IconBell size={18} color={theme.primary} />
            </View>
            <View style={styles.toggleContent}>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                Push Notifications
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textMuted }}>
                Get notified when friends add you
              </ThemedText>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ false: theme.backgroundTertiary, true: theme.success }}
              thumbColor={Platform.OS === "android" ? (pushNotificationsEnabled ? theme.success : theme.textMuted) : "#fff"}
              ios_backgroundColor={theme.backgroundTertiary}
            />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Settings
        </ThemedText>
        <Card style={styles.menuCard}>
          <MenuItem
            icon={<IconCreditCard size={18} color={theme.warning} />}
            label="Subscription"
            value={badge.label}
            onPress={() => navigation.navigate("Subscription")}
            color={theme.warning}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon={<IconGlobe size={18} color={theme.textMuted} />}
            label="Open Web App"
            onPress={openWebApp}
            color={theme.textMuted}
          />
        </Card>
      </View>

      <Button
        variant="primary"
        onPress={saveDistancePreferences}
        loading={savingPreferences}
        style={styles.saveButton}
      >
        Save Changes
      </Button>

      <Button
        variant="outline"
        onPress={handleLogout}
        loading={loggingOut}
        style={styles.logoutButton}
        testID="button-logout"
      >
        Sign Out
      </Button>

      <ThemedText type="small" style={[styles.version, { color: theme.textMuted }]}>
        AI Run Coach v1.0.0
      </ThemedText>

      <Modal
        visible={showPhotoConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={cancelPhotoUpload}
      >
        <View style={styles.photoConfirmOverlay}>
          <View style={[styles.photoConfirmModal, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.lg }}>
              Use this photo?
            </ThemedText>
            {pendingPhotoUri ? (
              <Image 
                source={{ uri: pendingPhotoUri }} 
                style={styles.photoPreview} 
              />
            ) : null}
            <View style={styles.photoConfirmButtons}>
              <Pressable
                onPress={cancelPhotoUpload}
                style={[styles.photoConfirmButton, { backgroundColor: theme.backgroundTertiary }]}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmPhotoUpload}
                style={[styles.photoConfirmButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFriendsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFriendsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="h3">Friends</ThemedText>
            <Pressable onPress={() => setShowFriendsModal(false)} hitSlop={8}>
              <IconX size={24} color={theme.text} />
            </Pressable>
          </View>

          {friendRequests.length > 0 ? (
            <View style={styles.modalSection}>
              <ThemedText type="h4" style={styles.modalSectionTitle}>
                Friend Requests ({friendRequests.length})
              </ThemedText>
              <FlatList
                data={friendRequests}
                keyExtractor={(item) => item.id}
                renderItem={renderFriendRequest}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                scrollEnabled={false}
              />
            </View>
          ) : null}

          <View style={styles.modalSection}>
            <ThemedText type="h4" style={styles.modalSectionTitle}>
              My Friends ({friends.length})
            </ThemedText>
            {friends.length === 0 ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                You haven't added any friends yet. Add friends to share your progress!
              </ThemedText>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                renderItem={renderFriendItem}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="h3">Add Friends</ThemedText>
            <Pressable onPress={() => setShowSearchModal(false)} hitSlop={8}>
              <IconX size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <View style={[styles.searchInputContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <IconSearch size={20} color={theme.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search by name or user code..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              contentContainerStyle={{ padding: Spacing.lg }}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          ) : searchQuery.length >= 2 ? (
            <View style={styles.emptySearch}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {searching ? "Searching..." : "No users found"}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.emptySearch}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Enter a name or user code to search
              </ThemedText>
            </View>
          )}
        </View>
      </Modal>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  avatar: {
    width: 100,
    height: 100,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  userCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  subscriptionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  badgeCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginRight: Spacing.sm,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalSection: {
    padding: Spacing.lg,
  },
  modalSectionTitle: {
    marginBottom: Spacing.md,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  friendAvatarImage: {
    width: 44,
    height: 44,
  },
  friendInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  requestActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    padding: Spacing.lg,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  emptySearch: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  photoConfirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  photoConfirmModal: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  photoPreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: Spacing.xl,
  },
  photoConfirmButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  photoConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  manageButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    marginLeft: "auto",
  },
  distanceInputRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  distanceInputGroup: {
    flex: 1,
  },
  distanceInput: {
    height: 48,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  toggleContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
});
