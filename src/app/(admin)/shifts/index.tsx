import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminApi } from '@/api/admin';
import {
  AttendanceFilterButton,
  AttendanceFilterModal,
} from '@/components/common/AttendanceFilterModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { Shift, ShiftSummary, ShiftVisit } from '@/api/types';
import {
  calculateLegDistanceKm,
  computeShiftTimingSummary,
  computeShiftTravelDistance,
  formatDurationHuman,
  getVisitDurationSeconds,
} from '@/utils/distanceUtils';
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

function formatISTTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatISTDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatCoordPair(lat: unknown, lng: unknown): string | null {
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || (nLat === 0 && nLng === 0)) {
    return null;
  }
  return `${nLat.toFixed(5)}, ${nLng.toFixed(5)}`;
}

export default function AdminShiftsScreen() {
  const insets = useSafeAreaInsets();
  const handleBack = useDashboardBackHandler('/(admin)');

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
      const empCode = (s.seller?.employeeCode || '').toLowerCase();
      const phone = (s.seller?.phone || '').toLowerCase();
      const area = [s.seller?.district, s.seller?.state, s.territory].filter(Boolean).join(' ').toLowerCase();
      const addresses = `${s.startAddress || ''} ${s.endAddress || ''}`.toLowerCase();
      const shopMatch = (s.visits || []).some((v) =>
        (v.customer?.shopName || v.shopName || '').toLowerCase().includes(q)
      );
      return (
        sellerName.includes(q) ||
        empCode.includes(q) ||
        phone.includes(q) ||
        area.includes(q) ||
        addresses.includes(q) ||
        shopMatch
      );
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
    const sellerArea =
      [item.seller?.district, item.seller?.state].filter(Boolean).join(', ') || item.territory || '';
    const visitsList = Array.isArray(item.visits) ? item.visits : [];
    const visitsCount = visitsList.length || item.timing?.visitCount || 0;
    const salesVisitsCount = visitsList.filter(
      (v) => Boolean(v.saleDone || (v as any).sale_done || v.saleId)
    ).length;

    const durationSecs = getShiftDurationSeconds(item);
    const duration = isOpen
      ? durationSecs > 0
        ? `${formatDurationHuman(durationSecs)} (Live)`
        : 'Active now'
      : durationSecs > 0
        ? formatDurationHuman(durationSecs)
        : formatMinutes(item.durationMins);

    const startKmVal = item.startOdometer ?? item.startOdometerKm;
    const endKmVal = item.endOdometer ?? item.endOdometerKm;
    const hasOdometerReading =
      startKmVal != null &&
      endKmVal != null &&
      Number(endKmVal) > Number(startKmVal);

    const distInfo = computeShiftTravelDistance(item);
    const startIso = item.startTime || item.startedAt;
    const endIso = item.endTime || item.endedAt;

    return (
      <Pressable
        onPress={() => setSelectedShift(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open shift details for ${sellerName}`}
      >
        <Card style={styles.shiftCard}>
          {/* Header Row */}
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <View style={styles.sellerTitleRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {sellerName}
                </Text>
                {item.startFaceVerified ? (
                  <View style={styles.faceVerifiedChip}>
                    <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                    <Text style={styles.faceVerifiedText}>Face ID</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.shiftMeta} numberOfLines={2}>
                {[
                  item.seller?.employeeCode ? `Emp #${item.seller.employeeCode}` : null,
                  item.seller?.phone || null,
                  sellerArea || null,
                  formatISTDate(startIso),
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
            </View>
            <Badge
              label={isOpen ? 'ON DUTY' : 'COMPLETED'}
              variant={isOpen ? 'ACTIVE' : 'info'}
              size="sm"
            />
          </View>

          {/* Time & Duration Breakdown */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Started</Text>
              <Text style={styles.statValue}>{formatISTTime(startIso)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Ended</Text>
              <Text style={[styles.statValue, isOpen && { color: BrandColors.green.primary }]}>
                {isOpen ? 'In progress' : formatISTTime(endIso)}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Duration</Text>
              <Text style={styles.statValue}>{duration}</Text>
            </View>
          </View>

          {/* Route Distance & Start/End Address Details */}
          <View style={styles.routeSummaryBox}>
            <View style={styles.routeSummaryRow}>
              <Ionicons name="navigate-outline" size={14} color={BrandColors.pink.dark} />
              <Text style={styles.routeSummaryText} numberOfLines={1}>
                Travel: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{distInfo.formatted}</Text>
                {hasOdometerReading
                  ? ` (${startKmVal} → ${endKmVal} km)`
                  : ` (${distInfo.sourceLabel})`}
              </Text>
            </View>

            {item.startAddress ? (
              <View style={styles.addressLineRow}>
                <View style={[styles.addressDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.addressLineText} numberOfLines={1}>
                  Start: {item.startAddress}
                </Text>
              </View>
            ) : null}

            {!isOpen && item.endAddress ? (
              <View style={styles.addressLineRow}>
                <View style={[styles.addressDot, { backgroundColor: '#0F172A' }]} />
                <Text style={styles.addressLineText} numberOfLines={1}>
                  End: {item.endAddress}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Footer Row */}
          <View style={styles.cardFooterRow}>
            <View style={styles.footerStatsPills}>
              <View style={styles.visitsChip}>
                <Ionicons name="storefront-outline" size={12} color="#334155" />
                <Text style={styles.visitsChipText}>
                  {visitsCount} {visitsCount === 1 ? 'Visit' : 'Visits'}
                </Text>
              </View>
              {salesVisitsCount > 0 ? (
                <View style={styles.salesChip}>
                  <Ionicons name="cart-outline" size={12} color="#15803D" />
                  <Text style={styles.salesChipText}>
                    {salesVisitsCount} {salesVisitsCount === 1 ? 'Sale' : 'Sales'}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailsBtn}>
              <Ionicons name="map-outline" size={14} color={BrandColors.pink.dark} />
              <Text style={styles.detailsBtnText}>View Details</Text>
              <Ionicons name="chevron-forward" size={13} color={BrandColors.pink.dark} />
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Employee Attendance"
        subtitle="Daily Shift Audit, route travel & store visit timeline"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
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
              placeholder="Search officer, phone, area or shop..."
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

      {/* Full Shift Details & GPS Visit Audit Modal */}
      <Modal
        visible={selectedShift !== null}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setSelectedShift(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedShift(null)} />
          <View
            style={[
              styles.modalContainer,
              { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.lg) },
            ]}
          >
            {(() => {
              if (!selectedShift) return null;
              const isModalOpen = selectedShift.status === 'OPEN' || selectedShift.status === 'ACTIVE';
              const summary = computeShiftTimingSummary(selectedShift);
              const distInfo = computeShiftTravelDistance(selectedShift);
              const modalVisits = Array.isArray(selectedShift.visits) ? selectedShift.visits : [];
              const startKm = selectedShift.startOdometer ?? selectedShift.startOdometerKm;
              const endKm = selectedShift.endOdometer ?? selectedShift.endOdometerKm;
              const hasOdometer =
                startKm != null && endKm != null && (Number(startKm) > 0 || Number(endKm) > 0);
              const startCoords = formatCoordPair(selectedShift.startLatitude, selectedShift.startLongitude);
              const endCoords = formatCoordPair(selectedShift.endLatitude, selectedShift.endLongitude);
              const sellerArea = [
                selectedShift.seller?.district,
                selectedShift.seller?.state,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <View style={styles.modalTitleRow}>
                        <Text style={styles.modalTitle} numberOfLines={1}>
                          {selectedShift.seller?.name || 'Field Officer'}
                        </Text>
                        <Badge
                          label={isModalOpen ? 'ON DUTY' : 'COMPLETED'}
                          variant={isModalOpen ? 'ACTIVE' : 'info'}
                          size="sm"
                        />
                      </View>
                      <Text style={styles.modalSub} numberOfLines={2}>
                        {[
                          selectedShift.seller?.employeeCode ? `Emp #${selectedShift.seller.employeeCode}` : null,
                          selectedShift.seller?.phone || null,
                          sellerArea || null,
                        ]
                          .filter(Boolean)
                          .join(' • ') || formatISTDateTime(selectedShift.startTime || selectedShift.startedAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedShift(null)}
                      hitSlop={HitSlop.md}
                      style={styles.modalCloseBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close shift details"
                    >
                      <Ionicons name="close" size={22} color={Colors.light.text} />
                    </Pressable>
                  </View>

                  <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                    {/* Verification Pills */}
                    <View style={styles.verificationStrip}>
                      <View style={styles.verifyPill}>
                        <Ionicons
                          name={selectedShift.startFaceVerified ? 'checkmark-circle' : 'alert-circle-outline'}
                          size={14}
                          color={selectedShift.startFaceVerified ? '#16A34A' : '#D97706'}
                        />
                        <Text style={styles.verifyPillText}>
                          Start Selfie: {selectedShift.startFaceVerified ? 'Verified' : 'Unverified'}
                        </Text>
                      </View>
                      {!isModalOpen ? (
                        <View style={styles.verifyPill}>
                          <Ionicons
                            name={selectedShift.endFaceVerified ? 'checkmark-circle' : 'alert-circle-outline'}
                            size={14}
                            color={selectedShift.endFaceVerified ? '#16A34A' : '#64748B'}
                          />
                          <Text style={styles.verifyPillText}>
                            End Selfie: {selectedShift.endFaceVerified ? 'Verified' : 'Not recorded'}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.verifyPill}>
                        <Ionicons name="navigate-circle-outline" size={14} color="#0284C7" />
                        <Text style={styles.verifyPillText}>{distInfo.sourceLabel}</Text>
                      </View>
                    </View>

                    {/* 4-Column Time & Route Summary */}
                    <Card style={styles.modalAuditCard}>
                      <Text style={styles.auditCardTitle}>Duty Time & Travel Summary</Text>
                      <View style={styles.odometerGrid}>
                        <View style={styles.odometerCol}>
                          <Text style={styles.odometerLabel}>Total Time</Text>
                          <Text style={styles.odometerVal}>{summary.formattedTotal}</Text>
                        </View>
                        <View style={styles.odometerCol}>
                          <Text style={styles.odometerLabel}>At Shops</Text>
                          <Text style={[styles.odometerVal, { color: '#16A34A' }]}>
                            {summary.formattedAtShops}
                          </Text>
                        </View>
                        <View style={styles.odometerCol}>
                          <Text style={styles.odometerLabel}>Travel Time</Text>
                          <Text style={[styles.odometerVal, { color: '#D97706' }]}>
                            {summary.formattedTravel}
                          </Text>
                        </View>
                        <View style={styles.odometerCol}>
                          <Text style={styles.odometerLabel}>Distance</Text>
                          <Text style={[styles.odometerVal, { color: BrandColors.pink.dark }]}>
                            {distInfo.formatted}
                          </Text>
                        </View>
                      </View>
                    </Card>

                    {/* Odometer Card (shown only when manual odometer readings exist) */}
                    {hasOdometer ? (
                      <Card style={styles.modalAuditCard}>
                        <Text style={styles.auditCardTitle}>Odometer Readings</Text>
                        <View style={styles.odometerGrid}>
                          <View style={styles.odometerCol}>
                            <Text style={styles.odometerLabel}>Start Reading</Text>
                            <Text style={styles.odometerVal}>{startKm ?? '—'} km</Text>
                          </View>
                          <View style={styles.odometerCol}>
                            <Text style={styles.odometerLabel}>End Reading</Text>
                            <Text style={styles.odometerVal}>{endKm ?? '—'} km</Text>
                          </View>
                        </View>
                      </Card>
                    ) : null}

                    {/* Shift Notes */}
                    {selectedShift.notes ? (
                      <View style={styles.shiftNoteBanner}>
                        <Ionicons name="document-text-outline" size={15} color="#475569" />
                        <Text style={styles.shiftNoteText}>{selectedShift.notes}</Text>
                      </View>
                    ) : null}

                    {/* Chronological Timeline: Start -> Visits -> End */}
                    <Text style={styles.visitsSectionHeading}>
                      Duty Timeline & Store Visits ({modalVisits.length})
                    </Text>

                    {/* Start Shift Timeline Row */}
                    <View style={styles.timelineRow}>
                      <View style={[styles.timelineDot, { backgroundColor: '#16A34A' }]}>
                        <Text style={styles.timelineDotText}>S</Text>
                      </View>
                      <View style={styles.timelineBody}>
                        <View style={styles.timelineHeaderRow}>
                          <Text style={styles.visitShopName}>Shift Started</Text>
                          <Text style={styles.timelineTime}>
                            {formatISTDateTime(selectedShift.startTime || selectedShift.startedAt)}
                          </Text>
                        </View>
                        {selectedShift.startAddress ? (
                          <Text style={styles.timelineAddress}>{selectedShift.startAddress}</Text>
                        ) : null}
                        {startCoords ? (
                          <View style={styles.visitGpsRow}>
                            <Ionicons name="location-outline" size={12} color="#0284C7" />
                            <Text style={styles.visitGpsText}>GPS: {startCoords}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Store Visits */}
                    {modalVisits.length > 0 ? (
                      modalVisits.map((v: ShiftVisit, idx: number, arr) => {
                        const hasSale = Boolean(v.saleDone || (v as any).sale_done || v.saleId);
                        const isVisitActive = !v.checkOutTime;
                        const visitSecs = getVisitDurationSeconds(v);
                        const visitDurationLabel =
                          visitSecs > 0
                            ? formatDurationHuman(visitSecs)
                            : v.durationMins
                              ? formatMinutes(v.durationMins)
                              : isVisitActive
                                ? 'Live'
                                : '—';
                        const vCoords = formatCoordPair(v.latitude, v.longitude);
                        const prevLat = idx === 0 ? selectedShift.startLatitude : arr[idx - 1]?.latitude;
                        const prevLng = idx === 0 ? selectedShift.startLongitude : arr[idx - 1]?.longitude;
                        const legKm =
                          prevLat != null && prevLng != null && v.latitude != null && v.longitude != null
                            ? calculateLegDistanceKm(
                                { lat: Number(prevLat), lng: Number(prevLng) },
                                { lat: Number(v.latitude), lng: Number(v.longitude) }
                              )
                            : 0;

                        const customerLoc = [
                          v.customer?.address,
                          v.customer?.village,
                          v.customer?.district,
                        ]
                          .filter(Boolean)
                          .join(', ');
                        const feedbackText =
                          v.customerFeedback || v.sale?.customerFeedback || v.notes || v.feedback;

                        return (
                          <View key={v.id || idx} style={styles.timelineRow}>
                            <View style={[styles.timelineDot, { backgroundColor: BrandColors.pink.dark }]}>
                              <Text style={styles.timelineDotText}>{idx + 1}</Text>
                            </View>
                            <View style={styles.visitCard}>
                              <View style={styles.timelineHeaderRow}>
                                <Text style={[styles.visitShopName, { flex: 1, marginRight: 8 }]} numberOfLines={2}>
                                  {v.customer?.shopName || v.shopName || 'Retail Customer'}
                                </Text>
                                <Badge
                                  label={hasSale ? 'Sale Done' : isVisitActive ? 'Active' : 'No Sale'}
                                  variant={hasSale ? 'ACTIVE' : isVisitActive ? 'warning' : 'neutral'}
                                  size="sm"
                                />
                              </View>

                              {v.customer?.phone || customerLoc ? (
                                <Text style={styles.visitCustomerSub} numberOfLines={2}>
                                  {[v.customer?.phone, customerLoc].filter(Boolean).join(' • ')}
                                </Text>
                              ) : null}

                              <View style={styles.visitTimeRow}>
                                <Text style={styles.visitTimeChip}>
                                  IN: {formatISTTime(v.checkInTime || v.createdAt)}
                                </Text>
                                <Text style={styles.visitTimeChip}>
                                  OUT: {v.checkOutTime ? formatISTTime(v.checkOutTime) : 'Active'}
                                </Text>
                                <Text style={[styles.visitTimeChip, { color: '#15803D', fontWeight: '700' }]}>
                                  Stay: {visitDurationLabel}
                                </Text>
                              </View>

                              {v.sale ? (
                                <View style={styles.saleInfoBox}>
                                  <Ionicons name="cart" size={14} color="#15803D" />
                                  <Text style={styles.saleInfoText}>
                                    ₹{((v.sale.totalPaise || 0) / 100).toLocaleString('en-IN')} •{' '}
                                    {v.sale.quantity} pkts • {v.sale.paymentMode} ({v.sale.status})
                                  </Text>
                                </View>
                              ) : null}

                              {legKm > 0 ? (
                                <Text style={styles.legDistanceText}>
                                  Route leg: ~{legKm} km from {idx === 0 ? 'start location' : 'previous stop'}
                                </Text>
                              ) : null}

                              {v.visitReason ? (
                                <View style={styles.visitReasonBadge}>
                                  <Text style={styles.visitReasonText}>{v.visitReason}</Text>
                                </View>
                              ) : null}

                              {feedbackText ? (
                                <View style={styles.visitFeedbackBox}>
                                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#0284C7" />
                                  <View style={{ flex: 1, marginLeft: 6 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369A1', marginBottom: 2 }}>
                                      Feedback & Notes
                                    </Text>
                                    <Text style={styles.visitFeedbackText}>{feedbackText}</Text>
                                  </View>
                                </View>
                              ) : null}

                              {vCoords ? (
                                <View style={styles.visitGpsRow}>
                                  <Ionicons name="location-outline" size={12} color="#0284C7" />
                                  <Text style={styles.visitGpsText}>
                                    GPS: {vCoords}
                                    {v.accuracy ? ` (±${Math.round(v.accuracy)}m)` : ''}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={styles.visitGpsMuted}>No GPS coordinates recorded</Text>
                              )}
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyVisitsText}>No store visits recorded during this shift.</Text>
                    )}

                    {/* End Shift Timeline Row */}
                    <View style={[styles.timelineRow, { borderBottomWidth: 0 }]}>
                      <View style={[styles.timelineDot, { backgroundColor: '#0F172A' }]}>
                        <Text style={styles.timelineDotText}>E</Text>
                      </View>
                      <View style={styles.timelineBody}>
                        <View style={styles.timelineHeaderRow}>
                          <Text style={styles.visitShopName}>
                            {isModalOpen ? 'Currently On Duty' : 'Shift Ended'}
                          </Text>
                          <Text style={styles.timelineTime}>
                            {isModalOpen
                              ? 'Active'
                              : formatISTDateTime(selectedShift.endTime || selectedShift.endedAt)}
                          </Text>
                        </View>
                        {!isModalOpen && selectedShift.endAddress ? (
                          <Text style={styles.timelineAddress}>{selectedShift.endAddress}</Text>
                        ) : null}
                        {!isModalOpen && endCoords ? (
                          <View style={styles.visitGpsRow}>
                            <Ionicons name="location-outline" size={12} color="#0284C7" />
                            <Text style={styles.visitGpsText}>GPS: {endCoords}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </ScrollView>

                  <View style={styles.modalFooterBar}>
                    <Text style={styles.modalFooterSummary}>
                      Total Route:{' '}
                      <Text style={{ color: BrandColors.pink.dark, fontWeight: '800' }}>
                        {distInfo.formatted}
                      </Text>
                    </Text>
                    <Button
                      title="Close"
                      variant="outline"
                      size="sm"
                      onPress={() => setSelectedShift(null)}
                    />
                  </View>
                </>
              );
            })()}
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
  sellerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sellerName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  faceVerifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  faceVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  shiftMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
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
  },
  statValue: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  routeSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    gap: 4,
  },
  routeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeSummaryText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  addressLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  addressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addressLineText: {
    fontSize: 11.5,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerStatsPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visitsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  visitsChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  salesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  salesChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  detailsBtnText: {
    ...Typography.caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
    marginTop: 3,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  verificationStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifyPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  modalAuditCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  auditCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
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
  shiftNoteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  shiftNoteText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  visitsSectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineDotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timelineBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  timelineAddress: {
    fontSize: 12,
    color: '#334155',
    marginTop: 3,
    lineHeight: 17,
  },
  visitCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: 4,
  },
  visitShopName: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  visitCustomerSub: {
    fontSize: 11.5,
    color: Colors.light.textSecondary,
  },
  visitTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  visitTimeChip: {
    fontSize: 11,
    color: '#334155',
  },
  saleInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  saleInfoText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  legDistanceText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  visitReasonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: BorderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 2,
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
    marginTop: 2,
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
    marginTop: 2,
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
    marginTop: 2,
  },
  emptyVisitsText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
    paddingLeft: 32,
  },
  modalFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  modalFooterSummary: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});
