import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managerApi } from '@/api/manager';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Shift, ShiftStatus } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
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
  formatDateIST,
  formatDateTimeIST,
  formatTimeIST,
  getISTDateKey,
  getISTDateRangeFilter,
} from '@/utils/dateUtils';

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'Active now';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type PeriodFilter = 'all' | 'today' | 'month';

export default function ManagerShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});

  const loadShifts = useCallback(async () => {
    try {
      const dateFilter = getISTDateRangeFilter(
        periodFilter === 'all' ? 'all' : periodFilter === 'today' ? 'today' : 'month'
      );

      const res = await managerApi.listShifts({
        page: 1,
        pageSize: 100,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        from: dateFilter.from,
        to: dateFilter.to,
      });

      setShifts(res.items || []);
    } catch (err) {
      console.warn('Failed to load manager shifts', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    setLoading(true);
    loadShifts();
  }, [loadShifts]);

  useRealtimeSync(['SHIFT_UPDATE'], loadShifts);

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

  // Metrics summary
  const metrics = useMemo(() => {
    const activeCount = shifts.filter((s) => s.status === 'ACTIVE').length;
    const completedCount = shifts.filter((s) => s.status === 'COMPLETED').length;
    let totalVisits = 0;
    let totalDistance = 0;

    for (const s of shifts) {
      totalVisits += s.visits?.length || 0;
      totalDistance += computeShiftTravelDistance(s).distanceKm;
    }

    return {
      activeCount,
      completedCount,
      totalVisits,
      totalDistance: Math.round(totalDistance * 10) / 10,
    };
  }, [shifts]);

  // Search filter
  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter((s) => {
      const name = (s.seller?.name || '').toLowerCase();
      const code = (s.seller?.employeeCode || '').toLowerCase();
      const phone = (s.seller?.phone || '').toLowerCase();
      return name.includes(q) || code.includes(q) || phone.includes(q);
    });
  }, [shifts, searchQuery]);

  return (
    <View style={styles.container}>
      <Header
        title="Attendance"
        subtitle={`${user?.district || 'My Area'}${user?.name ? ` • ${user.name}` : ''}`}
        showBack
        rightAction={
          <Button
            title="New Shift"
            size="sm"
            variant="primary"
            icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
            onPress={() => router.push('/(seller)/attendance' as any)}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 125) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.green.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Metric Cards */}
          {loading ? (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="On Duty Now"
                    value={String(metrics.activeCount)}
                    subtitle="Working today"
                    icon="navigate-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg="#DCFCE7"
                    accentColor={BrandColors.green.primary}
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Done Shifts"
                    value={String(metrics.completedCount)}
                    subtitle="Finished duties"
                    icon="checkmark-done-circle-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Shops Visited"
                    value={String(metrics.totalVisits)}
                    subtitle="Total shop stops"
                    icon="storefront-outline"
                    iconColor={BrandColors.pink.primary}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Distance"
                    value={`${metrics.totalDistance} km`}
                    subtitle="Total travel km"
                    icon="speedometer-outline"
                    iconColor="#F59E0B"
                    iconBg="#FEF3C7"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Period Filter Chips */}
          <View style={styles.filterChipRow}>
            <Pressable
              onPress={() => setPeriodFilter('all')}
              style={[styles.filterChip, periodFilter === 'all' && styles.filterChipActive]}
              hitSlop={HitSlop.sm}
            >
              <Text
                style={[
                  styles.filterChipText,
                  periodFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPeriodFilter('today')}
              style={[styles.filterChip, periodFilter === 'today' && styles.filterChipActive]}
              hitSlop={HitSlop.sm}
            >
              <Text
                style={[
                  styles.filterChipText,
                  periodFilter === 'today' && styles.filterChipTextActive,
                ]}
              >
                Today
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPeriodFilter('month')}
              style={[styles.filterChip, periodFilter === 'month' && styles.filterChipActive]}
              hitSlop={HitSlop.sm}
            >
              <Text
                style={[
                  styles.filterChipText,
                  periodFilter === 'month' && styles.filterChipTextActive,
                ]}
              >
                This Month
              </Text>
            </Pressable>
          </View>

          {/* Status Segmented Control */}
          <View style={styles.statusSegment}>
            <Pressable
              onPress={() => setStatusFilter('ALL')}
              style={[styles.statusBtn, statusFilter === 'ALL' && styles.statusBtnActive]}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  statusFilter === 'ALL' && styles.statusBtnTextActive,
                ]}
              >
                All Shifts
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('ACTIVE')}
              style={[styles.statusBtn, statusFilter === 'ACTIVE' && styles.statusBtnActive]}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  statusFilter === 'ACTIVE' && styles.statusBtnTextActive,
                ]}
              >
                On Duty ({metrics.activeCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('COMPLETED')}
              style={[styles.statusBtn, statusFilter === 'COMPLETED' && styles.statusBtnActive]}
            >
              <Text
                style={[
                  styles.statusBtnText,
                  statusFilter === 'COMPLETED' && styles.statusBtnTextActive,
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
            <TextInput
              placeholder="Search seller name or phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholderTextColor={Colors.light.textTertiary}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={HitSlop.sm}>
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Shift List */}
          {loading ? (
            <View style={{ paddingVertical: Spacing.xl }}>
              <ActivityIndicator size="small" color={BrandColors.green.primary} />
            </View>
          ) : filteredShifts.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description="No shift records found for this filter."
              icon="calendar-outline"
              actionTitle="Start New Shift"
              onAction={() => router.push('/(seller)/attendance' as any)}
            />
          ) : (
            <View style={styles.shiftList}>
              {filteredShifts.map((shift) => {
                const isActive = shift.status === 'ACTIVE';
                const visitsCount = shift.visits?.length || 0;
                const isExpanded = Boolean(expandedShiftIds[shift.id]);
                const distInfo = computeShiftTravelDistance(shift);
                const startKmVal = shift.startOdometer ?? shift.startOdometerKm;
                const endKmVal = shift.endOdometer ?? shift.endOdometerKm;
                const distanceKm = distInfo.distanceKm > 0 || !isActive ? distInfo.distanceKm : null;

                return (
                  <Card key={shift.id} style={styles.shiftCard}>
                    {/* Shift Card Top Header */}
                    <View style={styles.shiftCardTop}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={styles.officerName}>
                          {shift.seller?.name || 'Field Officer'}
                        </Text>
                        <Text style={styles.officerMeta}>
                          {shift.seller?.employeeCode ? `Emp #${shift.seller.employeeCode} • ` : ''}
                          {formatDateIST(shift.startTime, 'medium')}
                        </Text>
                      </View>

                      <Badge
                        label={isActive ? 'ON DUTY' : 'COMPLETED'}
                        variant={isActive ? 'ACTIVE' : 'neutral'}
                      />
                    </View>

                    {/* Time & Duration Grid */}
                    <View style={styles.timeInfoBox}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>Shift Started</Text>
                        <Text style={styles.timeValue}>{formatTimeIST(shift.startTime)}</Text>
                      </View>

                      <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>Shift Ended</Text>
                        <Text style={styles.timeValue}>
                          {isActive ? 'In progress' : formatTimeIST(shift.endTime)}
                        </Text>
                      </View>

                      <View style={styles.timeCol}>
                        <Text style={styles.timeLabel}>Duration</Text>
                        <Text style={styles.timeValue}>
                          {formatMinutes(shift.durationMins)}
                        </Text>
                      </View>
                    </View>

                    {/* Travel & Verification Row */}
                    <View style={styles.odometerRow}>
                      <View style={styles.odometerItem}>
                        <Ionicons name="navigate-outline" size={16} color={BrandColors.green.dark} />
                        <Text style={styles.odometerText}>
                          Travel:{' '}
                          <Text style={{ fontWeight: '700' }}>
                            {distInfo.formatted}
                          </Text>
                          {startKmVal != null && endKmVal != null && endKmVal > startKmVal
                            ? ` (${startKmVal} → ${endKmVal} km)`
                            : ` (${distInfo.sourceLabel})`}
                        </Text>
                      </View>

                      {shift.startFaceVerified && (
                        <View style={styles.faceBadge}>
                          <Ionicons name="checkmark-circle" size={14} color={BrandColors.green.primary} />
                          <Text style={styles.faceBadgeText}>Face ID</Text>
                        </View>
                      )}
                    </View>

                    {/* Visits Accordion Header */}
                    <Pressable
                      onPress={() => toggleExpand(shift.id)}
                      style={styles.visitsToggleBtn}
                      hitSlop={HitSlop.sm}
                    >
                      <View style={styles.visitsCountRow}>
                        <Ionicons name="storefront-outline" size={16} color={BrandColors.pink.dark} />
                        <Text style={styles.visitsCountText}>
                          {visitsCount} Store {visitsCount === 1 ? 'Visit' : 'Visits'} Completed
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Colors.light.textTertiary}
                      />
                    </Pressable>

                    {/* Expanded Visits List */}
                    {isExpanded && (
                      <View style={styles.expandedVisitsList}>
                        {visitsCount === 0 ? (
                          <Text style={styles.noVisitsText}>No store visits recorded during this shift.</Text>
                        ) : (
                          shift.visits?.map((v, vIdx) => (
                            <View key={v.id || vIdx} style={styles.visitRow}>
                              <View style={styles.visitDot} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.visitShopName}>
                                  {v.customer?.shopName || v.shopName || 'Retail Customer'}
                                </Text>
                                <Text style={styles.visitTime}>
                                  Checked in: {formatTimeIST(v.checkInTime)}
                                  {v.durationMins ? ` • Duration: ${v.durationMins}m` : ''}
                                  {v.saleDone ? ' • 🛒 Sale Made' : ' • No Sale'}
                                </Text>
                                {Boolean(v.customerFeedback || v.notes || (v as any).feedback) && (
                                  <View style={styles.visitFeedbackRow}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={12} color="#0284C7" />
                                    <Text style={styles.visitFeedbackText}>
                                      {v.customerFeedback || v.notes || (v as any).feedback}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
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
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  kpiContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  kpiCardWrapper: {
    flex: 1,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: BrandColors.green.primary,
    borderColor: BrandColors.green.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  statusBtnActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: BrandColors.green.light,
  },
  statusBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  statusBtnTextActive: {
    color: BrandColors.green.dark,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    padding: 0,
  },
  shiftList: {
    gap: Spacing.md,
  },
  shiftCard: {
    padding: Spacing.md,
  },
  shiftCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  officerName: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  officerMeta: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  timeInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timeCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  timeValue: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  odometerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  odometerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  odometerText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  faceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  faceBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    color: BrandColors.green.dark,
    fontWeight: '700',
  },
  visitsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  visitsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visitsCountText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  expandedVisitsList: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: '#FCE7F3',
    gap: Spacing.xs,
  },
  noVisitsText: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    fontStyle: 'italic',
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  visitDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.primary,
    marginTop: 5,
  },
  visitShopName: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  visitTime: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  visitFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
  },
  visitFeedbackText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#0369A1',
    flex: 1,
  },
});
