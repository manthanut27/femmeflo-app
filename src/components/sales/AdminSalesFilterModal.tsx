import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PaymentMode, SellerReportPreset } from '@/api/types';
import type { DateRangeFilterSelection } from '@/components/common/DateRangeFilterModal';
import { Button } from '@/components/ui/Button';
import { BrandColors, Colors, HitSlop, Radius, Spacing, Typography } from '@/constants/theme';
import { getISTDateParts } from '@/utils/dateUtils';
import {
  ADMIN_DATE_FILTER_PRESETS,
  formatShortDateKey,
} from '@/utils/reportFilterUtils';
import { buildCalendarMonthCells } from '@/utils/shiftFilterUtils';

export type AdminSalesStatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING_APPROVAL' | 'COMPLETED';
export type AdminSalesPaymentFilter = PaymentMode | 'ALL';

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

export const ADMIN_SALES_STATUS_OPTIONS: Array<{
  value: AdminSalesStatusFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'ALL', label: 'All Sales', icon: 'layers-outline' },
  { value: 'CONFIRMED', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { value: 'PENDING_APPROVAL', label: 'Pending', icon: 'time-outline' },
  { value: 'COMPLETED', label: 'Received', icon: 'checkmark-done-circle-outline' },
];

export const ADMIN_SALES_PAYMENT_OPTIONS: Array<{
  value: AdminSalesPaymentFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'ALL', label: 'All Modes', icon: 'wallet-outline' },
  { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { value: 'BANK', label: 'UPI / Bank', icon: 'qr-code-outline' },
  { value: 'PENDING', label: 'Pay Later', icon: 'time-outline' },
];

export function formatPaymentModeLabel(mode?: string | null): string {
  if (mode === 'CASH') return 'Cash';
  if (mode === 'BANK') return 'UPI / Bank';
  if (mode === 'PENDING') return 'Pay Later';
  return mode || '—';
}

export interface AdminSalesFilterModalProps {
  visible: boolean;
  statusFilter: AdminSalesStatusFilter;
  paymentFilter: AdminSalesPaymentFilter;
  dateSelection?: DateRangeFilterSelection;
  onApply: (next: {
    statusFilter: AdminSalesStatusFilter;
    paymentFilter: AdminSalesPaymentFilter;
    dateSelection?: DateRangeFilterSelection;
  }) => void;
  onClose: () => void;
}

export function AdminSalesFilterModal({
  visible,
  statusFilter,
  paymentFilter,
  dateSelection,
  onApply,
  onClose,
}: AdminSalesFilterModalProps) {
  const insets = useSafeAreaInsets();
  const nowParts = useMemo(() => getISTDateParts(new Date()), []);

  const [draftStatus, setDraftStatus] = useState<AdminSalesStatusFilter>(statusFilter);
  const [draftPayment, setDraftPayment] = useState<AdminSalesPaymentFilter>(paymentFilter);
  const [draftPreset, setDraftPreset] = useState<SellerReportPreset>(dateSelection?.preset ?? 'all');
  const [draftStartKey, setDraftStartKey] = useState<string | undefined>(
    dateSelection?.customFromDateKey
  );
  const [draftEndKey, setDraftEndKey] = useState<string | undefined>(dateSelection?.customToDateKey);
  const [calYear, setCalYear] = useState(nowParts.year);
  const [calMonth, setCalMonth] = useState(nowParts.month);
  const [calendarOpen, setCalendarOpen] = useState(dateSelection?.preset === 'custom_range');

  useEffect(() => {
    if (visible) {
      setDraftStatus(statusFilter);
      setDraftPayment(paymentFilter);
      setDraftPreset(dateSelection?.preset ?? 'all');
      setDraftStartKey(dateSelection?.customFromDateKey);
      setDraftEndKey(dateSelection?.customToDateKey);
      setCalYear(nowParts.year);
      setCalMonth(nowParts.month);
      setCalendarOpen(dateSelection?.preset === 'custom_range');
    }
  }, [
    visible,
    statusFilter,
    paymentFilter,
    dateSelection?.preset,
    dateSelection?.customFromDateKey,
    dateSelection?.customToDateKey,
    nowParts.year,
    nowParts.month,
  ]);

  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calYear, calMonth),
    [calYear, calMonth]
  );

  const canGoNextMonth =
    calYear < nowParts.year || (calYear === nowParts.year && calMonth < nowParts.month);

  function handleCalendarDayPress(dateKey: string) {
    setDraftPreset('custom_range');
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

  const handleReset = () => {
    setDraftStatus('ALL');
    setDraftPayment('ALL');
    setDraftPreset('all');
    setDraftStartKey(undefined);
    setDraftEndKey(undefined);
    setCalendarOpen(false);
  };

  const handleApply = () => {
    const resolvedDateSelection: DateRangeFilterSelection =
      draftPreset === 'custom_range' && draftStartKey
        ? {
            preset: 'custom_range',
            customFromDateKey: draftStartKey,
            customToDateKey: draftEndKey || draftStartKey,
          }
        : {
            preset: draftPreset === 'custom_range' ? 'all' : draftPreset,
            customFromDateKey: undefined,
            customToDateKey: undefined,
          };
    onApply({
      statusFilter: draftStatus,
      paymentFilter: draftPayment,
      dateSelection: resolvedDateSelection,
    });
    onClose();
  };

  const quickPresets = ADMIN_DATE_FILTER_PRESETS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Filter Sales</Text>
              <Text style={styles.subtitle}>Filter by date, status &amp; payment mode</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={HitSlop.md}
              accessibilityRole="button"
              accessibilityLabel="Close sales filter"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={Colors.light.textPrimary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.sectionLabel}>Date Range</Text>
            <View style={styles.chipGrid}>
              {quickPresets.map((opt) => {
                const active = draftPreset === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      setDraftPreset(opt.id);
                      setCalendarOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.optionChip,
                      active && {
                        backgroundColor: BrandColors.pink.dark,
                        borderColor: BrandColors.pink.dark,
                      },
                    ]}
                  >
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setDraftPreset('custom_range');
                  setCalendarOpen((prev) => !prev);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: draftPreset === 'custom_range' }}
                style={[
                  styles.optionChip,
                  draftPreset === 'custom_range' && {
                    backgroundColor: BrandColors.pink.dark,
                    borderColor: BrandColors.pink.dark,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={draftPreset === 'custom_range' ? '#FFFFFF' : Colors.light.textSecondary}
                />
                <Text
                  style={[
                    styles.optionChipText,
                    draftPreset === 'custom_range' && styles.optionChipTextActive,
                  ]}
                >
                  {draftPreset === 'custom_range' && draftStartKey
                    ? draftEndKey && draftEndKey !== draftStartKey
                      ? `${formatShortDateKey(draftStartKey)} – ${formatShortDateKey(draftEndKey)}`
                      : formatShortDateKey(draftStartKey)
                    : 'Custom Dates'}
                </Text>
              </TouchableOpacity>
            </View>

            {calendarOpen ? (
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
                          isBetween && { backgroundColor: BrandColors.pink.subtle },
                        ]}
                      >
                        <View
                          style={[
                            styles.calDayCircle,
                            cell.isToday && !isEndpoint && {
                              borderWidth: 1.5,
                              borderColor: BrandColors.pink.dark,
                            },
                            isEndpoint && { backgroundColor: BrandColors.pink.dark },
                            cell.isFuture && { opacity: 0.3 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              cell.isToday && !isEndpoint && {
                                color: BrandColors.pink.dark,
                                fontWeight: '700',
                              },
                              isEndpoint && { color: '#FFFFFF', fontWeight: '700' },
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
            ) : null}

            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Sale Status</Text>
            <View style={styles.chipGrid}>
              {ADMIN_SALES_STATUS_OPTIONS.map((opt) => {
                const active = draftStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.75}
                    onPress={() => setDraftStatus(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.optionChip,
                      active && {
                        backgroundColor:
                          opt.value === 'COMPLETED' ? BrandColors.green.primary : BrandColors.pink.dark,
                        borderColor:
                          opt.value === 'COMPLETED' ? BrandColors.green.primary : BrandColors.pink.dark,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#FFFFFF' : Colors.light.textSecondary}
                    />
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Payment Mode</Text>
            <View style={styles.chipGrid}>
              {ADMIN_SALES_PAYMENT_OPTIONS.map((opt) => {
                const active = draftPayment === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.75}
                    onPress={() => setDraftPayment(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.optionChip,
                      active && {
                        backgroundColor: BrandColors.green.primary,
                        borderColor: BrandColors.green.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#FFFFFF' : Colors.light.textSecondary}
                    />
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Reset" variant="outline" onPress={handleReset} style={{ flex: 1 }} />
            <Button title="Apply Filter" variant="admin" onPress={handleApply} style={{ flex: 1.6 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarBox: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F8FAFC',
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
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  calDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayText: {
    ...Typography.bodySmall,
    color: Colors.light.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
