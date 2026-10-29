import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandColors, Colors, Radius, Spacing, Typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function StartupScreen() {
  const { user, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user || !role) {
      router.replace('/(auth)/login' as any);
      return;
    }

    if (role === 'SELLER') {
      router.replace('/(seller)' as any);
    } else if (role === 'MANAGER') {
      router.replace('/(manager)' as any);
    } else if (role === 'SUPER_ADMIN') {
      router.replace('/(admin)' as any);
    } else {
      router.replace('/(auth)/login' as any);
    }
  }, [user, role, isLoading, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View
          style={styles.logoBadge}
          accessibilityRole="image"
          accessibilityLabel="FemmeFlo logo"
        >
          <Ionicons name="flower-outline" size={42} color={BrandColors.pink.primary} />
        </View>
        <Text style={styles.brandTitle}>FemmeFlo</Text>
        <Text style={styles.brandSubtitle}>Operations & Field Distribution</Text>
        <ActivityIndicator
          size="large"
          color={BrandColors.pink.primary}
          style={styles.spinner}
        />
        <Text style={styles.loadingStatus}>Verifying secure session...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
  },
  brandTitle: {
    ...Typography.display,
    color: Colors.light.heading,
    marginBottom: Spacing.xxs,
  },
  brandSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xxxl,
  },
  spinner: {
    marginBottom: Spacing.lg,
  },
  loadingStatus: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontWeight: '600',
  },
});
