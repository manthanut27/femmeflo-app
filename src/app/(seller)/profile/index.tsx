import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { Shift } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SellerProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);

  useEffect(() => {
    sellerApi
      .getShiftHistory({ pageSize: 5 })
      .then((res) => setShiftHistory(res.items))
      .catch(() => {});
  }, []);

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Header title="My Profile" subtitle="Field Officer Account & Duty Log" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* User Card */}
          <Card style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {user?.name?.slice(0, 2).toUpperCase() || 'SF'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <Badge label="SELLER • FIELD FORCE" variant="ACTIVE" style={{ marginTop: 6 }} />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoVal}>{user?.phone || 'Not provided'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Territory</Text>
              <Text style={styles.infoVal}>
                {[user?.district, user?.state].filter(Boolean).join(', ') || 'Assigned Territory'}
              </Text>
            </View>
          </Card>

          {/* Multi-Role Return for Managers viewing Field Sales Mode */}
          {user?.role === 'MANAGER' ? (
            <Card style={styles.roleSwitchCard}>
              <View style={styles.roleSwitchHeader}>
                <Ionicons name="swap-horizontal" size={20} color={BrandColors.green.primary} style={{ marginRight: 8 }} />
                <Text style={styles.roleSwitchTitle}>Territory Manager Session</Text>
              </View>
              <Text style={styles.roleSwitchDesc}>
                You are currently in Field Sales Mode. Tap below to return to your primary Territory Manager operational dashboard.
              </Text>
              <Button
                title="Return to Manager Hub"
                variant="secondary"
                size="md"
                onPress={() => router.replace('/(manager)' as any)}
                icon={<Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          ) : null}

          {/* Operational Shortcuts */}
          <Text style={styles.sectionHeading}>Account Settings</Text>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications Center"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => router.push('/(shared)/notifications' as any)}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconCircle}>
                  <Ionicons name="notifications-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.menuText}>Notifications Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change Password"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => router.push('/(shared)/change-password' as any)}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconCircle}>
                  <Ionicons name="key-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          </Card>

          {/* Recent Duty Shifts */}
          <Text style={styles.sectionHeading}>Recent Duty Shifts</Text>
          {shiftHistory.length === 0 ? (
            <Card variant="flat" style={{ padding: Spacing.md }}>
              <Text style={{ color: '#64748B', ...Typography.caption }}>No completed shifts recorded yet.</Text>
            </Card>
          ) : (
            shiftHistory.map((shift) => (
              <Card key={shift.id} style={styles.shiftCard}>
                <View style={styles.shiftHeader}>
                  <Text style={styles.shiftDate}>
                    {new Date(shift.startTime).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Badge label={shift.status} variant={shift.status === 'COMPLETED' ? 'success' : 'warning'} size="sm" />
                </View>
                <Text style={styles.shiftKm}>
                  Odometer: {shift.startOdometerKm} KM → {shift.endOdometerKm ?? 'Active'} KM
                  {shift.endOdometerKm ? ` (${(shift.endOdometerKm - shift.startOdometerKm).toFixed(1)} KM traveled)` : ''}
                </Text>
              </Card>
            ))
          )}

          {/* Sign Out Button */}
          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            onPress={handleLogout}
            style={styles.logoutBtn}
            icon={<Ionicons name="log-out-outline" size={20} color={BrandColors.pink.primary} />}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  roleSwitchCard: {
    marginBottom: Spacing.lg,
    backgroundColor: BrandColors.green.subtle,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.green.light,
  },
  roleSwitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  roleSwitchTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  roleSwitchDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
  },
  avatarText: {
    ...Typography.h2,
    color: BrandColors.pink.primary,
  },
  userName: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  userEmail: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginRight: Spacing.sm,
  },
  infoVal: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.heading,
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    minHeight: 56,
  },
  menuItemPressed: {
    backgroundColor: Colors.light.surfaceMuted,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginHorizontal: Spacing.lg,
  },
  shiftCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftDate: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  shiftKm: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
});
