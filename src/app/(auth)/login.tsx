import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isMockMode } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const showDevQuickFill = __DEV__ && isMockMode();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function fillDemoAccount(role: 'seller' | 'manager' | 'admin') {
    if (!__DEV__) return;
    if (role === 'seller') {
      setIdentifier('seller@femmeflo.com');
      setPassword('demo123');
    } else if (role === 'manager') {
      setIdentifier('manager@femmeflo.com');
      setPassword('demo123');
    } else if (role === 'admin') {
      setIdentifier('admin@femmeflo.com');
      setPassword('demo123');
    }
  }

  async function handleLogin() {
    if (isSubmitting) return;
    setError(null);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError('Please enter your registered email address or mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await login(trimmedId, password);
      const role = user.role;

      // Single login routing by returned role
      if (role === 'SELLER') {
        router.replace('/(seller)' as any);
      } else if (role === 'MANAGER') {
        router.replace('/(manager)' as any);
      } else if (role === 'SUPER_ADMIN') {
        router.replace('/(admin)' as any);
      } else {
        router.replace('/(seller)' as any);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.containerBox}>
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={32} color={BrandColors.pink.primary} />
            </View>
            <Text style={styles.title}>FemmeFlo</Text>
            <Text style={styles.subtitle}>FMCG & Hygiene Distribution Field Operations</Text>
            <View style={styles.accessBadge}>
              <Ionicons name="shield-checkmark" size={12} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
              <Text style={styles.accessBadgeText}>Unified Field-Force Access</Text>
            </View>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={Colors.light.danger} style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email or Mobile"
              placeholder="e.g. seller@femmeflo.com"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="Enter your account password"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.light.textMuted} />}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              hitSlop={HitSlop.md}
              style={styles.forgotPasswordLink}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            <Button
              title={isSubmitting ? 'Verifying Credentials...' : 'Sign In'}
              onPress={handleLogin}
              loading={isSubmitting}
              size="lg"
              variant="primary"
              style={styles.submitButton}
            />
          </View>

          {/* Mock Mode Quick-Fill Assistant (DEV only, excluded from production builds) */}
          {showDevQuickFill ? (
            <View style={styles.demoBox}>
              <View style={styles.demoHeader}>
                <Ionicons name="flash-outline" size={14} color={BrandColors.green.primary} style={{ marginRight: 4 }} />
                <Text style={styles.demoTitle}>Demo Quick-Fill</Text>
              </View>
              <View style={styles.demoChipsRow}>
                <Pressable
                  style={styles.demoChip}
                  onPress={() => fillDemoAccount('seller')}
                  accessibilityRole="button"
                >
                  <Text style={styles.demoChipText}>Field Seller</Text>
                </Pressable>
                <Pressable
                  style={styles.demoChip}
                  onPress={() => fillDemoAccount('manager')}
                  accessibilityRole="button"
                >
                  <Text style={styles.demoChipText}>Territory Manager</Text>
                </Pressable>
                <Pressable
                  style={styles.demoChip}
                  onPress={() => fillDemoAccount('admin')}
                  accessibilityRole="button"
                >
                  <Text style={styles.demoChipText}>Super Admin</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Hub Support Card */}
          <View style={styles.supportCard}>
            <Ionicons name="headset-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.supportText}>
              Need access credentials or beat assignment? Contact Territory Hub Admin
            </Text>
          </View>

          {/* Footer info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              FemmeFlo FMCG Operations System • Single Sign-On
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerBox: {
    width: '100%',
    maxWidth: 440,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
    ...Shadows.sm,
  },
  title: {
    ...Typography.display,
    fontSize: 26,
    color: Colors.light.heading,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.caption,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  accessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.primary,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    ...Shadows.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.dangerBg,
    borderWidth: 1,
    borderColor: Colors.light.dangerBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    ...Typography.bodySmall,
    color: Colors.light.danger,
    flex: 1,
    fontWeight: '500',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xs,
  },
  forgotPasswordText: {
    ...Typography.caption,
    color: BrandColors.pink.primary,
    fontWeight: '600',
  },
  submitButton: {
    width: '100%',
    minHeight: 54,
  },
  demoBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  demoChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  demoChip: {
    flex: 1,
    backgroundColor: Colors.light.backgroundElement,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    width: '100%',
  },
  supportText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
});
