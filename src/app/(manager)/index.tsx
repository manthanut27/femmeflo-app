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
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import { BrandColors, Colors, MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ManagerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

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
            <View style={styles.metricsGrid}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <StatCard
                title="Monthly Revenue"
                value={formatRupees(dashboard?.monthlyRevenuePaise || 0)}
                subtitle="Confirmed sales volume"
                icon="cash-outline"
                iconColor={BrandColors.green.primary}
                iconBgColor={BrandColors.green.surface}
                accentColor={BrandColors.green.primary}
              />
              <StatCard
                title="Packets Distributed"
                value={(dashboard?.monthlyPacketsSold || 0).toLocaleString()}
                subtitle="Total units sold"
                icon="cube-outline"
                iconColor={Colors.light.info}
                iconBgColor={Colors.light.infoBg}
              />
              <StatCard
                title="Active Field Force"
                value={`${dashboard?.activeSellersCount || 0} / ${dashboard?.totalSellers || 0}`}
                subtitle="Sellers on active duty"
                icon="people-outline"
                iconColor={BrandColors.green.primary}
                iconBgColor={BrandColors.green.surface}
                onPress={() => router.push('/(manager)/sellers' as any)}
              />
              <StatCard
                title="Retail Stores"
                value={(dashboard?.totalCustomers || 0).toLocaleString()}
                subtitle="Active customer network"
                icon="storefront-outline"
                iconColor={BrandColors.pink.primary}
                iconBgColor={BrandColors.pink.subtle}
                onPress={() => router.push('/(manager)/customers' as any)}
              />
            </View>
          )}

          {/* Quick Links */}
          <Text style={styles.sectionHeading}>Territory Operations</Text>
          <View style={styles.actionsCol}>
            <Button
              title="Manage Field Officers (Sellers)"
              variant="secondary"
              size="lg"
              icon={<Ionicons name="people-outline" size={20} color="#FFFFFF" />}
              onPress={() => router.push('/(manager)/sellers' as any)}
            />
            <Button
              title="Onboard New Field Officer"
              variant="outline-secondary"
              size="md"
              icon={<Ionicons name="person-add-outline" size={18} color={BrandColors.green.primary} />}
              onPress={() => router.push('/(manager)/sellers/new' as any)}
            />
            <Button
              title="Territory Customer Directory"
              variant="outline-secondary"
              size="md"
              icon={<Ionicons name="storefront-outline" size={18} color={BrandColors.green.primary} />}
              onPress={() => router.push('/(manager)/customers' as any)}
            />
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
    paddingBottom: Spacing.huge,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionsCol: {
    gap: Spacing.sm,
  },
});
