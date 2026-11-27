import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors, Colors, HitSlop, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDateIST, getISTDateKey, getISTDateParts } from '@/utils/dateUtils';
import {
  SHIFT_FILTER_PRESETS,
  buildCalendarMonthCells,
  type ShiftFilterPreset,
  type ShiftFilterState,
  type ShiftStatusFilter,
} from '@/utils/shiftFilterUtils';

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

export interface AttendanceFilterButtonProps {
  onPress: () => void;
  hasActiveFilter?: boolean;
  accentColor?: string;
  accessibilityLabel?: string;
}

/**
 * Clean icon-only filter trigger button matching the requested UX:
 * shows only the filter icon (with a subtle indicator dot when filtered).
 */
export function AttendanceFilterButton({
  onPress,
  hasActiveFilter = false,
  accentColor = BrandColors.pink.primary,
  accessibilityLabel = 'Open attendance filter',
}: AttendanceFilterButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={HitSlop.md}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconButton,
        hasActiveFilter && {
          borderColor: accentColor,
          backgroundColor: `${accentColor}14`,
        },
      ]}
    >
      <Ionicons
        name="options-outline"
        size={19}
        color={hasActiveFilter ? accentColor : Colors.light.textPrimary}
      />
      {hasActiveFilter ? <View style={[styles.activeDot, { backgroundColor: accentColor }]} /> : null}
    </TouchableOpacity>
  );
}

export interface AttendanceFilterModalProps {
  visible: boolean;
  value: ShiftFilterState;
  onApply: (next: ShiftFilterState) => void;
  onClose: () => void;
  accentColor?: string;
  showStatusFilter?: boolean;
  defaultPreset?: ShiftFilterPreset;
}

export function AttendanceFilterModal({
  visible,
  value,
  onApply,
  onClose,
  accentColor = BrandColors.pink.primary,
  showStatusFilter = false,
  defaultPreset = 'today',
}: AttendanceFilterModalProps) {
  const insets = useSafeAreaInsets();
  const istNow = getISTDateParts(new Date());
  const todayKey = getISTDateKey(new Date());

  const [draftPreset, setDraftPreset] = useState<ShiftFilterPreset>(value.preset);
  const [draftDateKey, setDraftDateKey] = useState<string | undefined>(value.customDateKey);
  const [draftStatus, setDraftStatus] = useState<ShiftStatusFilter>(value.status || 'ALL');
  const [calendarOpen, setCalendarOpen] = useState<boolean>(value.preset === 'custom_date');
  const [calYear, setCalYear] = useState<number>(istNow.year);
  const [calMonth, setCalMonth] = useState<number>(istNow.month);

  useEffect(() => {
    if (!visible) return;
    setDraftPreset(value.preset);
    setDraftDateKey(value.customDateKey);
    setDraftStatus(value.status || 'ALL');
    setCalendarOpen(value.preset === 'custom_date');

    if (value.customDateKey && /^\d{4}-\d{2}-\d{2}$/.test(value.customDateKey)) {
      const [yStr, mStr] = value.customDateKey.split('-');
      setCalYear(Number(yStr));
      setCalMonth(Number(mStr));
    } else {
      const nowParts = getISTDateParts(new Date());
      setCalYear(nowParts.year);
      setCalMonth(nowParts.month);
    }
  }, [visible, value]);

  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calYear, calMonth),
    [calYear, calMonth]
  );

  const canGoNextMonth =
    calYear < istNow.year || (calYear === istNow.year && calMonth < istNow.month);

  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear((y) => y - 1);
      setCalMonth(12);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    if (calMonth === 12) {
      setCalYear((y) => y + 1);
      setCalMonth(1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleSelectPreset = (presetId: Exclude<ShiftFilterPreset, 'custom_date'>) => {
    setDraftPreset(presetId);
    setCalendarOpen(false);
  };

  const handleSelectCalendarDate = (dateKey: string) => {
    setDraftDateKey(dateKey);
    setDraftPreset('custom_date');
  };

  const handleReset = () => {
    const nextState: ShiftFilterState = {
      preset: defaultPreset,
      customDateKey: undefined,
      status: 'ALL',
    };
    onApply(nextState);
    onClose();
  };

  const handleApply = () => {
    const resolvedPreset: ShiftFilterPreset =
      draftPreset === 'custom_date' && !draftDateKey ? defaultPreset : draftPreset;
    onApply({
      preset: resolvedPreset,
      customDateKey: resolvedPreset === 'custom_date' ? draftDateKey : undefined,
      status: showStatusFilter ? draftStatus : undefined,
    });
    onClose();
  };

  const selectedDateDisplay = draftDateKey
    ? formatDateIST(`${draftDateKey}T00:00:00.000+05:30`, 'medium')
    : 'Pick a date';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.xl) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.headerIconBadge, { backgroundColor: `${accentColor}15` }]}>
                <Ionicons name="funnel-outline" size={18} color={accentColor} />
              </View>
              <View>
                <Text style={styles.title}>Filter Attendance & KPI</Text>
                <Text style={styles.subtitle}>Choose time range or pick a specific date</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={HitSlop.md}
              accessibilityRole="button"
              accessibilityLabel="Close filter"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Time Period Presets */}
            <Text style={styles.sectionLabel}>QUICK RANGE</Text>
            <View style={styles.presetsGrid}>
              {SHIFT_FILTER_PRESETS.map((preset) => {
                const isSelected = draftPreset === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => handleSelectPreset(preset.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${preset.label}`}
                    style={[
                      styles.presetChip,
                      isSelected && {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected && styles.presetChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Specific Date Calendar Trigger + Inline Picker */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>SELECT DATE</Text>
            <Pressable
              onPress={() => {
                setCalendarOpen((open) => !open);
                if (!draftDateKey) {
                  setDraftDateKey(todayKey);
                  setDraftPreset('custom_date');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Toggle calendar date picker"
              style={[
                styles.calendarTriggerRow,
                draftPreset === 'custom_date' && {
                  borderColor: accentColor,
                  backgroundColor: `${accentColor}0E`,
                },
              ]}
            >
              <View style={styles.calendarTriggerLeft}>
                <View
                  style={[
                    styles.calendarIconCircle,
                    { backgroundColor: `${accentColor}16` },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={20} color={accentColor} />
                </View>
                <View>
                  <Text style={styles.calendarTriggerTitle}>
                    {draftPreset === 'custom_date' && draftDateKey
                      ? selectedDateDisplay
                      : 'Select Specific Date'}
                  </Text>
                  <Text style={styles.calendarTriggerSub}>
                    Tap calendar icon to choose a single day
                  </Text>
                </View>
              </View>
              <Ionicons
                name={calendarOpen ? 'chevron-up' : 'calendar'}
                size={20}
                color={accentColor}
              />
            </Pressable>

            {calendarOpen ? (
              <View style={styles.calendarBox}>
                {/* Month / Year Navigation */}
                <View style={styles.calHeader}>
                  <Pressable
                    onPress={handlePrevMonth}
                    hitSlop={HitSlop.sm}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    style={styles.calNavBtn}
                  >
                    <Ionicons name="chevron-back" size={18} color={Colors.light.textPrimary} />
                  </Pressable>
                  <Text style={styles.calMonthTitle}>
                    {MONTH_NAMES[calMonth - 1]} {calYear}
                  </Text>
                  <Pressable
                    onPress={handleNextMonth}
                    disabled={!canGoNextMonth}
                    hitSlop={HitSlop.sm}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    style={[styles.calNavBtn, !canGoNextMonth && { opacity: 0.35 }]}
                  >
                    <Ionicons name="chevron-forward" size={18} color={Colors.light.textPrimary} />
                  </Pressable>
                </View>

                {/* Weekday Header */}
                <View style={styles.calWeekRow}>
                  {WEEKDAY_LABELS.map((wd) => (
                    <Text key={wd} style={styles.calWeekdayText}>
                      {wd}
                    </Text>
                  ))}
                </View>

                {/* 7-col Days Grid */}
                <View style={styles.calGrid}>
                  {calendarCells.map((cell, idx) => {
                    if (!cell.dateKey || !cell.dayNumber) {
                      return <View key={`empty-${idx}`} style={styles.calDayCell} />;
                    }
                    const isSelected =
                      draftPreset === 'custom_date' && draftDateKey === cell.dateKey;
                    return (
                      <Pressable
                        key={cell.dateKey}
                        disabled={cell.isFuture}
                        onPress={() => handleSelectCalendarDate(cell.dateKey!)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${cell.dateKey}`}
                        style={styles.calDayCell}
                      >
                        <View
                          style={[
                            styles.calDayCircle,
                            cell.isToday && !isSelected && {
                              borderWidth: 1.5,
                              borderColor: accentColor,
                            },
                            isSelected && {
                              backgroundColor: accentColor,
                            },
                            cell.isFuture && { opacity: 0.3 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              cell.isToday && !isSelected && { color: accentColor, fontWeight: '700' },
                              isSelected && styles.calDayTextSelected,
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

            {/* Optional Shift Status Filter for Admin & Manager */}
            {showStatusFilter ? (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={styles.sectionLabel}>DUTY STATUS</Text>
                <View style={styles.statusRow}>
                  {(
                    [
                      { id: 'ALL', label: 'All Shifts' },
                      { id: 'ACTIVE', label: 'On Duty' },
                      { id: 'COMPLETED', label: 'Completed' },
                    ] as const
                  ).map((st) => {
                    const isSelected = draftStatus === st.id;
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => setDraftStatus(st.id)}
                        style={[
                          styles.statusChip,
                          isSelected && {
                            backgroundColor: `${accentColor}15`,
                            borderColor: accentColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            isSelected && { color: accentColor, fontWeight: '700' },
                          ]}
                        >
                          {st.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable
              onPress={handleReset}
              style={styles.resetBtn}
              accessibilityRole="button"
              accessibilityLabel="Reset filter"
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={[styles.applyBtn, { backgroundColor: accentColor }]}
              accessibilityRole="button"
              accessibilityLabel="Apply filter"
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
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: Platform.OS === 'web' ? '85%' : '88%',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.subtitle,
    fontWeight: '800',
    color: Colors.light.heading,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  scrollBody: {
    paddingVertical: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceMuted,
  },
  calendarTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  calendarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTriggerTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  calendarTriggerSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  calendarBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceMuted,
  },
  calMonthTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    maxHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textPrimary,
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
