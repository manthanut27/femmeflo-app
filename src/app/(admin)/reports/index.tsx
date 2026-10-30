import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type {
  AdminDashboardData,
  InventorySummaryData,
  SaleItem,
  SalesReportData,
  SalesReportGroupItem,
  StockLocationItem,
} from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrencyINR,
  formatDateIST,
  formatDateTimeIST,
  getISTDateRangeFilter,
} from '@/utils/dateUtils';

type MainReportMode = 'SALES' | 'INVENTORY';
type GroupByOption = 'district' | 'seller' | 'date';
type PeriodOption = 'all' | 'today' | 'week' | 'month';

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodOption }> = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'This Month', value: 'month' },
];

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvString(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

export default function AdminReportsScreen() {
  const { user } = useAuth();

  const [mode, setMode] = useState<MainReportMode>('SALES');
  const [groupBy, setGroupBy] = useState<GroupByOption>('district');
  const [period, setPeriod] = useState<PeriodOption>('all');
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventorySummaryData | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewTab, setViewTab] = useState<'ANALYTICS' | 'FEEDBACK'>('ANALYTICS');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const dateFilter = getISTDateRangeFilter(period);
      const [salesRes, invRes, dashRes] = await Promise.all([
        adminApi
          .getSalesReport({
            groupBy,
            from: dateFilter.from,
            to: dateFilter.to,
            status: 'CONFIRMED',
          })
          .catch(() => null),
        adminApi.getInventorySummary().catch(() => null),
        adminApi.getDashboard().catch(() => null),
      ]);
      setReport(salesRes);
      setInventoryReport(invRes);
      setDashboard(dashRes);
    } catch (err) {
      console.warn('Failed to load admin reports', err);
      Alert.alert('Report Error', 'Unable to fetch report data. Please pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupBy, period]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Extract feedback observations from sales items
  const feedbackItems = useMemo(() => {
    if (!report?.items) return [];
    return report.items.filter(
      (item) => item.customerFeedback && item.customerFeedback.trim().length > 0
    );
  }, [report]);

  async function saveAndShareCsv(filename: string, csvContent: string) {
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('CSV Downloaded', `File "${filename}" has been downloaded.`);
      return;
    }

    const filePath = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('CSV Generated', `Report saved to: ${filePath}`);
    }
  }

  // Handle Sales CSV Export
  async function handleExportSalesCsv() {
    if (!report) return;
    setExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `FemmeFlo_Sales_Report_${period}_${timestamp}.csv`;

      const headers = [
        'Sale Number',
        'Date (IST)',
        'Customer Shop',
        'Customer Phone',
        'District',
        'State',
        'Field Officer',
        'Packets Sold',
        'Total Amount (INR)',
        'Payment Mode',
        'Status',
        'Customer Feedback',
      ];

      const rows = (report.items || []).map((sale) => [
        sale.saleNumber || sale.id,
        formatDateIST(sale.createdAt, 'short'),
        sale.customer?.shopName || 'Retail Customer',
        sale.customer?.phone || '',
        sale.customer?.district || '',
        sale.customer?.state || '',
        sale.seller?.name || 'Field Officer',
        sale.packetCount || sale.quantity || 0,
        ((sale.totalAmountPaise || sale.totalPaise || 0) / 100).toFixed(2),
        sale.paymentMode || 'CASH',
        sale.status || 'CONFIRMED',
        sale.customerFeedback || '',
      ]);

      const csvContent = buildCsvString(headers, rows);
      await saveAndShareCsv(filename, csvContent);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export sales CSV.');
    } finally {
      setExporting(false);
    }
  }

  // Handle Grouped Breakdown CSV Export
  async function handleExportGroupedCsv() {
    if (!report?.groups) return;
    setExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `FemmeFlo_Grouped_${groupBy}_${timestamp}.csv`;

      const headers = [
        'Group Category',
        'Group Label',
        'Completed Orders',
        'Packets Delivered',
        'Total Revenue (INR)',
        'Share (%)',
      ];

      const totalQty = report.summary.totalQuantitySold || 1;
      const rows = report.groups.map((group) => {
        const percentage = Math.round((group.quantity / totalQty) * 100);
        return [
          groupBy.toUpperCase(),
          groupBy === 'date' ? formatDateIST(group.label, 'medium') : group.label,
          group.count,
          group.quantity,
          (group.totalPaise / 100).toFixed(2),
          percentage,
        ];
      });

      const csvContent = buildCsvString(headers, rows);
      await saveAndShareCsv(filename, csvContent);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export grouped breakdown CSV.');
    } finally {
      setExporting(false);
    }
  }

  // Handle Inventory CSV Export
  async function handleExportInventoryCsv() {
    if (!inventoryReport) return;
    setExporting(true);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `FemmeFlo_Inventory_Report_${timestamp}.csv`;

      const headers = [
        'Location Name',
        'Location Type',
        'Assigned Personnel',
        'Stock Balance (Packets)',
      ];

      const rows = (inventoryReport.locations || []).map((loc) => [
        loc.name,
        loc.type,
        loc.seller?.name || 'HQ Operations',
        loc.balance,
      ]);

      const csvContent = buildCsvString(headers, rows);
      await saveAndShareCsv(filename, csvContent);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export inventory CSV.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header
        title="Reports & Analytics"
        subtitle={`Super Admin • ${user?.name || 'HQ Operations'}`}
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Executive Header Banner */}
          <Card style={styles.bannerCard}>
            <View style={styles.bannerRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.bannerBadgeRow}>
                  <View style={styles.bannerIconBadge}>
                    <Ionicons name="bar-chart" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.bannerTitle}>National Business Intelligence</Text>
                </View>
                <Text style={styles.bannerSubtitle}>
                  Real-time database aggregated sales, district penetration & inventory audits.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (mode === 'SALES') {
                    Alert.alert('Export Sales Report', 'Choose export format:', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Detailed Sales CSV', onPress: handleExportSalesCsv },
                      { text: 'Grouped Breakdown CSV', onPress: handleExportGroupedCsv },
                    ]);
                  } else {
                    handleExportInventoryCsv();
                  }
                }}
                hitSlop={HitSlop.md}
                style={styles.exportButton}
                accessibilityRole="button"
                accessibilityLabel="Export CSV Report"
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={BrandColors.pink.dark} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={BrandColors.pink.dark} />
                    <Text style={styles.exportButtonText}>Export CSV</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Card>

          {/* Primary Mode Tabs: Sales vs Inventory */}
          <View style={styles.modeTabsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sales & Revenue Reports"
              style={[styles.modeTab, mode === 'SALES' && styles.modeTabActive]}
              onPress={() => setMode('SALES')}
            >
              <Ionicons
                name="wallet-outline"
                size={18}
                color={mode === 'SALES' ? '#FFFFFF' : Colors.light.textSecondary}
              />
              <Text style={[styles.modeTabText, mode === 'SALES' && styles.modeTabTextActive]}>
                Sales Reports
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inventory & Warehouse Reports"
              style={[styles.modeTab, mode === 'INVENTORY' && styles.modeTabActive]}
              onPress={() => setMode('INVENTORY')}
            >
              <Ionicons
                name="cube-outline"
                size={18}
                color={mode === 'INVENTORY' ? '#FFFFFF' : Colors.light.textSecondary}
              />
              <Text style={[styles.modeTabText, mode === 'INVENTORY' && styles.modeTabTextActive]}>
                Inventory Reports
              </Text>
            </Pressable>
          </View>

          {/* ========================================================================= */}
          {/* MODE 1: SALES REPORTS */}
          {/* ========================================================================= */}
          {mode === 'SALES' && (
            <>
              {/* Date Period Filter Chips */}
              <View style={styles.periodFilterRow}>
                {PERIOD_OPTIONS.map((opt) => {
                  const active = period === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPeriod(opt.value)}
                      style={[styles.periodChip, active && styles.periodChipActive]}
                      hitSlop={HitSlop.sm}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* KPI Summary Cards */}
              {loading ? (
                <View style={styles.loadingGrid}>
                  <CardSkeleton />
                  <CardSkeleton />
                </View>
              ) : (
                <View style={styles.kpiGrid}>
                  <View style={styles.kpiHalf}>
                    <StatCard
                      title="Net Revenue"
                      value={formatCurrencyINR(report?.summary.grossSalesPaise || 0)}
                      subtitle="Confirmed verified sales"
                      icon="wallet-outline"
                      iconColor={BrandColors.pink.primary}
                      iconBg={BrandColors.pink.subtle}
                    />
                  </View>

                  <View style={styles.kpiHalf}>
                    <StatCard
                      title="Packets Delivered"
                      value={`${(report?.summary.totalQuantitySold || 0).toLocaleString('en-IN')} pkts`}
                      subtitle="Sanitary napkin volume"
                      icon="cube-outline"
                      iconColor="#0284C7"
                      iconBg="#F0F9FF"
                    />
                  </View>

                  <View style={styles.kpiHalf}>
                    <StatCard
                      title="Total Orders"
                      value={(report?.summary.totalSalesCount || 0).toLocaleString('en-IN')}
                      subtitle="Completed store receipts"
                      icon="receipt-outline"
                      iconColor={BrandColors.green.primary}
                      iconBg={BrandColors.green.subtle}
                      accentColor={BrandColors.green.primary}
                    />
                  </View>

                  <View style={styles.kpiHalf}>
                    <StatCard
                      title="Avg Order Value"
                      value={`₹${Math.round(report?.summary.averageOrderValueRupees || 0).toLocaleString('en-IN')}`}
                      subtitle="Per retail store transaction"
                      icon="trending-up-outline"
                      iconColor="#F59E0B"
                      iconBg="#FEF3C7"
                    />
                  </View>
                </View>
              )}

              {/* Section View Tabs (Analytics Breakdown vs Customer Feedback Observations) */}
              <View style={styles.viewTabsContainer}>
                <Pressable
                  onPress={() => setViewTab('ANALYTICS')}
                  style={[styles.viewTab, viewTab === 'ANALYTICS' && styles.viewTabActive]}
                >
                  <Ionicons
                    name="pie-chart-outline"
                    size={16}
                    color={viewTab === 'ANALYTICS' ? BrandColors.pink.dark : Colors.light.textSecondary}
                  />
                  <Text
                    style={[
                      styles.viewTabText,
                      viewTab === 'ANALYTICS' && styles.viewTabTextActive,
                    ]}
                  >
                    Grouped Breakdown
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setViewTab('FEEDBACK')}
                  style={[styles.viewTab, viewTab === 'FEEDBACK' && styles.viewTabActive]}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={viewTab === 'FEEDBACK' ? BrandColors.pink.dark : Colors.light.textSecondary}
                  />
                  <Text
                    style={[
                      styles.viewTabText,
                      viewTab === 'FEEDBACK' && styles.viewTabTextActive,
                    ]}
                  >
                    Customer Feedback ({feedbackItems.length})
                  </Text>
                </Pressable>
              </View>

              {/* TAB 1: ANALYTICS GROUPED BREAKDOWN */}
              {viewTab === 'ANALYTICS' && (
                <Card style={styles.breakdownCard}>
                  <View style={styles.breakdownHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breakdownTitle}>
                        {groupBy === 'date'
                          ? 'Daily Sales Performance'
                          : groupBy === 'seller'
                          ? 'Field Officer Rankings'
                          : 'Territory District Performance'}
                      </Text>
                      <Text style={styles.breakdownSubtitle}>
                        {groupBy === 'date'
                          ? 'Chronological day-by-day sales volume & revenue'
                          : groupBy === 'seller'
                          ? 'Total volume and revenue generated by field officers'
                          : 'Geographic distribution and regional market penetration'}
                      </Text>
                    </View>

                    {/* Group By Selector Buttons */}
                    <View style={styles.groupByButtonGroup}>
                      <Pressable
                        onPress={() => setGroupBy('district')}
                        style={[
                          styles.groupByButton,
                          groupBy === 'district' && styles.groupByButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupByButtonText,
                            groupBy === 'district' && styles.groupByButtonTextActive,
                          ]}
                        >
                          District
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setGroupBy('seller')}
                        style={[
                          styles.groupByButton,
                          groupBy === 'seller' && styles.groupByButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupByButtonText,
                            groupBy === 'seller' && styles.groupByButtonTextActive,
                          ]}
                        >
                          Seller
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setGroupBy('date')}
                        style={[
                          styles.groupByButton,
                          groupBy === 'date' && styles.groupByButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupByButtonText,
                            groupBy === 'date' && styles.groupByButtonTextActive,
                          ]}
                        >
                          Daily
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {loading ? (
                    <View style={{ paddingVertical: Spacing.xl }}>
                      <ActivityIndicator size="small" color={BrandColors.pink.dark} />
                    </View>
                  ) : !report?.groups || report.groups.length === 0 ? (
                    <EmptyState
                      title="No sales recorded"
                      description="No confirmed sales found for this period and grouping selection."
                      icon="analytics-outline"
                    />
                  ) : (
                    <View style={styles.groupsList}>
                      {report.groups.map((group: SalesReportGroupItem, index: number) => {
                        const totalQty = report.summary.totalQuantitySold || 1;
                        const percentage = Math.min(
                          100,
                          Math.max(1, Math.round((group.quantity / totalQty) * 100))
                        );

                        let iconName: any = 'location-outline';
                        if (groupBy === 'seller') iconName = 'person-outline';
                        if (groupBy === 'date') iconName = 'calendar-outline';

                        const formattedLabel =
                          groupBy === 'date' ? formatDateIST(group.label, 'medium') : group.label;

                        return (
                          <View key={`${group.label}-${index}`} style={styles.groupItemRow}>
                            <View style={styles.groupItemTop}>
                              <View style={styles.groupItemLeft}>
                                <View style={styles.groupIconBox}>
                                  <Ionicons name={iconName} size={16} color={BrandColors.pink.dark} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.groupLabel} numberOfLines={1}>
                                    {formattedLabel || 'Unspecified'}
                                  </Text>
                                  <Text style={styles.groupSubInfo}>
                                    {group.count} {group.count === 1 ? 'order' : 'orders'} completed
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.groupItemRight}>
                                <Text style={styles.groupRevenue}>
                                  {formatCurrencyINR(group.totalPaise)}
                                </Text>
                                <Text style={styles.groupQuantity}>
                                  {group.quantity.toLocaleString('en-IN')} pkts ({percentage}%)
                                </Text>
                              </View>
                            </View>

                            {/* Progress Bar */}
                            <View style={styles.progressBarTrack}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  {
                                    width: `${percentage}%`,
                                    backgroundColor:
                                      index === 0
                                        ? BrandColors.pink.primary
                                        : index === 1
                                        ? BrandColors.green.primary
                                        : '#0284C7',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              )}

              {/* TAB 2: CUSTOMER FEEDBACK OBSERVATIONS FEED */}
              {viewTab === 'FEEDBACK' && (
                <Card style={styles.feedbackCard}>
                  <View style={styles.feedbackCardHeader}>
                    <View>
                      <Text style={styles.feedbackSectionTitle}>Field Customer Observations</Text>
                      <Text style={styles.feedbackSectionSub}>
                        Real observations recorded by field officers during store visits
                      </Text>
                    </View>
                    <Badge
                      label={`${feedbackItems.length} Notes`}
                      variant={feedbackItems.length > 0 ? 'ACTIVE' : 'neutral'}
                    />
                  </View>

                  {loading ? (
                    <View style={{ paddingVertical: Spacing.xl }}>
                      <ActivityIndicator size="small" color={BrandColors.pink.dark} />
                    </View>
                  ) : feedbackItems.length === 0 ? (
                    <EmptyState
                      title="No feedback observations"
                      description="None of the sales in this time frame recorded verbal or written customer feedback."
                      icon="chatbubble-outline"
                    />
                  ) : (
                    <View style={styles.feedbackList}>
                      {feedbackItems.map((item: SaleItem) => (
                        <View key={item.id} style={styles.feedbackItem}>
                          <View style={styles.feedbackHeaderRow}>
                            <View style={{ flex: 1, marginRight: Spacing.sm }}>
                              <Text style={styles.feedbackShopName}>
                                {item.customer?.shopName || item.customer?.name || 'Retail Partner'}
                              </Text>
                              <Text style={styles.feedbackLocation}>
                                {item.customer?.district || 'General Area'} • Seller:{' '}
                                {item.seller?.name || 'Officer'}
                              </Text>
                            </View>
                            <Text style={styles.feedbackDate}>
                              {formatDateIST(item.createdAt, 'short')}
                            </Text>
                          </View>

                          {/* Feedback Quote */}
                          <View style={styles.quoteBox}>
                            <Ionicons
                              name="chatbox-ellipses"
                              size={16}
                              color={BrandColors.pink.dark}
                              style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <Text style={styles.quoteText}>{item.customerFeedback}</Text>
                          </View>

                          <View style={styles.feedbackFooterRow}>
                            <Badge
                              label={`${item.quantity || item.packetCount || 0} pkts`}
                              variant="PENDING"
                            />
                            <Text style={styles.feedbackAmount}>
                              {formatCurrencyINR(item.totalAmountPaise ?? item.totalPaise ?? 0)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: INVENTORY REPORTS */}
          {/* ========================================================================= */}
          {mode === 'INVENTORY' && (
            <View style={{ marginTop: Spacing.sm }}>
              {/* Inventory KPI Summary */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiHalf}>
                  <StatCard
                    title="Total Stock"
                    value={`${(inventoryReport?.totalStock || dashboard?.metrics?.totalInventory || 0).toLocaleString('en-IN')} pkts`}
                    subtitle="Central & regional balance"
                    icon="cube-outline"
                    iconColor={BrandColors.pink.primary}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>

                <View style={styles.kpiHalf}>
                  <StatCard
                    title="HQ Central Stock"
                    value={`${(inventoryReport?.hqStock || dashboard?.metrics?.hqStock || 0).toLocaleString('en-IN')} pkts`}
                    subtitle="Headquarters warehouse"
                    icon="business-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>

                <View style={styles.kpiHalf}>
                  <StatCard
                    title="Warehouse Stock"
                    value={`${(inventoryReport?.warehouseStock || dashboard?.metrics?.warehouseStock || 0).toLocaleString('en-IN')} pkts`}
                    subtitle="District distribution hubs"
                    icon="home-outline"
                    iconColor="#8B5CF6"
                    iconBg="#F5F3FF"
                  />
                </View>

                <View style={styles.kpiHalf}>
                  <StatCard
                    title="Field Seller Van Stock"
                    value={`${(inventoryReport?.sellerStock || dashboard?.metrics?.sellerStock || 0).toLocaleString('en-IN')} pkts`}
                    subtitle="In-transit mobile kits"
                    icon="car-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                  />
                </View>
              </View>

              {/* Locations Breakdown Table */}
              <Card style={styles.breakdownCard}>
                <View style={styles.breakdownHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.breakdownTitle}>Stock Locations Directory</Text>
                    <Text style={styles.breakdownSubtitle}>
                      Live audited stock balances across central, regional, and field seller nodes
                    </Text>
                  </View>
                </View>

                {loading ? (
                  <View style={{ paddingVertical: Spacing.xl }}>
                    <ActivityIndicator size="small" color={BrandColors.pink.dark} />
                  </View>
                ) : !inventoryReport?.locations || inventoryReport.locations.length === 0 ? (
                  <EmptyState
                    title="No inventory locations"
                    description="No inventory nodes are registered in the system."
                    icon="cube-outline"
                  />
                ) : (
                  <View style={styles.groupsList}>
                    {inventoryReport.locations.map((loc: StockLocationItem, idx: number) => {
                      const isLowStock = loc.balance < 50;
                      let locIcon = 'business-outline';
                      if (loc.type === 'WAREHOUSE') locIcon = 'home-outline';
                      if (loc.type === 'SELLER') locIcon = 'car-outline';

                      return (
                        <View key={loc.id || `loc-${idx}`} style={styles.groupItemRow}>
                          <View style={styles.groupItemTop}>
                            <View style={styles.groupItemLeft}>
                              <View style={styles.groupIconBox}>
                                <Ionicons name={locIcon as any} size={18} color={BrandColors.pink.dark} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.groupLabel} numberOfLines={1}>
                                  {loc.name}
                                </Text>
                                <Text style={styles.groupSubInfo}>
                                  {loc.type === 'SELLER'
                                    ? `Seller: ${loc.seller?.name || 'Assigned Officer'}`
                                    : loc.type === 'WAREHOUSE'
                                    ? 'Regional Warehouse Hub'
                                    : 'Central Distribution HQ'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.groupItemRight}>
                              <Text style={styles.groupRevenue}>
                                {loc.balance.toLocaleString('en-IN')} pkts
                              </Text>
                              <Badge
                                label={isLowStock ? 'LOW STOCK' : 'IN STOCK'}
                                variant={isLowStock ? 'PENDING' : 'ACTIVE'}
                                style={{ marginTop: 2, alignSelf: 'flex-end' }}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
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
    backgroundColor: '#FFF5F8',
    borderColor: '#FCE7F3',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  bannerIconBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: '#FDE2EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  bannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  bannerSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 4,
    ...Shadows.sm,
  },
  exportButtonText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: BrandColors.pink.dark,
  },
  modeTabText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  periodFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  periodChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  periodChipActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  periodChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  loadingGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiHalf: {
    flex: 1,
    minWidth: '45%',
  },
  viewTabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 3,
    marginBottom: Spacing.md,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.sm,
    gap: 6,
  },
  viewTabActive: {
    backgroundColor: '#FFF5F8',
  },
  viewTabText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  viewTabTextActive: {
    color: BrandColors.pink.dark,
  },
  breakdownCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  breakdownHeader: {
    marginBottom: Spacing.md,
  },
  breakdownTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.text,
  },
  breakdownSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  groupByButtonGroup: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    backgroundColor: Colors.light.background,
    borderRadius: Radius.sm,
    padding: 2,
    alignSelf: 'flex-start',
  },
  groupByButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  groupByButtonActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  groupByButtonText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  groupByButtonTextActive: {
    color: BrandColors.pink.dark,
  },
  groupsList: {
    gap: Spacing.md,
  },
  groupItemRow: {
    paddingVertical: Spacing.xs,
  },
  groupItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  groupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  groupIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF5F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  groupLabel: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.text,
  },
  groupSubInfo: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  groupItemRight: {
    alignItems: 'flex-end',
  },
  groupRevenue: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  groupQuantity: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  feedbackCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  feedbackSectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.text,
  },
  feedbackSectionSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  feedbackList: {
    gap: Spacing.md,
  },
  feedbackItem: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  feedbackShopName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.text,
  },
  feedbackLocation: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  feedbackDate: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  quoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF5F8',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  quoteText: {
    ...Typography.caption,
    color: Colors.light.text,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 18,
  },
  feedbackFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  feedbackAmount: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
});
