import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
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

export default function StockMovementHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const handleBack = useCallback(() => {
    try {
      if (params?.from === 'actions') {
        (navigation as any).navigate('actions/index');
        return;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(admin)/actions' as any);
      }
    } catch {
      router.replace('/(admin)/actions' as any);
    }
  }, [navigation, router, params]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  // Primary 3-Section Navigation
  const [activeSection, setActiveSection] = useState<MainSectionTab>('TRANSFER');

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

  useEffect(() => {
    if (activeSection === 'HISTORY') {
      fetchTransactions(historyFilter, 1);
    }
  }, [activeSection, historyFilter, fetchTransactions]);

  const handleRefreshAll = useCallback(async () => {
    await fetchMasterData();
    if (activeSection === 'HISTORY') {
      await fetchTransactions(historyFilter, 1, true);
    }
  }, [fetchMasterData, activeSection, historyFilter, fetchTransactions]);

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
        subtitle: `Code: ${wh.code || 'WH'} • Available Balance: ${bal.toLocaleString('en-IN')} pkts`,
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
        subtitle: `Manager Van Stock • Territory: ${[m.district, m.state].filter(Boolean).join(', ') || 'Assigned Zone'}`,
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

      // Refresh master inventory data
      fetchMasterData();
      if (activeSection === 'HISTORY') {
        fetchTransactions(historyFilter, 1);
      }
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

      // Refresh master inventory data
      fetchMasterData();
      if (activeSection === 'HISTORY') {
        fetchTransactions(historyFilter, 1);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to record stock inward.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Inward Failed', msg);
    } finally {
      setIsSubmittingInward(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Stock Movement Hub"
        subtitle="Manage stock transfers, factory inward and inventory movements."
        showBack
        onBack={handleBack}
      />

      {/* Primary 3-Section Segmented Navigation Buttons */}
      <View style={styles.segmentedNavWrapper}>
        <View style={styles.segmentedNavContainer}>
          <TouchableOpacity
            style={[
              styles.segmentedButton,
              activeSection === 'TRANSFER' && styles.segmentedButtonActive,
            ]}
            onPress={() => {
              setActiveSection('TRANSFER');
              setFeedback(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === 'TRANSFER' }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={16}
              color={activeSection === 'TRANSFER' ? BrandColors.green.dark : Colors.light.textSecondary}
              style={styles.segmentedButtonIcon}
            />
            <Text
              style={[
                styles.segmentedButtonText,
                activeSection === 'TRANSFER' && styles.segmentedButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Stock Transfer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentedButton,
              activeSection === 'INWARD' && styles.segmentedButtonActive,
            ]}
            onPress={() => {
              setActiveSection('INWARD');
              setFeedback(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === 'INWARD' }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="download-outline"
              size={16}
              color={activeSection === 'INWARD' ? BrandColors.green.dark : Colors.light.textSecondary}
              style={styles.segmentedButtonIcon}
            />
            <Text
              style={[
                styles.segmentedButtonText,
                activeSection === 'INWARD' && styles.segmentedButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Stock Inward
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentedButton,
              activeSection === 'HISTORY' && styles.segmentedButtonActive,
            ]}
            onPress={() => {
              setActiveSection('HISTORY');
              setFeedback(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === 'HISTORY' }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={activeSection === 'HISTORY' ? BrandColors.green.dark : Colors.light.textSecondary}
              style={styles.segmentedButtonIcon}
            />
            <Text
              style={[
                styles.segmentedButtonText,
                activeSection === 'HISTORY' && styles.segmentedButtonTextActive,
              ]}
              numberOfLines={1}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
              style={{ marginBottom: Spacing.md }}
            />
          )}

          {dataError && (
            <Card style={styles.errorCard}>
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={24} color={Colors.light.error} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.errorTitle}>Inventory Lookup Issue</Text>
                  <Text style={styles.errorText}>{dataError}</Text>
                </View>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchMasterData}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* ======================================================== */}
          {/* SECTION 1: STOCK TRANSFER */}
          {/* ======================================================== */}
          {activeSection === 'TRANSFER' && (
            <View>
              <Card style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardIconBox, { backgroundColor: BrandColors.green.surface }]}>
                    <Ionicons name="swap-horizontal" size={20} color={BrandColors.green.dark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>Inter-Location Stock Transfer</Text>
                    <Text style={styles.cardHeaderSub}>
                      Dispatch inventory from central or regional depot to field seller vans or regional hubs.
                    </Text>
                  </View>
                </View>

                {/* 1. Source Location (From) */}
                <DropdownTrigger
                  label="Source Location (From)"
                  required
                  value={selectedSourceWarehouse?.name}
                  subtitle={
                    selectedSourceWarehouse
                      ? `Code: ${selectedSourceWarehouse.code || 'HQ'} • Available Balance: ${sourceAvailableStock.toLocaleString('en-IN')} pkts`
                      : 'Select source warehouse...'
                  }
                  badge={selectedSourceWarehouse?.type === 'HQ' ? 'CENTRAL HQ' : 'REGIONAL DEPOT'}
                  icon="cube"
                  onPress={() => setSourcePickerOpen(true)}
                />

                {/* 2. Destination Location (To) */}
                <DropdownTrigger
                  label="Destination Location (To)"
                  required
                  value={selectedDestination?.title}
                  subtitle={selectedDestination?.subtitle || 'Select destination seller or depot...'}
                  badge={selectedDestination?.badge}
                  icon={selectedDestination?.badge === 'FIELD SELLER' ? 'person' : 'business'}
                  onPress={() => setDestPickerOpen(true)}
                />

                {/* 3. Product / SKU Picker */}
                <DropdownTrigger
                  label="Product / SKU"
                  required
                  value={selectedTransferProduct?.name}
                  subtitle={
                    selectedTransferProduct
                      ? `SKU: ${selectedTransferProduct.sku || selectedTransferProduct.id.slice(0, 8)} • Source Stock: ${sourceAvailableStock.toLocaleString('en-IN')} pkts`
                      : 'Select product SKU...'
                  }
                  badge={selectedTransferProduct?.sku || undefined}
                  icon="pricetag"
                  onPress={() => setTransferProdPickerOpen(true)}
                />

                {/* 4. Numeric Quantity Input */}
                <View style={styles.quantitySection}>
                  <Input
                    label="Packet Quantity *"
                    value={transferQtyStr}
                    onChangeText={setTransferQtyStr}
                    keyboardType="number-pad"
                    placeholder="Enter packet quantity..."
                    leftIcon={<Ionicons name="cube-outline" size={18} color={Colors.light.textTertiary} />}
                  />

                  {/* Stock Validation Feedback */}
                  {isTransferStockExceeded && (
                    <View style={styles.stockWarningBox}>
                      <Ionicons name="warning-outline" size={16} color={BrandColors.pink.primary} />
                      <Text style={styles.stockWarningText}>
                        Entered quantity ({parsedTransferQty.toLocaleString('en-IN')}) exceeds available stock ({sourceAvailableStock.toLocaleString('en-IN')} pkts) at source location.
                      </Text>
                    </View>
                  )}
                </View>
              </Card>

              {/* Action Button: Execute Stock Transfer */}
              <Button
                title={isSubmittingTransfer ? 'Processing Transfer...' : 'Execute Stock Transfer'}
                variant="primary"
                size="lg"
                onPress={handleExecuteTransfer}
                disabled={!isTransferFormValid || isSubmittingTransfer}
                loading={isSubmittingTransfer}
                icon={<Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />}
                style={styles.actionButton}
              />
            </View>
          )}

          {/* ======================================================== */}
          {/* SECTION 2: STOCK INWARD */}
          {/* ======================================================== */}
          {activeSection === 'INWARD' && (
            <View>
              <Card style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.cardIconBox, { backgroundColor: BrandColors.pink.surface }]}>
                    <Ionicons name="download" size={20} color={BrandColors.pink.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>Inward Stock to HQ</Text>
                    <Text style={styles.cardHeaderSub}>
                      Receive verified factory packets into Central Reserve.
                    </Text>
                  </View>
                </View>

                {/* Fixed Destination Card: Automatic Central HQ Routing (No Dropdown) */}
                <View style={styles.inwardHqContainer}>
                  <View style={styles.inwardHqHeader}>
                    <View style={styles.inwardHqBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={BrandColors.green.dark} />
                      <Text style={styles.inwardHqBadgeText}>AUTOMATIC RESERVE ROUTING</Text>
                    </View>
                    <Text style={styles.inwardHqTitle}>Central Reserve (HQ Warehouse)</Text>
                  </View>
                  <Text style={styles.inwardHqDescription}>
                    Verified factory inward packets are automatically added into the Central HQ inventory reserve.
                  </Text>
                </View>

                {/* Product / SKU Dropdown */}
                <DropdownTrigger
                  label="Product / SKU *"
                  required
                  value={selectedInwardProduct?.name}
                  subtitle={
                    selectedInwardProduct
                      ? `SKU: ${selectedInwardProduct.sku || selectedInwardProduct.id.slice(0, 8)} • Base Price: ₹${((selectedInwardProduct.basePricePaise ?? 2500) / 100).toFixed(2)}`
                      : 'Select product SKU to inward...'
                  }
                  badge={selectedInwardProduct?.sku || undefined}
                  icon="pricetag"
                  onPress={() => setInwardProdPickerOpen(true)}
                />

                {/* Numeric Packet Quantity Input & Quick Chips */}
                <View style={styles.quantitySection}>
                  <Input
                    label="Packet Quantity *"
                    value={inwardQtyStr}
                    onChangeText={setInwardQtyStr}
                    keyboardType="number-pad"
                    placeholder="Enter received packet count..."
                    leftIcon={<Ionicons name="cube-outline" size={18} color={Colors.light.textTertiary} />}
                  />

                  <View style={styles.quickChipsRow}>
                    <Text style={styles.quickChipsLabel}>Quick Add:</Text>
                    {QUICK_ADD_PILLS.map((qty) => (
                      <TouchableOpacity
                        key={qty}
                        style={[
                          styles.quickQtyChip,
                          inwardQtyStr === String(qty) && styles.quickQtyChipActive,
                        ]}
                        onPress={() => handleInwardQuickAdd(qty)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickQtyText,
                            inwardQtyStr === String(qty) && styles.quickQtyTextActive,
                          ]}
                        >
                          +{qty >= 1000 ? `${qty / 1000}k` : qty}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Total Packet Quantity Summary */}
                <View style={styles.totalPacketBanner}>
                  <View style={styles.totalPacketIconWrap}>
                    <Ionicons name="layers-outline" size={20} color={BrandColors.green.dark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.totalPacketLabel}>Total Factory Inward</Text>
                    <Text style={styles.totalPacketValue}>
                      {isInwardQtyValid ? `${parsedInwardQty.toLocaleString('en-IN')} Packets` : '—'}
                    </Text>
                  </View>
                  <View style={styles.totalPacketHqPill}>
                    <Text style={styles.totalPacketHqPillText}>HQ Reserve</Text>
                  </View>
                </View>
              </Card>

              {/* Action Button: Inward Stock to HQ */}
              <Button
                title={isSubmittingInward ? 'Logging Factory Inward...' : 'Inward Stock to HQ'}
                variant="primary"
                size="lg"
                onPress={handleExecuteInward}
                disabled={!isInwardFormValid || isSubmittingInward}
                loading={isSubmittingInward}
                icon={<Ionicons name="download" size={20} color="#FFFFFF" />}
                style={styles.actionButton}
              />
            </View>
          )}

          {/* ======================================================== */}
          {/* SECTION 3: TRANSACTION HISTORY */}
          {/* ======================================================== */}
          {activeSection === 'HISTORY' && (
            <View>
              {/* Filter Buttons */}
              <View style={styles.historyFilterRow}>
                {(['All', 'Inward', 'Transfer', 'Sales'] as HistoryFilterType[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.historyFilterPill,
                      historyFilter === f && styles.historyFilterPillActive,
                    ]}
                    onPress={() => setHistoryFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.historyFilterText,
                        historyFilter === f && styles.historyFilterTextActive,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error State with Retry */}
              {historyError && (
                <Card style={styles.errorCard}>
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={24} color={Colors.light.error} />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.errorTitle}>Ledger Retrieval Error</Text>
                      <Text style={styles.errorText}>{historyError}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => fetchTransactions(historyFilter, 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              )}

              {/* Loading Skeleton */}
              {historyLoading && (
                <View style={styles.skeletonContainer}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={styles.skeletonCard}>
                      <View style={styles.skeletonHeaderRow}>
                        <View style={styles.skeletonPill} />
                        <View style={styles.skeletonDate} />
                      </View>
                      <View style={styles.skeletonLineLg} />
                      <View style={styles.skeletonLineSm} />
                    </View>
                  ))}
                </View>
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
                      ? 'No stock movements or transactions found in the nationwide ledger.'
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

              {/* Transaction Cards List */}
              {!historyLoading &&
                transactions.map((tx) => {
                  const { dateStr, timeStr } = formatTransactionIST(tx.createdAt);
                  const route = getTransactionRoute(tx);
                  const upperType = String(tx.type || '').toUpperCase();
                  const isTxInward = upperType === 'INWARD' || upperType === 'RECEIPT';
                  const isTxTransfer = upperType === 'TRANSFER' || upperType === 'DISPATCH';
                  const isTxSale = upperType === 'SALE' || upperType === 'SALES';

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

                      {/* Middle: Route & Flow */}
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

                      {/* Product & Quantity Row */}
                      <View style={styles.txProductRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txProductName} numberOfLines={1}>
                            {prodName}
                          </Text>
                          <Text style={styles.txProductSku}>SKU: {prodSku}</Text>
                        </View>
                        <View style={styles.txQuantityPill}>
                          <Text style={styles.txQuantityText}>
                            {Number(tx.quantity).toLocaleString('en-IN')} pkts
                          </Text>
                        </View>
                      </View>

                      {/* Footer Row: Responsible User & Status */}
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
                })}

              {/* Load More Pagination */}
              {!historyLoading && historyPage < historyTotalPages && (
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
          )}
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
  segmentedNavWrapper: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  segmentedNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.lg,
    padding: 3,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  segmentedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
  },
  segmentedButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  segmentedButtonIcon: {
    marginRight: 4,
  },
  segmentedButtonText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  segmentedButtonTextActive: {
    color: BrandColors.green.dark,
    fontWeight: '700',
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
  sectionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardHeaderTitle: {
    ...Typography.title,
    fontSize: 17,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  cardHeaderSub: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  quantitySection: {
    marginBottom: Spacing.xs,
  },
  stockWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: -8,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  stockWarningText: {
    ...Typography.caption,
    fontSize: 11,
    color: BrandColors.pink.dark,
    fontWeight: '600',
    flex: 1,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
    marginBottom: Spacing.md,
  },
  quickChipsLabel: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textTertiary,
    marginRight: 4,
  },
  quickQtyChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickQtyChipActive: {
    backgroundColor: BrandColors.green.surface,
    borderColor: BrandColors.green.border,
  },
  quickQtyText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    fontSize: 12,
  },
  quickQtyTextActive: {
    color: BrandColors.green.dark,
    fontWeight: '700',
  },
  actionButton: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    backgroundColor: BrandColors.green.primary,
  },
  inwardHqContainer: {
    backgroundColor: BrandColors.green.surface,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inwardHqHeader: {
    marginBottom: Spacing.xs,
  },
  inwardHqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  inwardHqBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: BrandColors.green.dark,
    letterSpacing: 0.5,
  },
  inwardHqTitle: {
    ...Typography.subtitle,
    fontSize: 15,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  inwardHqDescription: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  totalPacketBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  totalPacketIconWrap: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.green.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  totalPacketLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontWeight: '600',
  },
  totalPacketValue: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  totalPacketHqPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
  },
  totalPacketHqPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  historyFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  historyFilterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyFilterPillActive: {
    backgroundColor: BrandColors.green.dark,
    borderColor: BrandColors.green.dark,
  },
  historyFilterText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  historyFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorTitle: {
    ...Typography.subtitle,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.error,
  },
  errorText: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.error,
  },
  retryButtonText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skeletonContainer: {
    gap: Spacing.sm,
  },
  skeletonCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  skeletonPill: {
    width: 70,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  skeletonDate: {
    width: 110,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  skeletonLineLg: {
    width: '85%',
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  skeletonLineSm: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  emptyStateCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    ...Typography.title,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  emptyStateText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  txCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  txTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  txTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
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
    backgroundColor: BrandColors.green.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
  },
  txQuantityText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
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
});
