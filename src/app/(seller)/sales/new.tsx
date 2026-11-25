import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaymentMode, ProductItem, ProductStockItem } from '@/api/types';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  DropdownOption,
  SearchableDropdownModal,
} from '@/components/ui/SearchableDropdownModal';
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
import { useResponsiveLayout } from '@/utils/responsive';
import { checkHasActiveShift } from '@/utils/shiftGuard';

interface CartLineItem {
  key: string;
  productId: string;
  quantity: number;
  unitPriceRupees: number;
}

const QUICK_SHOP_MESSAGES = [
  'Come tomorrow',
  'Need more packets',
  'Shop was closed',
  'Payment pending',
];

function formatRupeeDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return Number.isInteger(amount)
    ? amount.toLocaleString('en-IN')
    : amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toFriendlySaveError(err: any): string {
  const raw = String(err?.message || '').toLowerCase();
  if (!raw || raw.includes('internal server') || raw.includes('prisma') || raw.includes('sql')) {
    return 'Could not save bill. Please try again.';
  }
  if (raw.includes('network') || raw.includes('timeout') || raw.includes('fetch')) {
    return 'No internet or slow connection. Check network and tap Save Sale again.';
  }
  if (raw.includes('insufficient') || raw.includes('stock')) {
    return 'Not enough packets in stock for this sale.';
  }
  if (raw.includes('shift')) {
    return 'Please start your duty first before saving a sale.';
  }
  if (err?.message && String(err.message).length <= 90 && !String(err.message).includes('{')) {
    return String(err.message);
  }
  return 'Could not save bill. Please try again.';
}

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useResponsiveLayout();
  const isCompactScreen = width < 400;
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
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [activeProductPickerItemKey, setActiveProductPickerItemKey] = useState<string | null>(null);
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
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
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
        const [custRes, prodRes, invRes, savedDraft, shiftRes] = await Promise.all([
          sellerApi.listCustomers({ pageSize: 100 }).catch(() => ({ items: [] })),
          sellerApi.listProducts().catch(() => ({ items: [] })),
          sellerApi.getInventory().catch(() => ({ balance: 0, products: [] })),
          draftStorage.getOrderDraft(userId).catch(() => null),
          checkHasActiveShift(userId).catch(() => ({ hasActiveShift: false, shift: null })),
        ]);

        setHasActiveShift(shiftRes.hasActiveShift);

        const loadedCustomers = custRes.items || [];
        const loadedProducts = prodRes.items || [];
        setCustomers(loadedCustomers);
        setProducts(loadedProducts);

        // Build stock map
        const map: Record<string, number> = {};
        if (invRes.products && Array.isArray(invRes.products)) {
          invRes.products.forEach((p: ProductStockItem) => {
            const pId = p.productId || (p as any).id;
            if (pId) {
              map[pId] = p.balance;
            }
          });
        }
        // Fallback: If map is empty or zero but seller has total van stock balance, assign to available products
        const totalBal = invRes.balance ?? (invRes as any).remaining ?? 0;
        if (Object.keys(map).length === 0 && totalBal > 0 && loadedProducts.length > 0) {
          loadedProducts.forEach((p) => {
            map[p.id] = totalBal;
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
        errorsMap[prodId] = `Only ${avail} packets available (${reqQty} entered).`;
      }
    }
    return errorsMap;
  }, [cartItems, stockMap]);

  const hasStockError = Object.keys(stockErrors).length > 0;

  // ----------------------------------------------------
  // Cart Actions
  // ----------------------------------------------------
  const handleAddLineItem = () => {
    const unusedProduct =
      products.find((p) => !cartItems.some((item) => item.productId === p.id)) || products[0];

    const prodId = unusedProduct?.id || '';
    const avail = prodId ? stockMap[prodId] ?? 0 : 0;
    const defaultQty = avail > 0 ? Math.min(5, avail) : 5;

    setCartItems((prev) => [
      ...prev,
      {
        key: `line_${Date.now()}_${prev.length + 1}`,
        productId: prodId,
        quantity: defaultQty,
        unitPriceRupees: (unusedProduct?.basePricePaise || 3500) / 100,
      },
    ]);
  };

  const handleRemoveLineItem = (key: string) => {
    if (cartItems.length <= 1) {
      Alert.alert('At Least 1 Product', 'A sale must have at least one product.');
      return;
    }
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleUpdateProduct = (key: string, newProductId: string) => {
    const prod = products.find((p) => p.id === newProductId);
    const avail = stockMap[newProductId] ?? 0;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const clampedQty = avail > 0 && item.quantity > avail ? avail : item.quantity;
        return {
          ...item,
          productId: newProductId,
          quantity: clampedQty,
          unitPriceRupees: prod ? (prod.basePricePaise || 3500) / 100 : item.unitPriceRupees,
        };
      })
    );
  };

  const handleUpdateQuantity = (key: string, delta: number, maxStock: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const candidate = Math.max(1, item.quantity + delta);
        const bounded = maxStock > 0 ? Math.min(candidate, maxStock) : candidate;
        return { ...item, quantity: bounded };
      })
    );
  };

  const handleSetQuantity = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (!cleaned) {
      setCartItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, quantity: 0 } : item))
      );
      return;
    }
    const parsed = parseInt(cleaned, 10);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        return { ...item, quantity: isNaN(parsed) || parsed < 0 ? 0 : parsed };
      })
    );
  };

  const handleSetUnitPrice = (key: string, val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      setCartItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, unitPriceRupees: 0 } : item))
      );
      return;
    }
    const parsed = parseFloat(cleaned);
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
    if (!selectedCustomerId) errs.customer = 'Please select a shop.';

    const validLines = cartItems.filter((i) => i.productId && i.quantity > 0);
    if (validLines.length === 0) {
      errs.cart = 'Enter at least 1 packet.';
    }

    cartItems.forEach((item, idx) => {
      if (!item.productId) {
        errs[`line_${idx}_product`] = 'Please select a product.';
      }
      if (item.quantity <= 0) {
        errs[`line_${idx}_qty`] = 'Enter at least 1 packet.';
      }
      if (item.unitPriceRupees <= 0) {
        errs[`line_${idx}_price`] = 'Enter a valid price.';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleConfirmSale() {
    if (isSubmitting) return;

    if (!validate()) {
      Alert.alert('Please Check', 'Check shop, product, packets, and price.');
      return;
    }

    if (hasStockError) {
      Alert.alert('Not Enough Stock', 'Entered packets exceed your available stock.');
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
      const salesTargetRoute = user?.role === 'MANAGER' ? '/(manager)/sales' : '/(seller)/sales';
      const billNo = res.sale.saleNumber ? `#${res.sale.saleNumber} ` : '';
      const totalFormatted = formatRupeeDisplay(grandTotalRupees);

      Alert.alert(
        isPendingApproval ? 'Sent for Approval!' : 'Sale Saved!',
        isPendingApproval
          ? `Bill ${billNo}has a special price and was sent to Admin for approval.`
          : `Bill ${billNo}saved. Total: ₹${totalFormatted} (${totalPackets} packets).`,
        [
          {
            text: 'View Sales',
            onPress: () => router.replace(salesTargetRoute as any),
          },
        ]
      );
    } catch (err: any) {
      const friendlyMsg = toFriendlySaveError(err);
      setFeedback({
        type: 'error',
        title: 'Could Not Save Sale',
        message: friendlyMsg,
      });
      Alert.alert('Could Not Save Sale', friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const customerDropdownOptions = useMemo<DropdownOption[]>(() => {
    return customers.map((c) => {
      const owner = c.ownerName || (c as any).contactName || '—';
      const area = c.village || c.district || 'Area';
      const phonePart = c.phone ? ` · ${c.phone}` : '';
      return {
        id: c.id,
        title: c.shopName,
        subtitle: `Owner: ${owner} · ${area}${phonePart}`,
        badge: 'Assigned',
        badgeVariant: 'ACTIVE',
        icon: 'storefront-outline',
        metadata: `${c.phone || ''} ${c.address || ''} ${c.pincode || ''} ${c.district || ''} ${c.village || ''}`,
      };
    });
  }, [customers]);

  const productDropdownOptions = useMemo<DropdownOption[]>(() => {
    return products.map((p) => {
      const stock = stockMap[p.id] ?? 0;
      const priceRupees = (p.basePricePaise || 0) / 100;
      return {
        id: p.id,
        title: p.name,
        subtitle:
          stock > 0
            ? `Available: ${stock.toLocaleString('en-IN')} packets · ₹${formatRupeeDisplay(priceRupees)}`
            : `Out of stock (0 packets) · ₹${formatRupeeDisplay(priceRupees)}`,
        badge: stock > 0 ? `${stock} pkts` : 'Out of stock',
        badgeVariant: stock > 0 ? 'success' : 'REJECTED',
        icon: 'cube-outline',
        metadata: `${p.name}`,
      };
    });
  }, [products, stockMap]);

  const handleOpenShift = useCallback(() => {
    router.push('/(seller)/attendance' as any);
  }, [router]);

  const paymentOptions: Array<{
    value: PaymentMode;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      value: 'CASH',
      title: 'Cash',
      subtitle: 'Cash received',
      icon: 'cash-outline',
    },
    {
      value: 'BANK',
      title: 'UPI / Bank',
      subtitle: 'Online payment',
      icon: 'qr-code-outline',
    },
    {
      value: 'PENDING',
      title: 'Pay Later',
      subtitle: 'Credit balance',
      icon: 'time-outline',
    },
  ];

  if (loading) {
    return <LoadingState message="Loading shops and products..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <Header
        title="New Sale"
        subtitle="Create a shop bill"
        showBack
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Shift Status Strip */}
          {hasActiveShift ? (
            <View style={[styles.shiftStrip, styles.shiftStripActive]}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" />
              <Text style={styles.shiftTextActive} numberOfLines={1}>
                Today&apos;s duty is active
              </Text>
            </View>
          ) : (
            <View style={[styles.shiftStrip, styles.shiftStripInactive]}>
              <View style={styles.shiftInactiveLeft}>
                <Ionicons name="alert-circle" size={18} color="#9F1239" />
                <Text style={styles.shiftTextInactive} numberOfLines={2}>
                  Start your duty first
                </Text>
              </View>
              <Pressable
                onPress={handleOpenShift}
                style={styles.startDutyBtn}
                hitSlop={HitSlop.sm}
                accessibilityRole="button"
              >
                <Text style={styles.startDutyBtnText} numberOfLines={1}>
                  Start Duty
                </Text>
              </Pressable>
            </View>
          )}

          {feedback && (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.title}
              message={feedback.message}
              actionLabel={feedback.actionLabel}
              onAction={feedback.onAction}
            />
          )}

          {/* Restored Unfinished Bill Notice with Close Button */}
          {isDraftRestored && (
            <View style={styles.draftRestoredNotice}>
              <Ionicons name="receipt-outline" size={17} color={BrandColors.green.dark} />
              <Text style={styles.draftRestoredText}>Previous bill restored.</Text>
              <Pressable
                onPress={() => setIsDraftRestored(false)}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Close restored bill notice"
                style={styles.draftCloseBtn}
              >
                <Ionicons name="close" size={16} color={BrandColors.green.dark} />
              </Pressable>
            </View>
          )}

          {/* 1. SHOP SELECTION */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>1. Select Shop</Text>
              {selectedCustomer && (
                <Pressable
                  onPress={() => setCustomerPickerOpen(true)}
                  hitSlop={HitSlop.md}
                  style={styles.changePillBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="swap-horizontal" size={14} color={BrandColors.pink.primary} />
                  <Text style={styles.changePillText} numberOfLines={1}>
                    Change Shop
                  </Text>
                </Pressable>
              )}
            </View>

            {selectedCustomer ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomerPickerOpen(true)}
                style={styles.selectedShopCard}
                accessibilityRole="button"
                accessibilityLabel={`${selectedCustomer.shopName}. Change Shop`}
              >
                <View style={styles.shopIconBox}>
                  <Ionicons name="storefront" size={22} color={BrandColors.pink.primary} />
                </View>
                <View style={styles.shopDetailsCol}>
                  <View style={styles.shopTopRow}>
                    <Text style={styles.shopNameText} numberOfLines={1}>
                      {selectedCustomer.shopName}
                    </Text>
                    <Badge label="Assigned" variant="ACTIVE" size="sm" />
                  </View>
                  <Text style={styles.shopOwnerText} numberOfLines={1}>
                    Owner: {selectedCustomer.ownerName || (selectedCustomer as any).contactName || '—'}
                  </Text>
                  <Text style={styles.shopAreaText} numberOfLines={1}>
                    {selectedCustomer.village || selectedCustomer.district || 'Area'}
                    {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.noShopBox}>
                <View style={styles.noShopTop}>
                  <Ionicons name="storefront-outline" size={24} color={Colors.light.textTertiary} />
                  <Text style={styles.noShopText}>No shop selected yet</Text>
                </View>
                <Button
                  title="Select Shop"
                  variant="primary"
                  size="md"
                  onPress={() => setCustomerPickerOpen(true)}
                  icon={<Ionicons name="search" size={17} color="#FFFFFF" />}
                />
              </View>
            )}

            {errors.customer ? <Text style={styles.errorText}>{errors.customer}</Text> : null}
          </Card>

          {/* 2. PRODUCT SELECTION */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>2. Add Products</Text>
              <Button
                title="+ Add Product"
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
              const lineTotal = item.quantity * item.unitPriceRupees;
              const isExceedingStock = item.quantity > availStock;

              return (
                <View key={item.key} style={styles.lineItemBox}>
                  {/* Item Number + Remove */}
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.itemNumberText}>Product #{index + 1}</Text>
                    {cartItems.length > 1 && (
                      <Pressable
                        onPress={() => handleRemoveLineItem(item.key)}
                        hitSlop={HitSlop.md}
                        style={styles.removeBtn}
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.light.danger} />
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Product Selector Trigger */}
                  <TouchableOpacity
                    style={styles.productTrigger}
                    onPress={() => setActiveProductPickerItemKey(item.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={prod ? prod.name : 'Select product'}
                  >
                    <View style={styles.productTriggerIcon}>
                      <Ionicons name="cube" size={20} color={BrandColors.pink.primary} />
                    </View>
                    <View style={styles.productTriggerTextCol}>
                      <Text style={styles.productTitleText} numberOfLines={2}>
                        {prod ? prod.name : 'Select product...'}
                      </Text>
                      <Text
                        style={[
                          styles.productStockText,
                          (isExceedingStock || availStock === 0) && { color: Colors.light.danger },
                        ]}
                        numberOfLines={1}
                      >
                        {availStock > 0
                          ? `Available: ${availStock.toLocaleString('en-IN')} packets`
                          : 'Out of stock (0 packets available)'}
                      </Text>
                    </View>
                    <View style={styles.selectPill}>
                      <Text style={styles.selectPillText}>Select</Text>
                      <Ionicons name="chevron-down" size={14} color={BrandColors.pink.primary} />
                    </View>
                  </TouchableOpacity>
                  {errors[`line_${index}_product`] ? (
                    <Text style={styles.errorText}>{errors[`line_${index}_product`]}</Text>
                  ) : null}

                  {/* Packets & Price per Packet */}
                  <View style={[styles.controlsRow, isCompactScreen && styles.controlsRowStacked]}>
                    {/* Packets Stepper */}
                    <View style={styles.controlCol}>
                      <Text style={styles.controlLabel}>Packets</Text>
                      <View style={styles.stepperBox}>
                        <Pressable
                          onPress={() => handleUpdateQuantity(item.key, -1, availStock)}
                          style={styles.stepperBtn}
                          hitSlop={HitSlop.sm}
                          accessibilityRole="button"
                          accessibilityLabel="Decrease packets"
                        >
                          <Ionicons name="remove" size={20} color={BrandColors.pink.dark} />
                        </Pressable>

                        <TextInput
                          keyboardType="numeric"
                          value={item.quantity === 0 ? '' : String(item.quantity)}
                          onChangeText={(val) => handleSetQuantity(item.key, val)}
                          style={styles.qtyInput}
                          placeholder="0"
                          placeholderTextColor={Colors.light.textPlaceholder}
                        />

                        <Pressable
                          onPress={() => handleUpdateQuantity(item.key, 1, availStock)}
                          style={styles.stepperBtn}
                          hitSlop={HitSlop.sm}
                          accessibilityRole="button"
                          accessibilityLabel="Increase packets"
                        >
                          <Ionicons name="add" size={20} color={BrandColors.pink.dark} />
                        </Pressable>
                      </View>
                      {errors[`line_${index}_qty`] ? (
                        <Text style={styles.errorText}>{errors[`line_${index}_qty`]}</Text>
                      ) : null}
                    </View>

                    {/* Price per Packet */}
                    <View style={styles.controlCol}>
                      <Text style={styles.controlLabel}>Price per Packet</Text>
                      <View style={styles.priceInputBox}>
                        <Text style={styles.rupeePrefix}>₹</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={item.unitPriceRupees === 0 ? '' : String(item.unitPriceRupees)}
                          onChangeText={(val) => handleSetUnitPrice(item.key, val)}
                          style={styles.priceInput}
                          placeholder="0"
                          placeholderTextColor={Colors.light.textPlaceholder}
                        />
                      </View>
                      {errors[`line_${index}_price`] ? (
                        <Text style={styles.errorText}>{errors[`line_${index}_price`]}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Line Amount Row */}
                  <View style={styles.lineAmountRow}>
                    <Text style={styles.lineAmountLabel}>Amount</Text>
                    <Text style={styles.lineAmountValue}>₹{formatRupeeDisplay(lineTotal)}</Text>
                  </View>

                  {/* Low Price Notice */}
                  {isBelowFloor && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning-outline" size={16} color="#D97706" />
                      <Text style={styles.warningText}>
                        Below ₹{formatRupeeDisplay(minPricePaise / 100)} minimum price. Needs Admin
                        approval.
                      </Text>
                    </View>
                  )}

                  {/* Stock Exceeded Error */}
                  {isExceedingStock && (
                    <Text style={styles.errorText}>
                      {stockErrors[item.productId] || `Available: ${availStock} packets`}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>

          {/* TOTAL BILL SUMMARY */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Bill</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Packets</Text>
              <Text style={styles.summaryPacketsValue}>
                {totalPackets.toLocaleString('en-IN')} packets
              </Text>
            </View>

            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryAmountLabel}>Total Amount</Text>
              <Text style={styles.summaryGrandTotal}>₹{formatRupeeDisplay(grandTotalRupees)}</Text>
            </View>

            <View
              style={[
                styles.stockNoteBox,
                hasLowPriceWarning ? styles.stockNoteWarning : styles.stockNoteNormal,
              ]}
            >
              <Ionicons
                name={hasLowPriceWarning ? 'time-outline' : 'checkmark-circle-outline'}
                size={16}
                color={hasLowPriceWarning ? '#92400E' : BrandColors.green.dark}
              />
              <Text
                style={[
                  styles.stockNoteText,
                  { color: hasLowPriceWarning ? '#92400E' : BrandColors.green.dark },
                ]}
              >
                {hasLowPriceWarning
                  ? 'Low price — needs Admin approval before stock updates.'
                  : 'Stock will be reduced after sale confirmation.'}
              </Text>
            </View>
          </Card>

          {/* 3. PAYMENT */}
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>3. Payment</Text>

            <View style={[styles.paymentGrid, isCompactScreen && styles.paymentGridStacked]}>
              {paymentOptions.map((opt) => {
                const selected = paymentMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setPaymentMode(opt.value)}
                    style={[
                      styles.paymentOptionCard,
                      !isCompactScreen && styles.paymentOptionCardRow,
                      selected && styles.paymentOptionCardSelected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        styles.paymentIconCircle,
                        selected && styles.paymentIconCircleSelected,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={19}
                        color={selected ? '#FFFFFF' : Colors.light.textSecondary}
                      />
                    </View>
                    <View style={styles.paymentTextCol}>
                      <Text
                        style={[
                          styles.paymentOptionTitle,
                          selected && styles.paymentOptionTitleSelected,
                        ]}
                      >
                        {opt.title}
                      </Text>
                      <Text
                        style={[
                          styles.paymentOptionSub,
                          selected && styles.paymentOptionSubSelected,
                        ]}
                      >
                        {opt.subtitle}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={BrandColors.pink.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {paymentMode === 'BANK' && (
              <View style={styles.bankInputBox}>
                <Text style={styles.controlLabel}>UPI / Bank Reference (Optional)</Text>
                <TextInput
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  placeholder="Enter transaction ID..."
                  placeholderTextColor={Colors.light.textPlaceholder}
                  style={styles.textInput}
                />
              </View>
            )}
          </Card>

          {/* 4. SHOPKEEPER'S MESSAGE (VOICE + QUICK CHIPS) */}
          <Card style={styles.sectionCard}>
            <VoiceFeedbackTranslator
              value={customerFeedback}
              onChange={setCustomerFeedback}
              label="4. Shopkeeper's Message"
              sublabel="Optional — write or speak a short note."
              placeholder='e.g. "Send stock tomorrow" or "Need 15 more packets"'
              micLabel="Speak to write"
              quickChipsHeading="Quick messages:"
              quickChips={QUICK_SHOP_MESSAGES}
              directApplyChips
            />
          </Card>
        </View>
      </ScrollView>

      {/* STICKY SAVE SALE FOOTER */}
      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <View style={styles.stickyFooterInner}>
          <Button
            title={
              isSubmitting
                ? 'Saving...'
                : `Save Sale • ₹${formatRupeeDisplay(grandTotalRupees)}`
            }
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting || hasStockError}
            onPress={handleConfirmSale}
          />
        </View>
      </View>

      {/* Searchable Shop Picker Modal */}
      <SearchableDropdownModal
        visible={customerPickerOpen}
        title="Select Shop"
        searchPlaceholder="Search shop, owner, area or phone..."
        options={customerDropdownOptions}
        selectedId={selectedCustomerId}
        onSelect={(opt) => {
          setSelectedCustomerId(opt.id);
          setCustomerPickerOpen(false);
          setErrors((prev) => {
            const next = { ...prev };
            delete next.customer;
            return next;
          });
        }}
        onClose={() => setCustomerPickerOpen(false)}
        emptyMessage="No shop found"
      />

      {/* Searchable Product Picker Modal */}
      <SearchableDropdownModal
        visible={Boolean(activeProductPickerItemKey)}
        title="Select Product"
        searchPlaceholder="Search product name..."
        options={productDropdownOptions}
        selectedId={
          activeProductPickerItemKey
            ? cartItems.find((i) => i.key === activeProductPickerItemKey)?.productId
            : undefined
        }
        onSelect={(opt) => {
          if (activeProductPickerItemKey) {
            handleUpdateProduct(activeProductPickerItemKey, opt.id);
            setActiveProductPickerItemKey(null);
          }
        }}
        onClose={() => setActiveProductPickerItemKey(null)}
        emptyMessage="No product found"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
  },
  shiftStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  shiftStripActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    justifyContent: 'flex-start',
  },
  shiftStripInactive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  shiftInactiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  shiftTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  shiftTextInactive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9F1239',
    flex: 1,
  },
  startDutyBtn: {
    backgroundColor: BrandColors.pink.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  startDutyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  draftRestoredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    marginBottom: Spacing.md,
    gap: 8,
  },
  draftRestoredText: {
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.green.dark,
    flex: 1,
  },
  draftCloseBtn: {
    padding: 4,
  },
  sectionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.titleSmall,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    flexShrink: 1,
  },
  changePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    gap: 5,
    flexShrink: 0,
  },
  changePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  selectedShopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8FA',
    borderWidth: 1.5,
    borderColor: BrandColors.pink.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  shopIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shopDetailsCol: {
    flex: 1,
    minWidth: 0,
  },
  shopTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  shopNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  shopOwnerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  shopAreaText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  noShopBox: {
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  noShopTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noShopText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    flex: 1,
  },
  lineItemBox: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  itemNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.danger,
  },
  productTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: BrandColors.pink.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 56,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  productTriggerIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  productTriggerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  productTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  productStockText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.dark,
    marginTop: 2,
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.subtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
    flexShrink: 0,
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  controlsRowStacked: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  controlCol: {
    flex: 1,
    minWidth: 0,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderColor: Colors.light.border,
    borderWidth: 1,
    minHeight: 46,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    paddingVertical: 8,
    minWidth: 44,
  },
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderColor: Colors.light.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
  },
  rupeePrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.textPrimary,
    paddingVertical: 8,
  },
  lineAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  lineAmountLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  lineAmountValue: {
    fontSize: 17,
    fontWeight: '800',
    color: BrandColors.green.dark,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BrandColors.green.border,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: 16,
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
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  summaryPacketsValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  summaryAmountLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  summaryGrandTotal: {
    fontSize: 26,
    fontWeight: '900',
    color: BrandColors.green.dark,
  },
  stockNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    gap: 6,
  },
  stockNoteNormal: {
    backgroundColor: '#F0FDF4',
  },
  stockNoteWarning: {
    backgroundColor: '#FFFBEB',
  },
  stockNoteText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  paymentGridStacked: {
    flexDirection: 'column',
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
    minHeight: 58,
  },
  paymentOptionCardRow: {
    flex: 1,
    minWidth: 150,
  },
  paymentOptionCardSelected: {
    backgroundColor: '#FFF5F8',
    borderColor: BrandColors.pink.primary,
  },
  paymentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paymentIconCircleSelected: {
    backgroundColor: BrandColors.pink.primary,
  },
  paymentTextCol: {
    flex: 1,
    minWidth: 0,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  paymentOptionTitleSelected: {
    color: BrandColors.pink.dark,
  },
  paymentOptionSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  paymentOptionSubSelected: {
    color: BrandColors.pink.dark,
    fontWeight: '600',
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
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.light.textPrimary,
  },
  stickyFooter: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...Shadows.md,
  },
  stickyFooterInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 12,
    color: Colors.light.danger,
    marginTop: 6,
    fontWeight: '700',
  },
});
