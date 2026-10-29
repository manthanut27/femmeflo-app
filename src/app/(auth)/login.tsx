import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import type { AuthRole } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, HitSlop, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type RoleOption = 'seller' | 'manager' | 'admin';

const ROLE_TABS = [
  { label: 'Seller', value: 'seller' as RoleOption, icon: 'person-outline' as const },
  { label: 'Manager', value: 'manager' as RoleOption, icon: 'briefcase-outline' as const },
  { label: 'Super Admin', value: 'admin' as RoleOption, icon: 'shield-checkmark-outline' as const },
];

export default function LoginScreen() {
  const [roleHint, setRoleHint] = useState<RoleOption>('seller');
  const [identifier, setIdentifier] = useState('seller@femmeflo.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  function selectRole(role: RoleOption | null) {
    if (!role) return;
    setRoleHint(role);
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
    setInfoNotice(null);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError('Please enter your email address or mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await login(trimmedId, password, roleHint);
      const serverRole = user.role;

      // Handle role matching
      const targetRole: AuthRole =
        roleHint === 'admin' ? 'SUPER_ADMIN' : roleHint === 'manager' ? 'MANAGER' : 'SELLER';

      if (serverRole !== targetRole) {
        setInfoNotice(
          `Signed in as authorized ${serverRole.replace('_', ' ')}. Redirecting to your workspace...`
        );
        timerRef.current = setTimeout(() => {
          if (serverRole === 'SELLER') {
            router.replace('/(seller)' as any);
          } else if (serverRole === 'MANAGER') {
            router.replace('/(manager)' as any);
          } else if (serverRole === 'SUPER_ADMIN') {
            router.replace('/(admin)' as any);
          }
        }, 350);
      } else {
        if (serverRole === 'SELLER') {
          router.replace('/(seller)' as any);
        } else if (serverRole === 'MANAGER') {
          router.replace('/(manager)' as any);
        } else if (serverRole === 'SUPER_ADMIN') {
          router.replace('/(admin)' as any);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const roleActiveColor =
    roleHint === 'manager'
      ? BrandColors.green.primary
      : roleHint === 'admin'
      ? BrandColors.pink.dark
      : BrandColors.pink.primary;

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={32} color={BrandColors.pink.primary} />
            </View>
            <Text style={styles.title}>FemmeFlo</Text>
            <Text style={styles.subtitle}>Sign in to your operational account</Text>
          </View>

          {/* Offline / UI Test Mode Pill */}
          <View style={styles.demoBadge}>
            <View style={styles.demoBadgeIconWrapper}>
              <Ionicons name="flash" size={16} color={BrandColors.green.primary} />
            </View>
            <View style={styles.demoBadgeTextContainer}>
              <Text style={styles.demoBadgeTitle}>Offline Demonstration Mode</Text>
              <Text style={styles.demoBadgeSubtitle}>
                Tap any role to pre-populate credentials and test its interface.
              </Text>
            </View>
          </View>

          {/* Role Selector Tabs */}
          <View style={styles.roleTabsWrapper}>
            <SegmentedTabs
              tabs={ROLE_TABS}
              selectedTab={roleHint}
              onSelect={selectRole}
              activeColor={roleActiveColor}
              accessibilityLabel="Select operational role"
            />
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={Colors.light.danger} style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {infoNotice ? (
              <View style={styles.infoBanner} accessibilityRole="alert">
                <Ionicons name="information-circle" size={16} color={Colors.light.info} style={{ marginRight: 6 }} />
                <Text style={styles.infoBannerText}>{infoNotice}</Text>
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
              leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.light.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
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
              title={isSubmitting ? 'Verifying...' : `Sign In as ${roleHint === 'admin' ? 'Super Admin' : roleHint === 'manager' ? 'Manager' : 'Seller'}`}
              onPress={handleLogin}
              loading={isSubmitting}
              size="lg"
              variant={roleHint === 'manager' ? 'secondary' : 'primary'}
              style={styles.submitButton}
            />
          </View>

          {/* Footer info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              FemmeFlo FMCG Operations System • v1.0.0
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
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.successBg,
    borderWidth: 1,
    borderColor: Colors.light.successBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  demoBadgeIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.green.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  demoBadgeTextContainer: {
    flex: 1,
  },
  demoBadgeTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: BrandColors.green.primary,
    marginBottom: 2,
  },
  demoBadgeSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: BrandColors.green.primary,
    lineHeight: 15,
  },
  roleTabsWrapper: {
    marginBottom: Spacing.lg,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.infoBg,
    borderWidth: 1,
    borderColor: Colors.light.infoBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoBannerText: {
    ...Typography.bodySmall,
    color: Colors.light.info,
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
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
});
