import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { TargetProgressStrip } from '@/components/incentives/TargetProgressStrip';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { formatCurrencyINR, formatDateIST } from '@/utils/dateUtils';

interface TeamIncentiveMember {
  targetProgress?: import('@/api/types').TargetProgressSummary | null;
  ratePerPacketPaise?: number;
  seller: {
    id: string;
    name: string;
    phone?: string;
    employeeCode?: string;
  };
  sellerId?: string;
  sellerName?: string;
  phone?: string;
  confirmedPackets: number;
  earnedPaise: number;
  totalPaidPaise: number;
  outstandingPaise: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'UNPAID';
}

export default function ManagerIncentivesScreen() {
  const { user } = useAuth();
  const handleBack = useDashboardBackHandler('/(manager)');

  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'TEAM' | 'PERSONAL'>('TEAM');
  const [autoSelectedPersonal, setAutoSelectedPersonal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIncentives = useCallback(async () => {
    try {
      const res = await managerApi.getIncentives();
      setData(res);
      const membersList = res?.team?.members || [];
      const pSum = res?.personal?.summary;
      const pPackets = Number(pSum?.totalPacketsSold ?? pSum?.confirmedPackets ?? 0);
      const pEarned = Number(
        pSum?.adjustedEntitlementPaise ?? pSum?.earnedPaise ?? pSum?.salesIncentivePaise ?? pSum?.totalIncentivePaise ?? 0
      );
      if (
        !autoSelectedPersonal &&
        membersList.length === 0 &&
        ((user as any)?.isSeller || pPackets > 0 || pEarned > 0)
      ) {
        setActiveTab('PERSONAL');
        setAutoSelectedPersonal(true);
      }
    } catch (err) {
      console.warn('Failed to load manager incentives', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [autoSelectedPersonal, user]);

  useEffect(() => {
    loadIncentives();
  }, [loadIncentives]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIncentives();
  }, [loadIncentives]);

  const team = data?.team;
  const personal = data?.personal;

  // Extract team members
  const teamMembers = useMemo<TeamIncentiveMember[]>(() => {
    if (!team?.members || !Array.isArray(team.members)) return [];
    return team.members.map((m: any, idx: number): TeamIncentiveMember => {
      const sellerId = m.seller?.id || m.sellerId || m.id || `seller-${idx}`;
      const sellerName = m.seller?.name || m.sellerName || m.name || 'Field Officer';
      const sellerPhone = m.seller?.phone || m.phone || '';
      const employeeCode = m.seller?.employeeCode || m.employeeCode || '';
      const confirmedPackets = Number(m.confirmedPackets ?? m.packetsSold ?? 0);
      const earnedPaise = Number(m.earnedPaise ?? m.totalEarnedPaise ?? 0);
      const totalPaidPaise = Number(m.totalPaidPaise ?? m.paidPaise ?? 0);
      const outstandingPaise = Number(m.outstandingPaise ?? m.netPayablePaise ?? m.pendingPaise ?? 0);

      return {
        seller: {
          id: sellerId,
          name: sellerName,
          phone: sellerPhone,
          employeeCode,
        },
        sellerId,
        sellerName,
        phone: sellerPhone,
        confirmedPackets,
        earnedPaise,
        totalPaidPaise,
        outstandingPaise,
        status: (m.status || 'PENDING') as 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'UNPAID',
      };
    });
  }, [team]);

  // Filter team members by search query
  const filteredMembers = useMemo<TeamIncentiveMember[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((m: TeamIncentiveMember) => {
      const name = (m.seller?.name || m.sellerName || '').toLowerCase();
      const code = (m.seller?.employeeCode || '').toLowerCase();
      const phone = (m.seller?.phone || m.phone || '').toLowerCase();
      return name.includes(q) || code.includes(q) || phone.includes(q);
    });
  }, [teamMembers, searchQuery]);

  const teamSummary = team?.summary ?? {
    assignedSellersCount: teamMembers.length,
    totalPacketsSold: 0,
    totalIncentiveEarnedPaise: 0,
    totalIncentiveEarnedRupees: 0,
    totalPaidPaise: 0,
    totalPendingPaise: 0,
    totalPaidRupees: 0,
    totalPendingRupees: 0,
  };

  const personalSummary = personal?.summary ?? {
    totalPacketsSold: 0,
    totalIncentivePaise: 0,
    totalPaidPaise: 0,
    outstandingPaise: 0,
    status: 'PENDING',
  };

  const personalPackets = Number(
    personalSummary.totalPacketsSold ?? personalSummary.confirmedPackets ?? 0
  );
  const personalRatePaise = Number(
    personalSummary.effectiveRatePaise ??
      personalSummary.ratePerPacketPaise ??
      data?.effectiveRatePaise ??
      data?.ratePerPacketPaise ??
      100
  );
  const personalEarnedPaise = Number(
    personalSummary.adjustedEntitlementPaise ??
      personalSummary.earnedPaise ??
      personalSummary.salesIncentivePaise ??
      personalSummary.totalIncentivePaise ??
      0
  );
  const personalPaidPaise = Number(
    personalSummary.totalPaidPaise ?? personalSummary.paidPaise ?? 0
  );
  const personalOutstandingPaise = Number(
    personalSummary.outstandingPaise ?? Math.max(0, personalEarnedPaise - personalPaidPaise)
  );

  return (
    <View style={styles.container}>
      <Header
        title="Team Bonus"
        subtitle={`Area: ${user?.district || 'My Area'}${user?.name ? ` • ${user.name}` : ''}`}
        showBack
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.green.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Mode Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => setActiveTab('TEAM')}
              style={[styles.tabBtn, activeTab === 'TEAM' && styles.tabBtnActive]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === 'TEAM' ? BrandColors.green.dark : Colors.light.textSecondary}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'TEAM' && styles.tabBtnTextActive]}
                numberOfLines={1}
              >
                Team Bonus ({teamMembers.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('PERSONAL')}
              style={[styles.tabBtn, activeTab === 'PERSONAL' && styles.tabBtnActive]}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={activeTab === 'PERSONAL' ? BrandColors.green.dark : Colors.light.textSecondary}
              />
              <Text
                style={[styles.tabBtnText, activeTab === 'PERSONAL' && styles.tabBtnTextActive]}
                numberOfLines={1}
              >
                My Bonus
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: TEAM BONUS */}
          {activeTab === 'TEAM' && (
            <View>
              {/* KPI Summary Grid */}
              {loading ? (
                <View style={styles.kpiContainer}>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCardWrapper}>
                      <CardSkeleton />
                    </View>
                    <View style={styles.kpiCardWrapper}>
                      <CardSkeleton />
                    </View>
                  </View>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCardWrapper}>
                      <CardSkeleton />
                    </View>
                    <View style={styles.kpiCardWrapper}>
                      <CardSkeleton />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.kpiContainer}>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCardWrapper}>
                      <StatCard
                        title="Packets Sold"
                        value={`${(teamSummary.totalPacketsSold || 0).toLocaleString('en-IN')} pkts`}
                        subtitle="Sold by team"
                        icon="cube-outline"
                        iconColor="#0284C7"
                        iconBg="#F0F9FF"
                      />
                    </View>

                    <View style={styles.kpiCardWrapper}>
                      <StatCard
                        title="Total Bonus"
                        value={formatCurrencyINR(
                          teamSummary.totalIncentiveEarnedPaise ||
                            teamSummary.totalIncentiveEarnedRupees * 100 ||
                            0
                        )}
                        subtitle="Earned by team"
                        icon="wallet-outline"
                        iconColor={BrandColors.pink.primary}
                        iconBg={BrandColors.pink.subtle}
                      />
                    </View>
                  </View>

                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCardWrapper}>
                      <StatCard
                        title="Paid"
                        value={formatCurrencyINR(
                          teamSummary.totalPaidPaise ||
                            teamSummary.totalPaidRupees * 100 ||
                            0
                        )}
                        subtitle="Money sent"
                        icon="checkmark-done-circle-outline"
                        iconColor={BrandColors.green.primary}
                        iconBg={BrandColors.green.subtle}
                        accentColor={BrandColors.green.primary}
                      />
                    </View>

                    <View style={styles.kpiCardWrapper}>
                      <StatCard
                        title="Pending"
                        value={formatCurrencyINR(
                          teamSummary.totalPendingPaise ||
                            teamSummary.totalPendingRupees * 100 ||
                            0
                        )}
                        subtitle="Money left"
                        icon="hourglass-outline"
                        iconColor={Colors.light.warning}
                        iconBg={Colors.light.warningBg}
                        accentColor={Colors.light.warning}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
                <TextInput
                  placeholder="Search name or phone..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  placeholderTextColor={Colors.light.textTertiary}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={HitSlop.sm}>
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Members List */}
              {loading ? (
                <View style={{ paddingVertical: Spacing.xl }}>
                  <ActivityIndicator size="small" color={BrandColors.green.primary} />
                </View>
              ) : filteredMembers.length === 0 ? (
                !searchQuery && ((user as any)?.isSeller || personalPackets > 0 || personalEarnedPaise > 0) ? (
                  <Card style={styles.personalDetailCard}>
                    <View style={styles.memberTop}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={styles.personalTitle}>Dual Role: Direct Field Sales Bonus</Text>
                        <Text style={styles.memberSub}>
                          No separate team sellers assigned yet. Your own confirmed direct sales appear under My Bonus.
                        </Text>
                      </View>
                      <Badge label={`₹${(personalRatePaise / 100).toFixed(2)}/pkt`} variant="ACTIVE" />
                    </View>
                    <View style={styles.figuresGrid}>
                      <View style={styles.figCol}>
                        <Text style={styles.figLabel}>My Packets</Text>
                        <Text style={styles.figValueGreen}>{personalPackets.toLocaleString('en-IN')} pkts</Text>
                      </View>
                      <View style={styles.figCol}>
                        <Text style={styles.figLabel}>My Earned</Text>
                        <Text style={styles.figValuePink}>{formatCurrencyINR(personalEarnedPaise)}</Text>
                      </View>
                      <View style={styles.figCol}>
                        <Text style={styles.figLabel}>Pending</Text>
                        <Text style={styles.figValueAmber}>{formatCurrencyINR(personalOutstandingPaise)}</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setActiveTab('PERSONAL')}
                      style={styles.switchPersonalBtn}
                      accessibilityRole="button"
                    >
                      <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.switchPersonalBtnText}>View My Bonus Breakdown</Text>
                    </Pressable>
                  </Card>
                ) : (
                  <EmptyState
                    title="No bonus yet"
                    description={
                      searchQuery
                        ? 'No seller matches your search.'
                        : 'Bonus shows here after sales are confirmed.'
                    }
                    icon="gift-outline"
                  />
                )
              ) : (
                <View style={styles.membersList}>
                  {filteredMembers.map((member) => {
                    const status = member.status || 'PENDING';
                    let statusVariant: 'ACTIVE' | 'PENDING' | 'REJECTED' = 'PENDING';
                    let statusLabel = 'PENDING';

                    if (status === 'PAID') {
                      statusVariant = 'ACTIVE';
                      statusLabel = 'PAID';
                    } else if (status === 'PARTIALLY_PAID') {
                      statusVariant = 'PENDING';
                      statusLabel = 'PART PAID';
                    }

                    const sellerObj = member.seller || {
                      id: member.sellerId || '',
                      name: member.sellerName || 'Seller',
                      phone: member.phone || '',
                    };

                    return (
                      <Card key={sellerObj.id || member.sellerId || String(Math.random())} style={styles.memberCard}>
                        <View style={styles.memberTop}>
                          <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {sellerObj.name}
                            </Text>
                            <Text style={styles.memberSub} numberOfLines={1}>
                              {sellerObj.phone ? `${sellerObj.phone} · ` : ''}
                              {(member.confirmedPackets || 0).toLocaleString('en-IN')} pkts sold
                            </Text>
                          </View>
                          <Badge label={statusLabel} variant={statusVariant} />
                        </View>

                        <TargetProgressStrip
                          targetProgress={member.targetProgress}
                          ratePerPacketPaise={member.ratePerPacketPaise}
                          mode="compact"
                          showWhenUnset={false}
                        />

                        {/* Breakdown Box */}
                        <View style={styles.figuresGrid}>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Total Bonus</Text>
                            <Text style={styles.figValuePink}>
                              {formatCurrencyINR(member.earnedPaise || 0)}
                            </Text>
                          </View>

                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Paid</Text>
                            <Text style={styles.figValueGreen}>
                              {formatCurrencyINR(member.totalPaidPaise || 0)}
                            </Text>
                          </View>

                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Pending</Text>
                            <Text style={styles.figValueAmber}>
                              {formatCurrencyINR(member.outstandingPaise || 0)}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: PERSONAL BONUS */}
          {activeTab === 'PERSONAL' && (
            <View>
              <View style={styles.kpiContainer}>
                <View style={styles.kpiRow}>
                  <View style={styles.kpiCardWrapper}>
                    <StatCard
                      title="My Packets"
                      value={`${personalPackets.toLocaleString('en-IN')} pkts`}
                      subtitle={`Rate: ₹${(personalRatePaise / 100).toFixed(2)}/pkt`}
                      icon="cube-outline"
                      iconColor="#0284C7"
                      iconBg="#F0F9FF"
                    />
                  </View>

                  <View style={styles.kpiCardWrapper}>
                    <StatCard
                      title="My Bonus"
                      value={formatCurrencyINR(personalEarnedPaise)}
                      subtitle="Total earned"
                      icon="wallet-outline"
                      iconColor={BrandColors.pink.primary}
                      iconBg={BrandColors.pink.subtle}
                    />
                  </View>
                </View>
              </View>

              <Card style={styles.personalDetailCard}>
                <View style={styles.memberTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personalTitle}>My Bonus Account</Text>
                    <Text style={styles.personalDesc}>
                      Bonus earned from your own direct sales at ₹{(personalRatePaise / 100).toFixed(2)} per packet.
                    </Text>
                  </View>
                  <Badge
                    label={personalSummary.status || (personalOutstandingPaise <= 0 && personalPaidPaise > 0 ? 'PAID' : personalOutstandingPaise > 0 ? 'UNPAID' : 'PENDING')}
                    variant={personalOutstandingPaise <= 0 && personalPaidPaise > 0 ? 'ACTIVE' : 'PENDING'}
                  />
                </View>

                <View style={styles.personalSummaryRow}>
                  <Text style={styles.personalSummaryLabel}>Commission Rate:</Text>
                  <Text style={styles.figValuePink}>
                    ₹{(personalRatePaise / 100).toFixed(2)} / pkt
                  </Text>
                </View>

                <View style={styles.personalSummaryRow}>
                  <Text style={styles.personalSummaryLabel}>Paid so far:</Text>
                  <Text style={styles.personalSummaryValGreen}>
                    {formatCurrencyINR(personalPaidPaise)}
                  </Text>
                </View>

                <View style={styles.personalSummaryRow}>
                  <Text style={styles.personalSummaryLabel}>Pending:</Text>
                  <Text style={styles.personalSummaryValAmber}>
                    {formatCurrencyINR(personalOutstandingPaise)}
                  </Text>
                </View>
              </Card>

              <View style={{ marginTop: Spacing.md }}>
                <TargetProgressStrip
                  targetProgress={personal?.targetProgress}
                  ratePerPacketPaise={personalRatePaise}
                  mode="detailed"
                  showWhenUnset
                />
              </View>

              {Array.isArray(personal?.items) && personal.items.length > 0 && (
                <Card style={[styles.personalDetailCard, { marginTop: Spacing.md }]}>
                  <Text style={styles.personalTitle}>Confirmed Sales Breakdown ({personal.items.length})</Text>
                  {personal.items.slice(0, 20).map((item: any, idx: number) => {
                    const qty = Number(item.quantity ?? item.packetsSold ?? 0);
                    const effRate = item.incentiveRatePaise ?? personalRatePaise;
                    const effAmt = item.incentiveAmountPaise ?? qty * effRate;
                    const dateStr = item.date || item.confirmedAt || item.createdAt;
                    return (
                      <View key={item.saleId || item.id || idx} style={styles.personalSummaryRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.personalSummaryLabel}>
                            {item.customer?.shopName || item.invoice?.invoiceNumber || 'Confirmed Sale'}
                          </Text>
                          <Text style={styles.memberSub}>
                            {qty.toLocaleString('en-IN')} pkts × ₹{(effRate / 100).toFixed(2)}/pkt
                            {dateStr ? ` • ${formatDateIST(dateStr, 'short')}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.figValuePink}>{formatCurrencyINR(effAmt)}</Text>
                      </View>
                    );
                  })}
                </Card>
              )}

              {Array.isArray(personal?.adjustments) && personal.adjustments.length > 0 && (
                <Card style={[styles.personalDetailCard, { marginTop: Spacing.md }]}>
                  <Text style={styles.personalTitle}>Bonuses &amp; Adjustments ({personal.adjustments.length})</Text>
                  {personal.adjustments.map((adj: any, idx: number) => (
                    <View key={adj.id || idx} style={styles.personalSummaryRow}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={styles.personalSummaryLabel}>
                          {adj.reason || (adj.type === 'DEDUCT' ? 'Deduction' : 'Bonus Addition')}
                        </Text>
                        <Text style={styles.memberSub}>
                          {adj.adjustmentDate ? formatDateIST(adj.adjustmentDate, 'short') : 'Recorded'}
                        </Text>
                      </View>
                      <Text
                        style={
                          adj.type === 'DEDUCT' ? styles.figValuePink : styles.personalSummaryValGreen
                        }
                      >
                        {adj.type === 'DEDUCT' ? '-' : '+'}
                        {formatCurrencyINR(adj.amountPaise || 0)}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}

              {Array.isArray(personal?.payouts) && personal.payouts.length > 0 && (
                <Card style={[styles.personalDetailCard, { marginTop: Spacing.md }]}>
                  <Text style={styles.personalTitle}>Payout History</Text>
                  {personal.payouts.map((p: any, idx: number) => (
                    <View key={p.id || idx} style={styles.personalSummaryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.personalSummaryLabel}>
                          {p.paymentMethod || 'Bank Transfer'} {p.referenceId ? `• ${p.referenceId}` : ''}
                        </Text>
                        <Text style={styles.memberSub}>
                          {p.paymentDate ? formatDateIST(p.paymentDate, 'short') : 'Paid'}
                        </Text>
                      </View>
                      <Text style={styles.personalSummaryValGreen}>
                        {formatCurrencyINR(p.amountPaise || 0)}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  bannerCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.dark,
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: Radius.md,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: BrandColors.green.light,
    borderWidth: 1,
  },
  tabBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  tabBtnTextActive: {
    color: BrandColors.green.dark,
    fontWeight: '800',
  },
  kpiContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  kpiCardWrapper: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    padding: 0,
  },
  membersList: {
    gap: Spacing.md,
  },
  memberCard: {
    padding: Spacing.md,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  memberName: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  memberSub: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  figuresGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  figCol: {
    flex: 1,
    alignItems: 'center',
  },
  figLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  figValuePink: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  figValueGreen: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  figValueAmber: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#D97706',
  },
  personalDetailCard: {
    padding: Spacing.md,
  },
  personalTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    marginBottom: Spacing.xs,
  },
  personalDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  personalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  personalSummaryLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  personalSummaryValGreen: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  personalSummaryValAmber: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#D97706',
  },
  switchPersonalBtn: {
    marginTop: Spacing.md,
    backgroundColor: BrandColors.green.primary,
    borderRadius: Radius.md,
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  switchPersonalBtnText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
