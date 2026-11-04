import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import type { ManagerDashboardData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { PageTransition } from '@/components/ui/PageTransition';
import { CardSkeleton, StatCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import { BorderRadius, BrandColors, Colors, MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  canMonitorStock,
  canOnboardCustomers,
  canViewCustomers,
  canViewSellers,
} from '@/utils/permissions';

export default function ManagerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const allowSellers = canViewSellers(user);
  const allowCustomers = canViewCustomers(user);
  const allowOnboardCust = canOnboardCustomers(user);
  const allowStock = canMonitorStock(user);

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await managerApi.getDashboard().catch(() => ({
        totalSellers: 0,
        activeSellersCount: 0,
        monthlyRevenuePaise: 0,
        monthlyPacketsSold: 0,
        totalCustomers: 0,
      }));
      setDashboard(res);
    } catch (err) {
      console.warn('Manager dashboard error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Territory: ${user?.district || 'Regional'}`}
        subtitle={`Manager: ${user?.name}`}
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.green.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Dual-Role Persona Quick Switch Banner */}
          {user?.isSeller ? (
            <Card style={styles.dualRoleCard}>
              <View style={styles.dualRoleHeader}>
                <View style={styles.dualRoleIconBox}>
                  <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.dualRoleTitleRow}>
                    <Text style={styles.dualRoleTitle}>Dual-Role Persona Active</Text>
                    <Badge label="FIELD READY" variant="ACTIVE" size="sm" pulse={true} />
                  </View>
                  <Text style={styles.dualRoleDesc}>
                    Frontline sales authority enabled: personal van stock, mobile POS orders, shift punch-in, and store KYC onboarding.
                  </Text>
                </View>
              </View>
              <Button
                title="Switch to Field Sales Mode"
                variant="primary"
                size="md"
                icon={<Ionicons name="bag-handle-outline" size={18} color="#FFFFFF" />}
                onPress={() => router.replace('/(seller)' as any)}
                style={styles.dualRoleBtn}
              />
            </Card>
          ) : null}

          <Card variant="outlined" style={styles.territoryCard}>
            <View style={styles.territoryHeader}>
              <View style={styles.territoryInfo}>
                <View style={styles.territoryTitleRow}>
                  <Ionicons name="map-outline" size={18} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.territoryTitle}>Territory Command</Text>
                </View>
                <Text style={styles.territorySub}>
                  Authorized scope: {[user?.district, user?.state].filter(Boolean).join(', ') || 'All Assigned Regional Territories'}
                </Text>
              </View>
              <Badge label="TERRITORY MANAGER" variant="ACTIVE" />
            </View>
          </Card>

          <Text style={styles.sectionHeading}>Territory Performance</Text>
          {loading ? (
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </View>
              <View style={styles.metricRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </View>
            </View>
          ) : (
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <StatCard
                  title="Monthly Revenue"
                  value={formatRupees(dashboard?.monthlyRevenuePaise || 0)}
                  subtitle="Confirmed sales volume"
                  icon="cash-outline"
                  iconColor={BrandColors.green.primary}
                  iconBgColor={BrandColors.green.surface}
                  accentColor={BrandColors.green.primary}
                  onPress={() => router.push('/(manager)/sales' as any)}
                />
                <StatCard
                  title="Packets Distributed"
                  value={allowStock ? (dashboard?.monthlyPacketsSold || 0).toLocaleString() : '—'}
                  subtitle={allowStock ? 'Total units sold' : 'Permission restricted'}
                  icon="cube-outline"
                  iconColor={Colors.light.info}
                  iconBgColor={Colors.light.infoBg}
                  onPress={allowStock ? () => router.push('/(manager)/inventory' as any) : undefined}
                />
              </View>
              <View style={styles.metricRow}>
                <StatCard
                  title="Active Field Force"
                  value={allowSellers ? `${dashboard?.activeSellersCount || 0} / ${dashboard?.totalSellers || 0}` : '—'}
                  subtitle={allowSellers ? 'Sellers on active duty' : 'Permission restricted'}
                  icon="people-outline"
                  iconColor={BrandColors.green.primary}
                  iconBgColor={BrandColors.green.surface}
                  onPress={allowSellers ? () => router.push('/(manager)/sellers' as any) : undefined}
                />
                <StatCard
                  title="Retail Stores"
                  value={allowCustomers ? (dashboard?.totalCustomers || 0).toLocaleString() : '—'}
                  subtitle={allowCustomers ? 'Active customer network' : 'Permission restricted'}
                  icon="storefront-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBgColor={BrandColors.pink.subtle}
                  onPress={allowCustomers ? () => router.push('/(manager)/customers' as any) : undefined}
                />
              </View>
            </View>
          )}

          {/* Quick Links */}
          <Text style={styles.sectionHeading}>Territory Operations & Supervision</Text>
          <View style={styles.actionsCol}>
            {allowStock ? (
              <Button
                title="Van Stock Supervision"
                variant="secondary"
                size="lg"
                icon={<Ionicons name="cube-outline" size={20} color="#FFFFFF" />}
                onPress={() => router.push('/(manager)/inventory' as any)}
              />
            ) : null}
            <Button
              title="Field Shift Attendance & Route Tracking"
              variant="outline-secondary"
              size="md"
              icon={<Ionicons name="time-outline" size={18} color={BrandColors.green.primary} />}
              onPress={() => router.push('/(manager)/shifts' as any)}
            />
            <Button
              title="Team Performance & Incentives Audit"
              variant="outline-secondary"
              size="md"
              icon={<Ionicons name="gift-outline" size={18} color={BrandColors.green.primary} />}
              onPress={() => router.push('/(manager)/incentives' as any)}
            />
            {allowOnboardCust ? (
              <Button
                title="Onboard Customer Store (Single / Batch)"
                variant="outline-secondary"
                size="md"
                icon={<Ionicons name="storefront-outline" size={18} color={BrandColors.green.primary} />}
                onPress={() => router.push('/(manager)/customers/new' as any)}
              />
            ) : null}
            {allowSellers ? (
              <Button
                title="Manage Field Officers (Sellers)"
                variant="outline-secondary"
                size="md"
                icon={<Ionicons name="people-outline" size={18} color={BrandColors.green.primary} />}
                onPress={() => router.push('/(manager)/sellers' as any)}
              />
            ) : null}
            <Button
              title="Territory Sales Stream"
              variant="ghost"
              size="md"
              textStyle={{ color: BrandColors.green.primary }}
              icon={<Ionicons name="receipt-outline" size={18} color={BrandColors.green.primary} />}
              onPress={() => router.push('/(manager)/sales' as any)}
            />
          </View>
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
    paddingBottom: 110,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  territoryCard: {
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.green.primary,
    marginBottom: Spacing.lg,
  },
  territoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  territoryInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  territoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  territoryTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  territorySub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.h2,
    color: Colors.light.heading,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  metricsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  actionsCol: {
    gap: Spacing.sm,
  },
  dualRoleCard: {
    backgroundColor: BrandColors.pink.subtle,
    borderColor: BrandColors.pink.tint,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  dualRoleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dualRoleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  dualRoleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dualRoleTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  dualRoleDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  dualRoleBtn: {
    marginTop: Spacing.sm,
  },
});
