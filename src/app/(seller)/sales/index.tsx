import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaginationMeta, SaleItem, SellerDashboardData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  DropdownOption,
  SearchableDropdownModal,
} from '@/components/ui/SearchableDropdownModal';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { formatCurrencyINR, formatDateIST, getISTDateKey, groupSalesByDay, isTodayIST, type DailyReportGroup } from '@/utils/dateUtils';

const STATUS_FILTERS: Array<{ label: string; value: string | null }> = [
  { label: 'All Orders', value: null },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Uncollected Payments', value: 'PAYMENT_PENDING' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Rejected', value: 'REJECTED' },
];

const PERIOD_FILTERS = [
  { label: 'All Dates', value: 'all' },
  { label: 'Today Only', value: 'today' },
  { label: 'This Month', value: 'this_month' },
];

export default function SalesListScreen() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'DAILY_REPORT' | 'TRANSACTIONS'>('DAILY_REPORT');
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null);

  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({
    [getISTDateKey(new Date())]: true,
  });

  const loadCustomers = useCallback(async () => {
    try {
      const res = await sellerApi.listCustomers({ pageSize: 100 });
      setCustomers(res.items || []);
    } catch (err) {
      console.warn('Failed to load customers for sales list', err);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const loadSales = useCallback(
    async (page = 1, append = false) => {
      try {
        if (!append) setLoading(true);
        const [salesRes, dashRes] = await Promise.all([
          sellerApi.listSales({
            page,
            pageSize: 50,
            status: selectedStatus === 'PAYMENT_PENDING' ? undefined : (selectedStatus || undefined),
            paymentMode: selectedStatus === 'PAYMENT_PENDING' ? 'PENDING' : undefined,
            period: selectedPeriod === 'this_month' ? 'this_month' : undefined,
            customerId: selectedCustomerId || undefined,
          }),
          sellerApi.getDashboard().catch(() => null),
        ]);

        let items = salesRes.items || [];
        if (selectedCustomerId) {
          items = items.filter((s) => (s.customer?.id || s.customerId) === selectedCustomerId);
        }
        if (selectedStatus === 'PAYMENT_PENDING') {
          items = items.filter((s) => s.paymentMode === 'PENDING' && s.status !== 'REJECTED');
        }

        if (append) {
          setSales((prev) => [...prev, ...items]);
        } else {
          setSales(items);
        }
        setPagination(salesRes.pagination);
        if (dashRes) setDashboardData(dashRes);
      } catch (err) {
        console.warn('Failed to load sales', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [selectedStatus, selectedPeriod, selectedCustomerId]
  );

  useEffect(() => {
    loadSales(1, false);
  }, [loadSales]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const customerDropdownOptions = useMemo<DropdownOption[]>(() => {
    const allOpt: DropdownOption = {
      id: 'ALL',
      title: 'All Retail Customers',
      subtitle: `View transactions across all ${customers.length} retail outlets`,
      badge: `${customers.length} outlets`,
      icon: 'people-outline',
    };

    const items: DropdownOption[] = customers.map((c) => ({
      id: c.id,
      title: c.shopName,
      subtitle: `Owner: ${c.ownerName || (c as any).contactName || '—'} • ${c.village || c.district || 'Territory'} • 📞 ${c.phone}`,
      badge: c.category?.name || 'RETAIL',
      icon: 'storefront-outline',
      metadata: `${c.phone || ''} ${c.address || ''} ${c.pincode || ''}`,
    }));

    return [allOpt, ...items];
  }, [customers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales(1, false);
  }, [loadSales]);

  const onEndReached = () => {
    if (loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    loadSales(pagination.page + 1, true);
  };

  const toggleDateExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Group sales date-by-date
  const dailyGroups = useMemo<DailyReportGroup<SaleItem>[]>(() => {
    let list = sales;
    if (selectedPeriod === 'today') {
      const todayKey = getISTDateKey(new Date());
      list = list.filter((s) => getISTDateKey(s.createdAt || s.requestedAt) === todayKey);
    }
    return groupSalesByDay(list);
  }, [sales, selectedPeriod]);

  // Today's verified totals
  const todayMetrics = useMemo(() => {
    const todaySales = sales.filter((s) => isTodayIST(s.createdAt || s.requestedAt));
    const totalPaise = todaySales.reduce((sum, s) => sum + (s.totalAmountPaise ?? s.totalPaise ?? 0), 0);
    const totalPackets = todaySales.reduce((sum, s) => sum + (s.quantity || s.packetCount || 0), 0);
    const orderCount = todaySales.length;

    let cashPaise = 0;
    let bankPaise = 0;
    let pendingPaise = 0;

    for (const s of todaySales) {
      const amt = s.totalAmountPaise ?? s.totalPaise ?? 0;
      if (s.paymentMode === 'CASH') cashPaise += amt;
      else if (s.paymentMode === 'BANK') bankPaise += amt;
      else if (s.paymentMode === 'PENDING') pendingPaise += amt;
    }

    return {
      totalPaise,
      totalPackets,
      orderCount,
      cashPaise,
      bankPaise,
      pendingPaise,
    };
  }, [sales]);

  const renderTransactionItem = ({ item }: { item: SaleItem }) => {
    const totalAmount = item.totalAmountPaise ?? item.totalPaise ?? 0;
    const packets = item.quantity ?? item.packetCount ?? 0;

    return (
      <Card
        onPress={() => router.push(`/(seller)/sales/${item.id}` as any)}
        accessibilityLabel={`Order for ${item.customer?.shopName || 'Retail Customer'}, ${formatCurrencyINR(totalAmount)}`}
        style={styles.saleCard}
      >
        <View style={styles.cardHeader}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer?.shopName || 'Retail Customer'}
            </Text>
            <Text style={styles.orderNumber}>
              #{item.saleNumber || item.id.slice(0, 8)} • {formatDateIST(item.createdAt, 'short')}
            </Text>
          </View>
          <Badge label={item.status} variant={item.status as any} />
        </View>

        {/* Customer Feedback if present */}
        {item.customerFeedback ? (
          <View style={styles.feedbackSnippet}>
            <Ionicons name="chatbubble-ellipses" size={12} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
            <Text style={styles.feedbackSnippetText} numberOfLines={1}>
              &ldquo;{item.customerFeedback}&rdquo;
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.leftFooter}>
            <Text style={styles.packetText}>{packets} packets</Text>
            <Badge label={item.paymentMode} variant={item.paymentMode as any} size="sm" showDot={false} />
            {item.paymentMode === 'PENDING' && item.status !== 'REJECTED' && (
              <View style={styles.uncollectedPill}>
                <Text style={styles.uncollectedPillText}>Collect ›</Text>
              </View>
            )}
          </View>
          <Text style={styles.amountText}>{formatCurrencyINR(totalAmount)}</Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Sales & Reports"
        subtitle={
          selectedCustomer
            ? `${sales.length} orders for ${selectedCustomer.shopName}`
            : `${sales.length} orders loaded • IST Analytics`
        }
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new sale"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() =>
              router.push({
                pathname: '/(seller)/sales/new',
                params: selectedCustomerId ? { customerId: selectedCustomerId } : {},
              } as any)
            }
            hitSlop={HitSlop.md}
          >
            <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      {/* View Mode Toggle: Daily Report vs Transactions */}
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
            Daily Sales Report
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
            Order Ledger
          </Text>
        </Pressable>
      </View>

      {/* Retail Customer Dropdown Filter with Search */}
      <View style={styles.customerFilterRow}>
        <TouchableOpacity
          style={[
            styles.customerFilterTrigger,
            Boolean(selectedCustomerId) && styles.customerFilterTriggerActive,
          ]}
          onPress={() => setCustomerPickerOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Filter sales by retail customer"
        >
          <View style={styles.customerFilterLeft}>
            <View
              style={[
                styles.customerFilterIconBox,
                Boolean(selectedCustomerId) && styles.customerFilterIconBoxActive,
              ]}
            >
              <Ionicons
                name={selectedCustomerId ? 'storefront' : 'funnel-outline'}
                size={16}
                color={selectedCustomerId ? '#FFFFFF' : BrandColors.pink.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.customerFilterLabelText}>Retail Customer Account</Text>
              <Text style={styles.customerFilterSelectedName} numberOfLines={1}>
                {selectedCustomer ? selectedCustomer.shopName : 'All Retail Customers'}
              </Text>
            </View>
          </View>
          <View style={styles.customerFilterRight}>
            {selectedCustomerId ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setSelectedCustomerId(null);
                }}
                hitSlop={HitSlop.md}
                style={styles.customerFilterClearBtn}
              >
                <Ionicons name="close-circle" size={16} color={Colors.light.textSecondary} />
                <Text style={styles.customerFilterClearText}>Reset</Text>
              </Pressable>
            ) : (
              <View style={styles.customerFilterChevron}>
                <Text style={styles.customerFilterCountText}>{customers.length}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.light.textSecondary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ==================================================== */}
      {/* 1. DAILY SALES REPORT VIEW */}
      {/* ==================================================== */}
      {viewMode === 'DAILY_REPORT' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.primary]} />}
        >
          <View style={styles.contentWrapper}>
            {/* Today's KPI Metric Cards */}
            <View style={styles.kpiGrid}>
              <Card
                onPress={() => {
                  setSelectedPeriod('today');
                  setSelectedStatus(null);
                  setViewMode('TRANSACTIONS');
                }}
                accessibilityLabel={`Today's Revenue: ${formatCurrencyINR(todayMetrics.totalPaise)}. Tap to view transactions.`}
                style={[styles.kpiCard, { borderLeftColor: BrandColors.green.primary, borderLeftWidth: 4 }]}
              >
                <View style={styles.kpiTitleRow}>
                  <Text style={styles.kpiLabel}>Today&apos;s Revenue</Text>
                  <Ionicons name="chevron-forward" size={13} color={BrandColors.green.primary} />
                </View>
                <Text style={styles.kpiValueGreen}>{formatCurrencyINR(todayMetrics.totalPaise)}</Text>
                <Text style={styles.kpiSub}>{todayMetrics.orderCount} orders recorded today</Text>
              </Card>

              <Card
                onPress={() => {
                  setSelectedPeriod('today');
                  setSelectedStatus(null);
                  setViewMode('TRANSACTIONS');
                }}
                accessibilityLabel={`Today's Volume: ${todayMetrics.totalPackets} packets. Tap to view transactions.`}
                style={[styles.kpiCard, { borderLeftColor: BrandColors.pink.primary, borderLeftWidth: 4 }]}
              >
                <View style={styles.kpiTitleRow}>
                  <Text style={styles.kpiLabel}>Today&apos;s Volume</Text>
                  <Ionicons name="chevron-forward" size={13} color={BrandColors.pink.primary} />
                </View>
                <Text style={styles.kpiValuePink}>{todayMetrics.totalPackets} pkts</Text>
                <Text style={styles.kpiSub}>Dispatched to retailers</Text>
              </Card>
            </View>

            {/* Payment Summary Box */}
            <Card style={styles.paymentSummaryCard}>
              <View style={styles.paymentSummaryHeader}>
                <Text style={styles.paymentSummaryTitle}>Today&apos;s Payment Collection Summary</Text>
                <Pressable
                  onPress={() => router.push('/(seller)/sales/pending' as any)}
                  hitSlop={HitSlop.sm}
                  style={styles.viewPendingHeaderLink}
                >
                  <Text style={styles.viewPendingHeaderLinkText}>All Uncollected ›</Text>
                </Pressable>
              </View>
              <View style={styles.paymentRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cash collection: ${formatCurrencyINR(todayMetrics.cashPaise)}`}
                  onPress={() => {
                    setSelectedPeriod('today');
                    setViewMode('TRANSACTIONS');
                  }}
                  style={({ pressed }) => [styles.paymentBox, pressed && styles.paymentBoxPressed]}
                >
                  <Text style={styles.paymentBoxLabel}>CASH</Text>
                  <Text style={styles.paymentBoxVal}>{formatCurrencyINR(todayMetrics.cashPaise)}</Text>
                  <Text style={styles.paymentBoxHint}>View ›</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`UPI and bank collection: ${formatCurrencyINR(todayMetrics.bankPaise)}`}
                  onPress={() => {
                    setSelectedPeriod('today');
                    setViewMode('TRANSACTIONS');
                  }}
                  style={({ pressed }) => [styles.paymentBox, pressed && styles.paymentBoxPressed]}
                >
                  <Text style={styles.paymentBoxLabel}>UPI / BANK</Text>
                  <Text style={styles.paymentBoxVal}>{formatCurrencyINR(todayMetrics.bankPaise)}</Text>
                  <Text style={styles.paymentBoxHint}>View ›</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pending uncollected amount: ${formatCurrencyINR(todayMetrics.pendingPaise)}. Tap to view uncollected shop amounts.`}
                  onPress={() => router.push('/(seller)/sales/pending' as any)}
                  style={({ pressed }) => [
                    styles.paymentBox,
                    styles.paymentBoxPending,
                    pressed && styles.paymentBoxPressed,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={[styles.paymentBoxLabel, { color: '#B45309' }]}>PENDING</Text>
                    <Ionicons name="arrow-forward-circle" size={14} color="#D97706" />
                  </View>
                  <Text style={[styles.paymentBoxVal, { color: '#D97706', fontWeight: '800' }]}>
                    {formatCurrencyINR(todayMetrics.pendingPaise)}
                  </Text>
                  <Text style={styles.pendingActionLabel}>Collect & Close ›</Text>
                </Pressable>
              </View>
            </Card>

            {/* Period Filter Chips */}
            <View style={styles.periodChipsRow}>
              {PERIOD_FILTERS.map((p) => {
                const isSelected = selectedPeriod === p.value;
                return (
                  <Pressable
                    key={p.value}
                    style={[styles.periodChip, isSelected && styles.periodChipActive]}
                    onPress={() => setSelectedPeriod(p.value)}
                  >
                    <Text style={[styles.periodChipText, isSelected && styles.periodChipTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Collapsible Date-by-Date History */}
            <View style={styles.dailySectionHeader}>
              <Text style={styles.dailySectionTitle}>Date-by-Date Performance History</Text>
              <Text style={styles.dailySectionSub}>Tap any day to expand orders & observations</Text>
            </View>

            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <CardSkeleton />
                <CardSkeleton />
              </View>
            ) : dailyGroups.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title={selectedCustomer ? `No Sales for ${selectedCustomer.shopName}` : 'No Sales Recorded'}
                description={
                  selectedCustomer
                    ? `No orders recorded for ${selectedCustomer.shopName} in this period.`
                    : 'No orders have been recorded for the selected period.'
                }
                actionTitle={selectedCustomer ? 'Create Sale for Customer' : 'Create New Sale'}
                onAction={() =>
                  router.push({
                    pathname: '/(seller)/sales/new',
                    params: selectedCustomerId ? { customerId: selectedCustomerId } : {},
                  } as any)
                }
              />
            ) : (
              dailyGroups.map((group) => {
                const isExpanded = Boolean(expandedDates[group.dateKey]);
                return (
                  <View key={group.dateKey} style={styles.dayGroupWrapper}>
                    {/* Collapsible Date Header Card */}
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
                          {group.salesCount} orders · {group.totalPackets} packets
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

                    {/* Expanded Day Orders & Observations */}
                    {isExpanded && (
                      <View style={styles.dayExpandedList}>
                        {group.sales.map((item) => {
                          const totalAmt = item.totalAmountPaise ?? item.totalPaise ?? 0;
                          return (
                            <Card
                              key={item.id}
                              onPress={() => router.push(`/(seller)/sales/${item.id}` as any)}
                              style={styles.daySaleCard}
                            >
                              <View style={styles.cardHeader}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.customerName} numberOfLines={1}>
                                    {item.customer?.shopName || 'Retail Customer'}
                                  </Text>
                                  <Text style={styles.orderNumber}>
                                    #{item.saleNumber || item.id.slice(0, 8)} · {item.quantity || item.packetCount || 1} pkts
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.amountText}>{formatCurrencyINR(totalAmt)}</Text>
                                  <Badge label={item.paymentMode} variant={item.paymentMode as any} size="sm" showDot={false} />
            {item.paymentMode === 'PENDING' && item.status !== 'REJECTED' && (
              <View style={styles.uncollectedPill}>
                <Text style={styles.uncollectedPillText}>Collect ›</Text>
              </View>
            )}
                                </View>
                              </View>

                              {/* Customer Feedback Observation */}
                              {item.customerFeedback ? (
                                <View style={styles.dayFeedbackCard}>
                                  <Ionicons name="chatbubble-ellipses" size={13} color={BrandColors.pink.primary} />
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
        /* 2. ORDER LEDGER VIEW */
        /* ==================================================== */
        <View style={{ flex: 1 }}>
          {/* Status Filter Tabs using SegmentedTabs */}
          <View style={styles.filtersWrapper}>
            <SegmentedTabs
              tabs={STATUS_FILTERS}
              selectedTab={selectedStatus}
              onSelect={setSelectedStatus}
              scrollable
              activeColor={BrandColors.pink.primary}
              accessibilityLabel="Filter sales orders by status"
            />
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : sales.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title={selectedCustomer ? `No Sales for ${selectedCustomer.shopName}` : 'No Sales Found'}
              description={
                selectedCustomer
                  ? `No orders found for ${selectedCustomer.shopName}. Tap below to record a sale.`
                  : selectedStatus
                  ? `No ${selectedStatus.toLowerCase()} orders found for this filter.`
                  : 'You have not recorded any sales yet.'
              }
              actionTitle={selectedCustomer ? 'Create Sale for Customer' : 'Create First Sale'}
              onAction={() =>
                router.push({
                  pathname: '/(seller)/sales/new',
                  params: selectedCustomerId ? { customerId: selectedCustomerId } : {},
                } as any)
              }
            />
          ) : (
            <FlatList
              data={sales}
              keyExtractor={(item) => item.id}
              renderItem={renderTransactionItem}
              contentContainerStyle={styles.listContent}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[BrandColors.pink.primary]}
                />
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadMoreRow}>
                    <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                    <Text style={styles.loadMoreText}>Loading more sales...</Text>
                  </View>
                ) : undefined
              }
            />
          )}
        </View>
      )}

      {/* Searchable Retail Customer Dropdown Modal */}
      <SearchableDropdownModal
        visible={customerPickerOpen}
        title="Select Retail Customer"
        searchPlaceholder="Search customer by shop, owner, phone, district..."
        options={customerDropdownOptions}
        selectedId={selectedCustomerId || 'ALL'}
        onSelect={(opt) => {
          setSelectedCustomerId(opt.id === 'ALL' ? null : opt.id);
          setCustomerPickerOpen(false);
        }}
        onClose={() => setCustomerPickerOpen(false)}
        emptyMessage="No customers found matching search"
      />
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
  customerFilterRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  customerFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  customerFilterTriggerActive: {
    backgroundColor: '#FFF5F8',
    borderColor: BrandColors.pink.border,
  },
  customerFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  customerFilterIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  customerFilterIconBoxActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  customerFilterLabelText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerFilterSelectedName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    fontSize: 13,
  },
  customerFilterRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerFilterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 4,
  },
  customerFilterClearText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  customerFilterChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerFilterCountText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
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
  uncollectedPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  uncollectedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  paymentSummaryCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  paymentSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: Spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  paymentBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  paymentBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  kpiTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  paymentSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  viewPendingHeaderLink: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  viewPendingHeaderLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  paymentBoxPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  paymentBoxPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  paymentBoxHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  pendingActionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
  periodChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
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
    backgroundColor: '#FFF1F2',
    borderRadius: Radius.sm,
    padding: 6,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: BrandColors.pink.primary,
  },
  dayFeedbackText: {
    fontSize: 11,
    color: '#334155',
    fontStyle: 'italic',
    marginLeft: 4,
    flex: 1,
  },
  filtersWrapper: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  saleCard: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  customerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  customerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  orderNumber: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  feedbackSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    padding: 4,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  feedbackSnippetText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#334155',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.sm,
  },
  leftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  packetText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  amountText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  addButton: {
    backgroundColor: BrandColors.pink.primary,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  loadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  loadMoreText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
