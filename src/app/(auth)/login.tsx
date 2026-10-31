import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseUrl, setCustomApiBaseUrl, testBackendHealth } from '@/api/client';
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
    defaultEmail: 'seller@femmeflo.com',
    defaultPhone: '9876543210',
    defaultPass: 'demo123',
    placeholder: 'seller@femmeflo.com or 9876543210',
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
    defaultEmail: 'manager@femmeflo.com',
    defaultPhone: '9876543220',
    defaultPass: 'demo123',
    placeholder: 'manager@femmeflo.com or 9876543220',
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
    defaultEmail: 'admin@femmeflo.in',
    defaultPhone: '9876543230',
    defaultPass: 'demo123',
    placeholder: 'admin@femmeflo.in or 9876543230',
  },
};

export default function LoginScreen() {
  const [selectedRole, setSelectedRole] = useState<LoginRole>('seller');
  const [identifier, setIdentifier] = useState('seller@femmeflo.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Server Connection State
  const [activeServerUrl, setActiveServerUrl] = useState(() => getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(() => getApiBaseUrl());
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);

  const passwordInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const activeRole = ROLES[selectedRole];

  // Test server connectivity on mount
  useEffect(() => {
    let isMounted = true;
    async function pingServer() {
      setServerStatus('checking');
      const res = await testBackendHealth();
      if (isMounted) {
        setServerStatus(res.ok ? 'connected' : 'offline');
      }
    }
    pingServer();
    return () => {
      isMounted = false;
    };
  }, [activeServerUrl]);

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
      const msg = err.message || '';
      if (
        msg.includes('NoRouteToHostException') ||
        msg.includes('Host unreachable') ||
        msg.includes('ECONNREFUSED')
      ) {
        setError(
          `Cannot reach backend at ${activeServerUrl}. If running on a physical Android phone, configure your computer's Wi-Fi IP address in Server Settings.`
        );
      } else {
        setError(msg || 'Failed to sign in. Please check your credentials or backend server status.');
      }
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

  async function handleTestCustomUrl(urlToTest: string) {
    setIsTestingServer(true);
    setTestResult(null);
    try {
      const res = await testBackendHealth(urlToTest);
      if (res.ok) {
        setTestResult(`✓ Connected! Server responded OK.`);
      } else {
        setTestResult(`✗ Unreachable: ${res.status}`);
      }
    } catch (err: any) {
      setTestResult(`✗ Failed: ${err.message || 'Host unreachable'}`);
    } finally {
      setIsTestingServer(false);
    }
  }

  function handleApplyServerUrl(url: string) {
    setCustomApiBaseUrl(url);
    const updated = getApiBaseUrl();
    setActiveServerUrl(updated);
    setServerModalVisible(false);
    setTestResult(null);
    setError(null);
  }

  const isFormValid = identifier.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + Spacing.sm, Spacing.lg),
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
              <Ionicons name="flower-outline" size={32} color={BrandColors.pink.primary} />
            </View>
            <Text style={styles.title}>FemmeFlo</Text>
            <Text style={styles.subtitle}>FMCG & Hygiene Distribution Operations</Text>

            {/* Server Status Pill */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Configure Backend Server Address"
              onPress={() => {
                setCustomUrlInput(activeServerUrl);
                setTestResult(null);
                setServerModalVisible(true);
              }}
              style={styles.serverStatusBar}
            >
              <View
                style={[
                  styles.serverStatusDot,
                  serverStatus === 'connected'
                    ? styles.statusDotGreen
                    : serverStatus === 'checking'
                    ? styles.statusDotOrange
                    : styles.statusDotRed,
                ]}
              />
              <Text style={styles.serverStatusText} numberOfLines={1}>
                {serverStatus === 'connected'
                  ? `Live Backend: ${activeServerUrl.replace('/api/v1', '')}`
                  : serverStatus === 'checking'
                  ? 'Connecting to server...'
                  : `Server Unreachable: ${activeServerUrl.replace('/api/v1', '')}`}
              </Text>
              <Ionicons name="settings-outline" size={13} color="#475569" style={{ marginLeft: 4 }} />
            </Pressable>
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

            {/* Credential Hint */}
            <View style={styles.hintRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={BrandColors.green.primary} />
              <Text style={styles.hintText}>
                Verified Database Password: <Text style={{ fontWeight: '700' }}>demo123</Text>
              </Text>
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

            {/* 1-Tap Fast Login */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Fast 1-tap sign in as ${activeRole.label}`}
              onPress={() => handleInstantDemoLogin(selectedRole)}
              disabled={isSubmitting}
              style={styles.fastLoginButton}
            >
              <Ionicons name="flash-outline" size={15} color={activeRole.primaryColor} style={{ marginRight: 6 }} />
              <Text style={[styles.fastLoginButtonText, { color: activeRole.primaryColor }]}>
                1-Tap Sign In as {activeRole.label}
              </Text>
            </Pressable>
          </View>

          {/* Official Backend Accounts Directory */}
          <View style={styles.accountsCard}>
            <View style={styles.accountsHeader}>
              <Ionicons name="key-outline" size={16} color={Colors.light.heading} style={{ marginRight: 6 }} />
              <Text style={styles.accountsHeading}>Verified Backend Accounts (PostgreSQL)</Text>
            </View>
            <Text style={styles.accountsHint}>
              Tap any verified account below to sign in directly:
            </Text>

            <View style={styles.accountsList}>
              {(['admin', 'manager', 'seller'] as LoginRole[]).map((roleKey) => {
                const conf = ROLES[roleKey];
                const isActive = selectedRole === roleKey;
                return (
                  <View
                    key={roleKey}
                    style={[
                      styles.accountItem,
                      isActive && {
                        backgroundColor: conf.subtleBg,
                        borderColor: conf.primaryColor,
                      },
                    ]}
                  >
                    <Pressable
                      style={styles.accountItemLeft}
                      onPress={() => handleQuickFill(roleKey)}
                    >
                      <View
                        style={[
                          styles.accountIconCircle,
                          { backgroundColor: conf.subtleBg, borderColor: conf.borderColor },
                        ]}
                      >
                        <Ionicons name={conf.iconName} size={16} color={conf.primaryColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.accountTitleRow}>
                          <Text style={[styles.accountRoleTitle, { color: conf.primaryColor }]}>
                            {conf.label}
                          </Text>
                          <Text style={styles.accountBadgeText}>• {conf.badgeLabel}</Text>
                        </View>
                        <Text style={styles.accountEmailText} numberOfLines={1}>
                          Login ID: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{conf.defaultEmail}</Text>
                        </Text>
                        <Text style={styles.accountSubText}>
                          Password: {conf.defaultPass} • Mobile: {conf.defaultPhone}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sign In as ${conf.label}`}
                      onPress={() => handleInstantDemoLogin(roleKey)}
                      disabled={isSubmitting}
                      style={[
                        styles.accountSignInBtn,
                        { backgroundColor: conf.primaryColor },
                      ]}
                    >
                      <Ionicons name="log-in-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.accountSignInBtnText}>Sign In</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              FemmeFlo FMCG Operations System • Express / PostgreSQL
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Server Configuration Modal */}
      <Modal visible={serverModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="server-outline" size={20} color={BrandColors.pink.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Backend Server Settings</Text>
              </View>
              <Pressable hitSlop={HitSlop.md} onPress={() => setServerModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select your network connection target or enter your computer&apos;s local IP:
            </Text>

            {/* Quick Presets */}
            <View style={styles.presetButtonsRow}>
              <Pressable
                style={[
                  styles.presetBtn,
                  customUrlInput.includes('192.168.0.100') && styles.presetBtnActive,
                ]}
                onPress={() => {
                  setCustomUrlInput('http://192.168.0.100:5000/api/v1');
                  setTestResult(null);
                }}
              >
                <Text style={styles.presetBtnTitle}>Physical Phone (Wi-Fi)</Text>
                <Text style={styles.presetBtnSub}>192.168.0.100:5000</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.presetBtn,
                  customUrlInput.includes('10.0.2.2') && styles.presetBtnActive,
                ]}
                onPress={() => {
                  setCustomUrlInput('http://10.0.2.2:5000/api/v1');
                  setTestResult(null);
                }}
              >
                <Text style={styles.presetBtnTitle}>Android Emulator</Text>
                <Text style={styles.presetBtnSub}>10.0.2.2:5000</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.presetBtn,
                  customUrlInput.includes('localhost') && styles.presetBtnActive,
                ]}
                onPress={() => {
                  setCustomUrlInput('http://localhost:5000/api/v1');
                  setTestResult(null);
                }}
              >
                <Text style={styles.presetBtnTitle}>Web / USB ADB</Text>
                <Text style={styles.presetBtnSub}>localhost:5000</Text>
              </Pressable>
            </View>

            <Input
              label="API Base URL"
              placeholder="e.g. http://192.168.0.100:5000/api/v1"
              value={customUrlInput}
              onChangeText={(txt) => {
                setCustomUrlInput(txt);
                setTestResult(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Ionicons name="link-outline" size={18} color={Colors.light.textMuted} />}
            />

            {/* Test Result Message */}
            {testResult ? (
              <View
                style={[
                  styles.testResultBox,
                  testResult.startsWith('✓') ? styles.testResultSuccess : styles.testResultFail,
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    testResult.startsWith('✓') ? styles.testResultTextSuccess : styles.testResultTextFail,
                  ]}
                >
                  {testResult}
                </Text>
              </View>
            ) : null}

            {/* Modal Actions */}
            <View style={styles.modalButtonsRow}>
              <Button
                title={isTestingServer ? 'Testing...' : 'Ping Test'}
                variant="outline"
                size="md"
                loading={isTestingServer}
                onPress={() => handleTestCustomUrl(customUrlInput)}
                icon={<Ionicons name="radio-outline" size={16} color={BrandColors.pink.primary} />}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Save & Connect"
                variant="primary"
                size="md"
                onPress={() => handleApplyServerUrl(customUrlInput)}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  containerBox: {
    width: '100%',
    maxWidth: 440,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.xs,
  },
  serverStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  serverStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusDotGreen: {
    backgroundColor: '#10B981',
  },
  statusDotOrange: {
    backgroundColor: '#F59E0B',
  },
  statusDotRed: {
    backgroundColor: '#EF4444',
  },
  serverStatusText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    maxWidth: 240,
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
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xs,
  },
  hintText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginLeft: 5,
  },
  submitButton: {
    width: '100%',
    minHeight: 48,
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
  accountsCard: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  accountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  accountsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  accountsHint: {
    fontSize: 11,
    color: Colors.light.textMuted,
    marginBottom: Spacing.sm,
  },
  accountsList: {
    gap: Spacing.sm,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  accountItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  accountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  accountRoleTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  accountBadgeText: {
    fontSize: 10,
    color: Colors.light.textMuted,
    fontWeight: '600',
  },
  accountEmailText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  accountSubText: {
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  accountSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    marginLeft: Spacing.xs,
  },
  accountSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 10,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    ...Typography.h2,
    fontSize: 17,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.bodySmall,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  presetBtn: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  presetBtnTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 2,
  },
  presetBtnSub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },
  testResultBox: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  testResultSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  testResultFail: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  testResultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  testResultTextSuccess: {
    color: '#065F46',
  },
  testResultTextFail: {
    color: '#991B1B',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
