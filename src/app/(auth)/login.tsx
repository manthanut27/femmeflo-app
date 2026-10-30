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
  defaultEmail: string;
  defaultPhone: string;
  defaultPass: string;
  placeholder: string;
}

export default function LoginScreen() {
  const [selectedRole, setSelectedRole] = useState<LoginRole>('seller');
  const [identifier, setIdentifier] = useState('seller@femmeflo.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const ROLES: Record<LoginRole, RoleConfig> = {
    seller: {
      key: 'seller',
      label: 'Seller',
      portalTitle: 'Field Seller Portal',
      portalSubtitle: 'Retail beat visits, catalogs, and on-field POS orders',
      badgeLabel: 'Field Force',
      iconName: 'bag-handle-outline',
      primaryColor: BrandColors.pink.primary,
      subtleBg: BrandColors.pink.subtle,
      borderColor: BrandColors.pink.tint,
      defaultEmail: 'seller@femmeflo.com',
      defaultPhone: '9876543210',
      defaultPass: 'demo123',
      placeholder: 'seller@femmeflo.com or 9876543210',
    },
    manager: {
      key: 'manager',
      label: 'Manager',
      portalTitle: 'Territory Manager Portal',
      portalSubtitle: 'Team beat oversight, stock balance, and field approvals',
      badgeLabel: 'Territory HQ',
      iconName: 'people-outline',
      primaryColor: BrandColors.green.primary,
      subtleBg: BrandColors.green.surface,
      borderColor: BrandColors.green.tint,
      defaultEmail: 'manager@femmeflo.com',
      defaultPhone: '9876543220',
      defaultPass: 'demo123',
      placeholder: 'manager@femmeflo.com or 9876543220',
    },
    admin: {
      key: 'admin',
      label: 'Super Admin',
      portalTitle: 'Super Admin Portal',
      portalSubtitle: 'Headquarters administration, low-price approvals & controls',
      badgeLabel: 'HQ Executive',
      iconName: 'shield-checkmark-outline',
      primaryColor: BrandColors.pink.dark,
      subtleBg: '#FFE4E6',
      borderColor: '#FDA4AF',
      defaultEmail: 'admin@femmeflo.in',
      defaultPhone: '9876543230',
      defaultPass: 'demo123',
      placeholder: 'admin@femmeflo.in or 9876543230',
    },
  };

  const activeRole = ROLES[selectedRole];

  function handleSelectRole(role: LoginRole) {
    setSelectedRole(role);
    setIdentifier(ROLES[role].defaultEmail);
    setPassword(ROLES[role].defaultPass);
    setError(null);
  }

  function handleQuickFill(role: LoginRole) {
    const config = ROLES[role];
    setSelectedRole(role);
    setIdentifier(config.defaultEmail);
    setPassword(config.defaultPass);
    setError(null);
  }

  async function performLogin(targetId: string, targetPass: string, roleKey: LoginRole) {
    if (isSubmitting) return;
    Keyboard.dismiss();
    setError(null);
    setIsSubmitting(true);

    try {
      const { user } = await login(targetId, targetPass, roleKey);
      const role = user.role;

      // Role-based routing
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
      setError(err.message || 'Failed to sign in. Please verify your demo credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin() {
    const trimmedId = identifier.trim() || activeRole.defaultEmail;
    const trimmedPass = password || activeRole.defaultPass;
    await performLogin(trimmedId, trimmedPass, selectedRole);
  }

  async function handleInstantDemoLogin(roleKey: LoginRole) {
    const conf = ROLES[roleKey];
    setSelectedRole(roleKey);
    setIdentifier(conf.defaultEmail);
    setPassword(conf.defaultPass);
    await performLogin(conf.defaultEmail, conf.defaultPass, roleKey);
  }

  const isFormValid = (identifier.trim().length > 0 || activeRole.defaultEmail.length > 0);

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
            paddingBottom: insets.bottom + Spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.containerBox}>
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={30} color={BrandColors.pink.primary} />
            </View>
            <Text style={styles.title}>FemmeFlo</Text>
            <Text style={styles.subtitle}>FMCG & Hygiene Distribution Field Operations</Text>

            {/* Offline Frontend Demo Indicator */}
            <View style={styles.demoModeBanner}>
              <View style={styles.demoIndicatorDot} />
              <Text style={styles.demoModeText}>Offline Frontend Demo Mode • No Backend Needed</Text>
            </View>
          </View>

          {/* Three Login Types Segmented Selector */}
          <View style={styles.roleSelectorCard}>
            <Text style={styles.roleSelectorHeading}>SELECT DEMO LOGIN ROLE</Text>
            <View style={styles.roleTabsRow}>
              {(['seller', 'manager', 'admin'] as LoginRole[]).map((roleKey) => {
                const conf = ROLES[roleKey];
                const isSelected = selectedRole === roleKey;
                return (
                  <Pressable
                    key={roleKey}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${conf.label} Login Type`}
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
                        styles.roleTabLabel,
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
            {/* Active Portal Banner */}
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
              label="Email or Mobile"
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
              placeholder="Enter your demo password"
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              hitSlop={HitSlop.md}
              style={styles.forgotPasswordLink}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
            >
              <Text style={styles.forgotPasswordText}>Demo Password: {activeRole.defaultPass}</Text>
            </Pressable>

            {/* Submit Button */}
            <Button
              title={isSubmitting ? 'Entering Portal...' : `Sign In as ${activeRole.label}`}
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={!isFormValid || isSubmitting}
              size="lg"
              variant={selectedRole === 'manager' ? 'secondary' : selectedRole === 'admin' ? 'admin' : 'primary'}
              style={styles.submitButton}
            />

            {/* 1-Tap Fast Login Shortcut */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Fast 1-tap demo sign in as ${activeRole.label}`}
              onPress={() => handleInstantDemoLogin(selectedRole)}
              disabled={isSubmitting}
              style={styles.fastLoginButton}
            >
              <Ionicons name="flash-outline" size={15} color={activeRole.primaryColor} style={{ marginRight: 6 }} />
              <Text style={[styles.fastLoginButtonText, { color: activeRole.primaryColor }]}>
                1-Tap Demo Sign In as {activeRole.label}
              </Text>
            </Pressable>
          </View>

          {/* Demo Login IDs System */}
          <View style={styles.quickFillCard}>
            <View style={styles.quickFillHeader}>
              <Ionicons name="key-outline" size={15} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.quickFillHeading}>Demo Login Accounts (Tap to Sign In)</Text>
            </View>
            <Text style={styles.quickFillHint}>
              Select any role below to instantly log in without backend connection:
            </Text>

            <View style={styles.quickFillChipsContainer}>
              {(['seller', 'manager', 'admin'] as LoginRole[]).map((roleKey) => {
                const conf = ROLES[roleKey];
                const isActive = selectedRole === roleKey;
                return (
                  <View
                    key={roleKey}
                    style={[
                      styles.quickFillCardItem,
                      isActive && {
                        backgroundColor: conf.subtleBg,
                        borderColor: conf.primaryColor,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.quickFillCardLeft}
                      onPress={() => handleQuickFill(roleKey)}
                    >
                      <View
                        style={[
                          styles.quickFillIconCircle,
                          { backgroundColor: conf.subtleBg, borderColor: conf.borderColor },
                        ]}
                      >
                        <Ionicons name={conf.iconName} size={16} color={conf.primaryColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.quickFillRoleRow}>
                          <Text style={[styles.quickFillRoleTitle, { color: conf.primaryColor }]}>
                            {conf.label}
                          </Text>
                          <Text style={styles.quickFillBadgeText}>• {conf.badgeLabel}</Text>
                        </View>
                        <Text style={styles.quickFillEmailText} numberOfLines={1}>
                          ID: {conf.defaultEmail}
                        </Text>
                        <Text style={styles.quickFillSubText}>
                          Pass: {conf.defaultPass} | Mobile: {conf.defaultPhone}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sign In as ${conf.label}`}
                      onPress={() => handleInstantDemoLogin(roleKey)}
                      disabled={isSubmitting}
                      style={[
                        styles.quickSignInBtn,
                        { backgroundColor: conf.primaryColor },
                      ]}
                    >
                      <Ionicons name="log-in-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.quickSignInBtnText}>Sign In</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Hub Support Card */}
          <View style={styles.supportCard}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
            <Text style={styles.supportText}>
              Frontend Demo System: Mock database is stateful in-memory and supports orders, visits, approvals, and stock transfers.
            </Text>
          </View>

          {/* Footer info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              FemmeFlo FMCG Operations System • Frontend Demo
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
    alignItems: 'center',
  },
  containerBox: {
    width: '100%',
    maxWidth: 440,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
    ...Shadows.sm,
  },
  title: {
    ...Typography.display,
    fontSize: 26,
    color: Colors.light.heading,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.caption,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  demoModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  demoIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  demoModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  roleSelectorCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  roleSelectorHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  roleTabsRow: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  roleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    ...Shadows.md,
  },
  portalBanner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  portalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  portalBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  portalBannerSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  portalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  portalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    color: Colors.light.textMuted,
    fontWeight: '500',
  },
  submitButton: {
    width: '100%',
    minHeight: 50,
  },
  fastLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.light.backgroundElement,
  },
  fastLoginButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickFillCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  quickFillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  quickFillHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  quickFillHint: {
    fontSize: 11,
    color: Colors.light.textMuted,
    marginBottom: Spacing.sm,
  },
  quickFillChipsContainer: {
    gap: Spacing.sm,
  },
  quickFillCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  quickFillCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickFillIconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  quickFillRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickFillRoleTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickFillBadgeText: {
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  quickFillEmailText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.heading,
    marginTop: 1,
  },
  quickFillSubText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  quickSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    marginLeft: Spacing.xs,
  },
  quickSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
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
    marginTop: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
});

