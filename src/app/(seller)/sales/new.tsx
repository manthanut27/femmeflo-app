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

type POSLanguage = 'hi' | 'en' | 'mr';

interface POSCopy {
  headerTitle: string;
  headerSubtitle: string;
  loadingText: string;
  shiftActive: string;
  shiftInactive: string;
  startDutyBtn: string;
  restoredBill: string;
  shopHeading: string;
  assignedBadge: string;
  changeShop: string;
  noShopSelected: string;
  selectShopBtn: string;
  shopModalTitle: string;
  shopSearchPlaceholder: string;
  shopEmptyMessage: string;
  productHeading: string;
  addProductBtn: string;
  productItemLabel: string;
  removeBtn: string;
  chooseProductPlaceholder: string;
  selectBtn: string;
  availableLabel: string;
  packetsUnit: string;
  packetsLabel: string;
  pricePerPacketLabel: string;
  amountLabel: string;
  productModalTitle: string;
  productSearchPlaceholder: string;
  productEmptyMessage: string;
  totalBillHeading: string;
  totalPacketsLabel: string;
  totalAmountLabel: string;
  stockConfirmNote: string;
  stockApprovalNote: string;
  paymentHeading: string;
  cashTitle: string;
  cashSub: string;
  upiTitle: string;
  upiSub: string;
  udhaarTitle: string;
  udhaarSub: string;
  upiRefLabel: string;
  upiRefPlaceholder: string;
  messageHeading: string;
  messageSublabel: string;
  messagePlaceholder: string;
  micLabel: string;
  quickChipsHeading: string;
  quickChips: string[];
  saveSaleBtn: string;
  savingSaleBtn: string;
  saleSuccessTitle: string;
  saleApprovalTitle: string;
  viewSalesBtn: string;
  checkFormTitle: string;
  checkFormMsg: string;
  lowStockTitle: string;
  lowStockMsg: string;
  cartLimitTitle: string;
  cartLimitMsg: string;
  errorTitle: string;
  genericSaveError: string;
  networkSaveError: string;
  selectShopError: string;
  selectProductError: string;
  qtyError: string;
  priceError: string;
}

const POS_TRANSLATIONS: Record<POSLanguage, POSCopy> = {
  hi: {
    headerTitle: 'New Sale',
    headerSubtitle: 'Shop se order lo',
    loadingText: 'Products aur dukaan load ho rahe hain...',
    shiftActive: 'Aaj ki duty chalu hai',
    shiftInactive: 'Pehle apni duty start karein',
    startDutyBtn: 'Start Duty',
    restoredBill: 'Purana adhoora bill wapas aa gaya.',
    shopHeading: '1. Dukaan Chune',
    assignedBadge: 'Assigned',
    changeShop: 'Change Shop',
    noShopSelected: 'Abhi dukaan nahi chuni hai',
    selectShopBtn: 'Select Shop',
    shopModalTitle: 'Dukaan Chune',
    shopSearchPlaceholder: 'Dukaan, owner, area ya phone likhein...',
    shopEmptyMessage: 'Koi dukaan nahi mili',
    productHeading: '2. Product Jodein',
    addProductBtn: '+ Product Jodein',
    productItemLabel: 'Product',
    removeBtn: 'Hataein',
    chooseProductPlaceholder: 'Product chune...',
    selectBtn: 'Select',
    availableLabel: 'Available',
    packetsUnit: 'packets',
    packetsLabel: 'Packets',
    pricePerPacketLabel: 'Price per packet',
    amountLabel: 'Amount',
    productModalTitle: 'Product Chune',
    productSearchPlaceholder: 'Product ka naam likhein...',
    productEmptyMessage: 'Koi product nahi mila',
    totalBillHeading: 'Total Bill',
    totalPacketsLabel: 'Total Packets',
    totalAmountLabel: 'Total Amount',
    stockConfirmNote: 'Sale confirm hone par stock kam hoga.',
    stockApprovalNote: 'Kam rate hai — Admin approve karne ke baad stock kam hoga.',
    paymentHeading: '3. Payment',
    cashTitle: 'Cash',
    cashSub: 'Cash mila',
    upiTitle: 'UPI / Bank',
    upiSub: 'Online payment',
    udhaarTitle: 'Udhaar',
    udhaarSub: 'Baad mein payment',
    upiRefLabel: 'UPI / Bank Number (Zaroori nahi)',
    upiRefPlaceholder: 'Transaction number likhein...',
    messageHeading: '4. Dukaan wale ka message',
    messageSublabel: 'Koi baat batani ho to likhein.',
    messagePlaceholder: 'Jaise: "Kal maal bhejna" ya "15 packet aur chahiye"',
    micLabel: 'Bolkar likhein',
    quickChipsHeading: 'Ek tap mein jodein:',
    quickChips: ['Kal aana', 'Aur maal chahiye', 'Dukaan band thi', 'Payment baaki hai'],
    saveSaleBtn: 'Sale Save Karein',
    savingSaleBtn: 'Save ho raha hai...',
    saleSuccessTitle: 'Sale ho gayi!',
    saleApprovalTitle: 'Approval ke liye bheja!',
    viewSalesBtn: 'Sales Dekhein',
    checkFormTitle: 'Check Karein',
    checkFormMsg: 'Dukaan, product aur packet sahi se bharein.',
    lowStockTitle: 'Stock Kam Hai',
    lowStockMsg: 'Aapke paas itne packets available nahi hain.',
    cartLimitTitle: 'Kam se kam 1 Product',
    cartLimitMsg: 'Bill mein kam se kam ek product hona zaroori hai.',
    errorTitle: 'Sale Save Nahi Hui',
    genericSaveError: 'Bill save nahi ho paya. Kripya dubara koshish karein.',
    networkSaveError: 'Internet slow ya band hai. Network check karke dubara save karein.',
    selectShopError: 'Kripya pehle dukaan chune.',
    selectProductError: 'Kripya product chune.',
    qtyError: 'Kam se kam 1 packet dalein.',
    priceError: 'Sahi price dalein.',
  },
  en: {
    headerTitle: 'New Sale',
    headerSubtitle: 'Create a shop bill',
    loadingText: 'Loading shops and products...',
    shiftActive: "Today's duty is active",
    shiftInactive: 'Start your duty first',
    startDutyBtn: 'Start Duty',
    restoredBill: 'Previous bill restored.',
    shopHeading: '1. Select Shop',
    assignedBadge: 'Assigned',
    changeShop: 'Change Shop',
    noShopSelected: 'No shop selected yet',
    selectShopBtn: 'Select Shop',
    shopModalTitle: 'Select Shop',
    shopSearchPlaceholder: 'Search shop, owner, area or phone...',
    shopEmptyMessage: 'No shop found',
    productHeading: '2. Add Products',
    addProductBtn: '+ Add Product',
    productItemLabel: 'Product',
    removeBtn: 'Remove',
    chooseProductPlaceholder: 'Select product...',
    selectBtn: 'Select',
    availableLabel: 'Available',
    packetsUnit: 'packets',
    packetsLabel: 'Packets',
    pricePerPacketLabel: 'Price per Packet',
    amountLabel: 'Amount',
    productModalTitle: 'Select Product',
    productSearchPlaceholder: 'Search product name...',
    productEmptyMessage: 'No product found',
    totalBillHeading: 'Total Bill',
    totalPacketsLabel: 'Total Packets',
    totalAmountLabel: 'Total Amount',
    stockConfirmNote: 'Stock will be reduced after sale confirmation.',
    stockApprovalNote: 'Low price — needs Admin approval before stock updates.',
    paymentHeading: '3. Payment',
    cashTitle: 'Cash',
    cashSub: 'Cash received',
    upiTitle: 'UPI / Bank',
    upiSub: 'Online payment',
    udhaarTitle: 'Udhaar',
    udhaarSub: 'Pay later',
    upiRefLabel: 'UPI / Bank Reference (Optional)',
    upiRefPlaceholder: 'Enter transaction ID...',
    messageHeading: "4. Shopkeeper's Message",
    messageSublabel: 'Optional — write or speak a short note.',
    messagePlaceholder: 'e.g. "Send stock tomorrow" or "Need 15 more packets"',
    micLabel: 'Speak to write',
    quickChipsHeading: 'Quick messages:',
    quickChips: ['Kal aana', 'Aur maal chahiye', 'Dukaan band thi', 'Payment baaki hai'],
    saveSaleBtn: 'Save Sale',
    savingSaleBtn: 'Saving...',
    saleSuccessTitle: 'Sale Done!',
    saleApprovalTitle: 'Sent for Approval!',
    viewSalesBtn: 'View Sales',
    checkFormTitle: 'Please Check',
    checkFormMsg: 'Check shop, product, packets and price.',
    lowStockTitle: 'Not Enough Stock',
    lowStockMsg: 'Entered packets exceed available stock.',
    cartLimitTitle: 'At Least 1 Product',
    cartLimitMsg: 'A sale must have at least one product.',
    errorTitle: 'Could Not Save Sale',
    genericSaveError: 'Sale could not be saved. Please try again.',
    networkSaveError: 'Connection issue. Please check internet and tap Save Sale again.',
    selectShopError: 'Please select a shop.',
    selectProductError: 'Please select a product.',
    qtyError: 'Enter at least 1 packet.',
    priceError: 'Enter a valid price.',
  },
  mr: {
    headerTitle: 'New Sale',
    headerSubtitle: 'दुकानातून ऑर्डर घ्या',
    loadingText: 'दुकाने आणि प्रॉडक्ट लोड होत आहेत...',
    shiftActive: 'आजची ड्युटी चालू आहे',
    shiftInactive: 'आधी तुमची ड्युटी सुरू करा',
    startDutyBtn: 'Start Duty',
    restoredBill: 'मागील अपूर्ण बिल परत आले आहे.',
    shopHeading: '1. दुकान निवडा',
    assignedBadge: 'नेमलेले',
    changeShop: 'Change Shop',
    noShopSelected: 'अजून दुकान निवडलेले नाही',
    selectShopBtn: 'Select Shop',
    shopModalTitle: 'दुकान निवडा',
    shopSearchPlaceholder: 'दुकान, मालक, परिसर किंवा फोन शोधा...',
    shopEmptyMessage: 'कोणतेही दुकान सापडले नाही',
    productHeading: '2. प्रॉडक्ट जोडा',
    addProductBtn: '+ प्रॉडक्ट जोडा',
    productItemLabel: 'प्रॉडक्ट',
    removeBtn: 'काढा',
    chooseProductPlaceholder: 'प्रॉडक्ट निवडा...',
    selectBtn: 'निवडा',
    availableLabel: 'उपलब्ध',
    packetsUnit: 'पॅकेट्स',
    packetsLabel: 'पॅकेट्स',
    pricePerPacketLabel: 'प्रति पॅकेट दर',
    amountLabel: 'रक्कम',
    productModalTitle: 'प्रॉडक्ट निवडा',
    productSearchPlaceholder: 'प्रॉडक्टचे नाव शोधा...',
    productEmptyMessage: 'प्रॉडक्ट सापडले नाही',
    totalBillHeading: 'Total Bill',
    totalPacketsLabel: 'एकूण पॅकेट्स',
    totalAmountLabel: 'एकूण रक्कम',
    stockConfirmNote: 'विक्री पक्की झाल्यावर स्टॉक कमी होईल.',
    stockApprovalNote: 'कमी दर आहे — ॲडमिन मंजुरीनंतर स्टॉक कमी होईल.',
    paymentHeading: '3. Payment',
    cashTitle: 'Cash',
    cashSub: 'रोख मिळाले',
    upiTitle: 'UPI / Bank',
    upiSub: 'ऑनलाईन पेमेंट',
    udhaarTitle: 'Udhaar',
    udhaarSub: 'नंतर पेमेंट',
    upiRefLabel: 'UPI / बँक नंबर (ऐच्छिक)',
    upiRefPlaceholder: 'ट्रान्झॅक्शन नंबर लिहा...',
    messageHeading: '4. दुकानदाराचा संदेश',
    messageSublabel: 'काही सांगायचे असल्यास लिहा किंवा बोला.',
    messagePlaceholder: 'उदा. "उद्या माल पाठवा" किंवा "१५ पॅकेट अजून हवे"',
    micLabel: 'बोलून लिहा',
    quickChipsHeading: 'झटपट संदेश:',
    quickChips: ['Kal aana', 'Aur maal chahiye', 'Dukaan band thi', 'Payment baaki hai'],
    saveSaleBtn: 'Sale Save Karein',
    savingSaleBtn: 'सेव्ह होत आहे...',
    saleSuccessTitle: 'Sale ho gayi!',
    saleApprovalTitle: 'मंजुरीसाठी पाठवले!',
    viewSalesBtn: 'विक्री पहा',
    checkFormTitle: 'तपासून पहा',
    checkFormMsg: 'कृपया दुकान, प्रॉडक्ट आणि पॅकेट तपासा.',
    lowStockTitle: 'स्टॉक कमी आहे',
    lowStockMsg: 'उपलब्ध स्टॉकपेक्षा जास्त पॅकेट्स निवडले आहेत.',
    cartLimitTitle: 'किमान १ प्रॉडक्ट',
    cartLimitMsg: 'बिलात किमान एक प्रॉडक्ट असणे आवश्यक आहे.',
    errorTitle: 'विक्री सेव्ह झाली नाही',
    genericSaveError: 'बिल सेव्ह होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',
    networkSaveError: 'इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.',
    selectShopError: 'कृपया आधी दुकान निवडा.',
    selectProductError: 'कृपया प्रॉडक्ट निवडा.',
    qtyError: 'किमान १ पॅकेट टाका.',
    priceError: 'योग्य दर टाका.',
  },
};

function formatRupeeDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return Number.isInteger(amount)
    ? amount.toLocaleString('en-IN')
    : amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toFriendlySaveError(err: any, copy: POSCopy): string {
  const raw = String(err?.message || '').toLowerCase();
  if (!raw || raw.includes('internal server') || raw.includes('prisma') || raw.includes('sql')) {
    return copy.genericSaveError;
  }
  if (raw.includes('network') || raw.includes('timeout') || raw.includes('fetch')) {
    return copy.networkSaveError;
  }
  if (raw.includes('insufficient') || raw.includes('stock')) {
    return copy.lowStockMsg;
  }
  if (raw.includes('shift')) {
    return copy.shiftInactive;
  }
  // If backend already gave a short readable validation sentence, keep it concise
  if (err?.message && String(err.message).length <= 90 && !String(err.message).includes('{')) {
    return String(err.message);
  }
  return copy.genericSaveError;
}

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useResponsiveLayout();
  const isCompactScreen = width < 400;
  const params = useLocalSearchParams<{ customerId?: string; customerName?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  const [lang, setLang] = useState<POSLanguage>('hi');
  const t = POS_TRANSLATIONS[lang];

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
        errorsMap[prodId] =
          lang === 'hi'
            ? `Sirf ${avail} packets available hain (${reqQty} dale hain).`
            : lang === 'mr'
              ? `फक्त ${avail} पॅकेट्स शिल्लक आहेत (${reqQty} टाकले आहेत).`
              : `Only ${avail} packets available (${reqQty} entered).`;
      }
    }
    return errorsMap;
  }, [cartItems, stockMap, lang]);

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
      Alert.alert(t.cartLimitTitle, t.cartLimitMsg);
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
    if (!selectedCustomerId) errs.customer = t.selectShopError;

    const validLines = cartItems.filter((i) => i.productId && i.quantity > 0);
    if (validLines.length === 0) {
      errs.cart = t.qtyError;
    }

    cartItems.forEach((item, idx) => {
      if (!item.productId) {
        errs[`line_${idx}_product`] = t.selectProductError;
      }
      if (item.quantity <= 0) {
        errs[`line_${idx}_qty`] = t.qtyError;
      }
      if (item.unitPriceRupees <= 0) {
        errs[`line_${idx}_price`] = t.priceError;
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleConfirmSale() {
    if (isSubmitting) return;

    if (!validate()) {
      Alert.alert(t.checkFormTitle, t.checkFormMsg);
      return;
    }

    if (hasStockError) {
      Alert.alert(t.lowStockTitle, t.lowStockMsg);
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
        isPendingApproval ? t.saleApprovalTitle : t.saleSuccessTitle,
        isPendingApproval
          ? lang === 'hi'
            ? `Bill ${billNo}kam rate par hai. Admin approval ke liye bhej diya hai.`
            : lang === 'mr'
              ? `बिल ${billNo}कमी दरावर आहे. ॲडमिन मंजुरीसाठी पाठवले आहे.`
              : `Bill ${billNo}has a special price and was sent for approval.`
          : lang === 'hi'
            ? `Bill ${billNo}save ho gaya! Total: ₹${totalFormatted} (${totalPackets} packets).`
            : lang === 'mr'
              ? `बिल ${billNo}सेव्ह झाले! एकूण: ₹${totalFormatted} (${totalPackets} पॅकेट्स).`
              : `Bill ${billNo}saved. Total: ₹${totalFormatted} (${totalPackets} packets).`,
        [
          {
            text: t.viewSalesBtn,
            onPress: () => router.replace(salesTargetRoute as any),
          },
        ]
      );
    } catch (err: any) {
      const friendlyMsg = toFriendlySaveError(err, t);
      setFeedback({
        type: 'error',
        title: t.errorTitle,
        message: friendlyMsg,
      });
      Alert.alert(t.errorTitle, friendlyMsg);
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
        badge: t.assignedBadge,
        badgeVariant: 'ACTIVE',
        icon: 'storefront-outline',
        metadata: `${c.phone || ''} ${c.address || ''} ${c.pincode || ''} ${c.district || ''} ${c.village || ''}`,
      };
    });
  }, [customers, t.assignedBadge]);

  const productDropdownOptions = useMemo<DropdownOption[]>(() => {
    return products.map((p) => {
      const stock = stockMap[p.id] ?? 0;
      const priceRupees = (p.basePricePaise || 0) / 100;
      return {
        id: p.id,
        title: p.name,
        subtitle: `${t.availableLabel}: ${stock} ${t.packetsUnit} · ₹${formatRupeeDisplay(priceRupees)}`,
        badge: stock > 0 ? `${stock} pkts` : '0 pkts',
        badgeVariant: stock > 0 ? 'success' : 'neutral',
        icon: 'cube-outline',
        metadata: `${p.name}`,
      };
    });
  }, [products, stockMap, t.availableLabel, t.packetsUnit]);

  const handleOpenShift = useCallback(() => {
    router.push('/(seller)/shift' as any);
  }, [router]);

  const paymentOptions = useMemo(
    () => [
      {
        value: 'CASH' as PaymentMode,
        title: t.cashTitle,
        subtitle: t.cashSub,
        icon: 'cash-outline' as const,
      },
      {
        value: 'BANK' as PaymentMode,
        title: t.upiTitle,
        subtitle: t.upiSub,
        icon: 'qr-code-outline' as const,
      },
      {
        value: 'PENDING' as PaymentMode,
        title: t.udhaarTitle,
        subtitle: t.udhaarSub,
        icon: 'time-outline' as const,
      },
    ],
    [t]
  );

  if (loading) {
    return <LoadingState message={t.loadingText} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <Header
        title={t.headerTitle}
        subtitle={t.headerSubtitle}
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
          {/* Language Selector (Hinglish default / English / Marathi) */}
          <View style={styles.langRow}>
            {(
              [
                { code: 'hi', label: 'Hinglish' },
                { code: 'en', label: 'English' },
                { code: 'mr', label: 'मराठी' },
              ] as const
            ).map((opt) => {
              const active = lang === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => setLang(opt.code)}
                  style={[styles.langPill, active && styles.langPillActive]}
                  hitSlop={HitSlop.sm}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.langPillText, active && styles.langPillTextActive]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Shift Status Strip */}
          {hasActiveShift ? (
            <View style={[styles.shiftStrip, styles.shiftStripActive]}>
              <Ionicons name="checkmark-circle" size={18} color="#15803D" />
              <Text style={styles.shiftTextActive} numberOfLines={1}>
                {t.shiftActive}
              </Text>
            </View>
          ) : (
            <View style={[styles.shiftStrip, styles.shiftStripInactive]}>
              <View style={styles.shiftInactiveLeft}>
                <Ionicons name="alert-circle" size={18} color="#9F1239" />
                <Text style={styles.shiftTextInactive} numberOfLines={2}>
                  {t.shiftInactive}
                </Text>
              </View>
              <Pressable
                onPress={handleOpenShift}
                style={styles.startDutyBtn}
                hitSlop={HitSlop.sm}
                accessibilityRole="button"
              >
                <Text style={styles.startDutyBtnText} numberOfLines={1}>
                  {t.startDutyBtn}
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
              <Text style={styles.draftRestoredText}>{t.restoredBill}</Text>
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
              <Text style={styles.sectionTitle}>{t.shopHeading}</Text>
              {selectedCustomer && (
                <Pressable
                  onPress={() => setCustomerPickerOpen(true)}
                  hitSlop={HitSlop.md}
                  style={styles.changePillBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="swap-horizontal" size={14} color={BrandColors.pink.primary} />
                  <Text style={styles.changePillText} numberOfLines={1}>
                    {t.changeShop}
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
                accessibilityLabel={`${selectedCustomer.shopName}. ${t.changeShop}`}
              >
                <View style={styles.shopIconBox}>
                  <Ionicons name="storefront" size={22} color={BrandColors.pink.primary} />
                </View>
                <View style={styles.shopDetailsCol}>
                  <View style={styles.shopTopRow}>
                    <Text style={styles.shopNameText} numberOfLines={1}>
                      {selectedCustomer.shopName}
                    </Text>
                    <Badge label={t.assignedBadge} variant="ACTIVE" size="sm" />
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
                  <Text style={styles.noShopText}>{t.noShopSelected}</Text>
                </View>
                <Button
                  title={t.selectShopBtn}
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
              <Text style={styles.sectionTitle}>{t.productHeading}</Text>
              <Button
                title={t.addProductBtn}
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
                    <Text style={styles.itemNumberText}>
                      {t.productItemLabel} #{index + 1}
                    </Text>
                    {cartItems.length > 1 && (
                      <Pressable
                        onPress={() => handleRemoveLineItem(item.key)}
                        hitSlop={HitSlop.md}
                        style={styles.removeBtn}
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.light.danger} />
                        <Text style={styles.removeBtnText}>{t.removeBtn}</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Product Selector Trigger */}
                  <TouchableOpacity
                    style={styles.productTrigger}
                    onPress={() => setActiveProductPickerItemKey(item.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={prod ? prod.name : t.chooseProductPlaceholder}
                  >
                    <View style={styles.productTriggerIcon}>
                      <Ionicons name="cube" size={20} color={BrandColors.pink.primary} />
                    </View>
                    <View style={styles.productTriggerTextCol}>
                      <Text style={styles.productTitleText} numberOfLines={2}>
                        {prod ? prod.name : t.chooseProductPlaceholder}
                      </Text>
                      <Text
                        style={[
                          styles.productStockText,
                          isExceedingStock && { color: Colors.light.danger },
                        ]}
                        numberOfLines={1}
                      >
                        {t.availableLabel}: {availStock.toLocaleString('en-IN')} {t.packetsUnit}
                      </Text>
                    </View>
                    <View style={styles.selectPill}>
                      <Text style={styles.selectPillText}>{t.selectBtn}</Text>
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
                      <Text style={styles.controlLabel}>{t.packetsLabel}</Text>
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
                      <Text style={styles.controlLabel}>{t.pricePerPacketLabel}</Text>
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
                    <Text style={styles.lineAmountLabel}>{t.amountLabel}</Text>
                    <Text style={styles.lineAmountValue}>₹{formatRupeeDisplay(lineTotal)}</Text>
                  </View>

                  {/* Low Price Notice */}
                  {isBelowFloor && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning-outline" size={16} color="#D97706" />
                      <Text style={styles.warningText}>
                        {lang === 'hi'
                          ? `Minimum ₹${formatRupeeDisplay(minPricePaise / 100)} se kam price hai. Admin approval lagega.`
                          : lang === 'mr'
                            ? `किमान ₹${formatRupeeDisplay(minPricePaise / 100)} पेक्षा कमी दर आहे. ॲडमिन मंजुरी लागेल.`
                            : `Below minimum price ₹${formatRupeeDisplay(minPricePaise / 100)}. Needs Admin approval.`}
                      </Text>
                    </View>
                  )}

                  {/* Stock Exceeded Error */}
                  {isExceedingStock && (
                    <Text style={styles.errorText}>
                      {stockErrors[item.productId] ||
                        `${t.availableLabel}: ${availStock} ${t.packetsUnit}`}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>

          {/* TOTAL BILL SUMMARY */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t.totalBillHeading}</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t.totalPacketsLabel}</Text>
              <Text style={styles.summaryPacketsValue}>
                {totalPackets.toLocaleString('en-IN')} {t.packetsUnit}
              </Text>
            </View>

            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryAmountLabel}>{t.totalAmountLabel}</Text>
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
                {hasLowPriceWarning ? t.stockApprovalNote : t.stockConfirmNote}
              </Text>
            </View>
          </Card>

          {/* 3. PAYMENT */}
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>
              {t.paymentHeading}
            </Text>

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
                <Text style={styles.controlLabel}>{t.upiRefLabel}</Text>
                <TextInput
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  placeholder={t.upiRefPlaceholder}
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
              label={t.messageHeading}
              sublabel={t.messageSublabel}
              placeholder={t.messagePlaceholder}
              micLabel={t.micLabel}
              quickChipsHeading={t.quickChipsHeading}
              quickChips={t.quickChips}
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
                ? t.savingSaleBtn
                : `${t.saveSaleBtn} • ₹${formatRupeeDisplay(grandTotalRupees)}`
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
        title={t.shopModalTitle}
        searchPlaceholder={t.shopSearchPlaceholder}
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
        emptyMessage={t.shopEmptyMessage}
      />

      {/* Searchable Product Picker Modal */}
      <SearchableDropdownModal
        visible={Boolean(activeProductPickerItemKey)}
        title={t.productModalTitle}
        searchPlaceholder={t.productSearchPlaceholder}
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
        emptyMessage={t.productEmptyMessage}
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
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  langPillActive: {
    backgroundColor: BrandColors.pink.tint,
    borderColor: BrandColors.pink.primary,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  langPillTextActive: {
    color: BrandColors.pink.dark,
    fontWeight: '800',
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
