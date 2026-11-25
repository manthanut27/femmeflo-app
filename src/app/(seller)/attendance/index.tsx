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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { Shift } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { computeShiftTravelDistance } from '@/utils/distanceUtils';

export default function SellerAttendanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});

  const loadAttendance = useCallback(async () => {
    try {
      const [historyRes, curRes] = await Promise.all([
        sellerApi.getShiftHistory({ pageSize: 50 }).catch(() => ({ items: [] })),
        sellerApi.getCurrentShift().catch(() => null),
      ]);
      setShifts(historyRes.items || []);
      const cur = (curRes as any)?.shift ?? (curRes as any)?.data?.shift ?? (curRes as any)?.data ?? curRes ?? null;
      const isCurActive = Boolean(cur && cur.startTime && !cur.endTime);
      setCurrentShift(isCurActive ? cur : null);
    } catch (err) {
      console.warn('Failed to load attendance history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useRealtimeSync(['SHIFT_UPDATE'], loadAttendance);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAttendance();
  }, [loadAttendance]);

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

  const isOnDutyToday = Boolean(currentShift && currentShift.startTime && !currentShift.endTime);

  const renderShiftItem = ({ item }: { item: Shift }) => {
    const isExpanded = Boolean(expandedShiftIds[item.id]);
    const distanceInfo = computeShiftTravelDistance(item);
    const visits = item.visits || [];
    const isActive = item.status === 'ACTIVE' || (!item.endTime && Boolean(item.startTime));

    const dateStr = new Date(item.startTime).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const startStr = new Date(item.startTime).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endStr = item.endTime
      ? new Date(item.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : 'Now';

    return (
      <Card style={[styles.shiftCard, isActive && styles.activeShiftCard]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={15} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
              <Text style={styles.shiftDate} numberOfLines={1}>
                {dateStr}
              </Text>
            </View>
            <Text style={styles.shiftTime} numberOfLines={1}>
              {startStr} → {endStr}
            </Text>
          </View>
          <Badge
            label={isActive ? 'ON DUTY' : 'DONE'}
            variant={isActive ? 'ACTIVE' : 'success'}
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>SHOPS</Text>
            <Text style={styles.metricValue}>{visits.length}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>DISTANCE</Text>
            <Text style={styles.metricValue}>{distanceInfo.formatted}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>CHECK-IN</Text>
            <Text style={[styles.metricValue, { color: BrandColors.green.primary }]}>
              ✓ Verified
            </Text>
          </View>
        </View>

        {visits.length > 0 ? (
          <View style={styles.visitsSection}>
            <Pressable
              onPress={() => toggleExpand(item.id)}
              style={styles.visitsToggleBtn}
              hitSlop={HitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? 'Hide shops' : 'Show shops'}
            >
              <Text style={styles.visitsToggleText}>
                {isExpanded ? 'Hide Shops' : `View ${visits.length} ${visits.length === 1 ? 'Shop' : 'Shops'}`}
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
                    <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.xs }}>
                      <Text style={styles.visitShopName} numberOfLines={1}>
                        {v.customer?.shopName || v.shopName || 'Shop'}
                      </Text>
                      <Text style={styles.visitTime}>
                        {new Date(v.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {v.checkOutTime
                          ? ` – ${new Date(v.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
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
        title="Attendance"
        subtitle={user?.name ? `${user.name} · Daily record` : 'Daily duty record'}
        rightAction={
          <Button
            title={isOnDutyToday ? 'Open Shift' : 'New Shift'}
            size="sm"
            variant="primary"
            icon={
              <Ionicons
                name={isOnDutyToday ? 'time-outline' : 'add'}
                size={16}
                color="#FFFFFF"
              />
            }
            onPress={() => router.push('/(seller)/shift' as any)}
          />
        }
      />

      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        renderItem={renderShiftItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom + 95, 125) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.primary]}
            tintColor={BrandColors.pink.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Summary KPIs */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <StatCard
                    title="Total Days"
                    value={metrics.totalCount}
                    icon="calendar-outline"
                    iconColor={BrandColors.pink.primary}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>
                <View style={styles.statCol}>
                  <StatCard
                    title="Completed"
                    value={metrics.completedCount}
                    icon="checkmark-circle-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <StatCard
                    title="Shops Visited"
                    value={metrics.totalVisits}
                    icon="storefront-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>
                <View style={styles.statCol}>
                  <StatCard
                    title="Distance"
                    value={`${metrics.totalKm} km`}
                    icon="navigate-outline"
                    iconColor="#D97706"
                    iconBg="#FFFBEB"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Attendance Log</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={BrandColors.pink.primary} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="calendar-outline"
                title="No attendance yet"
                description="Your daily duty attendance records will appear here."
                actionTitle="Start New Shift"
                onAction={() => router.push('/(seller)/shift' as any)}
              />
            </View>
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerContent: {
    marginBottom: Spacing.sm,
  },
  statsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCol: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.titleSmall,
    fontWeight: '800',
    color: Colors.light.heading,
    marginBottom: Spacing.xs,
  },
  shiftCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  activeShiftCard: {
    borderColor: BrandColors.green.primary,
    borderWidth: 1.5,
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
    marginBottom: 2,
  },
  shiftDate: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.heading,
    flexShrink: 1,
  },
  shiftTime: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.light.textPrimary,
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
    paddingVertical: 4,
  },
  visitsToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  visitsList: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  visitBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  visitBulletText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  visitShopName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  visitTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  loadingWrap: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: Spacing.xl,
  },
});
