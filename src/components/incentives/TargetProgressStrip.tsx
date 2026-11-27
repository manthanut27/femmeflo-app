import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, BrandColors, Colors, Spacing, Typography } from '@/constants/theme';

export type TargetPeriodType = 'DAILY' | 'MONTHLY';

export interface TargetProgressData {
  hasTarget: boolean;
  period: TargetPeriodType;
  periodLabel: string;
  targetPackets: number | null;
  completedPackets: number;
  remainingPackets: number;
  completedRevenuePaise: number;
  progressPercent: number;
  bonusPaise: number;
  earnedBonusPaise: number;
  isAchieved: boolean;
}

interface TargetProgressStripProps {
  targetProgress?: TargetProgressData | null;
  ratePerPacketPaise?: number;
  mode?: 'compact' | 'detailed';
  showWhenUnset?: boolean;
  onAssignPress?: () => void;
  assignButtonLabel?: string;
}

function formatRupeesCompact(paise: number): string {
  const rupees = (paise || 0) / 100;
  return Number.isInteger(rupees) ? `₹${rupees.toLocaleString('en-IN')}` : `₹${rupees.toFixed(2)}`;
}

export function TargetProgressStrip({
  targetProgress,
  ratePerPacketPaise,
  mode = 'compact',
  showWhenUnset = true,
  onAssignPress,
  assignButtonLabel = 'Set Target',
}: TargetProgressStripProps) {
  const progress = targetProgress ?? {
    hasTarget: false,
    period: 'MONTHLY' as TargetPeriodType,
    periodLabel: 'Current Month',
    targetPackets: null,
    completedPackets: 0,
    remainingPackets: 0,
    completedRevenuePaise: 0,
    progressPercent: 0,
    bonusPaise: 0,
    earnedBonusPaise: 0,
    isAchieved: false,
  };

  if (!progress.hasTarget && !showWhenUnset) {
    return null;
  }

  const periodWord = progress.period === 'DAILY' ? 'Daily Target' : 'Monthly Target';

  if (mode === 'compact') {
    if (!progress.hasTarget) {
      return (
        <View style={styles.compactUnsetRow}>
          <View style={styles.compactUnsetLeft}>
            <Ionicons name="flag-outline" size={13} color={Colors.light.textMuted} />
            <Text style={styles.compactUnsetText} numberOfLines={1}>
              {progress.periodLabel}: {progress.completedPackets} pkts •{' '}
              {formatRupeesCompact(progress.completedRevenuePaise)} sales
            </Text>
          </View>
          {onAssignPress ? (
            <Pressable
              onPress={onAssignPress}
              style={({ pressed }) => [styles.compactSetLink, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.compactSetLinkText}>+ {assignButtonLabel}</Text>
            </Pressable>
          ) : (
            <Text style={styles.compactNoTargetLabel}>No target</Text>
          )}
        </View>
      );
    }

    const barColor = progress.isAchieved ? Colors.light.success : BrandColors.pink.primary;

    return (
      <View
        style={[
          styles.compactWrap,
          progress.isAchieved && styles.compactWrapAchieved,
        ]}
      >
        <View style={styles.compactTopRow}>
          <View style={styles.compactTitleWrap}>
            <Ionicons
              name={progress.isAchieved ? 'trophy' : 'flag'}
              size={13}
              color={barColor}
            />
            <Text style={styles.compactTitle} numberOfLines={1}>
              {periodWord} ({progress.periodLabel})
            </Text>
          </View>
          <Text style={[styles.compactPercent, { color: barColor }]}>
            {progress.completedPackets}/{progress.targetPackets} pkts • {progress.progressPercent}%
          </Text>
        </View>

        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, Math.max(0, progress.progressPercent))}%`, backgroundColor: barColor },
            ]}
          />
        </View>

        <View style={styles.compactBottomRow}>
          <Text style={styles.compactSubText} numberOfLines={1}>
            {formatRupeesCompact(progress.completedRevenuePaise)} sales
            {progress.isAchieved
              ? ' • Target met!'
              : ` • ${progress.remainingPackets} pkts left`}
          </Text>
          {progress.bonusPaise > 0 ? (
            <View
              style={[
                styles.bonusPill,
                progress.isAchieved ? styles.bonusPillEarned : styles.bonusPillPending,
              ]}
            >
              <Text
                style={[
                  styles.bonusPillText,
                  progress.isAchieved ? styles.bonusPillTextEarned : styles.bonusPillTextPending,
                ]}
              >
                {progress.isAchieved
                  ? `✓ +${formatRupeesCompact(progress.bonusPaise)} Bonus`
                  : `+${formatRupeesCompact(progress.bonusPaise)} Bonus`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  // Detailed mode
  const accentColor = progress.isAchieved ? Colors.light.success : BrandColors.pink.primary;
  const excessPackets =
    progress.targetPackets !== null && progress.completedPackets > progress.targetPackets
      ? progress.completedPackets - progress.targetPackets
      : 0;

  return (
    <View
      style={[
        styles.detailCard,
        progress.isAchieved && styles.detailCardAchieved,
      ]}
    >
      <View style={styles.detailHeaderRow}>
        <View style={styles.detailTitleRow}>
          <View
            style={[
              styles.detailIconWrap,
              progress.isAchieved && { backgroundColor: Colors.light.successBg },
            ]}
          >
            <Ionicons
              name={progress.hasTarget ? (progress.isAchieved ? 'trophy' : 'flag') : 'stats-chart-outline'}
              size={16}
              color={progress.hasTarget ? accentColor : Colors.light.textSecondary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>
              {progress.hasTarget ? periodWord : 'Period Sales Summary'}
            </Text>
            <Text style={styles.detailSub}>{progress.periodLabel} • Confirmed Sales</Text>
          </View>
        </View>

        {progress.hasTarget ? (
          <View
            style={[
              styles.statusChip,
              progress.isAchieved ? styles.statusChipDone : styles.statusChipActive,
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                progress.isAchieved ? styles.statusChipTextDone : styles.statusChipTextActive,
              ]}
            >
              {progress.isAchieved ? 'Achieved ✓' : `${progress.progressPercent}% Done`}
            </Text>
          </View>
        ) : onAssignPress ? (
          <Pressable
            onPress={onAssignPress}
            style={({ pressed }) => [styles.detailAssignBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.detailAssignBtnText}>{assignButtonLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.statusChipMuted}>
            <Text style={styles.statusChipTextMuted}>No Target</Text>
          </View>
        )}
      </View>

      {progress.hasTarget ? (
        <>
          <View style={styles.detailMetricHeader}>
            <Text style={styles.detailPacketsCount}>
              <Text style={[styles.detailPacketsStrong, { color: accentColor }]}>
                {progress.completedPackets}
              </Text>{' '}
              / {progress.targetPackets} packets sold
            </Text>
            <Text style={[styles.detailPercentLarge, { color: accentColor }]}>
              {progress.progressPercent}%
            </Text>
          </View>

          <View style={styles.detailTrack}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, Math.max(0, progress.progressPercent))}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        </>
      ) : null}

      <View style={styles.detailGrid}>
        <View style={styles.detailGridCol}>
          <Text style={styles.detailGridLabel}>
            {progress.hasTarget ? (progress.isAchieved ? 'Above Target' : 'Remaining') : 'Packets Sold'}
          </Text>
          <Text style={styles.detailGridVal}>
            {progress.hasTarget
              ? progress.isAchieved
                ? excessPackets > 0
                  ? `+${excessPackets} pkts`
                  : 'Completed'
                : `${progress.remainingPackets} pkts`
              : `${progress.completedPackets} pkts`}
          </Text>
        </View>

        <View style={styles.detailGridDivider} />

        <View style={styles.detailGridCol}>
          <Text style={styles.detailGridLabel}>Sales Value</Text>
          <Text style={styles.detailGridVal}>{formatRupeesCompact(progress.completedRevenuePaise)}</Text>
        </View>

        <View style={styles.detailGridDivider} />

        <View style={styles.detailGridCol}>
          <Text style={styles.detailGridLabel}>Target Bonus</Text>
          <Text
            style={[
              styles.detailGridVal,
              progress.bonusPaise > 0 && progress.isAchieved && { color: Colors.light.success },
            ]}
          >
            {progress.bonusPaise > 0
              ? progress.isAchieved
                ? `+${formatRupeesCompact(progress.bonusPaise)} ✓`
                : formatRupeesCompact(progress.bonusPaise)
              : 'Commission only'}
          </Text>
        </View>
      </View>

      {ratePerPacketPaise !== undefined ? (
        <Text style={styles.earnRuleHint}>
          Earning Rule: {formatRupeesCompact(ratePerPacketPaise)}/packet on confirmed sales
          {progress.hasTarget && progress.bonusPaise > 0
            ? ` + ${formatRupeesCompact(progress.bonusPaise)} completion bonus at ${progress.targetPackets} pkts`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.surface,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    gap: 6,
  },
  compactWrapAchieved: {
    backgroundColor: Colors.light.successBg,
    borderColor: Colors.light.successBorder,
  },
  compactTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  compactTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  compactTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.text,
  },
  compactPercent: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
  },
  detailTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: Spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  compactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  compactSubText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  bonusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bonusPillPending: {
    backgroundColor: BrandColors.accent.amberSurface,
    borderWidth: 1,
    borderColor: BrandColors.accent.amberBorder,
  },
  bonusPillEarned: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.successBorder,
  },
  bonusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bonusPillTextPending: {
    color: BrandColors.accent.amber,
  },
  bonusPillTextEarned: {
    color: Colors.light.success,
  },
  compactUnsetRow: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  compactUnsetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  compactUnsetText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  compactSetLink: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
  },
  compactSetLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  compactNoTargetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textMuted,
  },
  detailCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    marginBottom: Spacing.sm,
  },
  detailCardAchieved: {
    borderColor: Colors.light.successBorder,
    backgroundColor: '#F7FEF9',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  detailSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipActive: {
    backgroundColor: BrandColors.pink.subtle,
  },
  statusChipDone: {
    backgroundColor: Colors.light.successBg,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: BrandColors.pink.primary,
  },
  statusChipTextDone: {
    color: Colors.light.success,
  },
  statusChipMuted: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  statusChipTextMuted: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textMuted,
  },
  detailAssignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.pink.primary,
  },
  detailAssignBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  detailPacketsCount: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  detailPacketsStrong: {
    fontSize: 16,
    fontWeight: '800',
  },
  detailPercentLarge: {
    fontSize: 15,
    fontWeight: '800',
  },
  detailGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  detailGridCol: {
    flex: 1,
    alignItems: 'center',
  },
  detailGridDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  },
  detailGridLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  detailGridVal: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  earnRuleHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
  },
});
