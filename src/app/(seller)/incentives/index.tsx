import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerIncentiveData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { TargetProgressStrip } from '@/components/incentives/TargetProgressStrip';
import { LoadingState } from '@/components/ui/LoadingState';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';

export default function SellerIncentivesScreen() {
  const handleBack = useDashboardBackHandler('/(seller)');
  const [incentives, setIncentives] = useState<SellerIncentiveData | null>(null);
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

  return (
    <View style={styles.container}>
      <Header title="Seller Incentives" subtitle="Commissions & Target Performance" showBack onBack={handleBack} />

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
            {(() => {
              const ratePaise = incentives?.effectiveRatePaise ?? incentives?.ratePerPacketPaise ?? 100;
              const lifetimePackets = incentives?.totalPacketsSold ?? incentives?.summary?.totalPacketsSold ?? incentives?.totalPacketsSoldMonth ?? 0;
              const lifetimeEarnedPaise =
                incentives?.adjustedEntitlementPaise ??
                incentives?.totalEarnedPaise ??
                incentives?.summary?.adjustedEntitlementPaise ??
                incentives?.summary?.salesIncentivePaise ??
                incentives?.currentMonthEarnedPaise ??
                0;
              const paidPaise = incentives?.totalPaidPaise ?? incentives?.summary?.totalPaidPaise ?? 0;
              const pendingPaise = incentives?.pendingPayoutPaise ?? incentives?.summary?.outstandingPaise ?? 0;
              const thisMonthPackets = incentives?.summary?.currentMonth?.confirmedPackets ?? incentives?.totalPacketsSoldMonth ?? 0;
              const thisMonthEarnedPaise = incentives?.summary?.currentMonth?.salesIncentivePaise ?? incentives?.summary?.currentMonth?.earnedPaise ?? incentives?.currentMonthEarnedPaise ?? 0;
              const overallStatus =
                incentives?.status ||
                (paidPaise > 0 && pendingPaise <= 0
                  ? 'PAID'
                  : paidPaise > 0 && pendingPaise > 0
                    ? 'PARTIALLY_PAID'
                    : pendingPaise > 0
                      ? 'UNPAID'
                      : 'PENDING');

              return (
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
                  </Card>

                  {/* Historical Rate Immutability Notice */}
                  <Card variant="flat" style={styles.noticeCard}>
                    <View style={styles.noticeRow}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={BrandColors.green.primary}
                        style={{ marginRight: 8, marginTop: 2 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noticeTitle}>Incentive Policy & Rate Protection</Text>
                        <Text style={styles.noticeDesc}>
                          Each confirmed sale uses your commission rate (default ₹1.00/pkt unless customized). Already-paid
                          periods remain locked once payouts begin.
                        </Text>
                      </View>
                    </View>
                  </Card>

                  {/* Confirmed Sales Contributing to Commission */}
                  {incentives?.items && incentives.items.length > 0 ? (
                    <>
                      <TargetProgressStrip
                        targetProgress={incentives.targetProgress}
                        ratePerPacketPaise={ratePaise}
                        mode="detailed"
                        showWhenUnset
                      />

                      <Text style={styles.sectionHeading}>Confirmed Sale Incentives ({incentives.items.length})</Text>
                      {incentives.items.slice(0, 20).map((s: any, idx: number) => {
                        const qty = Number(s.quantity ?? s.packetsSold ?? 0);
                        const itemRate = s.incentiveRatePaise ?? ratePaise;
                        const itemEarned = s.incentiveAmountPaise ?? qty * itemRate;
                        const shopLabel = s.customer?.shopName || s.shopName || s.invoice?.invoiceNumber || 'Confirmed Sale';
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

                  {/* Manual Adjustments */}
                  {incentives?.adjustments && incentives.adjustments.length > 0 ? (
                    <>
                      <Text style={styles.sectionHeading}>Adjustments</Text>
                      {incentives.adjustments.map((adj: any, idx: number) => (
                        <Card key={adj.id || idx} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <View style={{ flex: 1, marginRight: Spacing.sm }}>
                              <Text style={styles.historyMonth}>{adj.reason || 'Adjustment'}</Text>
                              <Text style={styles.historyMeta}>
                                {adj.adjustmentDate ? new Date(adj.adjustmentDate).toLocaleDateString('en-IN') : ''}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.historyEarned,
                                { color: adj.type === 'ADD' ? BrandColors.green.primary : Colors.light.error },
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
                                {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : 'Paid'}
                              </Text>
                              <Text style={[styles.historyMeta, { marginTop: 2 }]}>
                                Via {p.paymentMethod || 'Bank Transfer'} {p.referenceId ? `• Ref: ${p.referenceId}` : ''}
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
                          {item.packetsSold} packets @ ₹{((item.ratePerPacketPaise ?? ratePaise) / 100).toFixed(2)} / pkt
                        </Text>
                        <Badge
                          label={item.status}
                          variant={item.status === 'PAID' ? 'success' : 'warning'}
                          size="sm"
                        />
                      </View>
                    </Card>
                  ))}

                  {incentives && Array.isArray(incentives.adjustments) && incentives.adjustments.length > 0 && (
                    <>
                      <Text style={styles.sectionHeading}>Bonuses &amp; Adjustments ({incentives.adjustments.length})</Text>
                      {incentives.adjustments.map((adj: any, idx: number) => (
                        <Card key={adj.id || idx} style={styles.historyCard}>
                          <View style={styles.historyHeader}>
                            <Text style={[styles.historyMonth, { flex: 1, marginRight: Spacing.sm }]}>
                              {adj.reason || (adj.type === 'DEDUCT' ? 'Deduction' : 'Bonus Addition')}
                            </Text>
                            <Text
                              style={[
                                styles.historyEarned,
                                { color: adj.type === 'DEDUCT' ? Colors.light.danger : Colors.light.success },
                              ]}
                            >
                              {adj.type === 'DEDUCT' ? '-' : '+'}
                              {formatRupees(adj.amountPaise || 0)}
                            </Text>
                          </View>
                        </Card>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
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
    marginBottom: Spacing.md,
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
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  statUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  noticeCard: {
    backgroundColor: Colors.light.surfaceMuted,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.heading,
    marginBottom: 2,
  },
  noticeDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 17,
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
});
