import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerIncentiveData } from '@/api/types';
import { TargetProgressStrip } from '@/components/incentives/TargetProgressStrip';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';

export default function SellerIncentivesScreen() {
  const handleBack = useDashboardBackHandler('/(seller)');
  const [incentives, setIncentives] = useState<SellerIncentiveData | null>(null);
  const [activeTab, setActiveTab] = useState<'EARNINGS' | 'TARGET'>('EARNINGS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadIncentives();
  }, []);

  async function loadIncentives() {
    try {
      const res = await sellerApi.getIncentives();
      setIncentives(res);
    } catch (err) {
      console.warn('Failed to load incentives', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const ratePaise = incentives?.effectiveRatePaise ?? incentives?.ratePerPacketPaise ?? 100;
  const lifetimePackets =
    incentives?.totalPacketsSold ??
    incentives?.summary?.totalPacketsSold ??
    incentives?.totalPacketsSoldMonth ??
    0;
  const lifetimeEarnedPaise =
    incentives?.adjustedEntitlementPaise ??
    incentives?.totalEarnedPaise ??
    incentives?.summary?.adjustedEntitlementPaise ??
    incentives?.summary?.salesIncentivePaise ??
    incentives?.currentMonthEarnedPaise ??
    0;
  const paidPaise = incentives?.totalPaidPaise ?? incentives?.summary?.totalPaidPaise ?? 0;
  const pendingPaise = incentives?.pendingPayoutPaise ?? incentives?.summary?.outstandingPaise ?? 0;
  const thisMonthPackets =
    incentives?.summary?.currentMonth?.confirmedPackets ?? incentives?.totalPacketsSoldMonth ?? 0;
  const thisMonthEarnedPaise =
    incentives?.summary?.currentMonth?.salesIncentivePaise ??
    incentives?.summary?.currentMonth?.earnedPaise ??
    incentives?.currentMonthEarnedPaise ??
    0;
  const overallStatus =
    incentives?.status ||
    (paidPaise > 0 && pendingPaise <= 0
      ? 'PAID'
      : paidPaise > 0 && pendingPaise > 0
        ? 'PARTIALLY_PAID'
        : pendingPaise > 0
          ? 'UNPAID'
          : 'PENDING');
  const hasAssignedTarget = Boolean(incentives?.targetProgress?.hasTarget);
  const targetProgress = incentives?.targetProgress;

  return (
    <View style={styles.container}>
      <Header
        title="Seller Incentives"
        subtitle="Commissions & Sales Target"
        showBack
        onBack={handleBack}
      />

      <View style={styles.tabsBar}>
        <SegmentedTabs
          tabs={[
            { label: 'My Earnings', value: 'EARNINGS', icon: 'wallet-outline' },
            {
              label: 'Sales Target',
              value: 'TARGET',
              icon: hasAssignedTarget && targetProgress?.isAchieved ? 'trophy-outline' : 'flag-outline',
            },
          ]}
          selectedTab={activeTab}
          onSelect={(val) => {
            if (val) setActiveTab(val);
          }}
          activeColor={BrandColors.pink.primary}
          accessibilityLabel="Switch between My Earnings and Sales Target"
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingState message="Loading earnings..." color={BrandColors.pink.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadIncentives();
              }}
              colors={[BrandColors.pink.primary]}
            />
          }
        >
          <View style={styles.contentWrapper}>
            {activeTab === 'EARNINGS' ? (
              <>
                {/* Main Earnings Card */}
                <Card style={styles.earningsCard}>
                  <View style={styles.earningsHeaderRow}>
                    <View>
                      <Text style={styles.earningsLabel}>Total Earned Commission</Text>
                      <Text style={styles.earningsValue}>{formatRupees(lifetimeEarnedPaise)}</Text>
                    </View>
                    <Badge
                      label={overallStatus}
                      variant={overallStatus === 'PAID' ? 'success' : 'warning'}
                      size="md"
                    />
                  </View>
                  <Text style={styles.earningsSub}>
                    Rate: ₹{(ratePaise / 100).toFixed(2)} / packet • Calculated on confirmed sales
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.statsRow}>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Packets Sold</Text>
                      <Text style={styles.statVal}>{lifetimePackets.toLocaleString('en-IN')}</Text>
                    </View>

                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Total Paid</Text>
                      <Text style={[styles.statVal, { color: BrandColors.green.primary }]}>
                        {formatRupees(paidPaise)}
                      </Text>
                    </View>

                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Pending Payout</Text>
                      <Text style={[styles.statVal, { color: BrandColors.pink.primary }]}>
                        {formatRupees(pendingPaise)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.monthStrip}>
                    <Text style={styles.monthStripText}>
                      This Month: {thisMonthPackets.toLocaleString('en-IN')} pkts ({formatRupees(thisMonthEarnedPaise)})
                    </Text>
                    <Text style={styles.monthStripRate}>₹{(ratePaise / 100).toFixed(2)}/pkt</Text>
                  </View>

                  {hasAssignedTarget && targetProgress ? (
                    <Pressable
                      onPress={() => setActiveTab('TARGET')}
                      style={({ pressed }) => [styles.targetQuickJumpRow, pressed && { opacity: 0.75 }]}
                    >
                      <View style={styles.targetQuickJumpLeft}>
                        <Ionicons
                          name={targetProgress.isAchieved ? 'trophy' : 'flag'}
                          size={14}
                          color={targetProgress.isAchieved ? Colors.light.success : BrandColors.pink.primary}
                        />
                        <Text style={styles.targetQuickJumpText}>
                          Sales Target: {targetProgress.completedPackets}/{targetProgress.targetPackets} pkts ({targetProgress.progressPercent}%)
                        </Text>
                      </View>
                      <Text style={styles.targetQuickJumpLink}>View ›</Text>
                    </Pressable>
                  ) : null}
                </Card>

                {/* Confirmed Sales Contributing to Commission */}
                {incentives?.items && incentives.items.length > 0 ? (
                  <>
                    <Text style={styles.sectionHeading}>
                      Confirmed Sale Incentives ({incentives.items.length})
                    </Text>
                    {incentives.items.slice(0, 20).map((s: any, idx: number) => {
                      const qty = Number(s.quantity ?? s.packetsSold ?? 0);
                      const itemRate = s.incentiveRatePaise ?? ratePaise;
                      const itemEarned = s.incentiveAmountPaise ?? qty * itemRate;
                      const shopLabel =
                        s.customer?.shopName ||
                        s.shopName ||
                        s.invoice?.invoiceNumber ||
                        'Confirmed Sale';
                      const dateStr = s.date || s.confirmedAt || s.createdAt;
                      return (
                        <Card key={s.saleId || s.id || idx} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={styles.historyMonth}>{shopLabel}</Text>
                            <Text style={styles.historyEarned}>{formatRupees(itemEarned)}</Text>
                          </View>
                          <View style={styles.historyFooter}>
                            <Text style={styles.historyMeta}>
                              {qty.toLocaleString('en-IN')} pkts × ₹{(itemRate / 100).toFixed(2)}/pkt
                            </Text>
                            <Text style={styles.historyMeta}>
                              {dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : ''}
                            </Text>
                          </View>
                        </Card>
                      );
                    })}
                  </>
                ) : null}

                {/* Adjustments */}
                {incentives?.adjustments && incentives.adjustments.length > 0 ? (
                  <>
                    <Text style={styles.sectionHeading}>Bonuses &amp; Adjustments</Text>
                    {incentives.adjustments.map((adj: any, idx: number) => (
                      <Card key={adj.id || idx} style={styles.historyCard}>
                        <View style={styles.historyHeader}>
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <Text style={styles.historyMonth}>{adj.reason || 'Adjustment'}</Text>
                            <Text style={styles.historyMeta}>
                              {adj.adjustmentDate
                                ? new Date(adj.adjustmentDate).toLocaleDateString('en-IN')
                                : ''}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.historyEarned,
                              {
                                color:
                                  adj.type === 'ADD'
                                    ? BrandColors.green.primary
                                    : Colors.light.danger,
                              },
                            ]}
                          >
                            {adj.type === 'ADD' ? '+' : '-'}
                            {formatRupees(adj.amountPaise || 0)}
                          </Text>
                        </View>
                      </Card>
                    ))}
                  </>
                ) : null}

                {/* Payouts Disbursed by Office */}
                {incentives?.payouts && incentives.payouts.length > 0 ? (
                  <>
                    <Text style={styles.sectionHeading}>Office Payout Records</Text>
                    {incentives.payouts.map((p: any, idx: number) => (
                      <Card key={p.id || idx} style={styles.historyCard}>
                        <View style={styles.historyHeader}>
                          <View>
                            <Text style={styles.historyMonth}>
                              {p.paymentDate
                                ? new Date(p.paymentDate).toLocaleDateString('en-IN')
                                : 'Paid'}
                            </Text>
                            <Text style={[styles.historyMeta, { marginTop: 2 }]}>
                              Via {p.paymentMethod || 'Bank Transfer'}{' '}
                              {p.referenceId ? `• Ref: ${p.referenceId}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.historyEarned, { color: BrandColors.green.primary }]}>
                              {formatRupees(p.amountPaise)}
                            </Text>
                            <Badge label="PAID" variant="success" size="sm" />
                          </View>
                        </View>
                        {p.remarks ? (
                          <Text style={[styles.historyMeta, { fontStyle: 'italic', marginTop: 4 }]}>
                            &quot;{p.remarks}&quot;
                          </Text>
                        ) : null}
                      </Card>
                    ))}
                  </>
                ) : null}

                {/* Historical Monthly Ledger */}
                <Text style={styles.sectionHeading}>Monthly Commission Ledger</Text>
                {(incentives?.history && incentives.history.length > 0
                  ? incentives.history
                  : [
                      {
                        month: 'Current Month',
                        packetsSold: thisMonthPackets,
                        earnedPaise: thisMonthEarnedPaise,
                        ratePerPacketPaise: ratePaise,
                        status: overallStatus,
                      },
                    ]
                ).map((item, idx) => (
                  <Card key={idx} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyMonth}>{item.month}</Text>
                      <Text style={styles.historyEarned}>{formatRupees(item.earnedPaise)}</Text>
                    </View>
                    <View style={styles.historyFooter}>
                      <Text style={styles.historyMeta}>
                        {item.packetsSold} packets @ ₹
                        {((item.ratePerPacketPaise ?? ratePaise) / 100).toFixed(2)} / pkt
                      </Text>
                      <Badge
                        label={item.status}
                        variant={item.status === 'PAID' ? 'success' : 'warning'}
                        size="sm"
                      />
                    </View>
                  </Card>
                ))}
              </>
            ) : (
              /* Dedicated Sales Target Tab */
              <>
                {hasAssignedTarget ? (
                  <>
                    <TargetProgressStrip
                      targetProgress={targetProgress}
                      ratePerPacketPaise={ratePaise}
                      mode="detailed"
                      showWhenUnset={false}
                    />

                    <Card style={styles.targetGuideCard}>
                      <View style={styles.targetGuideHeader}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={BrandColors.green.primary} />
                        <Text style={styles.targetGuideTitle}>How Target Earnings Work</Text>
                      </View>
                      <Text style={styles.targetGuideText}>
                        You earn ₹{(ratePaise / 100).toFixed(2)} per packet on every confirmed sale. Reaching{' '}
                        {targetProgress?.targetPackets ?? 0} packets within the{' '}
                        {targetProgress?.period === 'DAILY' ? 'day' : 'month'} unlocks your extra{' '}
                        {targetProgress?.bonusPaise ? formatRupees(targetProgress.bonusPaise) : ''} target bonus
                        automatically.
                      </Text>
                    </Card>
                  </>
                ) : (
                  <EmptyState
                    icon="flag-outline"
                    title="No Sales Target Assigned Yet"
                    description={`You currently earn ₹${(ratePaise / 100).toFixed(2)} per confirmed packet (${thisMonthPackets.toLocaleString('en-IN')} pkts sold this month). When Admin assigns a target, your packet goal and bonus reward will show here.`}
                    actionTitle="View My Earnings"
                    onAction={() => setActiveTab('EARNINGS')}
                  />
                )}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  tabsBar: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  earningsCard: {
    backgroundColor: Colors.light.surface,
    marginBottom: Spacing.lg,
  },
  earningsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  earningsLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsValue: {
    ...Typography.display,
    color: Colors.light.heading,
    marginVertical: 4,
  },
  earningsSub: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  statVal: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    fontWeight: '700',
  },
  monthStrip: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthStripText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  monthStripRate: {
    ...Typography.caption,
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
  targetQuickJumpRow: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetQuickJumpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  targetQuickJumpText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  targetQuickJumpLink: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  targetGuideCard: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  targetGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  targetGuideTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  targetGuideText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  historyCard: {
    marginBottom: Spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMonth: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  historyEarned: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.xs,
  },
  historyMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
