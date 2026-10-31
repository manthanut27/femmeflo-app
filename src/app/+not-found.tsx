import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors, Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  function handleGoHome() {
    if (!user) {
      router.replace('/(auth)/login' as any);
      return;
    }
    if (user.role === 'SUPER_ADMIN') {
      router.replace('/(admin)' as any);
    } else if (user.role === 'MANAGER') {
      router.replace('/(manager)' as any);
    } else if (user.role === 'SELLER') {
      router.replace('/(seller)' as any);
    } else {
      router.replace('/(auth)/login' as any);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top + Spacing.xl, Spacing.xxl),
            paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl),
          },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="compass-outline" size={44} color={BrandColors.pink.primary} />
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>ERROR 404</Text>
          </View>

          <Text style={styles.title}>Lost in the Beat?</Text>
          <Text style={styles.description}>
            The screen or portal route you requested could not be found. It may have moved or the address may be incorrect.
          </Text>

          <View style={styles.actionsContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to Home Dashboard"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoHome}
            >
              <Ionicons name="home-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
            </Pressable>

            <Link href="/(auth)/login" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to Login Screen"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="log-in-outline" size={18} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>Return to Login</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Text style={styles.footerNote}>
          FemmeFlo Mobile Field Force System • v1.0.2
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    ...Shadows.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: BrandColors.pink.tint,
  },
  badge: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.pink.primary,
    letterSpacing: 0.8,
  },
  title: {
    ...Typography.display,
    fontSize: 22,
    color: Colors.light.heading,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.pink.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    minHeight: 48,
    ...Shadows.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    paddingVertical: 13,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  secondaryButtonText: {
    color: Colors.light.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  footerNote: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    marginTop: Spacing.xl,
    fontSize: 11,
  },
});

