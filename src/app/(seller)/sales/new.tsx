import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaymentMode, ProductItem, ProductStockItem } from '@/api/types';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
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
  computePayloadHash,
  draftStorage,
  generateIdempotencyKey,
  shouldRotateIdempotencyKey,
  type OrderDraftLineItem,
} from '@/utils/draftStorage';

interface CartLineItem {
  key: string;
  productId: string;
  quantity: number;
  unitPriceRupees: number;
}

export default function NewSaleScreen() {
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  // Catalog & Inventory Data
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(params.customerId || '');
  const [cartItems, setCartItems] = useState<CartLineItem[]>([
    { key: 'line_1', productId: '', quantity: 10, unitPriceRupees: 35 },
  ]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');

  // Offline Draft & Idempotency
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [boundPayloadHash, setBoundPayloadHash] = useState<string>('');
  const [wasSubmitted, setWasSubmitted] = useState<boolean>(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // ----------------------------------------------------
  // Initialize Data & Restore Draft
  // ----------------------------------------------------
  useEffect(() => {
    async function initScreen() {
      try {
        const [custRes, prodRes, invRes, savedDraft] = await Promise.all([
          sellerApi.listCustomers({ pageSize: 100 }).catch(() => ({ items: [] })),
          sellerApi.listProducts().catch(() => ({ items: [] })),
          sellerApi.getInventory().catch(() => ({ balance: 0, products: [] })),
          draftStorage.getOrderDraft(userId).catch(() => null),
        ]);

        const loadedCustomers = custRes.items || [];
        const loadedProducts = prodRes.items || [];
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);

        // Build stock map
        const map: Record<string, number> = {};
        if (invRes.products) {
          invRes.products.forEach((p: ProductStockItem) => {
            map[p.productId] = p.balance;
          });
        }
        setStockMap(map);

        // Restore draft if available
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
            setCartItems(
              savedDraft.items.map((item, idx) => ({
                key: `line_${idx + 1}_${Date.now()}`,
                productId: item.productId,
                quantity: item.quantity,
                unitPriceRupees: (item.unitPricePaise || 3500) / 100,
              }))
            );
          } else if (loadedProducts.length > 0) {
            setCartItems([
              {
                key: `line_init_${Date.now()}`,
                productId: loadedProducts[0].id,
                quantity: 10,
                unitPriceRupees: (loadedProducts[0].basePricePaise || 3500) / 100,
              },
            ]);
          }

          if (savedDraft.paymentMode) setPaymentMode(savedDraft.paymentMode);
          if (savedDraft.paymentReference) setPaymentReference(savedDraft.paymentReference);
          if (savedDraft.customerFeedback) setCustomerFeedback(savedDraft.customerFeedback);
          setIsDraftRestored(true);
        } else {
          // Initialize defaults
          if (loadedProducts.length > 0) {
            setCartItems([
              {
                key: `line_init_${Date.now()}`,
                productId: loadedProducts[0].id,
                quantity: 10,
                unitPriceRupees: (loadedProducts[0].basePricePaise || 3500) / 100,
              },
            ]);
          }
          if (params.customerId) {
            setSelectedCustomerId(params.customerId);
          } else if (loadedCustomers.length > 0) {
            setSelectedCustomerId(loadedCustomers[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to initialize POS screen', err);
      } finally {
        setLoading(false);
      }
    }

    initScreen();
  }, [params.customerId, userId]);

  // ----------------------------------------------------
  // Autosave Draft & Rotate Idempotency Key on Edit
  // ----------------------------------------------------
  useEffect(() => {
    if (loading || !idempotencyKey) return;

    const draftItems: OrderDraftLineItem[] = cartItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod?.name || 'Product',
        sku: prod?.sku || undefined,
        quantity: item.quantity,
        unitPricePaise: Math.round(item.unitPriceRupees * 100),
        minPricePaise: prod?.minimumPricePaise,
      };
    });

    const currentHash = computePayloadHash({
      customerId: selectedCustomerId,
      items: draftItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
      })),
      paymentMode,
      paymentReference,
      customerFeedback,
    });

    let activeKey = idempotencyKey;
    let submittedFlag = wasSubmitted;

    // Rotate idempotency key if payload changes after a submit attempt
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
      items: draftItems,
      paymentMode,
      paymentReference,
      customerFeedback,
      updatedAt: new Date().toISOString(),
    });
  }, [
    loading,
    idempotencyKey,
    selectedCustomerId,
    cartItems,
    paymentMode,
    paymentReference,
    customerFeedback,
    products,
    userId,
    wasSubmitted,
    boundPayloadHash,
  ]);

  // ----------------------------------------------------
  // Computed Order Totals & Validation Checks
  // ----------------------------------------------------
  const grandTotalRupees = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity * item.unitPriceRupees, 0);
  }, [cartItems]);

  const totalPackets = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Check if any product is priced below minimum threshold
  const hasLowPriceWarning = useMemo(() => {
    return cartItems.some((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return false;
      const minPaise = prod.minimumPricePaise ?? 2500;
      return Math.round(item.unitPriceRupees * 100) < minPaise;
    });
  }, [cartItems, products]);

  // Stock check errors per product
  const stockErrors = useMemo(() => {
    const productRequestedMap: Record<string, number> = {};
    for (const item of cartItems) {
      if (item.productId) {
        productRequestedMap[item.productId] =
          (productRequestedMap[item.productId] || 0) + item.quantity;
      }
    }

    const errorsMap: Record<string, string> = {};
    for (const [prodId, reqQty] of Object.entries(productRequestedMap)) {
      const avail = stockMap[prodId] ?? 0;
      if (reqQty > avail) {
        const prod = products.find((p) => p.id === prodId);
        errorsMap[prodId] = `Van stock has ${avail} pkts, but ${reqQty} pkts in cart.`;
      }
    }
    return errorsMap;
  }, [cartItems, stockMap, products]);

  const hasStockError = Object.keys(stockErrors).length > 0;

  // ----------------------------------------------------
  // Cart Actions
  // ----------------------------------------------------
  const handleAddLineItem = () => {
    // Find first product not yet in cart, or first product
    const unusedProduct =
      products.find((p) => !cartItems.some((item) => item.productId === p.id)) || products[0];

    setCartItems((prev) => [
      ...prev,
      {
        key: `line_${Date.now()}_${prev.length + 1}`,
        productId: unusedProduct?.id || '',
        quantity: 5,
        unitPriceRupees: (unusedProduct?.basePricePaise || 3500) / 100,
      },
    ]);
  };

  const handleRemoveLineItem = (key: string) => {
    if (cartItems.length <= 1) {
      Alert.alert('Cart Limit', 'A sale must have at least one product.');
      return;
    }
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleUpdateProduct = (key: string, newProductId: string) => {
    const prod = products.find((p) => p.id === newProductId);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        return {
          ...item,
          productId: newProductId,
          unitPriceRupees: prod ? (prod.basePricePaise || 3500) / 100 : item.unitPriceRupees,
        };
      })
    );
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      })
    );
  };

  const handleSetQuantity = (key: string, val: string) => {
    const parsed = parseInt(val, 10);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        return { ...item, quantity: isNaN(parsed) || parsed < 1 ? 1 : parsed };
      })
    );
  };

  const handleSetUnitPrice = (key: string, val: string) => {
    const parsed = parseFloat(val);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        return { ...item, unitPriceRupees: isNaN(parsed) || parsed < 0 ? 0 : parsed };
      })
    );
  };

  // ----------------------------------------------------
  // Validation & Submission
  // ----------------------------------------------------
  function validate() {
    const errs: Record<string, string> = {};
    if (!selectedCustomerId) errs.customer = 'Please select a customer.';

    const validLines = cartItems.filter((i) => i.productId && i.quantity > 0);
    if (validLines.length === 0) {
      errs.cart = 'Please add at least one product with quantity.';
    }

    cartItems.forEach((item, idx) => {
      if (!item.productId) {
        errs[`line_${idx}_product`] = 'Product selection is required.';
      }
      if (item.quantity <= 0) {
        errs[`line_${idx}_qty`] = 'Quantity must be > 0.';
      }
      if (item.unitPriceRupees <= 0) {
        errs[`line_${idx}_price`] = 'Price must be > 0.';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleConfirmSale() {
    if (isSubmitting) return;
    if (!validate()) {
      Alert.alert('Incomplete Sale', 'Please review highlighted fields in your cart.');
      return;
    }

    if (hasStockError) {
      Alert.alert(
        'Insufficient Van Stock',
        'One or more products in your cart exceed available van inventory. Please adjust quantities before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    setWasSubmitted(true);
    setFeedback(null);

    try {
      const payloadItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPricePaise: Math.round(item.unitPriceRupees * 100),
      }));

      const res = await sellerApi.createSale({
        customerId: selectedCustomerId,
        items: payloadItems,
        paymentMode,
        paymentReference: paymentMode === 'BANK' ? paymentReference.trim() : undefined,
        requestKey: idempotencyKey,
        customerFeedback: customerFeedback.trim() || undefined,
      });

      // Clear draft on successful confirmation
      await draftStorage.clearOrderDraft(userId).catch(() => {});

      const isPendingApproval = res.sale.status === 'PENDING_APPROVAL';

      Alert.alert(
        isPendingApproval ? 'Sale Submitted for Approval' : 'Sale Confirmed!',
        isPendingApproval
          ? `Order #${res.sale.saleNumber || ''} created with below-minimum price. It has been routed to the Super Admin queue for authorization.`
          : `Order #${res.sale.saleNumber || ''} recorded successfully. Total: ₹${grandTotalRupees.toFixed(2)} (${totalPackets} pkts).`,
        [
          {
            text: 'View Sales Stream',
            onPress: () => router.replace('/(seller)/sales' as any),
          },
        ]
      );
    } catch (err: any) {
      const msg = err.message || 'Failed to submit sale. Please retry.';
      setFeedback({
        type: 'error',
        title: 'Submission Error',
        message: msg,
      });
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
        <Text style={styles.loadingText}>Loading POS Cart & Van Inventory...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <Header
        title="Point of Sale (POS)"
        subtitle="Multi-SKU Cart • In-Field Delivery"
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              actionLabel={feedback.actionLabel}
              onAction={feedback.onAction}
            />
          )}

          {isDraftRestored && (
            <View style={styles.draftRestoredNotice}>
              <Ionicons name="cloud-done-outline" size={16} color={BrandColors.green.dark} />
              <Text style={styles.draftRestoredText}>
                Restored unfinished order draft from device storage.
              </Text>
            </View>
          )}

          {/* CUSTOMER SELECTION CARD */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Select Retail Customer</Text>
            <Text style={styles.sectionSubtitle}>
              Customer must be assigned to your field route.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {customers.map((c) => {
                const isSelected = c.id === selectedCustomerId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedCustomerId(c.id)}
                    style={[styles.customerChip, isSelected && styles.customerChipActive]}
                    hitSlop={HitSlop.sm}
                  >
                    <Ionicons
                      name="storefront-outline"
                      size={14}
                      color={isSelected ? '#FFFFFF' : Colors.light.textSecondary}
                    />
                    <Text
                      style={[
                        styles.customerChipText,
                        isSelected && styles.customerChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {c.shopName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedCustomer && (
              <View style={styles.selectedCustomerDetail}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{selectedCustomer.shopName}</Text>
                  <Text style={styles.customerSub}>
                    Owner: {selectedCustomer.ownerName || (selectedCustomer as any).contactName || '—'} •{' '}
                    {selectedCustomer.district}
                  </Text>
                </View>
                <Badge label="ASSIGNED" variant="ACTIVE" />
              </View>
            )}
            {errors.customer && <Text style={styles.errorText}>{errors.customer}</Text>}
          </Card>

          {/* MULTI-SKU CART CARD */}
          <Card style={styles.sectionCard}>
            <View style={styles.cartHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>2. Multi-SKU Cart</Text>
                <Text style={styles.sectionSubtitle}>Add products and adjust quantities.</Text>
              </View>
              <Button
                title="+ Add SKU"
                variant="outline"
                size="sm"
                onPress={handleAddLineItem}
              />
            </View>

            {cartItems.map((item, index) => {
              const prod = products.find((p) => p.id === item.productId);
              const availStock = item.productId ? stockMap[item.productId] ?? 0 : 0;
              const minPricePaise = prod?.minimumPricePaise ?? 2500;
              const isBelowFloor = Math.round(item.unitPriceRupees * 100) < minPricePaise;
              const lineTotal = (item.quantity * item.unitPriceRupees).toFixed(2);
              const isExceedingStock = item.quantity > availStock;

              return (
                <View key={item.key} style={styles.lineItemBox}>
                  {/* Line Item Header: Product Picker & Delete */}
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.itemNumberBadge}>Item #{index + 1}</Text>
                    {cartItems.length > 1 && (
                      <Pressable
                        onPress={() => handleRemoveLineItem(item.key)}
                        hitSlop={HitSlop.md}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.light.danger} />
                        <Text style={styles.deleteText}>Remove</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* SKU Selector Chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.skuScroll}
                  >
                    {products.map((p) => {
                      const isSelected = p.id === item.productId;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => handleUpdateProduct(item.key, p.id)}
                          style={[styles.skuChip, isSelected && styles.skuChipActive]}
                        >
                          <Text
                            style={[
                              styles.skuChipText,
                              isSelected && styles.skuChipTextActive,
                            ]}
                          >
                            {p.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* Product Metadata & Van Stock */}
                  <View style={styles.productMetaRow}>
                    <View style={styles.stockBadgeContainer}>
                      <Ionicons
                        name="cube-outline"
                        size={14}
                        color={isExceedingStock ? Colors.light.danger : BrandColors.green.dark}
                      />
                      <Text
                        style={[
                          styles.stockBadgeText,
                          isExceedingStock && { color: Colors.light.danger },
                        ]}
                      >
                        Van Stock: {availStock} pkts available
                      </Text>
                    </View>

                    <Text style={styles.lineTotalText}>
                      Subtotal: <Text style={{ fontWeight: '800' }}>₹{lineTotal}</Text>
                    </Text>
                  </View>

                  {/* Quantity and Price Inputs */}
                  <View style={styles.controlsRow}>
                    {/* Quantity Stepper */}
                    <View style={styles.qtyContainer}>
                      <Text style={styles.inputLabel}>Quantity (Packets)</Text>
                      <View style={styles.stepperBox}>
                        <Pressable
                          onPress={() => handleUpdateQuantity(item.key, -5)}
                          style={styles.stepperBtn}
                          hitSlop={HitSlop.sm}
                        >
                          <Ionicons name="remove" size={16} color={BrandColors.pink.dark} />
                        </Pressable>

                        <TextInput
                          keyboardType="numeric"
                          value={String(item.quantity)}
                          onChangeText={(val) => handleSetQuantity(item.key, val)}
                          style={styles.qtyInput}
                        />

                        <Pressable
                          onPress={() => handleUpdateQuantity(item.key, 5)}
                          style={styles.stepperBtn}
                          hitSlop={HitSlop.sm}
                        >
                          <Ionicons name="add" size={16} color={BrandColors.pink.dark} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Unit Price */}
                    <View style={styles.priceContainer}>
                      <Text style={styles.inputLabel}>Unit Price (₹)</Text>
                      <View style={styles.priceInputBox}>
                        <Text style={styles.rupeePrefix}>₹</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={String(item.unitPriceRupees)}
                          onChangeText={(val) => handleSetUnitPrice(item.key, val)}
                          style={styles.priceInput}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Below Minimum Price Warning */}
                  {isBelowFloor && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning-outline" size={16} color="#D97706" />
                      <Text style={styles.warningText}>
                        Below ₹{(minPricePaise / 100).toFixed(2)} price floor. Sale will require
                        Super Admin approval.
                      </Text>
                    </View>
                  )}

                  {/* Stock Exceeded Error */}
                  {isExceedingStock && (
                    <Text style={styles.errorText}>
                      Quantity ({item.quantity} pkts) exceeds available stock ({availStock} pkts).
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>

          {/* ORDER FINANCIAL SUMMARY */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Packets:</Text>
              <Text style={styles.summaryValue}>{totalPackets.toLocaleString('en-IN')} pkts</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Order Value:</Text>
              <Text style={styles.summaryGrandTotal}>₹{grandTotalRupees.toFixed(2)}</Text>
            </View>

            <View style={styles.approvalStatusRow}>
              <Badge
                label={
                  hasLowPriceWarning
                    ? 'PRICE APPROVAL REQUIRED'
                    : 'CONFIRMED DIRECT STOCK DEDUCTION'
                }
                variant={hasLowPriceWarning ? 'PENDING' : 'CONFIRMED'}
              />
            </View>
          </Card>

          {/* PAYMENT MODE SELECTION */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Payment Mode</Text>
            <SegmentedTabs
              tabs={[
                { label: 'Cash', value: 'CASH' },
                { label: 'Bank / UPI', value: 'BANK' },
                { label: 'Pending Credit', value: 'PENDING' },
              ]}
              selectedTab={paymentMode}
              onSelect={(val) => setPaymentMode(val as PaymentMode)}
            />

            {paymentMode === 'BANK' && (
              <View style={styles.bankInputBox}>
                <Text style={styles.inputLabel}>UPI / Bank Transaction Reference</Text>
                <TextInput
                  placeholder="e.g. UPI/1234567890/HDFC"
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  style={styles.textInput}
                />
              </View>
            )}
          </Card>

          {/* CUSTOMER FEEDBACK & VOICE TRANSLATOR */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Customer Feedback Observation</Text>
            <Text style={styles.sectionSubtitle}>
              Record verbal feedback in Hindi, Hinglish, or English.
            </Text>

            <TextInput
              placeholder="e.g. Owner requested 50 more packets next week due to festival demand."
              value={customerFeedback}
              onChangeText={setCustomerFeedback}
              multiline
              numberOfLines={3}
              style={styles.feedbackInput}
            />

            <VoiceFeedbackTranslator
              value={customerFeedback}
              onChange={setCustomerFeedback}
            />
          </Card>

          {/* SUBMIT BUTTON */}
          <View style={styles.submitSection}>
            <Button
              title={
                isSubmitting
                  ? 'Submitting Sale...'
                  : `Submit Sale • ₹${grandTotalRupees.toFixed(2)}`
              }
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting || hasStockError}
              onPress={handleConfirmSale}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
  draftRestoredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  draftRestoredText: {
    ...Typography.caption,
    fontWeight: '600',
    color: BrandColors.green.dark,
    flex: 1,
  },
  sectionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  sectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    marginVertical: Spacing.xs,
  },
  customerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    marginRight: Spacing.xs,
    gap: 6,
  },
  customerChipActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  customerChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  customerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedCustomerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F8',
    borderColor: '#FCE7F3',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  customerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  customerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  lineItemBox: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  itemNumberBadge: {
    ...Typography.caption,
    fontWeight: '800',
    color: BrandColors.pink.dark,
    textTransform: 'uppercase',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.danger,
  },
  skuScroll: {
    marginVertical: Spacing.xs,
  },
  skuChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderColor: Colors.light.border,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  skuChipActive: {
    backgroundColor: '#FCE7F3',
    borderColor: BrandColors.pink.primary,
  },
  skuChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  skuChipTextActive: {
    color: BrandColors.pink.dark,
    fontWeight: '800',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.xs,
  },
  stockBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
    color: BrandColors.green.dark,
  },
  lineTotalText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  qtyContainer: {
    flex: 1,
  },
  priceContainer: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderColor: Colors.light.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    paddingVertical: 6,
  },
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderColor: Colors.light.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  rupeePrefix: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    paddingVertical: 8,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginTop: Spacing.sm,
    gap: 6,
  },
  warningText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.light.border,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  summaryGrandTotal: {
    ...Typography.h3,
    fontSize: 22,
    fontWeight: '900',
    color: BrandColors.green.dark,
  },
  approvalStatusRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    alignItems: 'flex-start',
  },
  bankInputBox: {
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
  },
  feedbackInput: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.sm,
  },
  submitSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.light.danger,
    marginTop: 4,
    fontWeight: '600',
  },
});
