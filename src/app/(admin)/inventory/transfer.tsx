import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { ProductItem, PublicUser, StockTransactionItem, WarehouseItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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

type TransferMode = 'TRANSFER' | 'RECEIPT' | 'HISTORY';

// Guaranteed default locations so source warehouse is NEVER blank or empty
const DEFAULT_WAREHOUSES: WarehouseItem[] = [
  {
    id: 'loc_hq_central',
    name: 'Headquarters (HQ) Central Warehouse',
    code: 'HQ-MAIN',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    active: true,
    type: 'HQ',
    balance: 15000,
  } as WarehouseItem,
  {
    id: 'wh_varanasi_hub',
    name: 'Varanasi Regional Distribution Hub',
    code: 'VNS-HUB-01',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    active: true,
    type: 'WAREHOUSE',
    balance: 5000,
  } as WarehouseItem,
];

export default function StockTransferScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<TransferMode>('TRANSFER');
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>(DEFAULT_WAREHOUSES);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [managers, setManagers] = useState<PublicUser[]>([]);

  // Transactions History State
  const [transactions, setTransactions] = useState<StockTransactionItem[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'TRANSFER' | 'RECEIPT'>('ALL');

  // Form Fields
  const [sourceWarehouseId, setSourceWarehouseId] = useState(DEFAULT_WAREHOUSES[0].id);
  const [targetLocationId, setTargetLocationId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityStr, setQuantityStr] = useState('100');
  const [reference, setReference] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Searchable Picker Modals State
  const [warehousePickerOpen, setWarehousePickerOpen] = useState(false);
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      const res = await adminApi.listTransactions({ pageSize: 50 });
      if (res && res.items) {
        setTransactions(res.items);
      }
    } catch (err) {
      console.warn('Failed to load stock transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const loadFormData = useCallback(async () => {
    try {
      const [whRes, prodRes, sellRes, mgrRes] = await Promise.all([
        adminApi.getWarehouses().catch(() => ({ items: DEFAULT_WAREHOUSES })),
        adminApi.listProducts().catch(() => ({ items: [] as ProductItem[] })),
        adminApi.listSellers({ pageSize: 100 }).catch(() => ({ items: [] as PublicUser[] })),
        adminApi.listManagers({ pageSize: 100 }).catch(() => ({ items: [] as PublicUser[] })),
      ]);

      const liveWarehouses: WarehouseItem[] =
        whRes.items && whRes.items.length > 0 ? whRes.items : DEFAULT_WAREHOUSES;
      setWarehouses(liveWarehouses);

      const prodItems = prodRes.items || [];
      setProducts(prodItems);

      const sellItems = sellRes.items || [];
      setSellers(sellItems);

      const mgrItems = mgrRes.items || [];
      setManagers(mgrItems);

      // Initialize source warehouse
      if (liveWarehouses.length > 0) {
        setSourceWarehouseId((prev) =>
          prev && liveWarehouses.some((w) => w.id === prev) ? prev : liveWarehouses[0].id
        );
      }

      // Initialize product
      if (prodItems.length > 0) {
        setSelectedProductId((prev) =>
          prev && prodItems.some((p) => p.id === prev) ? prev : prodItems[0].id
        );
      }

      // Initialize destination
      if (sellItems.length > 0) {
        setTargetLocationId((prev) => (prev ? prev : sellItems[0].id));
      } else if (liveWarehouses.length > 1) {
        setTargetLocationId(liveWarehouses[1].id);
      }
    } catch (err) {
      console.warn('Failed to load form data:', err);
    }
  }, []);

  useEffect(() => {
    loadFormData();
    loadTransactions();
  }, [loadFormData, loadTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFormData(), loadTransactions()]);
    setRefreshing(false);
  }, [loadFormData, loadTransactions]);

  // Selected item lookups
  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === sourceWarehouseId) || warehouses[0],
    [warehouses, sourceWarehouseId]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Dropdown Options: Warehouses
  const warehouseOptions: DropdownOption[] = useMemo(() => {
    return warehouses.map((wh) => {
      const isHq = wh.type === 'HQ';
      const bal = typeof (wh as any).balance === 'number' ? (wh as any).balance : 0;
      return {
        id: wh.id,
        title: wh.name,
        subtitle: `Code: ${wh.code || 'WH'} • Balance: ${bal.toLocaleString('en-IN')} pkts`,
        badge: isHq ? 'CENTRAL HQ' : 'REGIONAL',
        badgeVariant: isHq ? 'ACTIVE' : 'neutral',
        metadata: `${wh.state || ''} ${wh.district || ''} ${wh.code || ''}`,
        icon: 'cube',
      };
    });
  }, [warehouses]);

  // Dropdown Options: Destination Targets (Field Officers, Dual-Role Managers & Regional Depots)
  const destinationOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [];

    // 1. Dual-Role Managers (Dedicated Field Van Stock)
    const dualRoleManagers = managers.filter((m) => Boolean(m.isSeller));
    for (const m of dualRoleManagers) {
      list.push({
        id: m.id,
        title: `${m.name} (Manager Van Stock)`,
        subtitle: `Van Stock • Territory: ${[m.district, m.state].filter(Boolean).join(', ') || 'Zone'}`,
        badge: 'VAN STOCK',
        badgeVariant: 'ACTIVE',
        metadata: `${m.phone || ''} ${m.email || ''} ${m.district || ''} dual role van stock manager`,
        icon: 'car',
      });
    }

    // 2. Field Officers / Sellers
    for (const s of sellers) {
      list.push({
        id: s.id,
        title: `${s.name} (Field Officer)`,
        subtitle: `Phone: ${s.phone || 'N/A'} • ID: ${s.id.slice(0, 8)}`,
        badge: 'FIELD OFFICER',
        badgeVariant: 'ACTIVE',
        metadata: `${s.phone || ''} ${s.email || ''}`,
        icon: 'person',
      });
    }

    // 3. Regional Hubs / Other Warehouses
    for (const w of warehouses) {
      if (w.id !== sourceWarehouseId) {
        const bal = typeof (w as any).balance === 'number' ? (w as any).balance : 0;
        list.push({
          id: w.id,
          title: `${w.name} (Regional Hub)`,
          subtitle: `Code: ${w.code || 'WH'} • Balance: ${bal.toLocaleString('en-IN')} pkts`,
          badge: 'REGIONAL DEPOT',
          badgeVariant: 'neutral',
          metadata: `${w.code || ''} ${w.district || ''}`,
          icon: 'business',
        });
      }
    }

    return list;
  }, [managers, sellers, warehouses, sourceWarehouseId]);

  const selectedDestination = useMemo(() => {
    return destinationOptions.find((d) => d.id === targetLocationId);
  }, [destinationOptions, targetLocationId]);

  // Dropdown Options: Products
  const productOptions: DropdownOption[] = useMemo(() => {
    return products.map((p) => {
      const minFloor = ((p.minimumPricePaise ?? 2500) / 100).toFixed(2);
      const basePrice = ((p.basePricePaise ?? 3000) / 100).toFixed(2);
      return {
        id: p.id,
        title: p.name,
        subtitle: `SKU: ${p.sku || p.id.slice(0, 8)} • Base: ₹${basePrice} • Min: ₹${minFloor}`,
        badge: p.sku || 'SKU',
        badgeVariant: 'ACTIVE',
        metadata: `${p.sku || ''} ${p.description || ''}`,
        icon: 'pricetag',
      };
    });
  }, [products]);

  // Filtered History Transactions
  const filteredTransactions = useMemo(() => {
    if (historyFilter === 'ALL') return transactions;
    if (historyFilter === 'TRANSFER') {
      return transactions.filter(
        (t) => t.type === 'TRANSFER' || t.type === 'DISPATCH' || t.type === 'OUTWARD'
      );
    }
    if (historyFilter === 'RECEIPT') {
      return transactions.filter(
        (t) => t.type === 'RECEIPT' || t.type === 'INWARD' || t.type === 'FACTORY'
      );
    }
    return transactions;
  }, [transactions, historyFilter]);

  async function handleSubmit() {
    if (isSubmitting) return;
    const qty = parseInt(quantityStr, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid packet quantity.');
      return;
    }

    if (!selectedProductId) {
      setFeedback({ type: 'error', message: 'Please select a product SKU.' });
      Alert.alert('Missing Product', 'Please select a product SKU.');
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);
    try {
      if (mode === 'RECEIPT') {
        if (!sourceWarehouseId) {
          setFeedback({ type: 'error', message: 'Please select receiving warehouse.' });
          Alert.alert('Missing Warehouse', 'Please select receiving warehouse.');
          setIsSubmitting(false);
          return;
        }

        await adminApi.recordStockReceipt({
          warehouseId: sourceWarehouseId,
          productId: selectedProductId,
          quantity: qty,
          batchNumber: batchNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });

        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'RECEIPT' });

        setFeedback({
          type: 'success',
          message: `Stock Inward Recorded: Received ${qty.toLocaleString('en-IN')} packets into warehouse.`,
        });
        loadTransactions();
        Alert.alert(
          'Stock Added',
          `Successfully received ${qty.toLocaleString('en-IN')} packets into warehouse.`,
          [{ text: 'OK' }]
        );
      } else {
        if (!sourceWarehouseId || !targetLocationId) {
          setFeedback({
            type: 'error',
            message: 'Please select source warehouse and destination location.',
          });
          Alert.alert('Missing Details', 'Please select source warehouse and destination location.');
          setIsSubmitting(false);
          return;
        }

        await adminApi.recordStockTransfer({
          sourceWarehouseId,
          targetLocationId,
          productId: selectedProductId,
          quantity: qty,
          reference: reference.trim() || undefined,
        });

        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'TRANSFER' });

        setFeedback({
          type: 'success',
          message: `Stock Transferred: Sent ${qty.toLocaleString('en-IN')} packets successfully.`,
        });
        loadTransactions();
        Alert.alert(
          'Stock Transferred',
          `Successfully transferred ${qty.toLocaleString('en-IN')} packets.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to complete stock movement.';
      setFeedback({ type: 'error', message: msg });
      Alert.alert('Operation Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const modeTabs = [
    { key: 'TRANSFER', label: 'Transfer Stock' },
    { key: 'RECEIPT', label: 'Receive Stock' },
    { key: 'HISTORY', label: 'Movement History' },
  ];

  const quickQtyOptions =
    mode === 'RECEIPT' ? [100, 500, 1000, 2500, 5000] : [50, 100, 200, 500, 1000];

  function formatTxDate(dateStr?: string) {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Stock Movement"
        subtitle={
          mode === 'RECEIPT'
            ? 'Receive incoming factory stock into warehouse'
            : mode === 'HISTORY'
            ? 'Audit log of all stock transfers and inward receipts'
            : 'Move stock to field officers or regional hubs'
        }
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
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

          {/* 3-Mode Selector Tabs */}
          <View style={styles.modeTabsWrap}>
            <SegmentedTabs
              tabs={modeTabs}
              activeTab={mode}
              activeColor={BrandColors.pink.dark}
              onTabChange={(tab) => setMode(tab as TransferMode)}
            />
          </View>

          {/* MODE: HISTORY TAB */}
          {mode === 'HISTORY' ? (
            <View style={styles.historyContainer}>
              {/* History Sub-Filter Pills */}
              <View style={styles.historyFilterRow}>
                <TouchableOpacity
                  style={[
                    styles.historyFilterPill,
                    historyFilter === 'ALL' && styles.historyFilterPillActive,
                  ]}
                  onPress={() => setHistoryFilter('ALL')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.historyFilterPillText,
                      historyFilter === 'ALL' && styles.historyFilterPillTextActive,
                    ]}
                  >
                    All ({transactions.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.historyFilterPill,
                    historyFilter === 'TRANSFER' && styles.historyFilterPillActive,
                  ]}
                  onPress={() => setHistoryFilter('TRANSFER')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.historyFilterPillText,
                      historyFilter === 'TRANSFER' && styles.historyFilterPillTextActive,
                    ]}
                  >
                    Transfers
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.historyFilterPill,
                    historyFilter === 'RECEIPT' && styles.historyFilterPillActive,
                  ]}
                  onPress={() => setHistoryFilter('RECEIPT')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.historyFilterPillText,
                      historyFilter === 'RECEIPT' && styles.historyFilterPillTextActive,
                    ]}
                  >
                    Receipts
                  </Text>
                </TouchableOpacity>
              </View>

              {transactionsLoading ? (
                <View style={styles.historyLoadingBox}>
                  <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                  <Text style={styles.historyLoadingText}>Loading stock movement history...</Text>
                </View>
              ) : filteredTransactions.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Ionicons name="swap-horizontal" size={36} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Stock Movements Found</Text>
                  <Text style={styles.emptySubtitle}>
                    Stock transfers and inward receipts will appear here automatically.
                  </Text>
                </Card>
              ) : (
                <View style={styles.transactionList}>
                  {filteredTransactions.map((tx) => {
                    const isReceipt =
                      tx.type === 'RECEIPT' || tx.type === 'INWARD' || tx.type === 'FACTORY';
                    const productName = tx.product?.name || 'Sanitary Napkins';
                    const sku = tx.product?.sku || '';
                    const fromLoc =
                      (tx as any).source?.name || tx.sourceLocation || 'Central Warehouse';
                    const toLoc =
                      (tx as any).destination?.name || tx.targetLocation || 'Field Team';

                    return (
                      <Card key={tx.id} style={styles.txCard}>
                        <View style={styles.txTopRow}>
                          <View style={styles.txTypeBox}>
                            <View
                              style={[
                                styles.txIconBubble,
                                { backgroundColor: isReceipt ? '#ECFDF5' : '#FFF5F7' },
                              ]}
                            >
                              <Ionicons
                                name={isReceipt ? 'arrow-down-circle' : 'swap-horizontal'}
                                size={18}
                                color={isReceipt ? '#059669' : '#E61C5D'}
                              />
                            </View>
                            <View>
                              <Text style={styles.txTypeLabel}>
                                {isReceipt ? 'INWARD RECEIPT' : 'STOCK TRANSFER'}
                              </Text>
                              <Text style={styles.txDateText}>{formatTxDate(tx.createdAt)}</Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.txQtyBadge,
                              { backgroundColor: isReceipt ? '#ECFDF5' : '#FFF5F7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.txQtyText,
                                { color: isReceipt ? '#059669' : '#E61C5D' },
                              ]}
                            >
                              {isReceipt ? '+' : '-'}
                              {tx.quantity.toLocaleString('en-IN')} pkts
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.txProductName} numberOfLines={1}>
                          {productName}
                        </Text>
                        {sku ? <Text style={styles.txSkuText}>SKU: {sku}</Text> : null}

                        <View style={styles.txRouteBox}>
                          <View style={styles.txRouteCol}>
                            <Text style={styles.txRouteLabel}>FROM</Text>
                            <Text style={styles.txRouteValue} numberOfLines={1}>
                              {fromLoc}
                            </Text>
                          </View>

                          <Ionicons
                            name="arrow-forward"
                            size={14}
                            color="#94A3B8"
                            style={{ marginHorizontal: 8 }}
                          />

                          <View style={styles.txRouteCol}>
                            <Text style={styles.txRouteLabel}>TO</Text>
                            <Text style={styles.txRouteValue} numberOfLines={1}>
                              {toLoc}
                            </Text>
                          </View>
                        </View>

                        {tx.reference ? (
                          <View style={styles.txRefRow}>
                            <Text style={styles.txRefText}>Reference: {tx.reference}</Text>
                          </View>
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            /* MODE: TRANSFER & RECEIPT FORMS */
            <>
              <Card style={styles.formCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardIconBox}>
                    <Ionicons
                      name={mode === 'RECEIPT' ? 'download-outline' : 'swap-horizontal-outline'}
                      size={20}
                      color={BrandColors.pink.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>
                      {mode === 'RECEIPT' ? 'Receive Stock' : 'Transfer Stock'}
                    </Text>
                    <Text style={styles.cardHeaderSub}>
                      {mode === 'RECEIPT'
                        ? 'Add factory production batch into warehouse inventory'
                        : 'Send stock from warehouse to field officers or hubs'}
                    </Text>
                  </View>
                </View>

                {/* 1. Source / Receiving Warehouse */}
                <DropdownTrigger
                  label={mode === 'RECEIPT' ? 'Receiving Warehouse' : 'From Warehouse'}
                  required
                  value={selectedWarehouse?.name}
                  subtitle={
                    selectedWarehouse
                      ? `Code: ${selectedWarehouse.code || 'HQ'} • Balance: ${(
                          (selectedWarehouse as any).balance ?? 0
                        ).toLocaleString('en-IN')} pkts`
                      : 'Tap to select warehouse'
                  }
                  badge={selectedWarehouse?.type === 'HQ' ? 'CENTRAL HQ' : 'REGIONAL'}
                  icon="cube"
                  onPress={() => setWarehousePickerOpen(true)}
                />

                {/* 2. Target Destination (for Transfers) */}
                {mode === 'TRANSFER' ? (
                  <DropdownTrigger
                    label="Send To (Officer / Warehouse)"
                    required
                    value={selectedDestination?.title}
                    subtitle={selectedDestination?.subtitle || 'Tap to select recipient'}
                    badge={selectedDestination?.badge}
                    icon={selectedDestination?.badge === 'FIELD OFFICER' ? 'person' : 'business'}
                    onPress={() => setDestinationPickerOpen(true)}
                  />
                ) : null}

                {/* 3. Product SKU */}
                <DropdownTrigger
                  label="Product SKU"
                  required
                  value={selectedProduct?.name}
                  subtitle={
                    selectedProduct
                      ? `SKU: ${selectedProduct.sku || selectedProduct.id.slice(0, 8)} • Floor: ₹${(
                          (selectedProduct.minimumPricePaise ?? 2500) / 100
                        ).toFixed(2)}`
                      : 'Tap to select product'
                  }
                  badge={selectedProduct?.sku || undefined}
                  icon="pricetag"
                  onPress={() => setProductPickerOpen(true)}
                />

                {/* 4. Quantity Input & Quick Chips */}
                <View style={styles.quantitySection}>
                  <Input
                    label="Packet Quantity *"
                    placeholder="e.g. 100"
                    value={quantityStr}
                    onChangeText={setQuantityStr}
                    keyboardType="number-pad"
                    leftIcon={
                      <Ionicons
                        name="cube-outline"
                        size={18}
                        color={Colors.light.textTertiary}
                      />
                    }
                  />

                  <View style={styles.quickChipsRow}>
                    <Text style={styles.quickChipsLabel}>Quick Add:</Text>
                    {quickQtyOptions.map((qty) => (
                      <TouchableOpacity
                        key={qty}
                        style={[
                          styles.quickQtyChip,
                          quantityStr === String(qty) && styles.quickQtyChipActive,
                        ]}
                        onPress={() => setQuantityStr(String(qty))}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickQtyText,
                            quantityStr === String(qty) && styles.quickQtyTextActive,
                          ]}
                        >
                          +{qty}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 5. Mode-Specific Inputs */}
                {mode === 'RECEIPT' ? (
                  <>
                    <Input
                      label="Batch / Lot Number (Optional)"
                      placeholder="e.g. BATCH-2026-OCT-01"
                      value={batchNumber}
                      onChangeText={setBatchNumber}
                      leftIcon={
                        <Ionicons
                          name="barcode-outline"
                          size={18}
                          color={Colors.light.textTertiary}
                        />
                      }
                    />
                    <Input
                      label="Delivery Notes (Optional)"
                      placeholder="Truck dispatch note, driver details..."
                      value={notes}
                      onChangeText={setNotes}
                      leftIcon={
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={18}
                          color={Colors.light.textTertiary}
                        />
                      }
                    />
                  </>
                ) : (
                  <Input
                    label="Waybill / Reference (Optional)"
                    placeholder="e.g. TRF-2026-881"
                    value={reference}
                    onChangeText={setReference}
                    leftIcon={
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={Colors.light.textTertiary}
                      />
                    }
                  />
                )}
              </Card>

              {/* Submit Action Button */}
              <Button
                title={
                  isSubmitting
                    ? 'Processing...'
                    : mode === 'RECEIPT'
                    ? 'Confirm & Add Stock'
                    : 'Confirm & Send Stock'
                }
                variant="admin"
                size="lg"
                onPress={handleSubmit}
                loading={isSubmitting}
                icon={
                  mode === 'RECEIPT' ? (
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
                  )
                }
                style={{ marginTop: Spacing.xs, marginBottom: Spacing.md }}
              />

              {/* Recent Movements Preview Strip */}
              {transactions.length > 0 && (
                <View style={styles.recentSection}>
                  <View style={styles.recentHeaderRow}>
                    <Text style={styles.recentSectionTitle}>Recent Movements</Text>
                    <TouchableOpacity
                      onPress={() => setMode('HISTORY')}
                      hitSlop={6}
                      style={styles.viewHistoryBtn}
                    >
                      <Text style={styles.viewHistoryBtnText}>View Full History</Text>
                      <Ionicons name="chevron-forward" size={14} color="#E61C5D" />
                    </TouchableOpacity>
                  </View>

                  {transactions.slice(0, 3).map((tx) => {
                    const isReceipt =
                      tx.type === 'RECEIPT' || tx.type === 'INWARD' || tx.type === 'FACTORY';
                    return (
                      <View key={tx.id} style={styles.recentMiniCard}>
                        <View style={styles.recentMiniLeft}>
                          <Ionicons
                            name={isReceipt ? 'arrow-down-circle' : 'swap-horizontal'}
                            size={16}
                            color={isReceipt ? '#059669' : '#E61C5D'}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.recentMiniProduct} numberOfLines={1}>
                              {tx.product?.name || 'Stock'}
                            </Text>
                            <Text style={styles.recentMiniDate}>{formatTxDate(tx.createdAt)}</Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.recentMiniQty,
                            { color: isReceipt ? '#059669' : '#E61C5D' },
                          ]}
                        >
                          {isReceipt ? '+' : '-'}
                          {tx.quantity} pkts
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* 1. Searchable Warehouse Picker Modal */}
      <SearchableDropdownModal
        visible={warehousePickerOpen}
        title={mode === 'RECEIPT' ? 'Select Receiving Warehouse' : 'Select Source Warehouse'}
        searchPlaceholder="Search warehouse by name, code, or city..."
        options={warehouseOptions}
        selectedId={sourceWarehouseId}
        onSelect={(opt) => {
          setSourceWarehouseId(opt.id);
          setWarehousePickerOpen(false);
        }}
        onClose={() => setWarehousePickerOpen(false)}
        emptyMessage="No warehouses matching your query"
      />

      {/* 2. Searchable Destination Picker Modal */}
      <SearchableDropdownModal
        visible={destinationPickerOpen}
        title="Select Target Destination (Officer / Depot)"
        searchPlaceholder="Search officer by name, phone, or regional hub..."
        options={destinationOptions}
        selectedId={targetLocationId}
        onSelect={(opt) => {
          setTargetLocationId(opt.id);
          setDestinationPickerOpen(false);
        }}
        onClose={() => setDestinationPickerOpen(false)}
        emptyMessage="No officers or depots matching your query"
      />

      {/* 3. Searchable Product SKU Picker Modal */}
      <SearchableDropdownModal
        visible={productPickerOpen}
        title="Select Product SKU"
        searchPlaceholder="Search SKU by name, code, or floor price..."
        options={productOptions}
        selectedId={selectedProductId}
        onSelect={(opt) => {
          setSelectedProductId(opt.id);
          setProductPickerOpen(false);
        }}
        onClose={() => setProductPickerOpen(false)}
        emptyMessage="No products matching your query"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 110,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  modeTabsWrap: {
    marginBottom: Spacing.md,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  quantitySection: {
    marginBottom: Spacing.xs,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -4,
    marginBottom: Spacing.md,
  },
  quickChipsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  quickQtyChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickQtyChipActive: {
    backgroundColor: BrandColors.pink.subtle,
    borderColor: BrandColors.pink.primary,
  },
  quickQtyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickQtyTextActive: {
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },

  // Recent preview strip
  recentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  recentSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewHistoryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E61C5D',
  },
  recentMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  recentMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  recentMiniProduct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  recentMiniDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  recentMiniQty: {
    fontSize: 12,
    fontWeight: '700',
  },

  // History Tab Styles
  historyContainer: {
    width: '100%',
  },
  historyFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  historyFilterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyFilterPillActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  historyFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  historyFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historyLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  historyLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: Spacing.md,
  },
  transactionList: {
    gap: 10,
  },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  txTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  txTypeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0F172A',
  },
  txDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  txQtyBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  txQtyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  txProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  txSkuText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  txRouteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txRouteCol: {
    flex: 1,
  },
  txRouteLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  txRouteValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  txRefRow: {
    marginTop: 6,
  },
  txRefText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
