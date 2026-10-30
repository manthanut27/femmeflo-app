import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

type TransferMode = 'TRANSFER' | 'RECEIPT';

export default function StockTransferScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<TransferMode>('TRANSFER');
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [sellers, setSellers] = useState<PublicUser[]>([]);

  // Form Fields
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityStr, setQuantityStr] = useState('100');
  const [reference, setReference] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      adminApi.getWarehouses().catch(() => ({ items: [] })),
      adminApi.listProducts().catch(() => ({ items: [] })),
      adminApi.listSellers({ pageSize: 50 }).catch(() => ({ items: [] })),
    ]).then(([whRes, prodRes, sellRes]) => {
      setWarehouses(whRes.items);
      setProducts(prodRes.items);
      setSellers(sellRes.items);

      if (whRes.items.length > 0) {
        setSourceWarehouseId(whRes.items[0].id);
      }
      if (prodRes.items.length > 0) {
        setSelectedProductId(prodRes.items[0].id);
      }
      if (sellRes.items.length > 0) {
        setTargetLocationId(sellRes.items[0].id);
      }
    });
  }, []);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Stock Movement" subtitle="Inward Receipts & Seller Allocations" showBack />

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

          {/* Source Warehouse */}
          <Text style={styles.sectionHeading}>
            {mode === 'RECEIPT' ? 'Receiving Warehouse' : 'Source Warehouse'}
          </Text>
          <Card style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {warehouses.map((wh) => {
                const isSelected = sourceWarehouseId === wh.id;
                return (
                  <Pressable
                    key={wh.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                    ]}
                    onPress={() => setSourceWarehouseId(wh.id)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {wh.name} ({wh.code})
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          {/* Destination Location (for Transfers) */}
          {mode === 'TRANSFER' ? (
            <>
              <Text style={styles.sectionHeading}>Target Destination (Field Officer / Seller)</Text>
              <Card style={styles.card}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {sellers.map((s) => {
                    const isSelected = targetLocationId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive,
                        ]}
                        onPress={() => setTargetLocationId(s.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                        >
                          {s.name} (Seller)
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Card>
            </>
          ) : null}

          {/* Product SKU Selection */}
          <Text style={styles.sectionHeading}>Product SKU</Text>
          <Card style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {products.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                    ]}
                    onPress={() => setSelectedProductId(p.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          {/* Quantity & Reference */}
          <Text style={styles.sectionHeading}>Movement Quantities & Notes</Text>
          <Card style={styles.card}>
            <Input
              label="Packet Quantity *"
              placeholder="e.g. 100"
              value={quantityStr}
              onChangeText={setQuantityStr}
              keyboardType="number-pad"
              leftIcon={<Ionicons name="cube-outline" size={18} color={Colors.light.textTertiary} />}
            />

            {mode === 'RECEIPT' ? (
              <>
                <Input
                  label="Batch / Lot Number (Optional)"
                  placeholder="e.g. BATCH-2026-OCT-01"
                  value={batchNumber}
                  onChangeText={setBatchNumber}
                  leftIcon={<Ionicons name="pricetag-outline" size={18} color={Colors.light.textTertiary} />}
                />
                <Input
                  label="Inward Remarks"
                  placeholder="Factory delivery note..."
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

          <Button
            title={
              isSubmitting
                ? 'Recording...'
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
    marginBottom: Spacing.lg,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  chipActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  chipText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
