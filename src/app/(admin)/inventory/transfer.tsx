import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { ProductItem, PublicUser, WarehouseItem } from '@/api/types';
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
  Elevation,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

type TransferMode = 'TRANSFER' | 'RECEIPT';

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

  useEffect(() => {
    Promise.all([
      adminApi.getWarehouses().catch(() => ({ items: DEFAULT_WAREHOUSES })),
      adminApi.listProducts().catch(() => ({ items: [] as ProductItem[] })),
      adminApi.listSellers({ pageSize: 100 }).catch(() => ({ items: [] as PublicUser[] })),
      adminApi.getInventorySummary().catch(() => null),
    ]).then(([whRes, prodRes, sellRes, summary]) => {
      const liveWarehouses: WarehouseItem[] = whRes.items && whRes.items.length > 0 ? whRes.items : DEFAULT_WAREHOUSES;
      setWarehouses(liveWarehouses);

      const prodItems = prodRes.items || [];
      setProducts(prodItems);

      const sellItems = sellRes.items || [];
      setSellers(sellItems);

      // Initialize source warehouse
      if (liveWarehouses.length > 0) {
        setSourceWarehouseId((prev) => (prev && liveWarehouses.some((w) => w.id === prev) ? prev : liveWarehouses[0].id));
      }

      // Initialize product
      if (prodItems.length > 0) {
        setSelectedProductId((prev) => (prev && prodItems.some((p) => p.id === prev) ? prev : prodItems[0].id));
      }

      // Initialize destination
      if (sellItems.length > 0) {
        setTargetLocationId((prev) => (prev ? prev : sellItems[0].id));
      } else if (liveWarehouses.length > 1) {
        setTargetLocationId(liveWarehouses[1].id);
      }
    });
  }, []);

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
        subtitle: `Code: ${wh.code || 'WH'} • Stock Balance: ${bal.toLocaleString('en-IN')} pkts`,
        badge: isHq ? 'CENTRAL HQ' : 'REGIONAL',
        badgeVariant: isHq ? 'ACTIVE' : 'neutral',
        metadata: `${wh.state || ''} ${wh.district || ''} ${wh.code || ''}`,
        icon: 'cube',
      };
    });
  }, [warehouses]);

  // Dropdown Options: Destination Targets (Field Officers & Regional Depots)
  const destinationOptions: DropdownOption[] = useMemo(() => {
    const list: DropdownOption[] = [];

    // 1. Field Officers / Sellers
    for (const s of sellers) {
      list.push({
        id: s.id,
        title: `${s.name} (Field Officer)`,
        subtitle: `Seller ID: ${s.id.slice(0, 8)} • Phone: ${s.phone || 'N/A'}`,
        badge: 'FIELD SELLER',
        badgeVariant: 'ACTIVE',
        metadata: `${s.phone || ''} ${s.email || ''}`,
        icon: 'person',
      });
    }

    // 2. Regional Hubs / Other Warehouses
    for (const w of warehouses) {
      if (w.id !== sourceWarehouseId) {
        const bal = typeof (w as any).balance === 'number' ? (w as any).balance : 0;
        list.push({
          id: w.id,
          title: `${w.name} (Regional Hub)`,
          subtitle: `Code: ${w.code || 'WH'} • Balance: ${bal.toLocaleString('en-IN')} pkts`,
          badge: 'DEPOT / HUB',
          badgeVariant: 'neutral',
          metadata: `${w.code || ''} ${w.district || ''}`,
          icon: 'business',
        });
      }
    }

    return list;
  }, [sellers, warehouses, sourceWarehouseId]);

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
        subtitle: `SKU: ${p.sku || p.id.slice(0, 8)} • Base: ₹${basePrice} • Min Floor: ₹${minFloor}`,
        badge: p.sku || 'SKU',
        badgeVariant: 'ACTIVE',
        metadata: `${p.sku || ''} ${p.description || ''}`,
        icon: 'pricetag',
      };
    });
  }, [products]);

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

        // Notify executive and stock views to update
        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'RECEIPT' });

        setFeedback({ type: 'success', message: `Stock Inward Recorded: Received ${qty} packets into warehouse.` });
        Alert.alert('Stock Inward Recorded', `Received ${qty} packets into warehouse.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        setTimeout(() => router.back(), 1500);
      } else {
        if (!sourceWarehouseId || !targetLocationId) {
          setFeedback({ type: 'error', message: 'Please select source warehouse and destination location.' });
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

        // Notify executive and stock views to update
        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { action: 'TRANSFER' });

        setFeedback({ type: 'success', message: `Stock Transfer Dispatched: Transferred ${qty} packets successfully.` });
        Alert.alert('Stock Transfer Dispatched', `Transferred ${qty} packets successfully.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        setTimeout(() => router.back(), 1500);
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
    { key: 'TRANSFER', label: 'Stock Transfer' },
    { key: 'RECEIPT', label: 'Inward Factory Receipt' },
  ];

  const quickQtyOptions = mode === 'RECEIPT' ? [100, 500, 1000, 2500, 5000] : [50, 100, 200, 500, 1000];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Stock Movement Hub"
        subtitle={mode === 'RECEIPT' ? 'Factory Inward & Inventory Reception' : 'Van Stock & Field Seller Transfers'}
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              message={feedback.message}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          )}

          {/* Mode Selector */}
          <View style={styles.modeTabsWrap}>
            <SegmentedTabs
              tabs={modeTabs}
              activeTab={mode}
              activeColor={BrandColors.pink.dark}
              onTabChange={(tab) => setMode(tab as TransferMode)}
            />
          </View>

          {/* Form Card */}
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
                  {mode === 'RECEIPT' ? 'Inward Factory Receipt Form' : 'Inter-Location Stock Transfer'}
                </Text>
                <Text style={styles.cardHeaderSub}>
                  {mode === 'RECEIPT'
                    ? 'Log incoming batches received from manufacturer into central warehouse'
                    : 'Dispatch inventory from central warehouse to field seller vans or regional hubs'}
                </Text>
              </View>
            </View>

            {/* 1. Source / Receiving Warehouse (Searchable Dropdown) */}
            <DropdownTrigger
              label={mode === 'RECEIPT' ? 'Receiving Warehouse' : 'Source Warehouse'}
              required
              value={selectedWarehouse?.name}
              subtitle={
                selectedWarehouse
                  ? `Code: ${selectedWarehouse.code || 'HQ'} • Available Balance: ${((selectedWarehouse as any).balance ?? 0).toLocaleString('en-IN')} pkts`
                  : 'Tap to search & select warehouse'
              }
              badge={selectedWarehouse?.type === 'HQ' ? 'CENTRAL HQ' : 'REGIONAL'}
              icon="cube"
              onPress={() => setWarehousePickerOpen(true)}
            />

            {/* 2. Target Destination (for Transfers, Searchable Dropdown) */}
            {mode === 'TRANSFER' ? (
              <DropdownTrigger
                label="Target Destination (Field Officer / Regional Hub)"
                required
                value={selectedDestination?.title}
                subtitle={selectedDestination?.subtitle || 'Tap to search & select recipient'}
                badge={selectedDestination?.badge}
                icon={selectedDestination?.badge === 'FIELD SELLER' ? 'person' : 'business'}
                onPress={() => setDestinationPickerOpen(true)}
              />
            ) : null}

            {/* 3. Product SKU (Searchable Dropdown) */}
            <DropdownTrigger
              label="Product SKU (Sanitary Napkin Spec)"
              required
              value={selectedProduct?.name}
              subtitle={
                selectedProduct
                  ? `SKU: ${selectedProduct.sku || selectedProduct.id.slice(0, 8)} • Floor: ₹${((selectedProduct.minimumPricePaise ?? 2500) / 100).toFixed(2)}`
                  : 'Tap to search & select SKU'
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
                leftIcon={<Ionicons name="cube-outline" size={18} color={Colors.light.textTertiary} />}
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
                  leftIcon={<Ionicons name="barcode-outline" size={18} color={Colors.light.textTertiary} />}
                />
                <Input
                  label="Inward Remarks / Delivery Note"
                  placeholder="Factory truck dispatch note, driver details..."
                  value={notes}
                  onChangeText={setNotes}
                  leftIcon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.light.textTertiary} />}
                />
              </>
            ) : (
              <Input
                label="Transfer Reference / Waybill (Optional)"
                placeholder="e.g. TRF-2026-881"
                value={reference}
                onChangeText={setReference}
                leftIcon={<Ionicons name="document-text-outline" size={18} color={Colors.light.textTertiary} />}
              />
            )}
          </Card>

          {/* Submit Action Button */}
          <Button
            title={
              isSubmitting
                ? 'Processing Stock Movement...'
                : mode === 'RECEIPT'
                ? 'Confirm Factory Inward Receipt'
                : 'Dispatch Stock Transfer'
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
            style={{ marginTop: Spacing.sm, marginBottom: Spacing.xl }}
          />
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
        title="Select Target Recipient (Seller / Depot)"
        searchPlaceholder="Search officer by name, phone, or regional hub..."
        options={destinationOptions}
        selectedId={targetLocationId}
        onSelect={(opt) => {
          setTargetLocationId(opt.id);
          setDestinationPickerOpen(false);
        }}
        onClose={() => setDestinationPickerOpen(false)}
        emptyMessage="No sellers or depots matching your query"
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
    backgroundColor: Colors.light.background,
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
  modeTabsWrap: {
    marginBottom: Spacing.md,
  },
  formCard: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
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
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardHeaderTitle: {
    ...Typography.title,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  cardHeaderSub: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  quantitySection: {
    marginBottom: Spacing.xs,
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
    backgroundColor: BrandColors.pink.subtle,
    borderColor: BrandColors.pink.border,
  },
  quickQtyText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    fontSize: 12,
  },
  quickQtyTextActive: {
    color: BrandColors.pink.dark,
    fontWeight: '700',
  },
});
