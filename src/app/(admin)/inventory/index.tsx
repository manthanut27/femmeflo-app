import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type {
  AdminInventoryTransactionItem,
  InventorySummaryData,
  ProductItem,
  PublicUser,
  WarehouseItem,
} from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  DropdownOption,
  DropdownTrigger,
  SearchableDropdownModal,
} from '@/components/ui/SearchableDropdownModal';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import {
  formatTransactionIST,
  getTransactionRoute,
  mapHistoryFilterToApiType,
} from '@/utils/inventoryMovement';

export type MainSectionTab = 'TRANSFER' | 'INWARD' | 'HISTORY';
export type HistoryFilterType = 'All' | 'Inward' | 'Transfer' | 'Sales';

const QUICK_ADD_PILLS = [100, 500, 1000, 2500, 5000];

export default function AdminInventoryMainScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string; section?: string; tab?: string }>();

  const handleBack = useCallback(() => {
    if (params?.from === 'actions') {
      try {
        (navigation as any).navigate('actions/index');
        return;
      } catch {
        // fallback
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      try {
        (navigation as any).navigate('actions/index');
      } catch {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [params?.from, navigation, router]);

  useEffect(() => {
    if (params?.from === 'actions') {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [params?.from, handleBack]);

  // Primary 3-Section Navigation: Stock Transfer, Stock Inward, History
  // Default to 'HISTORY' so recent history is shown below the stat cards and action buttons
  const initialSection: MainSectionTab = useMemo(() => {
    const raw = (params?.section || params?.tab || '').toUpperCase();
    if (raw === 'TRANSFER') return 'TRANSFER';
    if (raw === 'INWARD') return 'INWARD';
    return 'HISTORY';
  }, [params?.section, params?.tab]);

  const [activeSection, setActiveSection] = useState<MainSectionTab>(initialSection);

  // Master Data State
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Section 1: Stock Transfer Form State
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQtyStr, setTransferQtyStr] = useState('100');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Section 2: Stock Inward Form State
  const [inwardProductId, setInwardProductId] = useState('');
  const [inwardQtyStr, setInwardQtyStr] = useState('500');
  const [isSubmittingInward, setIsSubmittingInward] = useState(false);

  // Section 3: History State
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterType>('All');
  const [transactions, setTransactions] = useState<AdminInventoryTransactionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);

  // Pickers Modal State
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  const [transferProdPickerOpen, setTransferProdPickerOpen] = useState(false);
  const [inwardProdPickerOpen, setInwardProdPickerOpen] = useState(false);

  // Common UI Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initial Master Data Fetching
  const fetchMasterData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [whRes, prodRes, sellRes, mgrRes, sumRes] = await Promise.all([
        adminApi.getWarehouses(),
        adminApi.listProducts().catch(() => ({ items: [] as ProductItem[] })),
        adminApi.listSellers({ pageSize: 100 }).catch(() => ({ items: [] as PublicUser[] })),
        adminApi.listManagers({ pageSize: 100 }).catch(() => ({ items: [] as PublicUser[] })),
        adminApi.getInventorySummary().catch(() => null),
      ]);

      const liveWarehouses = whRes.items || [];
      const liveProducts = prodRes.items || [];
      const liveSellers = sellRes.items || [];
      const liveManagers = mgrRes.items || [];

      setWarehouses(liveWarehouses);
      setProducts(liveProducts);
      setSellers(liveSellers);
      setManagers(liveManagers);
      setInventorySummary(sumRes);

      // Initialize Transfer Source
      if (liveWarehouses.length > 0) {
        setSourceWarehouseId((prev) => (prev && liveWarehouses.some((w) => w.id === prev) ? prev : liveWarehouses[0].id));
      }

      // Initialize Products
      if (liveProducts.length > 0) {
        setTransferProductId((prev) => (prev && liveProducts.some((p) => p.id === prev) ? prev : liveProducts[0].id));
        setInwardProductId((prev) => (prev && liveProducts.some((p) => p.id === prev) ? prev : liveProducts[0].id));
      }

      // Initialize Destination
      if (liveSellers.length > 0) {
        setTargetLocationId((prev) => (prev ? prev : liveSellers[0].id));
      } else if (liveWarehouses.length > 1) {
        setTargetLocationId(liveWarehouses[1].id);
      }
    } catch (err: any) {
      setDataError(err?.message || 'Failed to load inventory locations. Please check your network connection.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Load Transactions for History Section
  const fetchTransactions = useCallback(
    async (filter: HistoryFilterType, page = 1, isRefresh = false) => {
      if (isRefresh) setHistoryRefreshing(true);
      else if (page === 1) setHistoryLoading(true);
      else setIsLoadingMoreHistory(true);

      setHistoryError(null);
      try {
        const apiType = mapHistoryFilterToApiType(filter);

        const res = await adminApi.listInventoryTransactions({
          page,
          pageSize: 15,
          type: apiType,
        });

        const items = res.items || [];
        if (page === 1) {
          setTransactions(items);
        } else {
          setTransactions((prev) => [...prev, ...items]);
        }
        setHistoryPage(res.pagination?.page || page);
        setHistoryTotalPages(res.pagination?.totalPages || 1);
      } catch (err: any) {
        setHistoryError(err?.message || 'Failed to load transaction ledger.');
      } finally {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
        setIsLoadingMoreHistory(false);
      }
    },
    []
  );

  // Always fetch transactions on mount and filter changes so recent history is immediately ready
  useEffect(() => {
    fetchTransactions(historyFilter, 1);
  }, [historyFilter, fetchTransactions]);

  useFocusEffect(
    useCallback(() => {
      fetchMasterData();
      fetchTransactions(historyFilter, 1);
    }, [fetchMasterData, fetchTransactions, historyFilter])
  );

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      fetchMasterData(),
      fetchTransactions(historyFilter, 1, true),
    ]);
  }, [fetchMasterData, historyFilter, fetchTransactions]);

  // Selected Lookups
  const selectedSourceWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === sourceWarehouseId) || warehouses[0];
  }, [warehouses, sourceWarehouseId]);

  const selectedTransferProduct = useMemo(() => {
    return products.find((p) => p.id === transferProductId);
  }, [products, transferProductId]);

  const selectedInwardProduct = useMemo(() => {
    return products.find((p) => p.id === inwardProductId);
  }, [products, inwardProductId]);

  // Available Stock at Source Calculation
  const sourceAvailableStock = useMemo(() => {
    if (!sourceWarehouseId) return 0;
    const summaryLoc = inventorySummary?.locations?.find((l) => l.id === sourceWarehouseId);
    if (summaryLoc && transferProductId) {
      const prodBal = summaryLoc.productBalances?.find((pb) => pb.productId === transferProductId);
      if (typeof prodBal?.balance === 'number') {
        return prodBal.balance;
      }
    }
    if (summaryLoc && typeof summaryLoc.balance === 'number') {
      return summaryLoc.balance;
    }
    return typeof selectedSourceWarehouse?.balance === 'number' ? selectedSourceWarehouse.balance : 0;
  }, [sourceWarehouseId, inventorySummary, transferProductId, selectedSourceWarehouse]);

  // Dropdown Options: Source Warehouse
  const sourceWarehouseOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [];
    const seenIds = new Set<string>();

    for (const wh of warehouses) {
      const id = String(wh?.id || '').trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const isHq = wh.type === 'HQ';
      const bal = typeof (wh as any).balance === 'number' ? (wh as any).balance : 0;
      list.push({
        id,
        title: wh.name || 'Warehouse',
        subtitle: `Code: ${wh.code || 'WH'} • Available: ${bal.toLocaleString('en-IN')} pkts`,
        badge: isHq ? 'CENTRAL HQ' : 'REGIONAL DEPOT',
        badgeVariant: isHq ? 'ACTIVE' : 'neutral',
        metadata: `${wh.state || ''} ${wh.district || ''} ${wh.code || ''}`,
        icon: 'cube',
      });
    }

    return list;
  }, [warehouses]);

  // Dropdown Options: Destination Locations (Excluding Source Warehouse)
  const destinationOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [];
    const seenIds = new Set<string>();

    // 1. Dual-Role Managers (Dedicated Field Van Stock)
    const dualRoleManagers = managers.filter((m) => Boolean(m?.isSeller));
    for (const m of dualRoleManagers) {
      const id = String(m?.id || '').trim();
      if (!id || id === sourceWarehouseId || seenIds.has(id)) continue;
      seenIds.add(id);

      list.push({
        id,
        title: `${m.name || 'Manager'} (Dual-Role Manager - Van Stock)`,
        subtitle: `Van Stock • Territory: ${[m.district, m.state].filter(Boolean).join(', ') || 'Assigned Zone'}`,
        badge: 'VAN STOCK',
        badgeVariant: 'ACTIVE',
        metadata: `${m.phone || ''} ${m.email || ''} ${m.district || ''} dual role van stock manager`,
        icon: 'car-sport',
      });
    }

    // 2. Field Officers / Sellers
    for (const s of sellers) {
      const id = String(s?.id || (s as any)?.sellerId || (s as any)?.userId || '').trim();
      if (!id || id === sourceWarehouseId || seenIds.has(id)) continue;
      seenIds.add(id);

      list.push({
        id,
        title: `${s.name || 'Field Officer'} (Field Officer)`,
        subtitle: `Seller ID: ${id ? id.slice(0, 8) : 'N/A'} • Phone: ${s.phone || 'N/A'}`,
        badge: 'FIELD SELLER',
        badgeVariant: 'ACTIVE',
        metadata: `${s.phone || ''} ${s.email || ''}`,
        icon: 'person',
      });
    }

    // 3. Regional Hubs / Other Warehouses (Strictly Exclude Source)
    for (const w of warehouses) {
      const id = String(w?.id || '').trim();
      if (!id || id === sourceWarehouseId || seenIds.has(id)) continue;
      seenIds.add(id);

      const bal = typeof (w as any).balance === 'number' ? (w as any).balance : 0;
      list.push({
        id,
        title: `${w.name || 'Regional Hub'} (Regional Hub)`,
        subtitle: `Code: ${w.code || 'WH'} • Balance: ${bal.toLocaleString('en-IN')} pkts`,
        badge: 'DEPOT / HUB',
        badgeVariant: 'neutral',
        metadata: `${w.code || ''} ${w.district || ''}`,
        icon: 'business',
      });
    }

    return list;
  }, [managers, sellers, warehouses, sourceWarehouseId]);

  const selectedDestination = useMemo(() => {
    return destinationOptions.find((d) => d.id === targetLocationId);
  }, [destinationOptions, targetLocationId]);

  // Dropdown Options: Products
  const productOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [];
    const seenIds = new Set<string>();

    for (const p of products) {
      const id = String(p?.id || '').trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const basePrice = ((p.basePricePaise ?? 2500) / 100).toFixed(2);
      list.push({
        id,
        title: p.name || 'Product SKU',
        subtitle: `SKU: ${p.sku || id.slice(0, 8)} • Base Price: ₹${basePrice}`,
        badge: p.sku || 'SKU',
        badgeVariant: 'ACTIVE',
        metadata: `${p.sku || ''} ${p.description || ''}`,
        icon: 'pricetag',
      });
    }

    return list;
  }, [products]);

  // Validation Checkers
  const parsedTransferQty = parseInt(transferQtyStr, 10);
  const isTransferQtyValid = !isNaN(parsedTransferQty) && parsedTransferQty > 0;
  const isTransferStockExceeded =
    isTransferQtyValid && sourceAvailableStock > 0 && parsedTransferQty > sourceAvailableStock;

  const isTransferFormValid =
    Boolean(sourceWarehouseId) &&
    Boolean(targetLocationId) &&
    sourceWarehouseId !== targetLocationId &&
    Boolean(transferProductId) &&
    isTransferQtyValid &&
    !isTransferStockExceeded;

  const parsedInwardQty = parseInt(inwardQtyStr, 10);
  const isInwardQtyValid = !isNaN(parsedInwardQty) && parsedInwardQty > 0;
  const isInwardFormValid = Boolean(inwardProductId) && isInwardQtyValid;

  const handleTransferQuickAdd = (amount: number) => {
    const current = parseInt(transferQtyStr, 10);
    const next = isNaN(current) || current <= 0 ? amount : current + amount;
    if (sourceAvailableStock > 0 && next > sourceAvailableStock) {
      setTransferQtyStr(String(sourceAvailableStock));
    } else {
      setTransferQtyStr(String(next));
    }
  };

  const handleInwardQuickAdd = (amount: number) => {
    const current = parseInt(inwardQtyStr, 10);
    const next = isNaN(current) || current <= 0 ? amount : current + amount;
    setInwardQtyStr(String(next));
  };

  // Submit Handler: Stock Transfer
  async function handleExecuteTransfer() {
    if (isSubmittingTransfer || !isTransferFormValid) return;

    setFeedback(null);
    setIsSubmittingTransfer(true);
    try {
      await adminApi.recordStockTransfer({
        sourceWarehouseId,
        targetLocationId,
        productId: transferProductId,
        quantity: parsedTransferQty,
      });

      DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'TRANSFER' });

      setFeedback({
        type: 'success',
        message: `Transferred ${parsedTransferQty.toLocaleString('en-IN')} packets to ${selectedDestination?.title || 'destination'}.`,
      });

      Alert.alert(
        'Stock Transferred',
        `Sent ${parsedTransferQty.toLocaleString('en-IN')} packets to ${selectedDestination?.title || 'destination'}.`,
        [{ text: 'OK' }]
      );

      // Refresh master inventory data and recent transactions
      fetchMasterData();
      fetchTransactions(historyFilter, 1);
    } catch (err: any) {
      const msg = err.message || 'Failed to dispatch stock transfer.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Transfer Failed', msg);
    } finally {
      setIsSubmittingTransfer(false);
    }
  }

  // Submit Handler: Stock Inward
  async function handleExecuteInward() {
    if (isSubmittingInward || !isInwardFormValid) return;

    setFeedback(null);
    setIsSubmittingInward(true);
    try {
      await adminApi.recordStockReceipt({
        productId: inwardProductId,
        quantity: parsedInwardQty,
      });

      DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'RECEIPT' });

      setFeedback({
        type: 'success',
        message: `Added ${parsedInwardQty.toLocaleString('en-IN')} packets to HQ stock.`,
      });

      Alert.alert(
        'Stock Received',
        `Added ${parsedInwardQty.toLocaleString('en-IN')} packets to HQ stock.`,
        [{ text: 'OK' }]
      );

      // Refresh master inventory data and recent transactions
      fetchMasterData();
      fetchTransactions(historyFilter, 1);
    } catch (err: any) {
      const msg = err.message || 'Failed to record stock inward.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Inward Failed', msg);
    } finally {
      setIsSubmittingInward(false);
    }
  }

  // Helper to render transaction item card
  const renderTransactionCard = (tx: AdminInventoryTransactionItem) => {
    const { dateStr, timeStr } = formatTransactionIST(tx.createdAt);
    const route = getTransactionRoute(tx);
    const upperType = String(tx.type || '').toUpperCase();
    const isTxInward = upperType === 'INWARD' || upperType === 'RECEIPT';
    const isTxTransfer = upperType === 'TRANSFER' || upperType === 'DISPATCH';

    const typeColor = isTxInward
      ? BrandColors.green.dark
      : isTxTransfer
      ? '#0369A1'
      : '#7C3AED';

    const typeBg = isTxInward
      ? BrandColors.green.surface
      : isTxTransfer
      ? '#F0F9FF'
      : '#F5F3FF';

    const prodName = tx.product?.name || tx.productName || 'Sanitary Napkins Pack';
    const prodSku = tx.product?.sku || tx.productSku || 'SKU';
    const actorName = tx.actor?.name || tx.user?.name || tx.createdBy?.name || 'Super Admin';

    return (
      <Card key={tx.id} style={styles.txCard}>
        {/* Top Row: Type Badge + IST Timestamp */}
        <View style={styles.txTopRow}>
          <View style={[styles.txTypeBadge, { backgroundColor: typeBg }]}>
            <Text style={[styles.txTypeBadgeText, { color: typeColor }]}>
              {isTxInward ? 'INWARD' : upperType}
            </Text>
          </View>
          <View style={styles.txDateWrap}>
            <Ionicons name="calendar-outline" size={13} color={Colors.light.textTertiary} />
            <Text style={styles.txDateText}>
              {dateStr} • {timeStr}
            </Text>
          </View>
        </View>

        {/* Route: From -> To */}
        <View style={styles.txRouteBox}>
          <View style={styles.txRouteNode}>
            <Text style={styles.txRouteLabel}>FROM</Text>
            <Text style={styles.txRouteText} numberOfLines={1}>
              {route.from}
            </Text>
          </View>
          <View style={styles.txRouteArrowWrap}>
            <Ionicons name="arrow-forward" size={16} color={BrandColors.green.primary} />
          </View>
          <View style={styles.txRouteNode}>
            <Text style={styles.txRouteLabel}>TO</Text>
            <Text style={styles.txRouteText} numberOfLines={1}>
              {route.to}
            </Text>
          </View>
        </View>

        {/* Product & Quantity */}
        <View style={styles.txProductRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txProductName} numberOfLines={1}>
              {prodName}
            </Text>
            <Text style={styles.txProductSku}>SKU: {prodSku}</Text>
          </View>
          <View style={[styles.txQuantityPill, isTxInward && styles.txQuantityPillInward]}>
            <Text style={[styles.txQuantityText, isTxInward && styles.txQuantityTextInward]}>
              {isTxInward ? '+' : ''}{Number(tx.quantity).toLocaleString('en-IN')} pkts
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.txFooterRow}>
          <View style={styles.txActorWrap}>
            <Ionicons name="person-circle-outline" size={14} color={Colors.light.textTertiary} />
            <Text style={styles.txActorText} numberOfLines={1}>
              By: {actorName}
            </Text>
          </View>
          <View style={styles.txStatusPill}>
            <Ionicons name="checkmark-circle" size={12} color={BrandColors.green.primary} />
            <Text style={styles.txStatusText}>Recorded</Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Stock Movement Hub"
        subtitle="Transfer stock, add factory inward, and view history"
        showBack={Boolean(params?.from === 'actions')}
        onBack={handleBack}
        rightAction={
          <TouchableOpacity
            style={styles.addWarehouseHeaderBtn}
            onPress={() => router.push('/(admin)/inventory/new' as any)}
            accessibilityRole="button"
            accessibilityLabel="Add Warehouse Depot"
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.addWarehouseHeaderBtnText}>Depot</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={dataLoading || historyRefreshing}
            onRefresh={handleRefreshAll}
            colors={[BrandColors.green.primary, BrandColors.pink.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
            />
          )}

          {dataError && (
            <Card style={styles.errorCard}>
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={20} color={Colors.light.danger} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Inventory Lookup Issue</Text>
                  <Text style={styles.errorText}>{dataError}</Text>
                </View>
              </View>
              <Button
                title="Retry Fetch"
                variant="outline"
                size="sm"
                onPress={fetchMasterData}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>
          )}

          {/* ==================================================== */}
          {/* STAT CARDS SECTION (HQ, Depots, Vans, Total)          */}
          {/* ==================================================== */}
          <View style={styles.statsSection}>
            <View style={styles.statCardsRow}>
              {/* Card 1: Central HQ Stock */}
              <Card style={[styles.statCard, { borderLeftColor: BrandColors.green.primary, borderLeftWidth: 4 }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>CENTRAL HQ</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: BrandColors.green.surface }]}>
                    <Ionicons name="cube" size={14} color={BrandColors.green.primary} />
                  </View>
                </View>
                <Text style={[styles.statCardValue, { color: BrandColors.green.primary }]}>
                  {(inventorySummary?.hqStock ?? 0).toLocaleString('en-IN')}
                  <Text style={styles.statCardUnit}> pkts</Text>
                </Text>
                <Text style={styles.statCardSub}>HQ Reserve</Text>
              </Card>

              {/* Card 2: Regional Depots */}
              <Card style={[styles.statCard, { borderLeftColor: '#0284C7', borderLeftWidth: 4 }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>DEPOTS</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="business" size={14} color="#0284C7" />
                  </View>
                </View>
                <Text style={[styles.statCardValue, { color: '#0284C7' }]}>
                  {(inventorySummary?.warehouseStock ?? 0).toLocaleString('en-IN')}
                  <Text style={styles.statCardUnit}> pkts</Text>
                </Text>
                <Text style={styles.statCardSub}>{warehouses.length} active facilities</Text>
              </Card>
            </View>

            <View style={styles.statCardsRow}>
              {/* Card 3: Field Van Stock */}
              <Card style={[styles.statCard, { borderLeftColor: BrandColors.pink.primary, borderLeftWidth: 4 }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>VAN STOCK</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: BrandColors.pink.surface }]}>
                    <Ionicons name="car-sport" size={14} color={BrandColors.pink.primary} />
                  </View>
                </View>
                <Text style={[styles.statCardValue, { color: BrandColors.pink.primary }]}>
                  {(inventorySummary?.sellerStock ?? 0).toLocaleString('en-IN')}
                  <Text style={styles.statCardUnit}> pkts</Text>
                </Text>
                <Text style={styles.statCardSub}>{sellers.length} field sellers</Text>
              </Card>

              {/* Card 4: Total System Stock */}
              <Card style={[styles.statCard, { borderLeftColor: '#7C3AED', borderLeftWidth: 4 }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statCardLabel}>TOTAL STOCK</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="layers" size={14} color="#7C3AED" />
                  </View>
                </View>
                <Text style={[styles.statCardValue, { color: '#7C3AED' }]}>
                  {(inventorySummary?.totalStock ?? 0).toLocaleString('en-IN')}
                  <Text style={styles.statCardUnit}> pkts</Text>
                </Text>
                <Text style={styles.statCardSub}>Entire network</Text>
              </Card>
            </View>
          </View>

          {/* ==================================================== */}
          {/* THREE PROPER BUTTONS AT TOP                          */}
          {/* (Stock Transfer, Stock Inward, History)              */}
          {/* ==================================================== */}
          <View style={styles.actionButtonsContainer}>
            <Text style={styles.sectionHeaderTitle}>Stock Actions</Text>
            <View style={styles.actionButtonsRow}>
              {/* Button 1: Stock Transfer */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  activeSection === 'TRANSFER' && styles.actionButtonActiveTransfer,
                ]}
                onPress={() => {
                  setActiveSection('TRANSFER');
                  setFeedback(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: activeSection === 'TRANSFER' }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: '#E0F2FE' },
                    activeSection === 'TRANSFER' && styles.actionIconBoxActiveTransfer,
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={20}
                    color={activeSection === 'TRANSFER' ? '#FFFFFF' : '#0369A1'}
                  />
                </View>
                <Text
                  style={[
                    styles.actionButtonTitle,
                    activeSection === 'TRANSFER' && styles.actionButtonTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  Stock Transfer
                </Text>
                <Text style={styles.actionButtonSub} numberOfLines={1}>
                  Depot to Van
                </Text>
              </TouchableOpacity>

              {/* Button 2: Stock Inward */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  activeSection === 'INWARD' && styles.actionButtonActiveInward,
                ]}
                onPress={() => {
                  setActiveSection('INWARD');
                  setFeedback(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: activeSection === 'INWARD' }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: BrandColors.green.surface },
                    activeSection === 'INWARD' && styles.actionIconBoxActiveInward,
                  ]}
                >
                  <Ionicons
                    name="download"
                    size={20}
                    color={activeSection === 'INWARD' ? '#FFFFFF' : BrandColors.green.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.actionButtonTitle,
                    activeSection === 'INWARD' && styles.actionButtonTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  Stock Inward
                </Text>
                <Text style={styles.actionButtonSub} numberOfLines={1}>
                  Factory to HQ
                </Text>
              </TouchableOpacity>

              {/* Button 3: History */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  activeSection === 'HISTORY' && styles.actionButtonActiveHistory,
                ]}
                onPress={() => {
                  setActiveSection('HISTORY');
                  setFeedback(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: activeSection === 'HISTORY' }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: '#F1F5F9' },
                    activeSection === 'HISTORY' && styles.actionIconBoxActiveHistory,
                  ]}
                >
                  <Ionicons
                    name="time"
                    size={20}
                    color={activeSection === 'HISTORY' ? '#FFFFFF' : '#475569'}
                  />
                </View>
                <Text
                  style={[
                    styles.actionButtonTitle,
                    activeSection === 'HISTORY' && styles.actionButtonTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  History
                </Text>
                <Text style={styles.actionButtonSub} numberOfLines={1}>
                  Ledger Audit
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ==================================================== */}
          {/* SECTION 1: STOCK TRANSFER FORM (When active)          */}
          {/* ==================================================== */}
          {activeSection === 'TRANSFER' && (
            <Card style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={[styles.formHeaderIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="swap-horizontal" size={18} color="#0369A1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formHeaderTitle}>Transfer Stock</Text>
                  <Text style={styles.formHeaderSubtitle}>
                    Dispatch packets from central/regional depot to seller vans or hubs.
                  </Text>
                </View>
              </View>

              {/* 1. Source Warehouse Trigger */}
              <View style={styles.fieldWrap}>
                <DropdownTrigger
                  label="SOURCE WAREHOUSE (FROM)"
                  required
                  value={selectedSourceWarehouse?.name || 'Select Source Depot'}
                  subtitle={`Code: ${selectedSourceWarehouse?.code || 'WH'} • Balance: ${sourceAvailableStock.toLocaleString('en-IN')} pkts`}
                  badge={selectedSourceWarehouse?.type === 'HQ' ? 'CENTRAL HQ' : 'DEPOT'}
                  icon="cube-outline"
                  onPress={() => setSourcePickerOpen(true)}
                />
              </View>

              {/* 2. Destination Location Trigger */}
              <View style={styles.fieldWrap}>
                <DropdownTrigger
                  label="DESTINATION (TO)"
                  required
                  value={selectedDestination?.title || 'Select Target Location'}
                  subtitle={selectedDestination?.subtitle || 'Tap to choose destination'}
                  badge={selectedDestination?.badge || 'DESTINATION'}
                  icon="car-sport-outline"
                  onPress={() => setDestPickerOpen(true)}
                />
              </View>

              {/* 3. Product Selection Trigger */}
              <View style={styles.fieldWrap}>
                <DropdownTrigger
                  label="PRODUCT SKU"
                  required
                  value={selectedTransferProduct?.name || 'Select Product SKU'}
                  subtitle={`SKU: ${selectedTransferProduct?.sku || 'SKU'} • Available: ${sourceAvailableStock.toLocaleString('en-IN')} pkts`}
                  badge={selectedTransferProduct?.sku || 'SKU'}
                  icon="pricetag-outline"
                  onPress={() => setTransferProdPickerOpen(true)}
                />
              </View>

              {/* Live Available Stock Badge */}
              <View style={styles.balanceInfoBox}>
                <Ionicons name="information-circle" size={16} color="#0369A1" style={{ marginRight: 6 }} />
                <Text style={styles.balanceInfoText}>
                  Source Stock Available: <Text style={{ fontWeight: '800' }}>{sourceAvailableStock.toLocaleString('en-IN')}</Text> packets
                </Text>
              </View>

              {/* 4. Quantity Input */}
              <View style={styles.fieldWrap}>
                <Input
                  label="TRANSFER QUANTITY (PACKETS) *"
                  value={transferQtyStr}
                  onChangeText={setTransferQtyStr}
                  placeholder="e.g. 200"
                  keyboardType="number-pad"
                  leftIcon={<Ionicons name="cube-outline" size={18} color="#64748B" />}
                  error={
                    isTransferStockExceeded
                      ? `Cannot transfer more than available balance (${sourceAvailableStock.toLocaleString('en-IN')} pkts).`
                      : !isTransferQtyValid && transferQtyStr.length > 0
                      ? 'Please enter a valid packet quantity.'
                      : undefined
                  }
                />
              </View>

              {/* Quick Add Pills */}
              <View style={styles.quickAddWrap}>
                <Text style={styles.quickAddLabel}>Quick Add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddScroll}>
                  {QUICK_ADD_PILLS.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={styles.quickPill}
                      onPress={() => handleTransferQuickAdd(amount)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickPillText}>+{amount.toLocaleString('en-IN')}</Text>
                    </TouchableOpacity>
                  ))}
                  {sourceAvailableStock > 0 && (
                    <TouchableOpacity
                      style={[styles.quickPill, styles.quickPillMax]}
                      onPress={() => setTransferQtyStr(String(sourceAvailableStock))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickPillMaxText}>Max ({sourceAvailableStock.toLocaleString('en-IN')})</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* Submit Transfer Button */}
              <Button
                title={isSubmittingTransfer ? 'Dispatching Transfer...' : 'Confirm & Dispatch Transfer'}
                variant="primary"
                size="lg"
                onPress={handleExecuteTransfer}
                loading={isSubmittingTransfer}
                disabled={!isTransferFormValid || isSubmittingTransfer}
                icon={<Ionicons name="send" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          )}

          {/* ==================================================== */}
          {/* SECTION 2: STOCK INWARD FORM (When active)            */}
          {/* ==================================================== */}
          {activeSection === 'INWARD' && (
            <Card style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={[styles.formHeaderIconCircle, { backgroundColor: BrandColors.green.surface }]}>
                  <Ionicons name="download" size={18} color={BrandColors.green.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formHeaderTitle}>Factory Stock Inward</Text>
                  <Text style={styles.formHeaderSubtitle}>
                    Record incoming factory shipment packets into Central HQ inventory.
                  </Text>
                </View>
              </View>

              {/* 1. Target Inward Depot */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>DESTINATION WAREHOUSE (HQ) *</Text>
                <Card variant="flat" style={styles.inwardHqBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="business" size={20} color={BrandColors.green.primary} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inwardHqTitle}>Central HQ Master Depot</Text>
                      <Text style={styles.inwardHqSubtitle}>
                        Direct Factory Consignment Inward Reserve
                      </Text>
                    </View>
                    <Badge label="CENTRAL HQ" variant="ACTIVE" size="sm" />
                  </View>
                </Card>
              </View>

              {/* 2. Product Selection Trigger */}
              <View style={styles.fieldWrap}>
                <DropdownTrigger
                  label="PRODUCT SKU TO RECEIVE"
                  required
                  value={selectedInwardProduct?.name || 'Select Product SKU to Receive'}
                  subtitle={`SKU: ${selectedInwardProduct?.sku || 'SKU'} • Tap to choose`}
                  badge={selectedInwardProduct?.sku || 'SKU'}
                  icon="pricetag-outline"
                  onPress={() => setInwardProdPickerOpen(true)}
                />
              </View>

              {/* 3. Inward Quantity Input */}
              <View style={styles.fieldWrap}>
                <Input
                  label="RECEIVED QUANTITY (PACKETS) *"
                  value={inwardQtyStr}
                  onChangeText={setInwardQtyStr}
                  placeholder="e.g. 5000"
                  keyboardType="number-pad"
                  leftIcon={<Ionicons name="cube-outline" size={18} color="#64748B" />}
                  error={!isInwardQtyValid && inwardQtyStr.length > 0 ? 'Please enter a valid packet quantity.' : undefined}
                />
              </View>

              {/* Quick Add Pills */}
              <View style={styles.quickAddWrap}>
                <Text style={styles.quickAddLabel}>Quick Add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddScroll}>
                  {QUICK_ADD_PILLS.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={styles.quickPill}
                      onPress={() => handleInwardQuickAdd(amount)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickPillText}>+{amount.toLocaleString('en-IN')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Submit Inward Button */}
              <Button
                title={isSubmittingInward ? 'Recording Factory Inward...' : 'Add Stock to HQ'}
                variant="primary"
                size="lg"
                onPress={handleExecuteInward}
                loading={isSubmittingInward}
                disabled={!isInwardFormValid || isSubmittingInward}
                icon={<Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          )}

          {/* ==================================================== */}
          {/* BELOW SHOWN RECENT HISTORY                           */}
          {/* (Shown in all modes, fully filtered when in History) */}
          {/* ==================================================== */}
          <View style={styles.historySection}>
            <View style={styles.historySectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>
                  {activeSection === 'HISTORY'
                    ? 'Recent History & Audit Ledger'
                    : activeSection === 'TRANSFER'
                    ? 'Recent Stock Transfers'
                    : 'Recent Inward Receipts'}
                </Text>
                <Text style={styles.historySectionSubtitle}>
                  {activeSection === 'HISTORY'
                    ? 'All transfers, factory receipts, and retail deliveries'
                    : 'Latest recorded stock movements in the ledger'}
                </Text>
              </View>

              {activeSection !== 'HISTORY' && (
                <TouchableOpacity
                  onPress={() => setActiveSection('HISTORY')}
                  style={styles.viewAllHistoryLink}
                  accessibilityRole="button"
                  accessibilityLabel="View all history"
                >
                  <Text style={styles.viewAllHistoryLinkText}>View All ›</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* History Filter Pills (When History tab is active) */}
            {activeSection === 'HISTORY' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.historyFilterScroll}
              >
                {(['All', 'Inward', 'Transfer', 'Sales'] as HistoryFilterType[]).map((tab) => {
                  const isActive = historyFilter === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.historyFilterPill, isActive && styles.historyFilterPillActive]}
                      onPress={() => setHistoryFilter(tab)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.historyFilterText, isActive && styles.historyFilterTextActive]}>
                        {tab === 'All' ? 'All Movements' : tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Loading Skeleton */}
            {historyLoading && (
              <View style={{ gap: Spacing.sm }}>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </View>
            )}

            {/* Error State */}
            {historyError && !historyLoading && (
              <Card style={styles.errorCard}>
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={18} color={Colors.light.danger} style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{historyError}</Text>
                </View>
                <Button
                  title="Retry"
                  variant="outline"
                  size="sm"
                  onPress={() => fetchTransactions(historyFilter, 1, true)}
                  style={{ marginTop: Spacing.sm, alignSelf: 'flex-start' }}
                />
              </Card>
            )}

            {/* Empty History State */}
            {!historyLoading && !historyError && transactions.length === 0 && (
              <Card style={styles.emptyStateCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="file-tray-outline" size={32} color={Colors.light.textMuted} />
                </View>
                <Text style={styles.emptyStateTitle}>No Movements Recorded</Text>
                <Text style={styles.emptyStateText}>
                  {historyFilter === 'All'
                    ? 'No stock movements or transactions found in the ledger.'
                    : `No ${historyFilter.toLowerCase()} transactions found for this filter.`}
                </Text>
                <Button
                  title="Refresh Ledger"
                  variant="outline"
                  size="sm"
                  onPress={() => fetchTransactions(historyFilter, 1, true)}
                  style={{ marginTop: Spacing.md }}
                />
              </Card>
            )}

            {/* Transactions List */}
            {!historyLoading && (
              <View style={styles.transactionsList}>
                {(activeSection === 'HISTORY'
                  ? transactions
                  : activeSection === 'TRANSFER'
                  ? transactions.filter((t) => String(t.type || '').toUpperCase().includes('TRANSFER'))
                  : transactions.filter((t) => {
                      const ut = String(t.type || '').toUpperCase();
                      return ut.includes('INWARD') || ut.includes('RECEIPT');
                    })
                ).slice(0, activeSection === 'HISTORY' ? undefined : 6).map((tx) => renderTransactionCard(tx))}
              </View>
            )}

            {/* Load More Pagination (Only in Full History tab) */}
            {activeSection === 'HISTORY' && !historyLoading && historyPage < historyTotalPages && (
              <View style={styles.paginationWrap}>
                <Button
                  title={isLoadingMoreHistory ? 'Loading More Movements...' : 'Load More History'}
                  variant="outline"
                  size="md"
                  onPress={() => fetchTransactions(historyFilter, historyPage + 1)}
                  loading={isLoadingMoreHistory}
                  disabled={isLoadingMoreHistory}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 1. Searchable Source Warehouse Picker Modal */}
      <SearchableDropdownModal
        visible={sourcePickerOpen}
        title="Select Source Warehouse (From)"
        searchPlaceholder="Search warehouse by name, code, or city..."
        options={sourceWarehouseOptions}
        selectedId={sourceWarehouseId}
        onSelect={(opt) => {
          setSourceWarehouseId(opt.id);
          setSourcePickerOpen(false);
        }}
        onClose={() => setSourcePickerOpen(false)}
        emptyMessage="No source warehouses found"
      />

      {/* 2. Searchable Destination Location Picker Modal */}
      <SearchableDropdownModal
        visible={destPickerOpen}
        title="Select Target Destination (To)"
        searchPlaceholder="Search officer by name, phone, or regional hub..."
        options={destinationOptions}
        selectedId={targetLocationId}
        onSelect={(opt) => {
          setTargetLocationId(opt.id);
          setDestPickerOpen(false);
        }}
        onClose={() => setDestPickerOpen(false)}
        emptyMessage="No destination sellers or regional depots found"
      />

      {/* 3. Searchable Product Picker Modal (Transfer) */}
      <SearchableDropdownModal
        visible={transferProdPickerOpen}
        title="Select Product SKU for Transfer"
        searchPlaceholder="Search SKU by name, code, or price..."
        options={productOptions}
        selectedId={transferProductId}
        onSelect={(opt) => {
          setTransferProductId(opt.id);
          setTransferProdPickerOpen(false);
        }}
        onClose={() => setTransferProdPickerOpen(false)}
        emptyMessage="No matching products found"
      />

      {/* 4. Searchable Product Picker Modal (Inward) */}
      <SearchableDropdownModal
        visible={inwardProdPickerOpen}
        title="Select Product SKU to Inward to HQ"
        searchPlaceholder="Search SKU by name, code, or price..."
        options={productOptions}
        selectedId={inwardProductId}
        onSelect={(opt) => {
          setInwardProductId(opt.id);
          setInwardProdPickerOpen(false);
        }}
        onClose={() => setInwardProdPickerOpen(false)}
        emptyMessage="No matching products found"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  addWarehouseHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.green.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  addWarehouseHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // Stat Cards
  statsSection: {
    gap: Spacing.sm,
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statCardLabel: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  statCardUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  statCardSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },

  // Action Buttons
  actionButtonsContainer: {
    gap: Spacing.xs,
  },
  sectionHeaderTitle: {
    ...Typography.h3,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.heading,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  actionButtonActiveTransfer: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  actionButtonActiveInward: {
    borderColor: BrandColors.green.primary,
    backgroundColor: '#F0FDF4',
  },
  actionButtonActiveHistory: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionIconBoxActiveTransfer: {
    backgroundColor: '#0284C7',
  },
  actionIconBoxActiveInward: {
    backgroundColor: BrandColors.green.primary,
  },
  actionIconBoxActiveHistory: {
    backgroundColor: '#0F172A',
  },
  actionButtonTitle: {
    ...Typography.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.heading,
    textAlign: 'center',
  },
  actionButtonTitleActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  actionButtonSub: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },

  // Forms
  formCard: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  formHeaderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderTitle: {
    ...Typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  formHeaderSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  fieldWrap: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  balanceInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
  },
  balanceInfoText: {
    ...Typography.caption,
    fontSize: 12,
    color: '#0369A1',
  },
  inwardHqBox: {
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  inwardHqTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  inwardHqSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  quickAddWrap: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  quickAddLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  quickAddScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  quickPill: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  quickPillText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  quickPillMax: {
    backgroundColor: BrandColors.green.surface,
    borderColor: BrandColors.green.border,
  },
  quickPillMaxText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },

  // History Section
  historySection: {
    gap: Spacing.sm,
  },
  historySectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySectionSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  viewAllHistoryLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllHistoryLinkText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  historyFilterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  historyFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  historyFilterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  historyFilterText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  historyFilterTextActive: {
    color: '#FFFFFF',
  },
  transactionsList: {
    gap: Spacing.sm,
  },

  // Transaction Cards
  txCard: {
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  txTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  txTypeBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  txDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txDateText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  txRouteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txRouteNode: {
    flex: 1,
  },
  txRouteLabel: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.light.textTertiary,
    letterSpacing: 0.5,
  },
  txRouteText: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.heading,
    marginTop: 1,
  },
  txRouteArrowWrap: {
    paddingHorizontal: 8,
  },
  txProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  txProductName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  txProductSku: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  txQuantityPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txQuantityPillInward: {
    backgroundColor: BrandColors.green.surface,
    borderColor: BrandColors.green.border,
  },
  txQuantityText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  txQuantityTextInward: {
    color: BrandColors.green.dark,
  },
  txFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  txActorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  txActorText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  txStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  txStatusText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.green.primary,
  },
  paginationWrap: {
    marginVertical: Spacing.md,
    alignItems: 'center',
  },

  // Error & Empty States
  errorCard: {
    padding: Spacing.md,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.danger,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.danger,
    marginTop: 2,
  },
  emptyStateCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyStateTitle: {
    ...Typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  emptyStateText: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});
