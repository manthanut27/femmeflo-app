import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { SellerReportDailyRecord, SellerReportData, SellerReportPreset } from '@/api/types';
import { TargetProgressStrip } from '@/components/incentives/TargetProgressStrip';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
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
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { formatCurrencyINR, formatDateIST, formatTimeIST, getISTDateParts } from '@/utils/dateUtils';
import {
  formatReportDuration,
  formatShortDateKey,
  getSellerReportDateRange,
  SELLER_REPORT_PRESETS,
} from '@/utils/reportFilterUtils';
import { buildCalendarMonthCells } from '@/utils/shiftFilterUtils';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SellerReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const handleBack = useDashboardBackHandler('/(seller)');

  const nowParts = useMemo(() => getISTDateParts(new Date()), []);
  const [preset, setPreset] = useState<SellerReportPreset>('month');
  const [customFromDateKey, setCustomFromDateKey] = useState<string | undefined>(undefined);
  const [customToDateKey, setCustomToDateKey] = useState<string | undefined>(undefined);

  const [report, setReport] = useState<SellerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Custom Date Range Calendar Modal State
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [calYear, setCalYear] = useState(nowParts.year);
  const [calMonth, setCalMonth] = useState(nowParts.month);
  const [draftStartKey, setDraftStartKey] = useState<string | undefined>(undefined);
  const [draftEndKey, setDraftEndKey] = useState<string | undefined>(undefined);

  const activeRange = useMemo(
    () =>
      getSellerReportDateRange({
        preset,
        customFromDateKey,
        customToDateKey,
      }),
    [preset, customFromDateKey, customToDateKey]
  );

  const loadReport = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await sellerApi.getReport({
          from: activeRange.fromDateKey,
          to: activeRange.toDateKey,
        });
        setReport(res);
        setExpandedDates((prev) => {
          if (res.dailyRecords.length === 1) {
            return { ...prev, [res.dailyRecords[0].date]: true };
          }
          if (Object.keys(prev).length === 0 && res.dailyRecords.length > 0) {
            return { [res.dailyRecords[0].date]: true };
          }
          return prev;
        });
      } catch (err: any) {
        setError(err?.message || 'Unable to load activity report right now.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeRange.fromDateKey, activeRange.toDateKey]
  );

  useEffect(() => {
    loadReport(false);
  }, [loadReport]);

  useFocusEffect(
    useCallback(() => {
      loadReport(true);
    }, [loadReport])
  );

  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calYear, calMonth),
    [calYear, calMonth]
  );

  const canGoNextMonth =
    calYear < nowParts.year || (calYear === nowParts.year && calMonth < nowParts.month);

  function openRangePicker() {
    setDraftStartKey(customFromDateKey || activeRange.fromDateKey);
    setDraftEndKey(customToDateKey || activeRange.toDateKey);
    setCalYear(nowParts.year);
    setCalMonth(nowParts.month);
    setRangeModalOpen(true);
  }

  function handleCalendarDayPress(dateKey: string) {
    if (!draftStartKey || (draftStartKey && draftEndKey)) {
      setDraftStartKey(dateKey);
      setDraftEndKey(undefined);
      return;
    }
    if (dateKey < draftStartKey) {
      setDraftEndKey(draftStartKey);
      setDraftStartKey(dateKey);
    } else {
      setDraftEndKey(dateKey);
    }
  }

  function handleApplyCustomRange() {
    if (!draftStartKey) {
      setRangeModalOpen(false);
      return;
    }
    setCustomFromDateKey(draftStartKey);
    setCustomToDateKey(draftEndKey || draftStartKey);
    setPreset('custom_range');
    setRangeModalOpen(false);
  }

  function toggleDayExpanded(dateKey: string) {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  }

  function toggleExpandAll(days: SellerReportDailyRecord[]) {
    if (days.length === 0) return;
    const allOpen = days.every((d) => expandedDates[d.date]);
    const next: Record<string, boolean> = {};
    for (const d of days) {
      next[d.date] = !allOpen;
    }
    setExpandedDates(next);
  }

  async function handleShareSummary() {
    if (!report) return;
    const s = report.summary;
    const lines = [
      `FemmeFlo Seller Activity Report (${activeRange.label}: ${activeRange.subtitle})`,
      `Shops Visited: ${s.shopsVisited} (${s.salesDoneVisits} converted, ${s.conversionRatePercent}%)`,
      `Travel: ${s.totalDistanceKm} km • ${formatReportDuration(s.totalDurationSeconds)} (${s.shiftsCount} shifts)`,
      `Sales: ${formatCurrencyINR(s.totalSalesPaise)} (${s.totalPacketsSold} pkts, ${s.confirmedOrdersCount} orders)`,
      `Period Incentive Earned: ${formatCurrencyINR(s.netIncentivePaise)} (Base ${formatCurrencyINR(s.baseCommissionPaise)} + Bonus ${formatCurrencyINR(s.additionsPaise)})`,
      '',
      'Daily Breakdown:',
      ...report.dailyRecords
        .slice(0, 14)
        .map(
          (d) =>
            `${formatShortDateKey(d.date)}: ${d.shopsVisited} shops | ${d.travelKm} km | ${d.packetsSold} pkts | ${formatCurrencyINR(d.salesPaise)} | Earned ${formatCurrencyINR(d.netIncentivePaise)}`
        ),
    ];
    const message = lines.join('\n');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
      }
      await Share.share({
        title: `Seller Activity Report - ${activeRange.label}`,
        message,
      });
    } catch {
      // User dismissed share sheet
    }
  }

  const summary = report?.summary;
  const overview = report?.incentiveOverview;
  const dailyRecords = report?.dailyRecords || [];
  const allDaysExpanded =
    dailyRecords.length > 0 && dailyRecords.every((d) => Boolean(expandedDates[d.date]));

  return (
    <View style={styles.container}>
      <Header
        title="My Activity Report"
        subtitle={activeRange.subtitle}
        showBack
        onBack={handleBack}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              onPress={openRangePicker}
              hitSlop={HitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel="Select custom date range"
              style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="calendar-outline" size={19} color={BrandColors.pink.primary} />
            </Pressable>
            {report ? (
              <Pressable
                onPress={handleShareSummary}
                hitSlop={HitSlop.sm}
                accessibilityRole="button"
                accessibilityLabel="Share activity summary"
                style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="share-outline" size={19} color={BrandColors.pink.primary} />
              </Pressable>
            ) : null}
          </View>
        }
      />

      {/* Preset Filter Strip */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {SELLER_REPORT_PRESETS.map((item) => {
            const active = preset === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === 'custom_range') {
                    openRangePicker();
                  } else {
                    setPreset(item.id);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filter report by ${item.label}`}
                style={({ pressed }) => [
                  styles.filterPill,
                  active && styles.filterPillActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {item.id === 'custom_range' ? (
                  <Ionicons
                    name="calendar"
                    size={13}
                    color={active ? '#FFFFFF' : BrandColors.pink.primary}
                    style={{ marginRight: 4 }}
                  />
                ) : null}
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && !report ? (
        <View style={styles.centerContainer}>
          <LoadingState message="Loading your activity report..." color={BrandColors.pink.primary} />
        </View>
      ) : error && !report ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Could Not Load Report"
            description={error}
            actionTitle="Retry"
            onAction={() => loadReport(false)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadReport(true);
              }}
              colors={[BrandColors.pink.primary]}
            />
          }
        >
          <View style={styles.contentWrapper}>
            {/* Active Filter Context Bar */}
            <View style={styles.contextStrip}>
              <View style={styles.contextLeft}>
                <Ionicons name="time-outline" size={15} color={BrandColors.pink.primary} />
                <Text style={styles.contextText} numberOfLines={1}>
                  {activeRange.label} • {activeRange.subtitle}
                </Text>
              </View>
              {preset === 'custom_range' ? (
                <TouchableOpacity onPress={openRangePicker} hitSlop={HitSlop.sm}>
                  <Text style={styles.contextActionText}>Change</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.contextDaysText}>
                  {summary?.activeDays || 0} active {(summary?.activeDays || 0) === 1 ? 'day' : 'days'}
                </Text>
              )}
            </View>

            {/* Overall Activity KPIs */}
            <Text style={styles.sectionTitle}>OVERALL SUMMARY</Text>
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: BrandColors.pink.subtle }]}>
                  <Ionicons name="storefront-outline" size={18} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.kpiLabel}>Shops Visited</Text>
                <Text style={styles.kpiValue}>{summary?.shopsVisited ?? 0}</Text>
                <Text style={styles.kpiSub}>
                  {summary?.uniqueShopsVisited ?? 0} unique • {summary?.salesDoneVisits ?? 0} sold (
                  {summary?.conversionRatePercent ?? 0}%)
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: Colors.light.infoBg }]}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.light.info} />
                </View>
                <Text style={styles.kpiLabel}>Travel & Duty</Text>
                <Text style={styles.kpiValue}>{summary?.totalDistanceKm ?? 0} km</Text>
                <Text style={styles.kpiSub}>
                  {formatReportDuration(summary?.totalDurationSeconds ?? 0)} •{' '}
                  {summary?.shiftsCount ?? 0} shifts
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: BrandColors.green.surface }]}>
                  <Ionicons name="cart-outline" size={18} color={BrandColors.green.primary} />
                </View>
                <Text style={styles.kpiLabel}>Sales Revenue</Text>
                <Text style={[styles.kpiValue, { color: BrandColors.green.primary }]}>
                  {formatCurrencyINR(summary?.totalSalesPaise ?? 0)}
                </Text>
                <Text style={styles.kpiSub}>
                  {summary?.totalPacketsSold ?? 0} pkts • {summary?.confirmedOrdersCount ?? 0} confirmed
                </Text>
              </Card>

              <Card style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: BrandColors.accent.amberSurface }]}>
                  <Ionicons name="wallet-outline" size={18} color={BrandColors.accent.amber} />
                </View>
                <Text style={styles.kpiLabel}>Period Earnings</Text>
                <Text style={[styles.kpiValue, { color: BrandColors.pink.primary }]}>
                  {formatCurrencyINR(summary?.netIncentivePaise ?? 0)}
                </Text>
                <Text style={styles.kpiSub}>
                  Base {formatCurrencyINR(summary?.baseCommissionPaise ?? 0)}
                  {(summary?.additionsPaise ?? 0) > 0
                    ? ` + ${formatCurrencyINR(summary?.additionsPaise ?? 0)}`
                    : ''}
                </Text>
              </Card>
            </View>

            {/* Payment Split Row */}
            {(summary?.totalSalesPaise ?? 0) > 0 || (summary?.pendingOrdersCount ?? 0) > 0 ? (
              <Card variant="flat" style={styles.paymentSplitCard}>
                <View style={styles.paymentSplitRow}>
                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentLabel}>CASH</Text>
                    <Text style={[styles.paymentVal, { color: BrandColors.green.primary }]}>
                      {formatCurrencyINR(summary?.cashPaise ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.paymentDivider} />
                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentLabel}>BANK / UPI</Text>
                    <Text style={[styles.paymentVal, { color: Colors.light.info }]}>
                      {formatCurrencyINR(summary?.bankPaise ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.paymentDivider} />
                  <View style={styles.paymentCol}>
                    <Text style={styles.paymentLabel}>PAY LATER</Text>
                    <Text style={[styles.paymentVal, { color: BrandColors.accent.amber }]}>
                      {formatCurrencyINR(summary?.pendingPaise ?? 0)}
                    </Text>
                  </View>
                </View>
                {(summary?.pendingOrdersCount ?? 0) > 0 ? (
                  <View style={styles.pendingOrdersHint}>
                    <Ionicons name="hourglass-outline" size={13} color={BrandColors.accent.amber} />
                    <Text style={styles.pendingOrdersHintText}>
                      {summary?.pendingOrdersCount} price approval order(s) pending confirmation in this period
                    </Text>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Incentive & Target Overall Card */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>INCENTIVE & TARGET</Text>
              <TouchableOpacity
                onPress={() => router.push('/(seller)/incentives' as any)}
                hitSlop={HitSlop.sm}
              >
                <Text style={styles.viewLedgerLink}>Full Ledger ›</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.incentiveCard}>
              <View style={styles.incentiveTopRow}>
                <View>
                  <Text style={styles.incentiveHeadlineLabel}>Selected Period Commission</Text>
                  <Text style={styles.incentiveHeadlineVal}>
                    {formatCurrencyINR(summary?.netIncentivePaise ?? 0)}
                  </Text>
                </View>
                <Badge
                  label={`₹${((report?.ratePerPacketPaise ?? 100) / 100).toFixed(2)}/pkt`}
                  variant="info"
                  size="sm"
                />
              </View>

              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Packet Comm.</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrencyINR(summary?.baseCommissionPaise ?? 0)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Bonus / Add</Text>
                  <Text style={[styles.breakdownValue, { color: BrandColors.green.primary }]}>
                    +{formatCurrencyINR(summary?.additionsPaise ?? 0)}
                  </Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Deductions</Text>
                  <Text style={[styles.breakdownValue, { color: Colors.light.danger }]}>
                    -{formatCurrencyINR(summary?.deductionsPaise ?? 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.lifetimeRow}>
                <View style={styles.lifetimeCol}>
                  <Text style={styles.lifetimeLabel}>Lifetime Earned</Text>
                  <Text style={styles.lifetimeVal}>
                    {formatCurrencyINR(overview?.totalEarnedPaise ?? 0)}
                  </Text>
                </View>
                <View style={styles.lifetimeCol}>
                  <Text style={styles.lifetimeLabel}>Total Paid</Text>
                  <Text style={[styles.lifetimeVal, { color: BrandColors.green.primary }]}>
                    {formatCurrencyINR(overview?.totalPaidPaise ?? 0)}
                  </Text>
                </View>
                <View style={styles.lifetimeCol}>
                  <Text style={styles.lifetimeLabel}>Balance Due</Text>
                  <Text style={[styles.lifetimeVal, { color: BrandColors.pink.primary }]}>
                    {formatCurrencyINR(overview?.outstandingPaise ?? 0)}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: Spacing.sm }}>
                <TargetProgressStrip
                  targetProgress={report?.targetProgress}
                  ratePerPacketPaise={report?.ratePerPacketPaise ?? 100}
                  mode="compact"
                  showWhenUnset
                />
              </View>
            </Card>

            {/* Daily Record Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                DAILY RECORD ({dailyRecords.length}{' '}
                {dailyRecords.length === 1 ? 'DAY' : 'DAYS'})
              </Text>
              {dailyRecords.length > 1 ? (
                <TouchableOpacity
                  onPress={() => toggleExpandAll(dailyRecords)}
                  hitSlop={HitSlop.sm}
                >
                  <Text style={styles.viewLedgerLink}>
                    {allDaysExpanded ? 'Collapse All' : 'Expand All'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {dailyRecords.length === 0 ? (
              <EmptyState
                icon="calendar-clear-outline"
                title="No Daily Records Found"
                description={`No shifts, shop visits, or sales found for ${activeRange.label.toLowerCase()} (${activeRange.subtitle}).`}
                actionTitle="View All Time"
                onAction={() => setPreset('all')}
              />
            ) : (
              dailyRecords.map((day) => {
                const isExpanded = Boolean(expandedDates[day.date]);
                const dateLabel = formatDateIST(`${day.date}T00:00:00.000+05:30`, 'medium');

                return (
                  <Card key={day.date} style={styles.dayCard}>
                    <Pressable
                      onPress={() => toggleDayExpanded(day.date)}
                      accessibilityRole="button"
                      accessibilityLabel={`Toggle daily details for ${dateLabel}`}
                    >
                      <View style={styles.dayHeaderRow}>
                        <View style={styles.dayTitleGroup}>
                          <Text style={styles.dayDateText}>{dateLabel}</Text>
                          {day.activeShiftsCount > 0 ? (
                            <Badge label="On Duty" variant="success" size="sm" />
                          ) : null}
                        </View>
                        <View style={styles.dayHeaderRight}>
                          <Text style={styles.dayNetEarnText}>
                            {formatCurrencyINR(day.netIncentivePaise)} earned
                          </Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={Colors.light.textMuted}
                          />
                        </View>
                      </View>

                      <View style={styles.dayStatsRow}>
                        <View style={styles.dayStatCell}>
                          <Text style={styles.dayStatLabel}>Shops</Text>
                          <Text style={styles.dayStatValue}>{day.shopsVisited}</Text>
                          <Text style={styles.dayStatSub}>{day.salesDoneVisits} sold</Text>
                        </View>
                        <View style={styles.dayStatCell}>
                          <Text style={styles.dayStatLabel}>Travel</Text>
                          <Text style={styles.dayStatValue}>{day.travelKm} km</Text>
                          <Text style={styles.dayStatSub}>
                            {formatReportDuration(day.durationSeconds)}
                          </Text>
                        </View>
                        <View style={styles.dayStatCell}>
                          <Text style={styles.dayStatLabel}>Sales</Text>
                          <Text style={[styles.dayStatValue, { color: BrandColors.green.primary }]}>
                            {formatCurrencyINR(day.salesPaise)}
                          </Text>
                          <Text style={styles.dayStatSub}>
                            {day.packetsSold} pkts • {day.confirmedOrdersCount} ord
                          </Text>
                        </View>
                        <View style={styles.dayStatCell}>
                          <Text style={styles.dayStatLabel}>Incentive</Text>
                          <Text style={[styles.dayStatValue, { color: BrandColors.pink.primary }]}>
                            {formatCurrencyINR(day.netIncentivePaise)}
                          </Text>
                          <Text style={styles.dayStatSub}>
                            {day.additionsPaise > 0
                              ? `+${formatCurrencyINR(day.additionsPaise)} bonus`
                              : 'commission'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.dayDetailsWrap}>
                        {/* Shop Visits */}
                        <View style={styles.detailSubBlock}>
                          <Text style={styles.detailSubTitle}>
                            Shop Visits ({day.visits.length})
                          </Text>
                          {day.visits.length === 0 ? (
                            <Text style={styles.detailEmptyText}>
                              No shift check-ins logged on this date.
                            </Text>
                          ) : (
                            day.visits.map((v) => (
                              <View key={v.id} style={styles.detailItemRow}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemTitle} numberOfLines={1}>
                                    {v.shopName}
                                  </Text>
                                  <Text style={styles.detailItemSub}>
                                    In {formatTimeIST(v.checkInTime)}
                                    {v.checkOutTime
                                      ? ` → Out ${formatTimeIST(v.checkOutTime)}`
                                      : ' • Active check-in'}
                                    {v.durationMins != null
                                      ? ` (${Math.round(v.durationMins)}m)`
                                      : ''}
                                  </Text>
                                  {v.notes ? (
                                    <Text style={styles.detailItemNotes} numberOfLines={2}>
                                      {v.notes}
                                    </Text>
                                  ) : null}
                                </View>
                                <Badge
                                  label={v.saleDone ? 'Sale Done' : 'Visited'}
                                  variant={v.saleDone ? 'success' : 'neutral'}
                                  size="sm"
                                />
                              </View>
                            ))
                          )}
                        </View>

                        {/* Sales Orders */}
                        <View style={styles.detailSubBlock}>
                          <Text style={styles.detailSubTitle}>
                            Orders ({day.sales.length})
                          </Text>
                          {day.sales.length === 0 ? (
                            <Text style={styles.detailEmptyText}>
                              No orders billed on this date.
                            </Text>
                          ) : (
                            day.sales.map((order) => (
                              <Pressable
                                key={order.id}
                                onPress={() =>
                                  router.push(`/(seller)/sales/${order.id}` as any)
                                }
                                style={({ pressed }) => [
                                  styles.detailItemRow,
                                  pressed && { opacity: 0.7 },
                                ]}
                              >
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemTitle} numberOfLines={1}>
                                    {order.shopName}
                                  </Text>
                                  <Text style={styles.detailItemSub}>
                                    {formatTimeIST(order.createdAt)} • {order.quantity} pkts •{' '}
                                    {order.paymentMode}
                                  </Text>
                                </View>
                                <View style={styles.orderRightCol}>
                                  <Text style={styles.orderAmountText}>
                                    {formatCurrencyINR(order.totalPaise)}
                                  </Text>
                                  <Text style={styles.orderIncentiveText}>
                                    {order.status === 'CONFIRMED' || order.status === 'COMPLETED'
                                      ? `+${formatCurrencyINR(order.incentivePaise)} inc`
                                      : order.status === 'PENDING_APPROVAL'
                                        ? 'Pending'
                                        : 'Rejected'}
                                  </Text>
                                </View>
                              </Pressable>
                            ))
                          )}
                        </View>

                        {/* Day Adjustments / Bonuses */}
                        {day.adjustments.length > 0 ? (
                          <View style={styles.detailSubBlock}>
                            <Text style={styles.detailSubTitle}>Bonuses & Adjustments</Text>
                            {day.adjustments.map((adj) => (
                              <View key={adj.id} style={styles.detailItemRow}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemTitle}>{adj.reason}</Text>
                                </View>
                                <Text
                                  style={[
                                    styles.orderAmountText,
                                    {
                                      color:
                                        adj.type === 'ADD'
                                          ? BrandColors.green.primary
                                          : Colors.light.danger,
                                    },
                                  ]}
                                >
                                  {adj.type === 'ADD' ? '+' : '-'}
                                  {formatCurrencyINR(adj.amountPaise)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={rangeModalOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setRangeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRangeModalOpen(false)} />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.xl) },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Select Date Range</Text>
                <Text style={styles.modalSubtitle}>
                  Tap start date and end date (tap once for single day)
                </Text>
              </View>
              <Pressable
                onPress={() => setRangeModalOpen(false)}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.selectedPreviewRow}>
              <View style={styles.selectedDatePill}>
                <Text style={styles.selectedDatePillLabel}>FROM</Text>
                <Text style={styles.selectedDatePillVal}>
                  {draftStartKey ? formatShortDateKey(draftStartKey) : 'Pick start'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={Colors.light.textMuted} />
              <View style={styles.selectedDatePill}>
                <Text style={styles.selectedDatePillLabel}>TO</Text>
                <Text style={styles.selectedDatePillVal}>
                  {draftEndKey
                    ? formatShortDateKey(draftEndKey)
                    : draftStartKey
                      ? formatShortDateKey(draftStartKey)
                      : 'Pick end'}
                </Text>
              </View>
            </View>

            <View style={styles.calendarBox}>
              <View style={styles.calHeader}>
                <Pressable
                  onPress={() => {
                    if (calMonth === 1) {
                      setCalYear((y) => y - 1);
                      setCalMonth(12);
                    } else {
                      setCalMonth((m) => m - 1);
                    }
                  }}
                  hitSlop={HitSlop.sm}
                  style={styles.calNavBtn}
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.light.textPrimary} />
                </Pressable>
                <Text style={styles.calMonthTitle}>
                  {MONTH_NAMES[calMonth - 1]} {calYear}
                </Text>
                <Pressable
                  disabled={!canGoNextMonth}
                  onPress={() => {
                    if (!canGoNextMonth) return;
                    if (calMonth === 12) {
                      setCalYear((y) => y + 1);
                      setCalMonth(1);
                    } else {
                      setCalMonth((m) => m + 1);
                    }
                  }}
                  hitSlop={HitSlop.sm}
                  style={[styles.calNavBtn, !canGoNextMonth && { opacity: 0.35 }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.light.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.calWeekRow}>
                {WEEKDAY_LABELS.map((wd) => (
                  <Text key={wd} style={styles.calWeekdayText}>
                    {wd}
                  </Text>
                ))}
              </View>

              <View style={styles.calGrid}>
                {calendarCells.map((cell, idx) => {
                  if (!cell.dateKey || !cell.dayNumber) {
                    return <View key={`empty-${idx}`} style={styles.calDayCell} />;
                  }
                  const key = cell.dateKey;
                  const endOrStart = draftEndKey || draftStartKey;
                  const isEndpoint = key === draftStartKey || key === endOrStart;
                  const isBetween =
                    Boolean(draftStartKey && draftEndKey) &&
                    key > draftStartKey! &&
                    key < draftEndKey!;

                  return (
                    <Pressable
                      key={key}
                      disabled={cell.isFuture}
                      onPress={() => handleCalendarDayPress(key)}
                      style={[
                        styles.calDayCell,
                        isBetween && styles.calDayBetweenCell,
                      ]}
                    >
                      <View
                        style={[
                          styles.calDayCircle,
                          cell.isToday && !isEndpoint && styles.calDayTodayBorder,
                          isEndpoint && styles.calDayEndpointCircle,
                          cell.isFuture && { opacity: 0.3 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayText,
                            cell.isToday && !isEndpoint && { color: BrandColors.pink.primary, fontWeight: '700' },
                            isEndpoint && styles.calDayEndpointText,
                          ]}
                        >
                          {cell.dayNumber}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalFooterRow}>
              <Pressable
                onPress={() => {
                  setDraftStartKey(undefined);
                  setDraftEndKey(undefined);
                  setCustomFromDateKey(undefined);
                  setCustomToDateKey(undefined);
                  setPreset('month');
                  setRangeModalOpen(false);
                }}
                style={styles.modalResetBtn}
              >
                <Text style={styles.modalResetBtnText}>Reset to Month</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyCustomRange}
                disabled={!draftStartKey}
                style={[styles.modalApplyBtn, !draftStartKey && { opacity: 0.5 }]}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.modalApplyBtnText}>Apply Range</Text>
              </Pressable>
            </View>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBarContainer: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  filterPillsScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  filterPillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.pink.subtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
  },
  contextLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  contextText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  contextDaysText: {
    ...Typography.captionSm,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  contextActionText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  sectionTitle: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  viewLedgerLink: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    width: '48.5%',
    flexGrow: 1,
    padding: Spacing.md,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  kpiLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  kpiValue: {
    ...Typography.h2,
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  kpiSub: {
    ...Typography.captionSm,
    color: Colors.light.textMuted,
    marginTop: 3,
  },
  paymentSplitCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  paymentSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentCol: {
    flex: 1,
    alignItems: 'center',
  },
  paymentDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.light.border,
  },
  paymentLabel: {
    ...Typography.overline,
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  paymentVal: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    marginTop: 2,
  },
  pendingOrdersHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  pendingOrdersHintText: {
    ...Typography.captionSm,
    color: BrandColors.accent.amber,
  },
  incentiveCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  incentiveTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  incentiveHeadlineLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  incentiveHeadlineVal: {
    ...Typography.h1,
    color: BrandColors.pink.primary,
    marginTop: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    ...Typography.captionSm,
    color: Colors.light.textMuted,
  },
  breakdownValue: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lifetimeCol: {
    flex: 1,
    alignItems: 'center',
  },
  lifetimeLabel: {
    ...Typography.captionSm,
    color: Colors.light.textSecondary,
  },
  lifetimeVal: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  dayCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  dayTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dayDateText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayNetEarnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  dayStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  dayStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayStatLabel: {
    ...Typography.captionSm,
    color: Colors.light.textMuted,
  },
  dayStatValue: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: 1,
  },
  dayStatSub: {
    ...Typography.captionSm,
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  dayDetailsWrap: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    gap: Spacing.md,
  },
  detailSubBlock: {
    gap: Spacing.xs,
  },
  detailSubTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  detailEmptyText: {
    ...Typography.captionSm,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    gap: Spacing.sm,
  },
  detailItemLeft: {
    flex: 1,
  },
  detailItemTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  detailItemSub: {
    ...Typography.captionSm,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  detailItemNotes: {
    ...Typography.captionSm,
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  orderRightCol: {
    alignItems: 'flex-end',
  },
  orderAmountText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  orderIncentiveText: {
    ...Typography.captionSm,
    color: BrandColors.green.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    ...Shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  selectedDatePill: {
    flex: 1,
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  selectedDatePillLabel: {
    ...Typography.overline,
    fontSize: 10,
    color: Colors.light.textMuted,
  },
  selectedDatePillVal: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  calendarBox: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    backgroundColor: Colors.light.surface,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calMonthTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekdayText: {
    flex: 1,
    textAlign: 'center',
    ...Typography.captionSm,
    fontWeight: '600',
    color: Colors.light.textMuted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  calDayBetweenCell: {
    backgroundColor: BrandColors.pink.subtle,
  },
  calDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayTodayBorder: {
    borderWidth: 1.5,
    borderColor: BrandColors.pink.primary,
  },
  calDayEndpointCircle: {
    backgroundColor: BrandColors.pink.primary,
  },
  calDayText: {
    ...Typography.bodySmall,
    color: Colors.light.textPrimary,
  },
  calDayEndpointText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetBtnText: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
  },
  modalApplyBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyBtnText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
