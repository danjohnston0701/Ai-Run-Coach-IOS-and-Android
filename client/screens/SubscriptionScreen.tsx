import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  IconCrown,
  IconCheck,
  IconZap,
  IconBrain,
  IconUsers,
  IconTrending,
  IconGift,
  IconCreditCard,
} from '@/components/icons/AppIcons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

interface SubscriptionStatus {
  isPremium: boolean;
  plan?: string;
  expiresAt?: string;
  features?: string[];
}

const PREMIUM_FEATURES = [
  { icon: IconBrain, title: 'AI Coach', description: 'Personalized real-time coaching' },
  { icon: IconZap, title: 'Unlimited Routes', description: 'Generate unlimited AI routes' },
  { icon: IconUsers, title: 'Group Runs', description: 'Create and join group runs' },
  { icon: IconTrending, title: 'Advanced Analytics', description: 'Detailed performance insights' },
];

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$9.99',
    period: '/month',
    priceId: 'price_monthly',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '$79.99',
    period: '/year',
    badge: 'Save 33%',
    priceId: 'price_yearly',
  },
];

export default function SubscriptionScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/subscriptions/status`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubscribing(true);

    try {
      const baseUrl = getApiUrl();
      const plan = PLANS.find((p) => p.id === selectedPlan);

      const response = await fetch(`${baseUrl}/api/subscriptions/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          priceId: plan?.priceId,
          successUrl: `${baseUrl}/subscription/success`,
          cancelUrl: `${baseUrl}/subscription/cancel`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          if (Platform.OS === 'web') {
            window.open(data.checkoutUrl, '_blank');
          } else {
            await Linking.openURL(data.checkoutUrl);
          }
        }
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to start checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', 'Failed to start checkout. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRedeemingCoupon(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/coupons/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          code: couponCode.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCouponSuccess(data.message || 'Coupon redeemed successfully!');
        setCouponCode('');
        await fetchSubscriptionStatus();
      } else {
        setCouponError(data.message || 'Invalid coupon code');
      }
    } catch (error) {
      setCouponError('Failed to redeem coupon. Please try again.');
    } finally {
      setRedeemingCoupon(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (status?.isPremium) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.premiumBadge, { backgroundColor: theme.warning + '20' }]}>
            <IconCrown size={32} color={theme.warning} />
            <ThemedText type="h2" style={{ marginTop: Spacing.md }}>
              Premium Active
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              {status.plan || 'You have full access to all features'}
            </ThemedText>
            {status.expiresAt ? (
              <ThemedText type="small" style={{ color: theme.textMuted, marginTop: Spacing.sm }}>
                Renews on {new Date(status.expiresAt).toLocaleDateString()}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.featuresSection}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.lg }}>
              Your Premium Features
            </ThemedText>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View
                key={index}
                style={[styles.featureItem, { backgroundColor: theme.backgroundSecondary }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
                  <feature.icon size={24} color={theme.primary} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText type="body" style={{ fontWeight: '600' }}>
                    {feature.title}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {feature.description}
                  </ThemedText>
                </View>
                <IconCheck size={20} color={theme.success} />
              </View>
            ))}
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <IconCrown size={48} color={theme.warning} />
          <ThemedText type="h1" style={{ marginTop: Spacing.md }}>
            Upgrade to Premium
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }}>
            Unlock the full potential of your AI running coach
          </ThemedText>
        </View>

        <View style={styles.featuresSection}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View
              key={index}
              style={[styles.featureItem, { backgroundColor: theme.backgroundSecondary }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: theme.primary + '20' }]}>
                <feature.icon size={24} color={theme.primary} />
              </View>
              <View style={styles.featureText}>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  {feature.title}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {feature.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.plansSection}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
            Choose Your Plan
          </ThemedText>
          {PLANS.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPlan(plan.id);
              }}
              style={[
                styles.planCard,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: selectedPlan === plan.id ? theme.primary : theme.border,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                },
              ]}
            >
              <View style={styles.planInfo}>
                <ThemedText type="h4">{plan.name}</ThemedText>
                <View style={styles.priceRow}>
                  <ThemedText type="h2" style={{ color: theme.primary }}>
                    {plan.price}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textMuted }}>
                    {plan.period}
                  </ThemedText>
                </View>
              </View>
              {plan.badge ? (
                <View style={[styles.planBadge, { backgroundColor: theme.success + '20' }]}>
                  <ThemedText type="small" style={{ color: theme.success, fontWeight: '600' }}>
                    {plan.badge}
                  </ThemedText>
                </View>
              ) : null}
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selectedPlan === plan.id ? theme.primary : theme.border },
                ]}
              >
                {selectedPlan === plan.id ? (
                  <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSubscribe}
          disabled={subscribing}
          style={[styles.subscribeButton, { backgroundColor: theme.primary }]}
        >
          {subscribing ? (
            <ActivityIndicator color={theme.backgroundRoot} />
          ) : (
            <>
              <IconCreditCard size={20} color={theme.backgroundRoot} />
              <ThemedText type="body" style={{ color: theme.backgroundRoot, fontWeight: '600', marginLeft: Spacing.sm }}>
                Subscribe Now
              </ThemedText>
            </>
          )}
        </Pressable>

        <View style={[styles.couponSection, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.couponHeader}>
            <IconGift size={20} color={theme.accent} />
            <ThemedText type="body" style={{ fontWeight: '600', marginLeft: Spacing.sm }}>
              Have a coupon code?
            </ThemedText>
          </View>
          <View style={styles.couponInputRow}>
            <TextInput
              value={couponCode}
              onChangeText={(text) => {
                setCouponCode(text);
                setCouponError('');
                setCouponSuccess('');
              }}
              placeholder="Enter code"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.couponInput,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleRedeemCoupon}
              disabled={redeemingCoupon}
              style={[styles.redeemButton, { backgroundColor: theme.accent }]}
            >
              {redeemingCoupon ? (
                <ActivityIndicator size="small" color={theme.backgroundRoot} />
              ) : (
                <ThemedText type="small" style={{ color: theme.backgroundRoot, fontWeight: '600' }}>
                  Redeem
                </ThemedText>
              )}
            </Pressable>
          </View>
          {couponError ? (
            <ThemedText type="small" style={{ color: theme.error, marginTop: Spacing.xs }}>
              {couponError}
            </ThemedText>
          ) : null}
          {couponSuccess ? (
            <ThemedText type="small" style={{ color: theme.success, marginTop: Spacing.xs }}>
              {couponSuccess}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
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
  content: {
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  premiumBadge: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing['3xl'],
  },
  featuresSection: {
    marginBottom: Spacing['3xl'],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  plansSection: {
    marginBottom: Spacing.xl,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  planInfo: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  planBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  couponSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  couponInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  redeemButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
