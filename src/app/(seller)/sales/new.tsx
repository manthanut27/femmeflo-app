import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaymentMode, ProductItem, ProductStockItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  draftStorage,
  generateIdempotencyKey,
  computePayloadHash,
  shouldRotateIdempotencyKey,
} from '@/utils/draftStorage';

export default function NewSaleScreen() {
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  // Data states
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Form states & Persistent Draft
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId || '');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityStr, setQuantityStr] = useState('10');
  const [unitPriceRupees, setUnitPriceRupees] = useState('35');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [boundPayloadHash, setBoundPayloadHash] = useState<string>('');
  const [wasSubmitted, setWasSubmitted] = useState<boolean>(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  useEffect(() => {
    async function initScreen() {
      try {
        const [custRes, prodRes, invRes, savedDraft] = await Promise.all([
          sellerApi.listCustomers({ pageSize: 50 }).catch(() => ({ items: [] })),
          sellerApi.listProducts().catch(() => ({ items: [] })),
          sellerApi.getInventory().catch(() => ({ balance: 0, products: [] })),
          draftStorage.getOrderDraft(userId).catch(() => null),
        ]);

        setCustomers(custRes.items);
        setProducts(prodRes.items);

        // Map stock by product ID
        const map: Record<string, number> = {};
        if (invRes.products) {
          invRes.products.forEach((p: ProductStockItem) => {
            map[p.productId] = p.balance;
          });
        }
        setStockMap(map);

        if (savedDraft) {
          setIdempotencyKey(savedDraft.idempotencyKey);
          setBoundPayloadHash(savedDraft.payloadHash || '');
          setWasSubmitted(Boolean(savedDraft.submitted));
          if (params.customerId) {
            setSelectedCustomerId(params.customerId);
          } else if (savedDraft.customerId) {
            setSelectedCustomerId(savedDraft.customerId);
          }
          if (savedDraft.items && savedDraft.items.length > 0) {
            const first = savedDraft.items[0];
            setSelectedProductId(first.productId);
            setQuantityStr(String(first.quantity || 10));
            setUnitPriceRupees(String((first.unitPricePaise || 3500) / 100));
          }
          if (savedDraft.paymentMode) setPaymentMode(savedDraft.paymentMode);
          if (savedDraft.paymentReference) setPaymentReference(savedDraft.paymentReference);
          setIsDraftRestored(true);
        } else {
          if (prodRes.items.length > 0) {
            const first = prodRes.items[0];
            setSelectedProductId(first.id);
            setUnitPriceRupees(String((first.basePricePaise || 3500) / 100));
          }
          if (params.customerId) {
            setSelectedCustomerId(params.customerId);
          } else if (custRes.items.length > 0) {
            setSelectedCustomerId(custRes.items[0].id);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    initScreen();
  }, [params.customerId, userId]);

  // Autosave draft on any field change and rotate idempotency key if modified after submit attempt
  useEffect(() => {
    if (loading || !idempotencyKey) return;
    const qty = parseInt(quantityStr, 10) || 0;
    const pricePaise = Math.round((parseFloat(unitPriceRupees) || 0) * 100);

    const items = selectedProductId
      ? [
          {
            productId: selectedProductId,
            productName: products.find((p) => p.id === selectedProductId)?.name || 'Product',
            quantity: qty,
            unitPricePaise: pricePaise,
          },
        ]
      : [];

    const currentHash = computePayloadHash({
      customerId: selectedCustomerId,
      items,
      paymentMode,
    });

    let activeKey = idempotencyKey;
    let submittedFlag = wasSubmitted;

    // Rotate idempotency key if draft changes after a submit attempt
    if (shouldRotateIdempotencyKey(currentHash, boundPayloadHash, wasSubmitted)) {
      activeKey = generateIdempotencyKey();
      setIdempotencyKey(activeKey);
      setBoundPayloadHash(currentHash);
      setWasSubmitted(false);
      submittedFlag = false;
    } else if (!boundPayloadHash) {
      setBoundPayloadHash(currentHash);
    }

    draftStorage.saveOrderDraft(userId, {
      idempotencyKey: activeKey,
      payloadHash: currentHash,
      submitted: submittedFlag,
      customerId: selectedCustomerId,
      items,
      paymentMode,
      paymentReference,
      updatedAt: new Date().toISOString(),
    });
  }, [
    idempotencyKey,
    selectedCustomerId,
    selectedProductId,
    quantityStr,
    unitPriceRupees,
    paymentMode,
    paymentReference,
    loading,
    products,
    userId,
    wasSubmitted,
    boundPayloadHash,
  ]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = selectedProductId ? stockMap[selectedProductId] ?? 0 : 0;
  const quantity = parseInt(quantityStr, 10) || 0;
  const unitPrice = parseFloat(unitPriceRupees) || 0;
  const unitPricePaise = Math.round(unitPrice * 100);
  const minimumPricePaise = selectedProduct?.minimumPricePaise ?? 2500;
  const isBelowMinimum = unitPricePaise < minimumPricePaise;
  const totalAmountRupees = (quantity * unitPrice).toFixed(2);

  function handleProductSelect(prod: ProductItem) {
    setSelectedProductId(prod.id);
    setUnitPriceRupees(String((prod.basePricePaise || 3500) / 100));
  }

  function handleIncrementQuantity() {
    const current = parseInt(quantityStr, 10) || 0;
    setQuantityStr(String(current + 5));
  }

  function handleDecrementQuantity() {
    const current = parseInt(quantityStr, 10) || 0;
    if (current > 5) {
      setQuantityStr(String(current - 5));
    } else if (current > 1) {
      setQuantityStr(String(current - 1));
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!selectedCustomerId) errs.customer = 'Please select a customer.';
    if (!selectedProductId) errs.product = 'Please select a product SKU.';
    if (quantity <= 0) errs.quantity = 'Quantity must be at least 1 packet.';
    if (unitPrice <= 0) errs.price = 'Unit price must be greater than zero.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleConfirmSale() {
    if (isSubmitting) return;
    if (!validate()) return;

    if (quantity > currentStock) {
      setFeedback({
        type: 'error',
        title: 'Insufficient Van Stock',
        message: `You have ${currentStock} packets in your inventory, but requested ${quantity}. Please adjust quantity.`,
      });
      Alert.alert(
        'Insufficient Van Stock',
        `You have ${currentStock} packets in your inventory, but requested ${quantity}. Please adjust quantity.`
      );
      return;
    }

    setIsSubmitting(true);
    setWasSubmitted(true);
    setFeedback(null);
    try {
      const res = await sellerApi.createSale({
        customerId: selectedCustomerId,
        paymentMode,
        paymentReference: paymentReference.trim() || undefined,
        idempotencyKey,
        items: [
          {
            productId: selectedProductId,
            quantity,
            unitPricePaise,
          },
        ],
      });

      // Clear draft upon successful order submission
      await draftStorage.clearOrderDraft(userId);

      const sale = res.sale;
      const isPending = sale.status === 'PENDING';

      setFeedback({
        type: isPending ? 'warning' : 'success',
        title: isPending ? 'Order Sent for Super Admin Approval' : 'Sale Confirmed & Stock Deducted!',
        message: isPending
          ? `Order #${sale.id.slice(0, 8)} is priced below minimum (₹${minimumPricePaise / 100}) and has been sent to Super Admin for approval.`
          : `Order #${sale.id.slice(0, 8)} for ₹${(sale.totalAmountPaise / 100).toFixed(2)} confirmed successfully.`,
        actionLabel: 'View Order Details',
        onAction: () => router.replace(`/(seller)/sales/${sale.id}` as any),
      });

      Alert.alert(
        isPending ? 'Sale Submitted for Approval' : 'Sale Confirmed!',
        isPending
          ? `Order #${sale.id.slice(0, 8)} is priced below minimum (₹${minimumPricePaise / 100}) and has been sent to Super Admin for approval. Stock has not been deducted.`
          : `Order #${sale.id.slice(0, 8)} for ₹${(sale.totalAmountPaise / 100).toFixed(2)} confirmed. Stock deducted.`,
        [
          {
            text: 'View Order',
            onPress: () => router.replace(`/(seller)/sales/${sale.id}` as any),
          },
        ]
      );
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Sale Creation Failed',
        message: err.message || 'Unable to record sale. Please try again.',
      });
      Alert.alert('Sale Creation Failed', err.message || 'Unable to record sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDiscardDraft() {
    Alert.alert('Discard Draft', 'Are you sure you want to reset this order draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await draftStorage.clearOrderDraft(userId);
          setIdempotencyKey(generateIdempotencyKey());
          setWasSubmitted(false);
          setBoundPayloadHash('');
          setSelectedCustomerId(params.customerId || (customers.length > 0 ? customers[0].id : ''));
          setPaymentMode('CASH');
          setPaymentReference('');
          setQuantityStr('10');
          setIsDraftRestored(false);
          if (products.length > 0) {
            setSelectedProductId(products[0].id);
            setUnitPriceRupees(String((products[0].basePricePaise || 3500) / 100));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header title="Point of Sale (POS)" subtitle="Direct Van Distribution Order" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {feedback ? (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              actionLabel={feedback.actionLabel}
              onAction={feedback.onAction}
              onDismiss={() => setFeedback(null)}
              style={{ marginBottom: Spacing.md }}
            />
          ) : null}

          {/* Draft Autosave & Idempotency Key Status */}
          <View style={styles.draftBadgeRow}>
            <View style={styles.draftBadge}>
              <Ionicons name="cloud-done-outline" size={14} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
              <Text style={styles.draftBadgeText}>
                {isDraftRestored ? 'Draft restored' : 'Draft autosaved'} • #{idempotencyKey.slice(0, 14)}
              </Text>
            </View>
            <Pressable
              onPress={handleDiscardDraft}
              style={styles.discardDraftBtn}
              accessibilityRole="button"
              accessibilityLabel="Reset order draft"
            >
              <Text style={styles.discardDraftText}>Reset</Text>
            </Pressable>
          </View>

          {/* Customer Selector */}
          <Text style={styles.sectionHeading}>1. Retail Store</Text>
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Select Retail Store *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {customers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Select ${c.shopName}`}
                    style={[
                      styles.customerChip,
                      isSelected && styles.customerChipActive,
                    ]}
                    onPress={() => setSelectedCustomerId(c.id)}
                  >
                    <View style={styles.customerChipRow}>
                      <Text
                        style={[
                          styles.customerChipText,
                          isSelected && styles.customerChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {c.shopName}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.customerChipSub,
                        isSelected && styles.customerChipSubActive,
                      ]}
                    >
                      {c.ownerName}
                    </Text>
                    {(c as any).tier || (c as any).creditTerms ? (
                      <View style={[styles.tierPill, isSelected && styles.tierPillActive]}>
                        <Text style={[styles.tierPillText, isSelected && styles.tierPillTextActive]}>
                          {[(c as any).tier, (c as any).creditTerms].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {errors.customer ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#B4234D" style={{ marginRight: 4 }} />
                <Text style={styles.errorText}>{errors.customer}</Text>
              </View>
            ) : null}
          </Card>

          {/* Product SKU Selector */}
          <Text style={styles.sectionHeading}>2. Product & Van Stock</Text>
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Select Product SKU *</Text>
            <View style={styles.productGrid}>
              {products.map((p) => {
                const stock = stockMap[p.id] ?? 0;
                const isSelected = selectedProductId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Product ${p.name}, ${stock} packets available`}
                    style={[styles.productCard, isSelected && styles.productCardActive]}
                    onPress={() => handleProductSelect(p)}
                  >
                    <View style={styles.productCardHeader}>
                      <Text style={[styles.productName, isSelected && styles.productNameActive]}>
                        {p.name}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color={BrandColors.pink.primary} />
                      ) : null}
                    </View>
                    <Text style={styles.skuText}>SKU: {p.sku || 'STD-PKT'}</Text>
                    <View style={[styles.stockBadge, stock === 0 && styles.stockBadgeEmpty]}>
                      <Text style={[styles.stockText, stock === 0 && styles.stockTextEmpty]}>
                        Stock: {stock} pkts
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {errors.product ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#B4234D" style={{ marginRight: 4 }} />
                <Text style={styles.errorText}>{errors.product}</Text>
              </View>
            ) : null}

            {/* Quantity & Unit Price inputs */}
            <View style={styles.qtyPriceRow}>
              <View style={styles.qtyCol}>
                <Input
                  label="Packets Quantity *"
                  placeholder="e.g. 10"
                  value={quantityStr}
                  onChangeText={setQuantityStr}
                  keyboardType="number-pad"
                  error={errors.quantity}
                  leftIcon={<Ionicons name="cube-outline" size={18} color="#94A3B8" />}
                />
                <View style={styles.stepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease quantity by 5"
                    style={styles.stepperBtn}
                    onPress={handleDecrementQuantity}
                  >
                    <Ionicons name="remove" size={16} color={BrandColors.pink.primary} />
                  </Pressable>
                  <Text style={styles.stepperHint}>±5 Quick Step</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase quantity by 5"
                    style={styles.stepperBtn}
                    onPress={handleIncrementQuantity}
                  >
                    <Ionicons name="add" size={16} color={BrandColors.pink.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.priceCol}>
                <Input
                  label="Unit Price (₹) *"
                  placeholder="e.g. 35"
                  value={unitPriceRupees}
                  onChangeText={setUnitPriceRupees}
                  keyboardType="decimal-pad"
                  error={errors.price}
                  leftIcon={<Text style={styles.rupeeSymbol}>₹</Text>}
                />
              </View>
            </View>

            {/* Minimum Price Amber Warning */}
            {isBelowMinimum ? (
              <View style={styles.warningBanner} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={20} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Special Price Approval Required</Text>
                  <Text style={styles.warningDesc}>
                    Entered price (₹{unitPrice}) is below the minimum floor threshold of ₹
                    {(minimumPricePaise / 100).toFixed(2)}. This sale will be submitted as PENDING to Super Admin.
                    No stock will be deducted until confirmed.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.priceNormalNotice}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.priceNormalText}>
                  Standard price (≥ ₹{(minimumPricePaise / 100).toFixed(2)}). Immediate stock deduction.
                </Text>
              </View>
            )}
          </Card>

          {/* Payment Mode Selector */}
          <Text style={styles.sectionHeading}>3. Payment Collection Mode</Text>
          <Card style={styles.card}>
            <SegmentedTabs
              tabs={[
                { label: 'CASH', value: 'CASH', icon: 'cash-outline' },
                { label: 'BANK / UPI', value: 'BANK', icon: 'card-outline' },
                { label: 'PAY LATER', value: 'PENDING', icon: 'time-outline' },
              ]}
              selectedTab={paymentMode}
              onSelect={(val) => val && setPaymentMode(val as PaymentMode)}
              activeColor={BrandColors.pink.primary}
              accessibilityLabel="Select payment mode"
            />

            {paymentMode === 'BANK' ? (
              <Input
                label="Transaction Reference / UPI ID"
                placeholder="e.g. UPI/1234567890"
                value={paymentReference}
                onChangeText={setPaymentReference}
                containerStyle={{ marginTop: Spacing.md }}
                leftIcon={<Ionicons name="barcode-outline" size={18} color="#94A3B8" />}
              />
            ) : null}

            {paymentMode === 'PENDING' ? (
              <View style={styles.pendingNoticeBox}>
                <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.pendingNotice}>
                  Outstanding payment can be collected and marked received later from the sale details.
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Order Summary & Submit Button */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Order Invoice Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Units</Text>
              <Text style={styles.summaryValue}>{quantity} Packets</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Unit Rate</Text>
              <Text style={styles.summaryValue}>₹{unitPrice.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.totalLabel}>Total Payable</Text>
              <Text style={styles.totalAmount}>₹{totalAmountRupees}</Text>
            </View>

            <Button
              title={
                isSubmitting
                  ? 'Processing Sale...'
                  : isBelowMinimum
                  ? 'Submit for Super Admin Approval'
                  : 'Confirm & Record Sale'
              }
              onPress={handleConfirmSale}
              loading={isSubmitting}
              variant={isBelowMinimum ? 'secondary' : 'primary'}
              size="lg"
              icon={
                isBelowMinimum ? (
                  <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />
                )
              }
              style={{ marginTop: Spacing.lg }}
            />
          </Card>
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
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  draftBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.light,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  draftBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  discardDraftBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.xs,
  },
  discardDraftText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.danger,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  customerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.md,
    marginRight: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    minWidth: 140,
    minHeight: 48,
    justifyContent: 'center',
  },
  customerChipActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  customerChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerChipText: {
    ...Typography.bodyMedium,
    color: Colors.light.text,
    flex: 1,
  },
  customerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customerChipSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  customerChipSubActive: {
    color: '#FFF5F7',
  },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF7F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginTop: 4,
  },
  tierPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tierPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#156035',
  },
  tierPillTextActive: {
    color: '#FFFFFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surfaceMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    marginTop: 4,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.xs,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  stepperHint: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  productCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  productCardActive: {
    borderColor: BrandColors.pink.primary,
    backgroundColor: BrandColors.pink.surface,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    flex: 1,
  },
  productNameActive: {
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
  skuText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginVertical: 2,
  },
  stockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.light.successBorder,
  },
  stockBadgeEmpty: {
    backgroundColor: Colors.light.dangerBg,
    borderColor: Colors.light.dangerBorder,
  },
  stockText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.success,
  },
  stockTextEmpty: {
    color: Colors.light.danger,
  },
  qtyPriceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  qtyCol: {
    flex: 1,
    minWidth: 140,
  },
  priceCol: {
    flex: 1,
    minWidth: 140,
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.warningBg,
    borderWidth: 1.5,
    borderColor: Colors.light.warningBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  warningTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.warning,
    marginBottom: 2,
  },
  warningDesc: {
    ...Typography.caption,
    color: Colors.light.warning,
    lineHeight: 16,
  },
  priceNormalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.successBg,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.successBorder,
  },
  priceNormalText: {
    ...Typography.caption,
    color: Colors.light.success,
    fontWeight: '600',
  },
  pendingNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    backgroundColor: Colors.light.surfaceMuted,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  pendingNotice: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  summaryCard: {
    backgroundColor: Colors.light.surface,
    marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  summaryCardTitle: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    ...Typography.bodyMedium,
    color: Colors.light.text,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
    alignItems: 'center',
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  totalAmount: {
    ...Typography.display,
    fontSize: 24,
    color: BrandColors.pink.primary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.danger,
    fontWeight: '600',
  },
});
