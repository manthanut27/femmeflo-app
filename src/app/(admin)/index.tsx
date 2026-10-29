import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { AdminDashboardData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
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

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await adminApi.getDashboard().catch(() => ({
        totalRevenuePaise: 0,
        totalPacketsSold: 0,
        totalCustomers: 0,
        activeSellers: 0,
        pendingApprovalsCount: 0,
        warehouseStockBalance: 0,
      }));
      setDashboard(res);
    } catch (err) {
      console.warn('Admin dashboard error', err);
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

  const pendingCount = dashboard?.pendingApprovalsCount || 0;

  return (
    <View style={styles.container}>
      <Header
        title="Executive Overview"
        subtitle={`Super Admin • ${user?.name || 'Administrator'}`}
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* National Governance Banner */}
          <Card style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <View style={styles.bannerInfo}>
                <View style={styles.bannerTitleRow}>
                  <View style={styles.bannerIconBadge}>
                    <Ionicons name="shield-checkmark" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.bannerTitle}>National Distribution Control</Text>
                </View>
                <Text style={styles.bannerSub}>HQ Operations, Warehouses & Role Hierarchy</Text>
              </View>
              <Badge label="SUPER ADMIN" variant="ACTIVE" />
            </View>
          </Card>

          {/* Pending Approvals Alert Banner */}
          {pendingCount > 0 ? (
            <Card style={styles.approvalAlertCard}>
              <View style={styles.approvalAlertRow}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <View style={styles.alertHeaderRow}>
                    <Ionicons name="alert-circle" size={20} color={Colors.light.warning} style={{ marginRight: 6 }} />
                    <Text style={styles.approvalAlertTitle}>
                      {pendingCount} Below-Minimum Price {pendingCount === 1 ? 'Sale' : 'Sales'} Pending
                    </Text>
                  </View>
                  <Text style={styles.approvalAlertDesc}>
                    Orders below ₹25.00/pkt threshold are blocked from stock deduction and invoicing until authorized.
                  </Text>
                </View>
                <Button
                  title="Review Queue"
                  size="sm"
                  variant="primary"
                  onPress={() => router.push('/(admin)/approvals/' as any)}
                />
              </View>
            </Card>
          ) : null}

          {/* Metrics Grid */}
          <Text style={styles.sectionHeading}>National Operations Metrics</Text>
          {loading ? (
            <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricHalf}>
                <StatCard
                  title="Total Revenue"
                  value={formatRupees(dashboard?.totalRevenuePaise || 0)}
                  subtitle="Confirmed gross receipts"
                  icon="wallet-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Packets Sold"
                  value={(dashboard?.totalPacketsSold || 0).toLocaleString()}
                  subtitle="Sanitary napkins sold"
                  icon="cube-outline"
                  iconColor="#0284C7"
                  iconBg="#F0F9FF"
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="HQ Warehouse Stock"
                  value={`${(dashboard?.warehouseStockBalance || 0).toLocaleString()} pkts`}
                  subtitle="Central inventory pool"
                  icon="business-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                  accentColor={BrandColors.green.primary}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Customer Network"
                  value={(dashboard?.totalCustomers || 0).toLocaleString()}
                  subtitle="Active retail stores"
                  icon="storefront-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Active Field Force"
                  value={(dashboard?.activeSellers || 0).toLocaleString()}
                  subtitle="Officers on duty"
                  icon="people-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Price Approvals"
                  value={String(pendingCount)}
                  subtitle={pendingCount > 0 ? 'Action required' : 'Queue cleared'}
                  icon="hourglass-outline"
                  iconColor={pendingCount > 0 ? Colors.light.warning : Colors.light.textTertiary}
                  iconBg={pendingCount > 0 ? Colors.light.warningBg : '#F1F5F9'}
                  accentColor={pendingCount > 0 ? Colors.light.warning : undefined}
                />
              </View>
            </View>
          )}

          {/* Administration Actions */}
          <Text style={styles.sectionHeading}>Administrative Actions</Text>
          <View style={styles.actionsCol}>
            <Button
              title="Price Approvals Queue"
              variant="primary"
              size="lg"
              icon={<Ionicons name="checkmark-done-circle-outline" size={20} color="#FFFFFF" />}
              onPress={() => router.push('/(admin)/approvals/' as any)}
            />
            <Button
              title="Inward Factory Stock & Warehouse Transfers"
              variant="secondary"
              size="md"
              icon={<Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />}
              onPress={() => router.push('/(admin)/inventory/transfer' as any)}
            />
            <Button
              title="Manage Managers & Sellers Directory"
              variant="outline"
              size="md"
              icon={<Ionicons name="people-outline" size={18} color={BrandColors.pink.primary} />}
              onPress={() => router.push('/(admin)/users/' as any)}
            />
            <Button
              title="Customer Categories Configuration"
              variant="outline"
              size="md"
              icon={<Ionicons name="pricetags-outline" size={18} color={BrandColors.pink.primary} />}
              onPress={() => router.push('/(admin)/categories/' as any)}
            />
            <Button
              title="Configure Minimum Sale Price & Invariants"
              variant="ghost"
              size="md"
              icon={<Ionicons name="settings-outline" size={18} color={BrandColors.pink.primary} />}
              onPress={() => router.push('/(admin)/settings/' as any)}
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
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  bannerCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.pink.dark,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    ...Elevation.low,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bannerTitle: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginLeft: 36,
  },
  approvalAlertCard: {
    backgroundColor: Colors.light.warningBg,
    borderColor: Colors.light.warningBorder,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Elevation.low,
  },
  approvalAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  approvalAlertTitle: {
    ...Typography.bodyMedium,
    color: Colors.light.warningText,
    fontWeight: '700',
  },
  approvalAlertDesc: {
    ...Typography.caption,
    color: Colors.light.warningText,
    lineHeight: 16,
    marginLeft: 26,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricHalf: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  actionsCol: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
});
