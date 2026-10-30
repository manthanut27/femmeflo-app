import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import type { ManagerDashboardData, PaginationMeta, SaleItem, SellerItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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
import {
  formatCurrencyINR,
  formatDateIST,
  getISTDateKey,
  groupSalesByDay,
  type DailyReportGroup,
} from '@/utils/dateUtils';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED';

const PERIOD_FILTERS = [
  { label: 'All Territory Sales', value: 'all' },
  { label: 'Today Only', value: 'today' },
  { label: 'This Month', value: 'this_month' },
];

export default function ManagerSalesScreen() {
  const [viewMode, setViewMode] = useState<'DAILY_REPORT' | 'TRANSACTIONS'>('DAILY_REPORT');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [sellers, setSellers] = useState<SellerItem[]>([]);
  const [dashboardData, setDashboardData] = useState<ManagerDashboardData | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
    [getISTDateKey(new Date())]: true,
  });

  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [salesRes, dashRes, sellersRes] = await Promise.all([
        managerApi.listSales({ page: 1, pageSize: 100 }),
        managerApi.getDashboard().catch(() => null),
        managerApi.listSellers({ pageSize: 50 }).catch(() => ({ items: [] })),
      ]);

      setSales(salesRes.items || []);
      setPagination(salesRes.pagination);
      if (dashRes) setDashboardData(dashRes);
      setSellers(sellersRes.items || []);
    } catch (err) {
      console.warn('Failed to load manager sales and dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Group sales date-by-date
  const dailyGroups = useMemo<DailyReportGroup<SaleItem>[]>(() => {
    let list = sales;
    if (periodFilter === 'today') {
      const todayKey = getISTDateKey(new Date());
      list = list.filter((s) => getISTDateKey(s.createdAt || s.requestedAt) === todayKey);
    }
    return groupSalesByDay(list);
  }, [sales, periodFilter]);

  // Aggregate metrics across territory
  const territoryMetrics = useMemo(() => {
    const totalPaise = sales.reduce((sum, s) => sum + (s.totalAmountPaise ?? s.totalPaise ?? 0), 0);
    const totalPackets = sales.reduce((sum, s) => sum + (s.quantity || s.packetCount || 0), 0);
    const activeOfficersCount = sellers.filter((s) => s.active !== false).length || sellers.length;
    const confirmedCount = sales.filter((s) => s.status === 'CONFIRMED').length;
    const pendingCount = sales.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL').length;

    return {
      revenuePaise: dashboardData?.monthlyRevenuePaise ?? dashboardData?.metrics?.monthlyRevenuePaise ?? totalPaise,
      totalPackets: dashboardData?.monthlyPacketsSold ?? dashboardData?.metrics?.monthlyPacketsSold ?? totalPackets,
      activeOfficersCount: dashboardData?.activeSellersCount ?? dashboardData?.metrics?.activeSellersCount ?? activeOfficersCount,
      totalCustomers: dashboardData?.totalCustomers ?? dashboardData?.metrics?.totalCustomers ?? 0,
      confirmedCount,
      pendingCount,
    };
  }, [sales, sellers, dashboardData]);

  // Seller-wise performance breakdown
  const sellerPerformance = useMemo(() => {
    const perfMap: Record<string, { name: string; packets: number; totalPaise: number; count: number }> = {};

    for (const s of sales) {
      const sellerId = s.sellerId || s.seller?.id || 'unknown';
      const sellerName = s.seller?.name || 'Assigned Officer';

      if (!perfMap[sellerId]) {
        perfMap[sellerId] = { name: sellerName, packets: 0, totalPaise: 0, count: 0 };
      }
      perfMap[sellerId].packets += s.quantity || s.packetCount || 0;
      perfMap[sellerId].totalPaise += s.totalAmountPaise ?? s.totalPaise ?? 0;
      perfMap[sellerId].count += 1;
    }

    return Object.values(perfMap).sort((a, b) => b.totalPaise - a.totalPaise);
  }, [sales]);

  const filteredSales = useMemo(() => {
    let result = sales;
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => s.status === statusFilter || (statusFilter === 'PENDING' && s.status === 'PENDING_APPROVAL'));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.customer?.shopName?.toLowerCase().includes(q) ||
          s.seller?.name?.toLowerCase().includes(q) ||
          s.saleNumber?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sales, statusFilter, searchQuery]);

  const filterTabs = [
    { key: 'ALL' as const, label: 'All', badge: sales.length },
    { key: 'CONFIRMED' as const, label: 'Confirmed', badge: sales.filter((s) => s.status === 'CONFIRMED').length },
    { key: 'PENDING' as const, label: 'Pending', badge: sales.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL').length },
    { key: 'REJECTED' as const, label: 'Rejected', badge: sales.filter((s) => s.status === 'REJECTED').length },
  ];

  const renderTransactionItem = ({ item }: { item: SaleItem }) => {
    const totalAmount = item.totalAmountPaise ?? item.totalPaise ?? 0;
    const packets = item.quantity ?? item.packetCount ?? 0;

    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer?.shopName || 'Retail Customer'}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.orderMeta}>
                {item.saleNumber || `Order #${item.id.slice(0, 8)}`} • {formatDateIST(item.createdAt, 'short')}
              </Text>
            </View>
          </View>
          <Badge label={item.status} variant={item.status as any} />
        </View>

        {/* Customer Feedback Observation Snippet */}
        {item.customerFeedback ? (
          <View style={styles.feedbackSnippet}>
            <Ionicons name="chatbubble-ellipses" size={12} color={BrandColors.green.primary} style={{ marginRight: 4 }} />
            <Text style={styles.feedbackSnippetText} numberOfLines={2}>
              &ldquo;{item.customerFeedback}&rdquo;
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.sellerInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.sellerName}>{item.seller?.name || 'Assigned Officer'}</Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Ionicons name="cube-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.packets}>{packets} Packets</Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatCurrencyINR(totalAmount)}</Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Territory Sales & Reports"
        subtitle={`Territory Beat Analytics • ${territoryMetrics.activeOfficersCount} field officers`}
      />

      {/* Mode Switcher: Daily Report vs Order Transactions */}
      <View style={styles.modeToggleRow}>
        <Pressable
          style={[styles.modeTab, viewMode === 'DAILY_REPORT' && styles.modeTabActive]}
          onPress={() => setViewMode('DAILY_REPORT')}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={viewMode === 'DAILY_REPORT' ? '#FFFFFF' : '#475569'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeTabText, viewMode === 'DAILY_REPORT' && styles.modeTabTextActive]}>
            Daily Territory Report
          </Text>
        </Pressable>

        <Pressable
          style={[styles.modeTab, viewMode === 'TRANSACTIONS' && styles.modeTabActive]}
          onPress={() => setViewMode('TRANSACTIONS')}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={viewMode === 'TRANSACTIONS' ? '#FFFFFF' : '#475569'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.modeTabText, viewMode === 'TRANSACTIONS' && styles.modeTabTextActive]}>
            Transaction Ledger
          </Text>
        </Pressable>
      </View>

      {/* ==================================================== */}
      {/* 1. DAILY TERRITORY REPORT VIEW */}
      {/* ==================================================== */}
      {viewMode === 'DAILY_REPORT' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.green.primary]} />}
        >
          <View style={styles.contentWrapper}>
            {/* Territory KPI Grid */}
            <View style={styles.kpiGrid}>
              <Card style={[styles.kpiCard, { borderLeftColor: BrandColors.green.primary, borderLeftWidth: 4 }]}>
                <Text style={styles.kpiLabel}>Territory Revenue</Text>
                <Text style={styles.kpiValueGreen}>{formatCurrencyINR(territoryMetrics.revenuePaise)}</Text>
                <Text style={styles.kpiSub}>{territoryMetrics.confirmedCount} confirmed orders</Text>
              </Card>

              <Card style={[styles.kpiCard, { borderLeftColor: BrandColors.pink.primary, borderLeftWidth: 4 }]}>
                <Text style={styles.kpiLabel}>Team Volume</Text>
                <Text style={styles.kpiValuePink}>{territoryMetrics.totalPackets} pkts</Text>
                <Text style={styles.kpiSub}>{territoryMetrics.activeOfficersCount} active officers</Text>
              </Card>
            </View>

            {/* Seller-wise Performance Breakdown Card */}
            {sellerPerformance.length > 0 && (
              <Card style={styles.sellerPerfCard}>
                <View style={styles.sellerPerfHeader}>
                  <Ionicons name="people" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.sellerPerfTitle}>Seller-Wise Performance Ranking</Text>
                </View>
                {sellerPerformance.map((seller, idx) => (
                  <View key={seller.name + idx} style={styles.sellerRow}>
                    <View style={styles.sellerRankBadge}>
                      <Text style={styles.sellerRankText}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.sellerRowName}>{seller.name}</Text>
                      <Text style={styles.sellerRowSub}>
                        {seller.count} orders · {seller.packets} pkts sold
                      </Text>
                    </View>
                    <Text style={styles.sellerRowAmount}>{formatCurrencyINR(seller.totalPaise)}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Period Filter Chips */}
            <View style={styles.periodChipsRow}>
              {PERIOD_FILTERS.map((p) => {
                const isSelected = periodFilter === p.value;
                return (
                  <Pressable
                    key={p.value}
                    style={[styles.periodChip, isSelected && styles.periodChipActive]}
                    onPress={() => setPeriodFilter(p.value)}
                  >
                    <Text style={[styles.periodChipText, isSelected && styles.periodChipTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Daily Sales Breakdown */}
            <View style={styles.dailySectionHeader}>
              <Text style={styles.dailySectionTitle}>Daily Sales Breakdown</Text>
              <Text style={styles.dailySectionSub}>Date-by-date performance across field beat</Text>
            </View>

            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <CardSkeleton />
                <CardSkeleton />
              </View>
            ) : dailyGroups.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No Sales Recorded"
                description="No sales have been recorded across the territory for the selected filter."
              />
            ) : (
              dailyGroups.map((group) => {
                const isExpanded = Boolean(expandedDates[group.dateKey]);
                return (
                  <View key={group.dateKey} style={styles.dayGroupWrapper}>
                    {/* Collapsible Header */}
                    <Pressable
                      style={[styles.dayHeaderCard, group.isToday && styles.dayHeaderCardToday]}
                      onPress={() => toggleDateExpand(group.dateKey)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.dayLabelRow}>
                          <Text style={styles.dayLabelText}>{group.dayLabel}</Text>
                          {group.isToday && (
                            <Badge label="TODAY" variant="success" size="sm" showDot={false} />
                          )}
                        </View>
                        <Text style={styles.daySubText}>
                          {group.salesCount} orders · {group.totalPackets} packets · {group.officerNames.length} officers
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginRight: Spacing.sm }}>
                        <Text style={styles.dayRevenueText}>{formatCurrencyINR(group.totalPaise)}</Text>
                        <Text style={styles.dayCashBankText}>
                          Cash {formatCurrencyINR(group.cashPaise)} · Bank {formatCurrencyINR(group.bankPaise)}
                        </Text>
                      </View>

                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#64748B"
                      />
                    </Pressable>

                    {/* Expanded Day Details & Customer Feedback Observations */}
                    {isExpanded && (
                      <View style={styles.dayExpandedList}>
                        {group.sales.map((item) => {
                          const totalAmt = item.totalAmountPaise ?? item.totalPaise ?? 0;
                          return (
                            <Card key={item.id} style={styles.daySaleCard}>
                              <View style={styles.header}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.customerName} numberOfLines={1}>
                                    {item.customer?.shopName || 'Retail Customer'}
                                  </Text>
                                  <Text style={styles.orderMeta}>
                                    Officer: {item.seller?.name || 'Seller'} · #{item.saleNumber || item.id.slice(0, 8)}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.amount}>{formatCurrencyINR(totalAmt)}</Text>
                                  <Badge label={item.status} variant={item.status as any} size="sm" showDot={false} />
                                </View>
                              </View>

                              {/* Customer Feedback Summary */}
                              {item.customerFeedback ? (
                                <View style={styles.dayFeedbackCard}>
                                  <Ionicons name="chatbubble-ellipses" size={13} color={BrandColors.green.primary} />
                                  <Text style={styles.dayFeedbackText} numberOfLines={2}>
                                    &ldquo;{item.customerFeedback}&rdquo;
                                  </Text>
                                </View>
                              ) : null}
                            </Card>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      ) : (
        /* ==================================================== */
        /* 2. TRANSACTION LEDGER VIEW */
        /* ==================================================== */
        <View style={styles.innerContainer}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search shop, seller, or order #..."
                placeholderTextColor={Colors.light.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                accessibilityLabel="Search sales orders"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={HitSlop.md}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search query"
                >
                  <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Status Filter Tabs */}
          <View style={styles.filterSection}>
            <SegmentedTabs
              tabs={filterTabs}
              activeTab={statusFilter}
              activeColor={BrandColors.green.primary}
              onTabChange={(tab) => setStatusFilter(tab as StatusFilter)}
            />
          </View>

          {loading ? (
            <View style={{ padding: Spacing.lg }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : filteredSales.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No Sales Found"
              description={
                searchQuery
                  ? 'No sales orders matched your search criteria.'
                  : 'No sales recorded for this status.'
              }
            />
          ) : (
            <FlatList
              data={filteredSales}
              keyExtractor={(item) => item.id}
              renderItem={renderTransactionItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[BrandColors.green.primary]}
                />
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modeToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: Spacing.sm,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: '#F1F5F9',
  },
  modeTabActive: {
    backgroundColor: '#0F172A',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.md,
  },
  kpiLabel: {
    ...Typography.overline,
    color: '#64748B',
    marginBottom: 2,
  },
  kpiValueGreen: {
    fontSize: 20,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  kpiValuePink: {
    fontSize: 20,
    fontWeight: '800',
    color: BrandColors.pink.primary,
  },
  kpiSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  sellerPerfCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sellerPerfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.xs,
  },
  sellerPerfTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  sellerRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerRankText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  sellerRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  sellerRowSub: {
    fontSize: 10,
    color: '#64748B',
  },
  sellerRowAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  periodChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: Spacing.sm,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  periodChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  dailySectionHeader: {
    marginBottom: Spacing.sm,
  },
  dailySectionTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  dailySectionSub: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: 2,
  },
  dayGroupWrapper: {
    marginBottom: Spacing.sm,
  },
  dayHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  dayHeaderCardToday: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.green.primary,
  },
  dayLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  daySubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  dayRevenueText: {
    fontSize: 14,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  dayCashBankText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  dayExpandedList: {
    paddingLeft: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  daySaleCard: {
    marginBottom: Spacing.xs,
    padding: Spacing.sm,
  },
  dayFeedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.sm,
    padding: 6,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: BrandColors.green.primary,
  },
  dayFeedbackText: {
    fontSize: 11,
    color: '#166534',
    fontStyle: 'italic',
    marginLeft: 4,
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light.surface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  filterSection: {
    backgroundColor: Colors.light.surface,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  orderMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  sellerInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerName: {
    ...Typography.caption,
    color: Colors.light.text,
    fontWeight: '500',
  },
  packets: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  amount: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  feedbackSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 6,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  feedbackSnippetText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#166534',
    flex: 1,
  },
  loadingContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
