import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { ThemedText } from './ThemedText';
import { IconX, IconStar } from './icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface RouteRatingModalProps {
  visible: boolean;
  onClose: () => void;
  routeId: string;
  routeName?: string;
  userId?: string;
  onRatingSubmitted?: () => void;
}

export function RouteRatingModal({
  visible,
  onClose,
  routeId,
  routeName,
  userId,
  onRatingSubmitted,
}: RouteRatingModalProps) {
  const { theme } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStarPress = async (starIndex: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(starIndex);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    setError('');

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/routes/${routeId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (response.ok) {
        onRatingSubmitted?.();
        onClose();
        setRating(0);
        setComment('');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to submit rating');
      }
    } catch (err) {
      setError('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => handleStarPress(star)}
            style={styles.starButton}
          >
            <IconStar
              size={36}
              color={star <= rating ? theme.warning : theme.textMuted}
            />
          </Pressable>
        ))}
      </View>
    );
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
            <ThemedText type="h2">Rate This Route</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <IconX size={24} color={theme.text} />
            </Pressable>
          </View>

          {routeName ? (
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.lg }}
            >
              {routeName}
            </ThemedText>
          ) : null}

          <View style={styles.content}>
            <ThemedText type="body" style={{ textAlign: 'center', marginBottom: Spacing.md }}>
              How was your run on this route?
            </ThemedText>

            {renderStars()}

            <View style={styles.ratingLabels}>
              <ThemedText type="small" style={{ color: theme.textMuted }}>
                Not great
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textMuted }}>
                Excellent
              </ThemedText>
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment (optional)"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              style={[
                styles.commentInput,
                {
                  backgroundColor: theme.backgroundRoot,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            {error ? (
              <ThemedText
                type="small"
                style={{ color: theme.error, textAlign: 'center', marginTop: Spacing.sm }}
              >
                {error}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.secondaryButton, { borderColor: theme.border }]}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Skip
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.button, styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              {submitting ? (
                <ActivityIndicator color={theme.backgroundRoot} />
              ) : (
                <ThemedText type="body" style={{ color: theme.backgroundRoot, fontWeight: '600' }}>
                  Submit
                </ThemedText>
              )}
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
  content: {
    padding: Spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  starButton: {
    padding: Spacing.xs,
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  commentInput: {
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    textAlignVertical: 'top',
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
