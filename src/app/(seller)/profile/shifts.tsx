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
import type { Shift, ShiftSummary } from '@/api/types';
import {
  AttendanceFilterButton,
  AttendanceFilterModal,
} from '@/components/common/AttendanceFilterModal';
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
import {
  computeAttendanceKpiMetrics,
  getShiftFilterDateRange,
  type ShiftFilterState,
} from '@/utils/shiftFilterUtils';

export default function SellerAllShiftsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [serverSummary, setServerSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterState>({ preset: 'all' });
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const dateRangeInfo = useMemo(
    () => getShiftFilterDateRange(shiftFilter),
    [shiftFilter]
  );

  const loadShifts = useCallback(async () => {
    try {
      const range = getShiftFilterDateRange(shiftFilter);
      const res = await sellerApi.getShiftHistory({
        pageSize: 200,
        from: range.from,
        to: range.to,
      });
      setShifts(res.items || []);
      setServerSummary(res.summary || null);
    } catch (err) {
      console.warn('Failed to load seller shift history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shiftFilter]);

  useEffect(() => {
    setLoading(true);
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

  const metrics = useMemo(
    () => computeAttendanceKpiMetrics(shifts, serverSummary),
    [shifts, serverSummary]
  );

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
        subtitle={`${dateRangeInfo.label}: ${shifts.length} shifts • ${user?.name || 'Field Officer'}`}
        showBack
        rightAction={
          <AttendanceFilterButton
            onPress={() => setFilterModalVisible(true)}
            hasActiveFilter={shiftFilter.preset !== 'all'}
            accentColor={BrandColors.pink.primary}
            accessibilityLabel="Filter shift history"
          />
        }
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
                title="Stores Visited"
                value={String(metrics.shopsVisited)}
                subtitle={`${metrics.salesDoneVisits} with sale`}
                icon="storefront-outline"
                iconColor="#0284C7"
                iconBg="#F0F9FF"
              />
              <StatCard
                title="Total Travel"
                value={`${metrics.totalDistanceKm} KM`}
                subtitle="Combined distance"
                icon="speedometer-outline"
                iconColor={BrandColors.green.primary}
                iconBg={BrandColors.green.subtle}
                accentColor={BrandColors.green.primary}
              />
            </View>
            <View style={styles.kpiRow}>
              <StatCard
                title="Total Time"
                value={metrics.totalTimeLabel}
                subtitle={`${metrics.totalShifts} shifts logged`}
                icon="time-outline"
                iconColor={BrandColors.pink.primary}
                iconBg={BrandColors.pink.subtle}
              />
              <StatCard
                title="Completed"
                value={`${metrics.completedShifts} / ${metrics.totalShifts}`}
                subtitle="Finished duty runs"
                icon="checkmark-done-circle-outline"
                iconColor={BrandColors.green.primary}
                iconBg={BrandColors.green.subtle}
              />
            </View>

            <Text style={styles.listSectionTitle}>
              Field Duty Records · {dateRangeInfo.label}
            </Text>
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
              description={`No shifts found for ${dateRangeInfo.label}.`}
              actionTitle="Go to Shift Screen"
              onAction={() => router.push('/(seller)/attendance' as any)}
            />
          )
        }
      />

      <AttendanceFilterModal
        visible={filterModalVisible}
        value={shiftFilter}
        onApply={setShiftFilter}
        onClose={() => setFilterModalVisible(false)}
        accentColor={BrandColors.pink.primary}
        defaultPreset="all"
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

