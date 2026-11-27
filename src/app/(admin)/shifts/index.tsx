import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Shift, ShiftSummary, ShiftVisit } from '@/api/types';
import {
  AttendanceFilterButton,
  AttendanceFilterModal,
} from '@/components/common/AttendanceFilterModal';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { computeShiftTravelDistance, formatDurationHuman } from '@/utils/distanceUtils';
import {
  computeAttendanceKpiMetrics,
  getShiftDurationSeconds,
  getShiftFilterDateRange,
  type ShiftFilterState,
} from '@/utils/shiftFilterUtils';

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'Active now';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatISTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AdminShiftsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const handleBack = useCallback(() => {
    try {
      if (router.canGoBack()) { router.back(); } else { router.replace('/(admin)' as any); }
    } catch {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(admin)' as any);
      }
    }
  }, [navigation, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [serverSummary, setServerSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterState>({
    preset: 'today',
    status: 'ALL',
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  // Selected Shift for Details Modal
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const dateRangeInfo = useMemo(
    () => getShiftFilterDateRange(shiftFilter),
    [shiftFilter]
  );

  const fetchShifts = useCallback(async () => {
    try {
      const range = getShiftFilterDateRange(shiftFilter);
      const apiStatus =
        shiftFilter.status && shiftFilter.status !== 'ALL' ? shiftFilter.status : undefined;

      const res = await adminApi.listShifts({
        page: 1,
        pageSize: 200,
        status: apiStatus,
        from: range.from,
        to: range.to,
      });

      setShifts(res.items || []);
      setServerSummary(res.summary || null);
    } catch (err: any) {
      console.warn('Failed to load shifts', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shiftFilter]);

  useEffect(() => {
    setLoading(true);
    fetchShifts();
  }, [fetchShifts]);

  useRealtimeSync(['SHIFT_UPDATE'], fetchShifts);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShifts();
  }, [fetchShifts]);

  const filteredShifts = useMemo(() => {
    if (!search.trim()) return shifts;
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      const sellerName = (s.seller?.name || '').toLowerCase();
      const phone = (s.seller?.phone || '').toLowerCase();
      const territory = (s.territory || '').toLowerCase();
      return sellerName.includes(q) || phone.includes(q) || territory.includes(q);
    });
  }, [shifts, search]);

  const kpiMetrics = useMemo(
    () => computeAttendanceKpiMetrics(filteredShifts, serverSummary, Boolean(search.trim())),
    [filteredShifts, serverSummary, search]
  );

  const hasActiveNonDefaultFilter =
    shiftFilter.preset !== 'today' || (shiftFilter.status && shiftFilter.status !== 'ALL');

  const renderShiftItem = ({ item }: { item: Shift }) => {
    const isOpen = item.status === 'OPEN' || item.status === 'ACTIVE';
    const sellerName = item.seller?.name || 'Field Officer';
    const visitsCount = item.visits?.length ?? item.timing?.visitCount ?? 0;
    const durationSecs = getShiftDurationSeconds(item);
    const duration = isOpen
      ? durationSecs > 0
        ? `${formatDurationHuman(durationSecs)} (Live)`
        : 'Active now'
      : durationSecs > 0
        ? formatDurationHuman(durationSecs)
        : formatMinutes(item.durationMins);
    const startKm = item.startOdometer ?? item.startOdometerKm;
    const distInfo = computeShiftTravelDistance(item);
    const distanceKm = distInfo.distanceKm > 0 ? distInfo.formatted : (isOpen ? null : '0 km');

    return (
      <Card style={styles.shiftCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.sellerName}>{sellerName}</Text>
            <Text style={styles.shiftMeta}>
              {item.seller?.phone ? `${item.seller.phone} • ` : ''}
              Started: {formatISTDateTime(item.startTime || item.startedAt)}
            </Text>
          </View>
          <Badge
            label={isOpen ? 'ON DUTY' : 'COMPLETED'}
            variant={isOpen ? 'ACTIVE' : 'info'}
            size="sm"
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{duration}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="storefront-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Store Visits</Text>
            <Text style={styles.statValue}>{visitsCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="speedometer-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Odometer</Text>
            <Text style={styles.statValue}>{distanceKm ? distanceKm : startKm ? `${startKm} km` : '—'}</Text>
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          {item.endTime || item.endedAt ? (
            <Text style={styles.endedText}>
              Ended: {formatISTDateTime(item.endTime || item.endedAt)}
            </Text>
          ) : (
            <Text style={[styles.endedText, { color: BrandColors.green.primary, fontWeight: '700' }]}>
              Currently in the field
            </Text>
          )}

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedShift(item)}
            accessibilityRole="button"
            accessibilityLabel={`View GPS visits for ${sellerName}`}
          >
            <Ionicons name="map-outline" size={14} color="#0F172A" />
            <Text style={styles.detailsBtnText}>GPS Audit ({visitsCount})</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="National Shift Audit"
        subtitle="Real-time attendance, odometer logs and GPS visit trails"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to administrative actions"
            onPress={handleBack}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
      />

      <View style={styles.filterSection}>
        <View style={styles.searchFilterRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Search officer, phone or area..."
              value={search}
              onChangeText={setSearch}
              containerStyle={{ marginBottom: 0 }}
              leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
            />
          </View>
          <AttendanceFilterButton
            onPress={() => setFilterModalVisible(true)}
            hasActiveFilter={Boolean(hasActiveNonDefaultFilter)}
            accentColor={BrandColors.pink.dark}
            accessibilityLabel="Open shift date and status filter"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingPadding}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={(item) => item.id}
          renderItem={renderShiftItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.pink.dark]}
            />
          }
          ListHeaderComponent={
            <View style={styles.kpiWrapper}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiSectionTitle}>
                  Attendance KPIs · {dateRangeInfo.label}
                </Text>
                <Badge
                  label={`${kpiMetrics.totalShifts} ${kpiMetrics.totalShifts === 1 ? 'shift' : 'shifts'}`}
                  variant="neutral"
                  size="sm"
                />
              </View>
              <View style={styles.kpiGridRow}>
                <View style={styles.kpiGridCol}>
                  <StatCard
                    title="Shops Visited"
                    value={kpiMetrics.shopsVisited}
                    subtitle={`${kpiMetrics.salesDoneVisits} with sale`}
                    icon="storefront-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>
                <View style={styles.kpiGridCol}>
                  <StatCard
                    title="Total KM"
                    value={kpiMetrics.totalDistanceLabel}
                    subtitle="Field travel distance"
                    icon="speedometer-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                  />
                </View>
              </View>
              <View style={styles.kpiGridRow}>
                <View style={styles.kpiGridCol}>
                  <StatCard
                    title="Total Time"
                    value={kpiMetrics.totalTimeLabel}
                    subtitle="Combined duty hours"
                    icon="time-outline"
                    iconColor={BrandColors.pink.dark}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>
                <View style={styles.kpiGridCol}>
                  <StatCard
                    title="Completed"
                    value={`${kpiMetrics.completedShifts} / ${kpiMetrics.totalShifts}`}
                    subtitle={`${kpiMetrics.activeShifts} active now`}
                    icon="checkmark-done-circle-outline"
                    iconColor="#D97706"
                    iconBg="#FFFBEB"
                  />
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No Shifts Found"
              description={
                search
                  ? 'No shift records match your search criteria.'
                  : `No shifts recorded for ${dateRangeInfo.label}.`
              }
            />
          }
        />
      )}

      <AttendanceFilterModal
        visible={filterModalVisible}
        value={shiftFilter}
        onApply={setShiftFilter}
        onClose={() => setFilterModalVisible(false)}
        accentColor={BrandColors.pink.dark}
        showStatusFilter
        defaultPreset="today"
      />

      {/* GPS Visits Audit Modal */}
      <Modal
        visible={selectedShift !== null}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setSelectedShift(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Shift GPS Audit Trail</Text>
                <Text style={styles.modalSub}>
                  {selectedShift?.seller?.name || 'Field Officer'} •{' '}
                  {formatISTDateTime(selectedShift?.startTime || selectedShift?.startedAt)}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedShift(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Odometer Card */}
              <Card style={styles.modalAuditCard}>
                <Text style={styles.auditCardTitle}>Odometer Verification</Text>
                <View style={styles.odometerGrid}>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>Start Reading</Text>
                    <Text style={styles.odometerVal}>{selectedShift?.startOdometer ?? selectedShift?.startOdometerKm ?? '—'} km</Text>
                  </View>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>End Reading</Text>
                    <Text style={styles.odometerVal}>{selectedShift?.endOdometer ?? selectedShift?.endOdometerKm ?? '—'} km</Text>
                  </View>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>Net Travel</Text>
                    <Text style={[styles.odometerVal, { color: BrandColors.pink.dark }]}>
                      {selectedShift ? computeShiftTravelDistance(selectedShift).formatted : '—'}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Visits List */}
              <Text style={styles.visitsSectionHeading}>
                Store Visits ({selectedShift?.visits?.length || 0})
              </Text>
              {selectedShift?.visits && selectedShift.visits.length > 0 ? (
                selectedShift.visits.map((v: ShiftVisit, idx: number) => (
                  <View key={v.id || idx} style={styles.visitItem}>
                    <View style={styles.visitIndexBadge}>
                      <Text style={styles.visitIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitShopName}>
                        {v.customer?.shopName || (v as any).shopName || 'Retail Customer'}
                      </Text>
                      <Text style={styles.visitTime}>
                        {formatISTDateTime(v.checkInTime || (v as any).createdAt)}
                      </Text>

                      {v.visitReason ? (
                        <View style={styles.visitReasonBadge}>
                          <Text style={styles.visitReasonText}>{v.visitReason}</Text>
                        </View>
                      ) : null}

                      {(v.customerFeedback || v.notes || (v as any).feedback) ? (
                        <View style={styles.visitFeedbackBox}>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#0284C7" />
                          <View style={{ flex: 1, marginLeft: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1', marginBottom: 2 }}>
                              Feedback & Notes
                            </Text>
                            <Text style={styles.visitFeedbackText}>
                              {v.customerFeedback || v.notes || (v as any).feedback}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {v.latitude && v.longitude ? (
                        <View style={styles.visitGpsRow}>
                          <Ionicons name="location-outline" size={12} color="#0284C7" />
                          <Text style={styles.visitGpsText}>
                            GPS: {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                            {v.accuracy ? ` (±${Math.round(v.accuracy)}m)` : ''}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.visitGpsMuted}>No GPS coordinates recorded</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyVisitsText}>No store visits recorded for this shift.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  filterSection: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  kpiWrapper: {
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiSectionTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiGridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  kpiGridCol: {
    flex: 1,
  },
  loadingPadding: {
    padding: Spacing.md,
    gap: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  shiftCard: {
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sellerName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  shiftMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statValue: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  endedText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  detailsBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  modalAuditCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  auditCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  odometerGrid: {
    flexDirection: 'row',
  },
  odometerCol: {
    flex: 1,
    alignItems: 'center',
  },
  odometerLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  odometerVal: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  visitsSectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  visitItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  visitIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  visitIndexText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitShopName: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  visitTime: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  visitReasonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: BorderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  visitReasonText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  visitFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: '#FAF8F5',
    padding: 6,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  visitFeedbackText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.text,
    flex: 1,
  },
  visitGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visitGpsText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  visitGpsMuted: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyVisitsText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
  },
});
