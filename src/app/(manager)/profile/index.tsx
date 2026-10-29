import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ManagerProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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
      <Header title="Manager Profile" subtitle="Territory Administration" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerContainer}>
          <Card style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {user?.name?.slice(0, 2).toUpperCase() || 'TM'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <Badge label="TERRITORY MANAGER" variant="ACTIVE" style={{ marginTop: 6 }} />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigned Territory</Text>
              <Text style={styles.infoVal}>
                {[user?.district, user?.state].filter(Boolean).join(', ') || 'All Regions'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoVal}>{user?.phone || 'Not configured'}</Text>
            </View>
          </Card>

          {/* Multi-Role Switcher for Managers with Field Sales Authority */}
          {user?.isSeller ? (
            <Card style={styles.roleSwitchCard}>
              <View style={styles.roleSwitchHeader}>
                <Ionicons name="swap-horizontal" size={20} color={BrandColors.pink.primary} style={{ marginRight: 8 }} />
                <Text style={styles.roleSwitchTitle}>Dual Operational Role</Text>
              </View>
              <Text style={styles.roleSwitchDesc}>
                You are designated as both Territory Manager and Field Sales Officer. Switch into Field Sales mode to enter mobile POS orders and record on-ground duty shifts.
              </Text>
              <Button
                title="Switch to Field Sales Mode"
                variant="primary"
                size="md"
                onPress={() => router.replace('/(seller)' as any)}
                icon={<Ionicons name="bag-handle-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          ) : null}

          <Text style={styles.sectionHeading}>Settings & Actions</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(shared)/notifications' as any)}
              accessibilityRole="button"
              accessibilityLabel="Notifications Center"
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.light.textPrimary} />
                </View>
                <Text style={styles.menuText}>Notifications Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(shared)/change-password' as any)}
              accessibilityRole="button"
              accessibilityLabel="Change Password"
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconBadge, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="key-outline" size={20} color={Colors.light.textPrimary} />
                </View>
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          </Card>

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
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  roleSwitchCard: {
    marginBottom: Spacing.lg,
    backgroundColor: BrandColors.pink.subtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
  },
  roleSwitchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  roleSwitchTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  roleSwitchDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  profileCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EBF6EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  userName: {
    ...Typography.h2,
    color: Colors.light.textPrimary,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  infoVal: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    minHeight: 56,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: Spacing.lg,
  },
  logoutBtn: {
    marginTop: Spacing.xxl,
  },
});
