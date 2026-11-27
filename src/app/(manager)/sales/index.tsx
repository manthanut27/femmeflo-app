import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managerApi } from '@/api/manager';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { tokenStorage } from '@/api/client';
import type { ManagerDashboardData, PaginationMeta, SaleItem, SellerItem } from '@/api/types';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
import { PdfPreviewModal } from '@/components/common/PdfPreviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
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
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrencyINR,
  formatDateIST,
  getISTDateKey,
  groupSalesByDay,
  type DailyReportGroup,
} from '@/utils/dateUtils';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED';

const PERIOD_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Month', value: 'this_month' },
];

export default function ManagerSalesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const insets = useSafeAreaInsets();
  const [selectedRejectedSale, setSelectedRejectedSale] = useState<SaleItem | null>(null);
  const [managerPriceModalVisible, setManagerPriceModalVisible] = useState(false);
  const [managerEditPriceStr, setManagerEditPriceStr] = useState('');
  const [managerEditNotes, setManagerEditNotes] = useState('');
  const [isManagerSubmitting, setIsManagerSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      let salesErrMsg: string | null = null;
      const [salesRes, dashRes, sellersRes] = await Promise.all([
        managerApi.listSales({ page: 1, pageSize: 100 }).catch((err: any) => {
          salesErrMsg = err?.message || 'Unable to load sales right now.';
          return null;
        }),
        managerApi.getDashboard().catch(() => null),
        managerApi.listSellers({ pageSize: 50 }).catch(() => null),
      ]);

      if (salesRes) {
        setSales(salesRes.items || []);
        setPagination(salesRes.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 1 });
        setLoadError(null);
      } else if (salesErrMsg) {
        setLoadError(salesErrMsg);
      }
      if (dashRes) setDashboardData(dashRes);
      if (sellersRes) setSellers(sellersRes.items || []);
    } catch (err: any) {
      console.warn('Failed to load manager sales and dashboard', err);
      setLoadError(err?.message || 'Unable to connect to server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', () => {
      loadData();
    });
    const sub2 = DeviceEventEmitter.addListener('SALES_SYNC', () => {
      loadData();
    });
    const sub3 = DeviceEventEmitter.addListener('REALTIME_DATA_SYNC', () => {
      loadData();
    });

    const liveTicker = setInterval(() => {
      loadData();
    }, 45000);

    return () => {
      sub.remove();
      sub2.remove();
      sub3.remove();
      clearInterval(liveTicker);
    };
  }, [loadData]);

  const handleOpenManagerPriceModal = (item: SaleItem) => {
    setSelectedRejectedSale(item);
    const qty = item.quantity || item.packetCount || 1;
    const currentPricePaise =
      item.unitPricePaise ||
      (item.items?.[0]?.unitPricePaise
        ? item.items[0].unitPricePaise
        : qty > 0
          ? Math.round((item.totalAmountPaise ?? item.totalPaise ?? 0) / qty)
          : 2500);
    setManagerEditPriceStr(((currentPricePaise || 2500) / 100).toFixed(2));
    setManagerEditNotes('');
    setManagerPriceModalVisible(true);
  };

  const handleManagerResubmitPrice = async () => {
    if (!selectedRejectedSale || isManagerSubmitting) return;
    const priceNum = parseFloat(managerEditPriceStr);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than ₹0.00');
      return;
    }

    const newUnitPricePaise = Math.round(priceNum * 100);
    const qty = selectedRejectedSale.quantity || selectedRejectedSale.packetCount || 1;
    const newTotalPaise = qty * newUnitPricePaise;

    setIsManagerSubmitting(true);
    try {
      const res = await managerApi.updateSale(selectedRejectedSale.id, {
        unitPricePaise: newUnitPricePaise,
        customerFeedback: managerEditNotes.trim()
          ? `[Manager Price Revised: ₹${priceNum.toFixed(2)}] ${managerEditNotes.trim()}`
          : selectedRejectedSale.customerFeedback || undefined,
      });

      // Update state locally
      setSales((prev) =>
        prev.map((s) =>
          s.id === selectedRejectedSale.id
            ? {
                ...s,
                ...(res?.sale || {}),
                status: (res?.sale && res.sale.status) ? res.sale.status : 'PENDING_APPROVAL',
                unitPricePaise: newUnitPricePaise,
                totalAmountPaise: newTotalPaise,
                totalPaise: newTotalPaise,
                rejectionReason: null,
                approvalReason: `Manager revised price to ₹${priceNum.toFixed(2)}/pkt`,
              }
            : s
        )
      );

      setManagerPriceModalVisible(false);

      DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { saleId: selectedRejectedSale.id, action: 'RESUBMIT' });

      Alert.alert(
        'Price Updated & Resubmitted',
        `Order #${selectedRejectedSale.id.slice(0, 8)} price updated to ₹${priceNum.toFixed(2)}/pkt (Total: ₹${(newTotalPaise / 100).toFixed(2)}). Sent to Super Admin for reapproval.`
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update price and resubmit.');
    } finally {
      setIsManagerSubmitting(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  useRealtimeSync(['SALE_STATUS_UPDATE', 'APPROVAL_UPDATE'], loadData);

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
      const isCurrentUserSale = Boolean(user?.id && (s.sellerId === user.id || s.seller?.id === user.id));
      const sellerName = s.seller?.name || (isCurrentUserSale ? user?.name : undefined) || 'Assigned Officer';

      if (!perfMap[sellerId]) {
        perfMap[sellerId] = { name: sellerName, packets: 0, totalPaise: 0, count: 0 };
      }
      perfMap[sellerId].packets += s.quantity || s.packetCount || 0;
      perfMap[sellerId].totalPaise += s.totalAmountPaise ?? s.totalPaise ?? 0;
      perfMap[sellerId].count += 1;
    }

    return Object.values(perfMap).sort((a, b) => b.totalPaise - a.totalPaise);
  }, [sales, user]);

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

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    filename: string;
    title: string;
  } | null>(null);

  const filterTabs = [
    { key: 'ALL' as const, label: 'All', badge: sales.length },
    { key: 'CONFIRMED' as const, label: 'Confirmed', badge: sales.filter((s) => s.status === 'CONFIRMED').length },
    { key: 'PENDING' as const, label: 'Pending', badge: sales.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL').length },
    { key: 'REJECTED' as const, label: 'Rejected', badge: sales.filter((s) => s.status === 'REJECTED').length },
  ];

  async function handleViewInvoice(sale: SaleItem) {
    const invoiceId = sale.invoice?.id || sale.id;
    const pdfUrl = managerApi.getInvoicePdfUrl(invoiceId, false);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(pdfUrl, '_blank');
      }
      return;
    }

    const invoiceLabel = sale.invoice?.number || sale.saleNumber || sale.id.slice(0, 8);
    const safeNum = String(invoiceLabel).replace(/[^a-zA-Z0-9._-]/g, '_');
    setPdfPreview({
      url: pdfUrl,
      filename: `Invoice_${safeNum}.pdf`,
      title: `Tax Invoice #${invoiceLabel}`,
    });
  }

  async function handleShareInvoicePdf(sale: SaleItem) {
    const invoiceId = sale.invoice?.id || sale.id;
    if (downloadingInvoiceId) return;
    setDownloadingInvoiceId(sale.id);

    try {
      const pdfUrl = managerApi.getInvoicePdfUrl(invoiceId, true);

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(pdfUrl, '_blank');
        }
        return;
      }

      const rawNum = String(sale.invoice?.number || sale.saleNumber || invoiceId.slice(0, 8));
      const safeNum = rawNum.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `Invoice_${safeNum}.pdf`;
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        Alert.alert('Download Error', 'Device storage directory is unavailable.');
        return;
      }
      const localUri = `${baseDir}${filename}`;
      const token = await tokenStorage.getToken();

      const downloadRes = await FileSystem.downloadAsync(pdfUrl, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (downloadRes.status === 200) {
        const info = await FileSystem.getInfoAsync(downloadRes.uri);
        if (!info.exists || ('size' in info && info.size === 0)) {
          Alert.alert('Download Error', 'Downloaded invoice file was empty. Please try again.');
          return;
        }
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadRes.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Share Invoice ${sale.saleNumber || ''}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Invoice Saved', `Downloaded to: ${downloadRes.uri}`);
        }
      } else {
        const reason =
          downloadRes.status === 403
            ? 'You do not have permission to download this invoice.'
            : downloadRes.status === 404
            ? 'Invoice has not been generated for this order yet.'
            : `Server returned status ${downloadRes.status}.`;
        Alert.alert('Download Error', `Could not retrieve invoice PDF (${reason})`);
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to download invoice PDF.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  function handleShareWhatsAppInvoice(sale: SaleItem) {
    const shopName = sale.customer?.shopName || 'Retailer';
    const amountStr = formatCurrencyINR(sale.totalAmountPaise || sale.totalPaise || 0);
    const invoiceNum = sale.invoice?.number || sale.saleNumber || `#${sale.id.slice(0, 8)}`;
    const text = encodeURIComponent(
      `*FemmeFlo Official Tax Invoice*\n\nDear ${shopName},\nYour invoice *${invoiceNum}* for *${amountStr}* has been issued.\n\nThank you for partnering with FemmeFlo for healthy hygiene solutions!`
    );
    const rawPhone = sale.customer?.phone || (sale.customer as any)?.mobile || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('WhatsApp Error', 'Could not launch WhatsApp on this device.');
    });
  }

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

        {/* Rejected or Pending Approval Sale: Reapproval / Edit Action Banner */}
        {(item.status === 'REJECTED' || item.status === 'PENDING_APPROVAL') && (
          <View style={styles.managerRejectedBanner}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={item.status === 'REJECTED' ? 'close-circle' : 'time'}
                  size={14}
                  color={item.status === 'REJECTED' ? '#B4234D' : '#D97706'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.managerRejectedTitle, item.status === 'PENDING_APPROVAL' && { color: '#B45309' }]}>
                  {item.status === 'REJECTED' ? 'Price Rejected by Admin' : 'Low Price Pending Approval'}
                </Text>
              </View>
              <Text style={styles.managerRejectedReason} numberOfLines={2}>
                {item.status === 'REJECTED'
                  ? (item.rejectionReason || 'Price below threshold. Edit price to resubmit for reapproval.')
                  : 'Sold below base price. You can edit the price request before office approval.'}
              </Text>
            </View>
            <Button
              title="Edit Price"
              variant="outline"
              size="sm"
              icon={<Ionicons name="pricetag-outline" size={14} color={BrandColors.pink.primary} />}
              onPress={() => handleOpenManagerPriceModal(item)}
            />
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.sellerInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.sellerName}>
                {item.seller?.name || (user?.id && (item.sellerId === user.id || item.seller?.id === user.id) ? user.name : undefined) || 'Assigned Officer'}
              </Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 4 }]}>
              <Ionicons name="cube-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.packets}>{packets} Packets</Text>
            </View>
          </View>
          <Text style={styles.amount}>{formatCurrencyINR(totalAmount)}</Text>
        </View>

        {/* Confirmed Tax Invoice Actions */}
        {item.status === 'CONFIRMED' && (
          <View style={styles.managerInvoiceRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View Invoice for ${item.saleNumber || item.id}`}
              style={({ pressed }) => [styles.managerPdfBtn, pressed && styles.btnPressed]}
              onPress={() => handleViewInvoice(item)}
            >
              <Ionicons name="document-text-outline" size={13} color={BrandColors.green.primary} />
              <Text style={styles.managerPdfBtnText}>Tax Invoice</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share Invoice on WhatsApp for ${item.saleNumber || item.id}`}
              style={({ pressed }) => [styles.managerWaBtn, pressed && styles.btnPressed]}
              onPress={() => handleShareWhatsAppInvoice(item)}
            >
              <Ionicons name="logo-whatsapp" size={13} color="#FFFFFF" />
              <Text style={styles.managerWaBtnText}>WhatsApp</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share Invoice PDF for ${item.saleNumber || item.id}`}
              style={({ pressed }) => [styles.managerShareBtn, pressed && styles.btnPressed]}
              onPress={() => handleShareInvoicePdf(item)}
              disabled={downloadingInvoiceId === item.id}
            >
              {downloadingInvoiceId === item.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="share-social-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.managerShareBtnText}>Share</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  const handleNewSale = () => {
    router.push('/(seller)/sales/new' as any);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Area Sales"
        subtitle={`${territoryMetrics.activeOfficersCount} sellers`}
        showMenu={true}
        onMenuPress={() => setMenuOpen(true)}
        rightAction={
          <Button
            title="New Sale"
            size="sm"
            variant="primary"
            icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
            onPress={handleNewSale}
          />
        }
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
            Daily Summary
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
            All Bills
          </Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' }}>
          <FeedbackBanner
            type="warning"
            title="Live sync delayed"
            message={loadError}
            actionLabel="Retry"
            onAction={onRefresh}
            onDismiss={() => setLoadError(null)}
          />
        </View>
      ) : null}

      {/* ==================================================== */}
      {/* 1. DAILY AREA REPORT VIEW */}
      {/* ==================================================== */}
      {viewMode === 'DAILY_REPORT' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.green.primary]} />}
        >
          <View style={styles.contentWrapper}>
            {/* Area KPI Grid */}
            <View style={styles.kpiGrid}>
              <Card style={[styles.kpiCard, { borderLeftColor: BrandColors.green.primary, borderLeftWidth: 4 }]}>
                <Text style={styles.kpiLabel}>Total Sales</Text>
                <Text style={styles.kpiValueGreen}>{formatCurrencyINR(territoryMetrics.revenuePaise)}</Text>
                <Text style={styles.kpiSub}>
                  {territoryMetrics.confirmedCount} {territoryMetrics.confirmedCount === 1 ? 'bill' : 'bills'}
                </Text>
              </Card>

              <Card style={[styles.kpiCard, { borderLeftColor: BrandColors.pink.primary, borderLeftWidth: 4 }]}>
                <Text style={styles.kpiLabel}>Packets Sold</Text>
                <Text style={styles.kpiValuePink}>{territoryMetrics.totalPackets} pkts</Text>
                <Text style={styles.kpiSub}>{territoryMetrics.activeOfficersCount} active sellers</Text>
              </Card>
            </View>

            {/* Seller-wise Performance Breakdown Card */}
            {sellerPerformance.length > 0 && (
              <Card style={styles.sellerPerfCard}>
                <View style={styles.sellerPerfHeader}>
                  <Ionicons name="people" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.sellerPerfTitle}>Top Sellers</Text>
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
              <Text style={styles.dailySectionTitle}>Day-by-Day Sales</Text>
            </View>

            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <CardSkeleton />
                <CardSkeleton />
              </View>
            ) : dailyGroups.length === 0 ? (
              <EmptyState
                icon={loadError ? 'cloud-offline-outline' : 'calendar-outline'}
                title={loadError ? "Couldn't Load Sales" : 'No Sales Recorded'}
                description={
                  loadError
                    ? loadError
                    : 'No sales have been recorded across the area for the selected filter.'
                }
                actionTitle={loadError ? 'Retry' : undefined}
                onAction={loadError ? onRefresh : undefined}
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
                          {group.salesCount} {group.salesCount === 1 ? 'bill' : 'bills'} · {group.totalPackets} pkts
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

                              {/* Rejected or Pending Approval Sale Action Banner */}
                              {(item.status === 'REJECTED' || item.status === 'PENDING_APPROVAL') && (
                                <View style={[styles.managerRejectedBanner, { marginTop: 8 }]}>
                                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons
                                        name={item.status === 'REJECTED' ? 'close-circle' : 'time'}
                                        size={14}
                                        color={item.status === 'REJECTED' ? '#B4234D' : '#D97706'}
                                        style={{ marginRight: 4 }}
                                      />
                                      <Text style={[styles.managerRejectedTitle, item.status === 'PENDING_APPROVAL' && { color: '#B45309' }]}>
                                        {item.status === 'REJECTED' ? 'Price Rejected' : 'Low Price Pending Approval'}
                                      </Text>
                                    </View>
                                    <Text style={styles.managerRejectedReason} numberOfLines={2}>
                                      {item.status === 'REJECTED'
                                        ? (item.rejectionReason || 'Price below minimum floor.')
                                        : 'Sold below base price. You can edit the price request before office approval.'}
                                    </Text>
                                  </View>
                                  <Button
                                    title="Edit Price"
                                    variant="outline"
                                    size="sm"
                                    icon={<Ionicons name="pricetag-outline" size={14} color={BrandColors.pink.primary} />}
                                    onPress={() => handleOpenManagerPriceModal(item)}
                                  />
                                </View>
                              )}

                              {/* Confirmed Tax Invoice Actions */}
                              {item.status === 'CONFIRMED' && (
                                <View style={styles.managerInvoiceRow}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`View Invoice for ${item.saleNumber || item.id}`}
                                    style={({ pressed }) => [styles.managerPdfBtn, pressed && styles.btnPressed]}
                                    onPress={() => handleViewInvoice(item)}
                                  >
                                    <Ionicons name="document-text-outline" size={13} color={BrandColors.green.primary} />
                                    <Text style={styles.managerPdfBtnText}>Tax Invoice</Text>
                                  </Pressable>

                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Share Invoice on WhatsApp for ${item.saleNumber || item.id}`}
                                    style={({ pressed }) => [styles.managerWaBtn, pressed && styles.btnPressed]}
                                    onPress={() => handleShareWhatsAppInvoice(item)}
                                  >
                                    <Ionicons name="logo-whatsapp" size={13} color="#FFFFFF" />
                                    <Text style={styles.managerWaBtnText}>WhatsApp</Text>
                                  </Pressable>

                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Share Invoice PDF for ${item.saleNumber || item.id}`}
                                    style={({ pressed }) => [styles.managerShareBtn, pressed && styles.btnPressed]}
                                    onPress={() => handleShareInvoicePdf(item)}
                                    disabled={downloadingInvoiceId === item.id}
                                  >
                                    {downloadingInvoiceId === item.id ? (
                                      <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                      <>
                                        <Ionicons name="share-social-outline" size={13} color="#FFFFFF" />
                                        <Text style={styles.managerShareBtnText}>Share</Text>
                                      </>
                                    )}
                                  </Pressable>
                                </View>
                              )}
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
              icon={loadError ? 'cloud-offline-outline' : 'receipt-outline'}
              title={loadError ? "Couldn't Load Sales" : 'No Sales Found'}
              description={
                loadError
                  ? loadError
                  : searchQuery
                  ? 'No sales orders matched your search criteria.'
                  : 'No sales recorded for this status.'
              }
              actionTitle={loadError ? 'Retry' : undefined}
              onAction={loadError ? onRefresh : undefined}
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

      {/* Manager Price Edit & Reapproval Modal */}
      {selectedRejectedSale && (
        <Modal
          visible={managerPriceModalVisible}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setManagerPriceModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <Pressable style={styles.backdropDismiss} onPress={() => setManagerPriceModalVisible(false)} />
            <View style={[styles.modalContent, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Edit Price for Reapproval</Text>
                  <Pressable
                    onPress={() => setManagerPriceModalVisible(false)}
                    hitSlop={HitSlop.md}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                </View>
                <Text style={styles.modalSubtitle}>
                  Order #{selectedRejectedSale.id.slice(0, 8)} • Officer: {selectedRejectedSale.seller?.name || 'Field Officer'}
                </Text>

                {/* Rejection context box */}
                {selectedRejectedSale.rejectionReason ? (
                  <View style={styles.rejectionContextBox}>
                    <Ionicons name="alert-circle" size={18} color="#B4234D" style={{ marginRight: 8, marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rejectionContextTitle}>Rejection Reason</Text>
                      <Text style={styles.rejectionContextText}>{selectedRejectedSale.rejectionReason}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Order & Pricing Summary Box */}
                <View style={styles.priceSummaryBox}>
                  <View style={styles.priceSummaryItem}>
                    <Text style={styles.priceSummaryLabel}>Order Qty</Text>
                    <Text style={styles.priceSummaryValue}>
                      {selectedRejectedSale.quantity || selectedRejectedSale.packetCount || 1} pkts
                    </Text>
                  </View>
                  <View style={styles.priceSummaryDivider} />
                  <View style={styles.priceSummaryItem}>
                    <Text style={styles.priceSummaryLabel}>Previous Price</Text>
                    <Text style={styles.priceSummaryValue}>
                      ₹{(((selectedRejectedSale.unitPricePaise || Math.round((selectedRejectedSale.totalAmountPaise ?? selectedRejectedSale.totalPaise ?? 0) / (selectedRejectedSale.quantity || selectedRejectedSale.packetCount || 1))) || 0) / 100).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.priceSummaryDivider} />
                  <View style={styles.priceSummaryItem}>
                    <Text style={styles.priceSummaryLabel}>Min Floor</Text>
                    <Text style={[styles.priceSummaryValue, { color: BrandColors.pink.primary }]}>₹25.00</Text>
                  </View>
                </View>

                {/* Revised Unit Price Input */}
                <Input
                  label="Revised Price (₹ per packet)"
                  placeholder="e.g. 26.50"
                  value={managerEditPriceStr}
                  onChangeText={setManagerEditPriceStr}
                  keyboardType="decimal-pad"
                  leftIcon={<Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.pink.primary }}>₹</Text>}
                  containerStyle={{ marginTop: Spacing.sm }}
                />

                {/* Live Calculation Preview */}
                {(() => {
                  const p = parseFloat(managerEditPriceStr);
                  const isValid = !isNaN(p) && p > 0;
                  const total = isValid ? p * (selectedRejectedSale.quantity || selectedRejectedSale.packetCount || 1) : 0;
                  return (
                    <View style={styles.calculationPreview}>
                      <Text style={styles.calcLabel}>Revised Total Order Value:</Text>
                      <Text style={styles.calcValue}>₹{total.toFixed(2)}</Text>
                    </View>
                  );
                })()}

                {/* Reapproval Notes / Justification */}
                <Input
                  label="Manager Notes / Reason"
                  placeholder="e.g. Revised price for store"
                  value={managerEditNotes}
                  onChangeText={setManagerEditNotes}
                  containerStyle={{ marginTop: Spacing.xs }}
                  leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
                />

                <View style={styles.modalButtonsRow}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setManagerPriceModalVisible(false)}
                    disabled={isManagerSubmitting}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    title={isManagerSubmitting ? 'Sending...' : 'Send for Approval'}
                    variant="primary"
                    onPress={handleManagerResubmitPrice}
                    loading={isManagerSubmitting}
                    disabled={!managerEditPriceStr || isNaN(parseFloat(managerEditPriceStr)) || parseFloat(managerEditPriceStr) <= 0 || isManagerSubmitting}
                    style={{ flex: 1.6 }}
                  />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* In-App Tax Invoice PDF Preview + Share Modal */}
      <PdfPreviewModal
        visible={pdfPreview !== null}
        pdfUrl={pdfPreview?.url || null}
        filename={pdfPreview?.filename}
        title={pdfPreview?.title}
        onClose={() => setPdfPreview(null)}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
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
  managerRejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  managerRejectedTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#9F1239',
  },
  managerRejectedReason: {
    ...Typography.caption,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
    marginBottom: Spacing.lg,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  rejectionContextBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  rejectionContextTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#9F1239',
    textTransform: 'uppercase',
  },
  rejectionContextText: {
    ...Typography.bodySmall,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 18,
  },
  priceSummaryBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  priceSummaryLabel: {
    ...Typography.caption,
    color: '#64748B',
  },
  priceSummaryValue: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  priceSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  calculationPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  calcLabel: {
    ...Typography.bodySmall,
    color: '#166534',
    fontWeight: '600',
  },
  calcValue: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#15803D',
  },
  managerInvoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    flexWrap: 'wrap',
  },
  managerPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
    backgroundColor: BrandColors.green.subtle,
    gap: 4,
  },
  managerPdfBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  managerWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: '#25D366',
    gap: 4,
  },
  managerWaBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  managerShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.green.primary,
    gap: 4,
  },
  managerShareBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.8,
  },
});
