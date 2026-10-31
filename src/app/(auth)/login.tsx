import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export type LoginRole = 'seller' | 'manager' | 'admin';

interface RoleConfig {
  key: LoginRole;
  label: string;
  portalTitle: string;
  portalSubtitle: string;
  badgeLabel: string;
  iconName: keyof typeof Ionicons.glyphMap;
  primaryColor: string;
  subtleBg: string;
  borderColor: string;
  placeholder: string;
}

const ROLES: Record<LoginRole, RoleConfig> = {
  seller: {
    key: 'seller',
    label: 'Field Seller',
    portalTitle: 'Field Seller Portal',
    portalSubtitle: 'Retail store visits, catalogs, and POS sales orders',
    badgeLabel: 'Field Force',
    iconName: 'bag-handle-outline',
    primaryColor: BrandColors.pink.primary,
    subtleBg: BrandColors.pink.subtle,
    borderColor: BrandColors.pink.tint,
    placeholder: 'seller@femmeflo.com or mobile number',
  },
  manager: {
    key: 'manager',
    label: 'Territory Manager',
    portalTitle: 'Territory Manager Portal',
    portalSubtitle: 'Regional team oversight, van stock, and field approvals',
    badgeLabel: 'Territory HQ',
    iconName: 'people-outline',
    primaryColor: BrandColors.green.primary,
    subtleBg: BrandColors.green.surface,
    borderColor: BrandColors.green.tint,
    placeholder: 'manager@femmeflo.com or mobile number',
  },
  admin: {
    key: 'admin',
    label: 'Super Admin',
    portalTitle: 'Super Admin Portal',
    portalSubtitle: 'National distribution governance, approvals, and executive controls',
    badgeLabel: 'HQ Executive',
    iconName: 'shield-checkmark-outline',
    primaryColor: BrandColors.pink.dark,
    subtleBg: '#FFE4E6',
    borderColor: '#FDA4AF',
    placeholder: 'admin@femmeflo.in or mobile number',
  },
};

export default function LoginScreen() {
  const [selectedRole, setSelectedRole] = useState<LoginRole>('seller');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const activeRole = ROLES[selectedRole];

  function handleSelectRole(role: LoginRole) {
    setSelectedRole(role);
    setError(null);
  }

  async function handleLogin() {
    if (isSubmitting) return;
    const trimmedId = identifier.trim();
    if (!trimmedId || !password) {
      setError('Please enter your email/phone and password.');
      return;
    }

    Keyboard.dismiss();
    setError(null);
    setIsSubmitting(true);

    try {
      const { user } = await login(trimmedId, password, selectedRole);
      const role = user.role;

      // Role-based routing based on verified backend user object
      if (role === 'SUPER_ADMIN') {
        router.replace('/(admin)' as any);
      } else if (role === 'MANAGER') {
        router.replace('/(manager)' as any);
      } else if (role === 'SELLER') {
        router.replace('/(seller)' as any);
      } else {
        setError('Account role is not recognized. Please contact system support.');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('unreachable') || msg.includes('timeout')) {
        setError('Unable to reach authentication server. Please check your internet connection.');
      } else {
        setError(msg || 'Invalid login credentials. Please verify your email/phone and password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormValid = identifier.trim().length > 0 && password.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + Spacing.md, Spacing.xl),
            paddingBottom: insets.bottom + Spacing.huge,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.containerBox}>
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={34} color={BrandColors.pink.primary} />
            </View>
            <Text style={styles.title}>FemmeFlo</Text>
            <Text style={styles.subtitle}>Enterprise Field Operations & Sales</Text>
          </View>

          {/* Three Role Tabs Selector */}
          <View style={styles.roleSelectorCard}>
            <Text style={styles.roleSelectorHeading}>SELECT LOGIN PORTAL</Text>
            <View style={styles.roleTabsRow}>
              {(['seller', 'manager', 'admin'] as LoginRole[]).map((roleKey) => {
                const conf = ROLES[roleKey];
                const isSelected = selectedRole === roleKey;
                return (
                  <Pressable
                    key={roleKey}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${conf.label} Login Portal`}
                    onPress={() => handleSelectRole(roleKey)}
                    style={[
                      styles.roleTab,
                      isSelected && {
                        backgroundColor: conf.subtleBg,
                        borderColor: conf.primaryColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={conf.iconName}
                      size={18}
                      color={isSelected ? conf.primaryColor : Colors.light.textMuted}
                      style={{ marginBottom: 4 }}
                    />
                    <Text
                      style={[
                        styles.roleTabText,
                        isSelected && {
                          color: conf.primaryColor,
                          fontWeight: '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {conf.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {/* Active Portal Header Banner */}
            <View
              style={[
                styles.portalBanner,
                {
                  backgroundColor: activeRole.subtleBg,
                  borderColor: activeRole.borderColor,
                },
              ]}
            >
              <View style={styles.portalBannerLeft}>
                <View
                  style={[
                    styles.portalIconCircle,
                    { backgroundColor: activeRole.primaryColor },
                  ]}
                >
                  <Ionicons name={activeRole.iconName} size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.portalBannerTitle, { color: activeRole.primaryColor }]}>
                    {activeRole.portalTitle}
                  </Text>
                  <Text style={styles.portalBannerSubtitle}>{activeRole.portalSubtitle}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.portalBadge,
                  { backgroundColor: activeRole.borderColor },
                ]}
              >
                <Text style={[styles.portalBadgeText, { color: activeRole.primaryColor }]}>
                  {activeRole.badgeLabel}
                </Text>
              </View>
            </View>

            {/* Error Banner */}
            {error ? (
              <FeedbackBanner
                type="error"
                message={error}
                onDismiss={() => setError(null)}
                style={{ marginBottom: Spacing.md }}
              />
            ) : null}

            {/* Input 1: Email or Mobile */}
            <Input
              label="Email Address or Mobile Number"
              placeholder={activeRole.placeholder}
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (error) setError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              autoComplete="username"
              textContentType="username"
              importantForAutofill="yes"
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textMuted} />}
            />

            {/* Input 2: Password */}
            <Input
              inputRef={passwordInputRef}
              label="Password"
              placeholder="Enter password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              autoComplete="current-password"
              textContentType="password"
              importantForAutofill="yes"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.light.textMuted} />}
            />

            {/* Forgot Password Row */}
            <View style={styles.forgotRow}>
              <Pressable
                hitSlop={HitSlop.md}
                onPress={() => router.push('/(auth)/forgot-password' as any)}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            {/* Submit Button */}
            <Button
              title={isSubmitting ? 'Authenticating...' : `Sign In as ${activeRole.label}`}
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={!isFormValid || isSubmitting}
              size="lg"
              variant={selectedRole === 'manager' ? 'secondary' : selectedRole === 'admin' ? 'admin' : 'primary'}
              style={styles.submitButton}
            />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <View style={styles.footerBadgeRow}>
              <Ionicons name="lock-closed-outline" size={12} color={Colors.light.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.footerText}>
                FemmeFlo Technologies • Secure 256-Bit Encrypted Session
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerBox: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
    ...Shadows.sm,
  },
  title: {
    fontSize: Typography.headlineSm.fontSize,
    fontWeight: '800',
    color: Colors.light.heading,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.bodySm.fontSize,
    color: Colors.light.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  roleSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  roleSelectorHeading: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    color: Colors.light.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  roleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: '#F8FAFC',
  },
  roleTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.md,
  },
  portalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  portalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  portalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  portalBannerTitle: {
    fontSize: Typography.labelMd.fontSize,
    fontWeight: '700',
  },
  portalBannerSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  portalBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginLeft: Spacing.xs,
  },
  portalBadgeText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  forgotButton: {
    paddingVertical: Spacing.xs,
  },
  forgotText: {
    fontSize: Typography.bodySm.fontSize,
    color: BrandColors.pink.primary,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: Spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textMuted,
  },
});
