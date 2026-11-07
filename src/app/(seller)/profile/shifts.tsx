import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { Shift } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { StatCard } from '@/components/ui/StatCard';
import {
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { computeShiftTravelDistance } from '@/utils/distanceUtils';

export default function SellerAllShiftsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});

  const loadShifts = useCallback(async () => {
    try {
      const res = await sellerApi.getShiftHistory({ pageSize: 50 });
      setShifts(res.items || []);
    } catch (err) {
      console.warn('Failed to load seller shift history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShifts();
  }, [loadShifts]);

  const toggleExpand = (shiftId: string) => {
    setExpandedShiftIds((prev) => ({
      ...prev,
      [shiftId]: !prev[shiftId],
    }));
  };

  const metrics = useMemo(() => {
    const totalCount = shifts.length;
    const completedCount = shifts.filter((s) => s.status === 'COMPLETED').length;
    let totalKm = 0;
    let totalVisits = 0;

    for (const s of shifts) {
      totalVisits += s.visits?.length || 0;
      totalKm += computeShiftTravelDistance(s).distanceKm;
    }

    return {
      totalCount,
      completedCount,
      totalKm: totalKm.toFixed(1),
      totalVisits,
    };
  }, [shifts]);

  const renderShiftItem = ({ item }: { item: Shift }) => {
    const isExpanded = Boolean(expandedShiftIds[item.id]);
    const startKm = item.startOdometerKm ?? (item as any).startOdometer ?? 0;
    const endKm = item.endOdometerKm ?? (item as any).endOdometer;
    const distanceInfo = computeShiftTravelDistance(item);
    const visits = item.visits || [];
    const isActive = item.status === 'ACTIVE';

    return (
      <Card style={[styles.shiftCard, isActive && styles.activeShiftCard]}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={15} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
              <Text style={styles.shiftDate}>
                {new Date(item.startTime).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={styles.shiftTime}>
              Started: {new Date(item.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              {item.endTime ? ` • Ended: ${new Date(item.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </Text>
          </View>
          <Badge
            label={isActive ? 'DUTY ACTIVE' : item.status}
            variant={isActive ? 'ACTIVE' : item.status === 'COMPLETED' ? 'success' : 'warning'}
            pulse={isActive}
            size="sm"
          />
        </View>

        {/* Odometer & Distance Stats */}
        <View style={styles.odometerGrid}>
          <View style={styles.odometerBox}>
            <Text style={styles.odometerLabel}>START ODOMETER</Text>
            <Text style={styles.odometerValue}>{startKm.toLocaleString('en-IN')} KM</Text>
          </View>
          <View style={styles.odometerDivider} />
          <View style={styles.odometerBox}>
            <Text style={styles.odometerLabel}>CLOSING ODOMETER</Text>
            <Text style={styles.odometerValue}>
              {endKm != null ? `${endKm.toLocaleString('en-IN')} KM` : 'Active'}
            </Text>
          </View>
          <View style={styles.odometerDivider} />
          <View style={styles.odometerBox}>
            <Text style={styles.odometerLabel}>DISTANCE</Text>
            <Text style={[styles.odometerValue, { color: BrandColors.green.primary }]}>
              {distanceInfo.formatted.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Verification & Address Tags */}
        <View style={styles.metaRow}>
          {item.startFaceVerified ? (
            <View style={styles.verifiedTag}>
              <Ionicons name="checkmark-circle" size={13} color={BrandColors.green.primary} />
              <Text style={styles.verifiedText}>Face ID Verified</Text>
            </View>
          ) : null}

          <View style={styles.visitsCountTag}>
            <Ionicons name="storefront-outline" size={13} color={BrandColors.pink.primary} />
            <Text style={styles.visitsCountText}>{visits.length} Store Visits</Text>
          </View>
        </View>

        {/* Visits Accordion */}
        {visits.length > 0 ? (
          <View style={styles.visitsSection}>
            <Pressable
              onPress={() => toggleExpand(item.id)}
              style={styles.visitsToggleBtn}
              hitSlop={HitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? 'Collapse visits' : 'Expand visits'}
            >
              <Text style={styles.visitsToggleText}>
                {isExpanded ? 'Hide Visited Stores' : `View ${visits.length} Visited Stores`}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={BrandColors.pink.primary}
              />
            </Pressable>

            {isExpanded ? (
              <View style={styles.visitsList}>
                {visits.map((v, idx) => (
                  <View key={v.id || idx} style={styles.visitRow}>
                    <View style={styles.visitBullet}>
                      <Text style={styles.visitBulletText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: Spacing.xs }}>
                      <Text style={styles.visitShopName}>
                        {v.customer?.shopName || v.shopName || 'Retail Customer'}
                      </Text>
                      <Text style={styles.visitTime}>
                        {new Date(v.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {v.checkOutTime ? ` - ${new Date(v.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </Text>
                    </View>
                    {v.orderPlaced || v.saleDone || v.saleId ? (
                      <Badge label="SALE DONE" variant="success" size="sm" showDot={false} />
                    ) : (
                      <Badge label="VISITED" variant="neutral" size="sm" showDot={false} />
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Duty Shifts History"
        subtitle={`Total: ${shifts.length} shifts • ${user?.name || 'Field Officer'}`}
        showBack
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(seller)/profile' as any);
          }
        }}
      />

      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        renderItem={renderShiftItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.primary]}
            tintColor={BrandColors.pink.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            {/* KPI Stats */}
            <View style={styles.kpiRow}>
              <StatCard
                title="Total Shifts"
                value={String(metrics.totalCount)}
                subtitle="Duty sessions logged"
                icon="time-outline"
                iconColor={BrandColors.pink.primary}
                iconBg={BrandColors.pink.subtle}
              />
              <StatCard
                title="Total Travel"
                value={`${metrics.totalKm} KM`}
                subtitle="Combined odometer"
                icon="speedometer-outline"
                iconColor={BrandColors.green.primary}
                iconBg={BrandColors.green.subtle}
                accentColor={BrandColors.green.primary}
              />
            </View>
            <View style={styles.kpiRow}>
              <StatCard
                title="Stores Visited"
                value={String(metrics.totalVisits)}
                subtitle="Retail touchpoints"
                icon="storefront-outline"
                iconColor="#0284C7"
                iconBg="#F0F9FF"
              />
              <StatCard
                title="Completed"
                value={`${metrics.completedCount} / ${metrics.totalCount}`}
                subtitle="Finished duty runs"
                icon="checkmark-done-circle-outline"
                iconColor={BrandColors.green.primary}
                iconBg={BrandColors.green.subtle}
              />
            </View>

            <Text style={styles.listSectionTitle}>All Field Duty Records</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={BrandColors.pink.primary} />
            </View>
          ) : (
            <EmptyState
              icon="time-outline"
              title="No Shifts Recorded"
              description="You have not recorded any field duty shifts yet. Start your first shift from the Duty Shift tab."
              actionTitle="Go to Shift Screen"
              onAction={() => router.push('/(seller)/shift' as any)}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrapper: {
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  listSectionTitle: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  shiftCard: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    padding: Spacing.md,
  },
  activeShiftCard: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.green.primary,
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftDate: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  shiftTime: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  odometerGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  odometerBox: {
    flex: 1,
    alignItems: 'center',
  },
  odometerDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  odometerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.textMuted,
    letterSpacing: 0.5,
  },
  odometerValue: {
    ...Typography.caption,
    fontWeight: '800',
    color: Colors.light.heading,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  visitsCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.pink.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  visitsCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.pink.primary,
  },
  visitsSection: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.xs,
  },
  visitsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  visitsToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.pink.primary,
  },
  visitsList: {
    marginTop: Spacing.xs,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 8,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  visitBulletText: {
    fontSize: 10,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  visitShopName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.heading,
  },
  visitTime: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
});

