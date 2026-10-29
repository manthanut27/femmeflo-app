import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerIncentiveData } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';

export default function SellerIncentivesScreen() {
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
      <Header title="Seller Incentives" subtitle="Commissions & Target Performance" showBack />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.pink.primary} />
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
            {/* Main Earnings Card */}
            <Card style={styles.earningsCard}>
              <View style={styles.earningsHeaderRow}>
                <Text style={styles.earningsLabel}>Current Month Commission</Text>
                <View style={styles.iconCircle}>
                  <Ionicons name="trending-up" size={18} color={BrandColors.pink.primary} />
                </View>
              </View>
              <Text style={styles.earningsValue}>
                {formatRupees(incentives?.currentMonthEarnedPaise || 0)}
              </Text>
              <Text style={styles.earningsSub}>Calculated exclusively on confirmed sales</Text>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Packets Sold</Text>
                  <Text style={styles.statVal}>
                    {(incentives?.totalPacketsSoldMonth || 0).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Current Rate</Text>
                  <Text style={[styles.statVal, { color: BrandColors.pink.primary }]}>
                    ₹{((incentives?.ratePerPacketPaise || 500) / 100).toFixed(2)} <Text style={styles.statUnit}>/ pkt</Text>
                  </Text>
                </View>

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Pending Payout</Text>
                  <Text style={[styles.statVal, { color: BrandColors.green.primary }]}>
                    {formatRupees(incentives?.pendingPayoutPaise || 0)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Historical Rate Immutability Notice (Scenario 10) */}
            <Card variant="flat" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={BrandColors.green.primary} style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle}>Incentive Policy & Rate Protection</Text>
                  <Text style={styles.noticeDesc}>
                    Each confirmed sale automatically locks in your commission rate effective at the confirmation timestamp.
                    Historical incentives remain immutable and will not fluctuate when future rates change.
                  </Text>
                </View>
              </View>
            </Card>

            {/* Historical Monthly Ledger */}
            <Text style={styles.sectionHeading}>Historical Commission Ledger</Text>
            {(incentives?.history && incentives.history.length > 0 ? incentives.history : [
              {
                month: 'Current Month',
                packetsSold: incentives?.totalPacketsSoldMonth || 0,
                earnedPaise: incentives?.currentMonthEarnedPaise || 0,
                ratePerPacketPaise: incentives?.ratePerPacketPaise || 500,
                status: 'In Progress',
              },
            ]).map((item, idx) => (
              <Card key={idx} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyMonth}>{item.month}</Text>
                  <Text style={styles.historyEarned}>{formatRupees(item.earnedPaise)}</Text>
                </View>
                <View style={styles.historyFooter}>
                  <Text style={styles.historyMeta}>
                    {item.packetsSold} packets @ ₹{(item.ratePerPacketPaise / 100).toFixed(2)} / pkt
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.historyStatus}>{item.status}</Text>
                  </View>
                </View>
              </Card>
            ))}
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
  statusBadge: {
    backgroundColor: Colors.light.backgroundElement,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  historyStatus: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});
