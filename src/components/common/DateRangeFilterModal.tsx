import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SellerReportPreset } from '@/api/types';
import {
  BrandColors,
  Colors,
  HitSlop,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { getISTDateParts } from '@/utils/dateUtils';
import {
  formatShortDateKey,
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

export interface DateRangeFilterSelection {
  preset: SellerReportPreset;
  customFromDateKey?: string;
  customToDateKey?: string;
}

export interface DateRangeFilterModalProps {
  visible: boolean;
  preset: SellerReportPreset;
  customFromDateKey?: string;
  customToDateKey?: string;
  defaultPreset?: SellerReportPreset;
  presets?: Array<{ id: SellerReportPreset; label: string; shortLabel?: string }>;
  accentColor?: string;
  title?: string;
  subtitle?: string;
  onApply: (selection: DateRangeFilterSelection) => void;
  onClose: () => void;
}

export function DateRangeFilterModal({
  visible,
  preset,
  customFromDateKey,
  customToDateKey,
  defaultPreset = 'all',
  presets,
  accentColor = BrandColors.pink.primary,
  title = 'Filter by Date',
  subtitle = 'Select All Time, Today, 7 Days, Month or pick dates',
  onApply,
  onClose,
}: DateRangeFilterModalProps) {
  const insets = useSafeAreaInsets();
  const nowParts = useMemo(() => getISTDateParts(new Date()), []);

  const [draftPreset, setDraftPreset] = useState<SellerReportPreset>(preset);
  const [draftStartKey, setDraftStartKey] = useState<string | undefined>(customFromDateKey);
  const [draftEndKey, setDraftEndKey] = useState<string | undefined>(customToDateKey);
  const [calYear, setCalYear] = useState(nowParts.year);
  const [calMonth, setCalMonth] = useState(nowParts.month);
  const [calendarOpen, setCalendarOpen] = useState(preset === 'custom_range');

  useEffect(() => {
    if (visible) {
      setDraftPreset(preset);
      setDraftStartKey(customFromDateKey);
      setDraftEndKey(customToDateKey);
      setCalYear(nowParts.year);
      setCalMonth(nowParts.month);
      setCalendarOpen(preset === 'custom_range');
    }
  }, [visible, preset, customFromDateKey, customToDateKey, nowParts.year, nowParts.month]);

  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calYear, calMonth),
    [calYear, calMonth]
  );

  const canGoNextMonth =
    calYear < nowParts.year || (calYear === nowParts.year && calMonth < nowParts.month);

  function handleSelectPreset(nextPreset: SellerReportPreset) {
    if (nextPreset === 'custom_range') {
      setDraftPreset('custom_range');
      setCalendarOpen(true);
      return;
    }
    setDraftPreset(nextPreset);
    setCalendarOpen(false);
  }

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

  function handleReset() {
    setDraftPreset(defaultPreset);
    setDraftStartKey(undefined);
    setDraftEndKey(undefined);
    setCalendarOpen(false);
    onApply({
      preset: defaultPreset,
      customFromDateKey: undefined,
      customToDateKey: undefined,
    });
    onClose();
  }

  function handleApply() {
    if (draftPreset === 'custom_range') {
      if (!draftStartKey) {
        onApply({ preset: defaultPreset });
        onClose();
        return;
      }
      onApply({
        preset: 'custom_range',
        customFromDateKey: draftStartKey,
        customToDateKey: draftEndKey || draftStartKey,
      });
      onClose();
      return;
    }
    onApply({
      preset: draftPreset,
      customFromDateKey: undefined,
      customToDateKey: undefined,
    });
    onClose();
  }

  const quickPresets = presets ?? SELLER_REPORT_PRESETS.filter((p) => p.id !== 'custom_range');

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
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.xl) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.headerBadge, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name="funnel-outline" size={18} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={HitSlop.md}
              accessibilityRole="button"
              accessibilityLabel="Close filter modal"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <Text style={styles.sectionLabel}>QUICK PERIOD</Text>
            <View style={styles.presetsGrid}>
              {quickPresets.map((item) => {
                const isSelected = draftPreset === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelectPreset(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${item.label}`}
                    style={[
                      styles.presetChip,
                      isSelected && { backgroundColor: accentColor, borderColor: accentColor },
                    ]}
                  >
                    <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>CUSTOM DATE OR RANGE</Text>
            <Pressable
              onPress={() => {
                setCalendarOpen((prev) => !prev);
                setDraftPreset('custom_range');
              }}
              accessibilityRole="button"
              accessibilityLabel="Toggle custom date range calendar"
              style={[
                styles.rangeTriggerRow,
                draftPreset === 'custom_range' && {
                  borderColor: accentColor,
                  backgroundColor: `${accentColor}0D`,
                },
              ]}
            >
              <View style={styles.rangeTriggerLeft}>
                <View style={[styles.rangeIconCircle, { backgroundColor: `${accentColor}16` }]}>
                  <Ionicons name="calendar-outline" size={18} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rangeTriggerTitle}>
                    {draftPreset === 'custom_range' && draftStartKey
                      ? draftEndKey && draftEndKey !== draftStartKey
                        ? `${formatShortDateKey(draftStartKey)} – ${formatShortDateKey(draftEndKey)}`
                        : formatShortDateKey(draftStartKey)
                      : 'Pick Single Date or Date Range'}
                  </Text>
                  <Text style={styles.rangeTriggerSub}>
                    Tap 1 date for a single day, or 2 dates for a range
                  </Text>
                </View>
              </View>
              <Ionicons
                name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={accentColor}
              />
            </Pressable>

            {calendarOpen ? (
              <View style={styles.calendarBox}>
                <View style={styles.selectedPreviewRow}>
                  <View style={styles.selectedPill}>
                    <Text style={styles.selectedPillLabel}>FROM</Text>
                    <Text style={styles.selectedPillVal}>
                      {draftStartKey ? formatShortDateKey(draftStartKey) : 'Tap start date'}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={Colors.light.textMuted} />
                  <View style={styles.selectedPill}>
                    <Text style={styles.selectedPillLabel}>TO</Text>
                    <Text style={styles.selectedPillVal}>
                      {draftEndKey
                        ? formatShortDateKey(draftEndKey)
                        : draftStartKey
                          ? formatShortDateKey(draftStartKey)
                          : 'Tap end date'}
                    </Text>
                  </View>
                </View>

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
                          isBetween && { backgroundColor: `${accentColor}15` },
                        ]}
                      >
                        <View
                          style={[
                            styles.calDayCircle,
                            cell.isToday && !isEndpoint && { borderWidth: 1.5, borderColor: accentColor },
                            isEndpoint && { backgroundColor: accentColor },
                            cell.isFuture && { opacity: 0.3 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              cell.isToday && !isEndpoint && { color: accentColor, fontWeight: '700' },
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
            ) : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={[styles.applyBtn, { backgroundColor: accentColor }]}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.applyBtnText}>Apply Filter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: '85%',
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  presetText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  presetTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rangeTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.light.surfaceMuted,
  },
  rangeTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: 8,
  },
  rangeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeTriggerTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  rangeTriggerSub: {
    ...Typography.captionSm,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  calendarBox: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    backgroundColor: Colors.light.surface,
  },
  selectedPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  selectedPill: {
    flex: 1,
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
  },
  selectedPillLabel: {
    ...Typography.overline,
    fontSize: 9,
    color: Colors.light.textMuted,
  },
  selectedPillVal: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textPrimary,
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
  calDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayText: {
    ...Typography.bodySmall,
    color: Colors.light.textPrimary,
  },
  calDayEndpointText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
  },
  applyBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
