import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { PublicUser } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Shadows,
  Spacing,
} from '@/constants/theme';

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; role?: string }>();
  const userId = params.id;
  const initialRole = (params.role as 'MANAGER' | 'SELLER') || undefined;

  const [user, setUser] = useState<PublicUser | null>(null);
  const [resolvedRole, setResolvedRole] = useState<'MANAGER' | 'SELLER'>(initialRole || 'MANAGER');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadUserData = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await adminApi.getUser(userId, initialRole);
      if (res.user) {
        setUser(res.user);
        setResolvedRole(res.role || (res.user.role as any) || 'MANAGER');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load user profile.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, initialRole]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserData();
  }, [loadUserData]);

  function handleCall() {
    if (!user?.phone) {
      Alert.alert('No Phone', 'This user does not have a phone number registered.');
      return;
    }
    const cleanPhone = user.phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call Failed', 'Unable to initiate call from this device.');
    });
  }

  function handleEmail() {
    if (!user?.email) {
      Alert.alert('No Email', 'This user does not have an email address registered.');
      return;
    }
    Linking.openURL(`mailto:${user.email}`).catch(() => {
      Alert.alert('Email Failed', 'Unable to open mail client.');
    });
  }

  async function handleToggleStatus() {
    if (!user || actionLoading) return;
    const willDeactivate = Boolean(user.active);

    Alert.alert(
      willDeactivate ? 'Deactivate User?' : 'Activate User?',
      willDeactivate
        ? `Are you sure you want to deactivate ${user.name}? They will be blocked from logging in until reactivated.`
        : `Activate ${user.name}? They will regain full access to the platform.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: willDeactivate ? 'Deactivate' : 'Activate',
          style: willDeactivate ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (resolvedRole === 'MANAGER') {
                const updated = await adminApi.updateManager(user.id, { active: !willDeactivate });
                setUser(updated.manager);
              } else {
                const updated = await adminApi.updateSeller(user.id, { active: !willDeactivate });
                setUser(updated.seller);
              }
              setFeedback({
                type: 'success',
                message: `User ${user.name} is now ${!willDeactivate ? 'Active' : 'Inactive'}.`,
              });
              DeviceEventEmitter.emit('USER_UPDATED', { id: user.id });
            } catch (err: any) {
              setFeedback({
                type: 'error',
                message: err.message || 'Failed to update user status.',
              });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleToggleDualRole() {
    if (!user || resolvedRole !== 'MANAGER' || actionLoading) return;
    const nextIsSeller = !user.isSeller;

    Alert.alert(
      nextIsSeller ? 'Enable Dual-Role Persona?' : 'Disable Dual-Role Persona?',
      nextIsSeller
        ? `Enable direct van stock allocation and field sales POS for Manager ${user.name}?`
        : `Remove van sales POS access for Manager ${user.name}? They will remain a Territory Manager.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextIsSeller ? 'Enable Dual Role' : 'Disable',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await adminApi.updateManager(user.id, { isSeller: nextIsSeller });
              setUser(updated.manager);
              setFeedback({
                type: 'success',
                message: `Dual-Role Persona ${nextIsSeller ? 'enabled' : 'disabled'} for ${user.name}.`,
              });
              DeviceEventEmitter.emit('USER_UPDATED', { id: user.id });
            } catch (err: any) {
              setFeedback({
                type: 'error',
                message: err.message || 'Failed to update persona.',
              });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="User Details" subtitle="Loading profile..." showBack />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={BrandColors.pink.dark} />
          <Text style={styles.loadingText}>Loading user profile...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Header title="User Details" subtitle="Profile not found" showBack />
        <View style={styles.notFoundCenter}>
          <Ionicons name="person-remove-outline" size={48} color="#94A3B8" />
          <Text style={styles.notFoundTitle}>User Not Found</Text>
          <Text style={styles.notFoundSub}>
            The requested user profile could not be found or has been removed.
          </Text>
          <Button
            title="Return to Team Directory"
            variant="secondary"
            size="md"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </View>
    );
  }

  const isManager = resolvedRole === 'MANAGER';
  const isDualRole = isManager && Boolean(user.isSeller);

  return (
    <View style={styles.container}>
      <Header
        title={user.name}
        subtitle={isManager ? 'Territory Manager' : 'Field Sales Officer'}
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          )}

          {/* 1. Hero Profile Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.avatarLarge,
                  {
                    backgroundColor: isManager ? BrandColors.green.subtle : BrandColors.pink.subtle,
                    borderColor: isManager ? BrandColors.green.tint : BrandColors.pink.tint,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarLargeText,
                    { color: isManager ? BrandColors.green.primary : BrandColors.pink.dark },
                  ]}
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>

              <View style={styles.heroInfoCol}>
                <Text style={styles.heroName}>{user.name}</Text>
                <Text style={styles.heroDesignation}>
                  {user.designation || (isManager ? 'Territory Sales Manager' : 'Field Sales Officer')}
                </Text>
                <View style={styles.badgeRow}>
                  <Badge
                    label={isManager ? 'MANAGER' : 'FIELD OFFICER'}
                    variant={isManager ? 'ACTIVE' : 'info'}
                    size="sm"
                  />
                  <Badge
                    label={user.active ? 'ACTIVE' : 'INACTIVE'}
                    variant={user.active ? 'ACTIVE' : 'INACTIVE'}
                    size="sm"
                  />
                  {isDualRole && (
                    <Badge label="DUAL ROLE" variant="ACTIVE" size="sm" pulse />
                  )}
                </View>
              </View>
            </View>

            {/* Quick Contact Action Buttons */}
            <View style={styles.quickContactRow}>
              <TouchableOpacity
                style={[styles.quickContactBtn, styles.callBtn]}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={16} color="#059669" />
                <Text style={styles.callBtnText}>Call {user.phone ? user.phone.slice(-10) : ''}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickContactBtn, styles.emailBtn]}
                onPress={handleEmail}
                activeOpacity={0.7}
              >
                <Ionicons name="mail" size={16} color="#E61C5D" />
                <Text style={styles.emailBtnText} numberOfLines={1}>
                  {user.email || 'Email'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* 2. Dual-Role Persona Banner (For Managers) */}
          {isManager && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: BrandColors.pink.subtle }]}>
                  <Ionicons name="swap-horizontal" size={18} color={BrandColors.pink.dark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Dual-Role Persona (Van Stock & Sales)</Text>
                  <Text style={styles.sectionSubtitle}>
                    Allows Territory Manager to hold vehicle inventory and make direct spot sales
                  </Text>
                </View>
              </View>

              <View style={styles.personaStatusRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaStateLabel}>
                    Status: <Text style={{ fontWeight: '700', color: isDualRole ? '#059669' : '#64748B' }}>{isDualRole ? 'Enabled' : 'Disabled'}</Text>
                  </Text>
                  <Text style={styles.personaStateSub}>
                    {isDualRole
                      ? 'This manager can receive warehouse dispatches and record customer sales.'
                      : 'Standard manager role without direct field sales pos.'}
                  </Text>
                </View>
                <Button
                  title={isDualRole ? 'Disable' : 'Enable'}
                  size="sm"
                  variant={isDualRole ? 'outline' : 'admin'}
                  loading={actionLoading}
                  onPress={handleToggleDualRole}
                />
              </View>
            </Card>
          )}

          {/* 3. Territory & Work Location Card */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="location" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Territory & Location</Text>
                <Text style={styles.sectionSubtitle}>Assigned geographical operating territory</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>State</Text>
                <Text style={styles.infoValue}>{user.state || 'All States'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>District</Text>
                <Text style={styles.infoValue}>{user.district || 'All Districts'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Village / Area</Text>
                <Text style={styles.infoValue}>{user.village || 'Central Territory'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Postal Pincode</Text>
                <Text style={styles.infoValue}>{user.pincode || 'Not specified'}</Text>
              </View>
            </View>

            {user.address ? (
              <View style={styles.addressBox}>
                <Text style={styles.infoLabel}>Full Operating Address</Text>
                <Text style={styles.addressText}>{user.address}</Text>
              </View>
            ) : null}
          </Card>

          {/* 4. Professional & Identity Information Card */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="briefcase" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Employment & Identity Details</Text>
                <Text style={styles.sectionSubtitle}>Work profile and credential records</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Employee Code</Text>
                <Text style={styles.infoValue}>{user.employeeCode || `FF-${user.id.slice(-6).toUpperCase()}`}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Role Assigned</Text>
                <Text style={styles.infoValue}>{isManager ? 'Territory Manager' : 'Field Sales Officer'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Primary Phone</Text>
                <Text style={styles.infoValue}>{user.phone || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Alternate Phone</Text>
                <Text style={styles.infoValue}>{user.alternatePhone || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Aadhaar Card</Text>
                <Text style={styles.infoValue}>
                  {user.aadhaarNumber ? `•••• •••• ${user.aadhaarNumber.slice(-4)}` : 'Verified on File'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Driving License</Text>
                <Text style={styles.infoValue}>{user.drivingLicenseNumber || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Qualification</Text>
                <Text style={styles.infoValue}>{user.qualification || 'Higher Secondary / Graduate'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Date Onboarded</Text>
                <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
              </View>
            </View>
          </Card>

          {/* 5. Assigned Permissions (for Managers) */}
          {isManager && user.permissions && user.permissions.length > 0 && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <Ionicons name="key" size={18} color="#9333EA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Governance Permissions</Text>
                  <Text style={styles.sectionSubtitle}>Configured role authorities in territory</Text>
                </View>
              </View>

              <View style={styles.permissionsPillsWrap}>
                {user.permissions.map((perm) => (
                  <View key={perm} style={styles.permChip}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.permChipText}>
                      {perm.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* 6. Account Status & Governance */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIconBox,
                  { backgroundColor: user.active ? '#FEF2F2' : '#F0FDF4' },
                ]}
              >
                <Ionicons
                  name={user.active ? 'alert-circle' : 'shield-checkmark'}
                  size={18}
                  color={user.active ? '#DC2626' : '#16A34A'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Account Status & Access</Text>
                <Text style={styles.sectionSubtitle}>
                  {user.active
                    ? 'Active staff member with live access to mobile application'
                    : 'Account suspended — cannot access system or log in'}
                </Text>
              </View>
            </View>

            <View style={styles.statusActionBox}>
              <Button
                title={user.active ? 'Deactivate Account' : 'Activate Account'}
                variant={user.active ? 'outline' : 'admin'}
                size="md"
                loading={actionLoading}
                onPress={handleToggleStatus}
                icon={
                  <Ionicons
                    name={user.active ? 'lock-closed-outline' : 'lock-open-outline'}
                    size={16}
                    color={user.active ? '#DC2626' : '#FFFFFF'}
                  />
                }
                style={user.active ? { borderColor: '#DC2626' } : undefined}
                textStyle={user.active ? { color: '#DC2626' } : undefined}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 110,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  notFoundCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: Spacing.sm,
  },
  notFoundSub: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 280,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: Spacing.md,
  },
  avatarLargeText: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  heroDesignation: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  callBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  emailBtn: {
    backgroundColor: '#FFF5F7',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  emailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E61C5D',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  sectionIconBox: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  personaStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
  },
  personaStateLabel: {
    fontSize: 13,
    color: '#334155',
  },
  personaStateSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  infoItem: {
    width: '50%',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  addressBox: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },
  permissionsPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  permChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  statusActionBox: {
    marginTop: Spacing.xs,
  },
});
