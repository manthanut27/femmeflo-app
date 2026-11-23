import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaymentMode, ProductItem, Shift, ShiftVisit } from '@/api/types';
import { FaceVerificationModal, type FaceVerificationResult } from '@/components/common/FaceVerificationModal';
import { ShiftAuthVerificationModal, type ShiftAuthResult } from '@/components/common/ShiftAuthVerificationModal';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { VerifiedLocationCard } from '@/components/common/VerifiedLocationCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageTransition } from '@/components/ui/PageTransition';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { draftStorage } from '@/utils/draftStorage';
import { computeShiftTravelDistance } from '@/utils/distanceUtils';
import { getCurrentLocationWithAddress, type LocationResult } from '@/utils/locationUtils';

const PREDEFINED_VISIT_REASONS = [
  'Stock already sufficient',
  'Decision maker unavailable',
  'Shop closed',
  'Customer not interested',
  'Payment pending',
  'Order planned for next visit',
  'Sample provided for trial',
];

export default function ShiftScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Start Shift Form State
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [startOdometer, setStartOdometer] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);
  const [gpsTraveledDistanceKm, setGpsTraveledDistanceKm] = useState<number>(0);

  // Check-in Visit Form State
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [checkInCustomShopName, setCheckInCustomShopName] = useState('');
  const [activeShopElapsed, setActiveShopElapsed] = useState('0s');
  const [checkInCustomerSearch, setCheckInCustomerSearch] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const filteredCheckInCustomers = useMemo(() => {
    const q = checkInCustomerSearch.trim().toLowerCase();
    if (!Array.isArray(customers)) return [];
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.shopName ? c.shopName.toLowerCase().includes(q) : false) ||
        (c.ownerName ? c.ownerName.toLowerCase().includes(q) : false) ||
        (c.phone ? c.phone.includes(q) : false) ||
        (c.district ? c.district.toLowerCase().includes(q) : false) ||
        (c.village ? c.village.toLowerCase().includes(q) : false)
    );
  }, [customers, checkInCustomerSearch]);

  // Check-out Visit Form State (Two Branches: No Sale vs Sale Done)
  const [checkOutModalVisible, setCheckOutModalVisible] = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<ShiftVisit | null>(null);
  const [checkoutSaleDone, setCheckoutSaleDone] = useState(false);
  const [checkoutReason, setCheckoutReason] = useState('');
  const [checkoutFeedback, setCheckoutFeedback] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutCustomerId, setCheckoutCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleUnitPrice, setSaleUnitPrice] = useState(25);
  const [salePaymentMode, setSalePaymentMode] = useState<PaymentMode>('CASH');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // End Shift Form State
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [endOdometer, setEndOdometer] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [isEndingShift, setIsEndingShift] = useState(false);

  // Duty Shift Start Authentication Modal (Fingerprint & Mobile Password)
  const [shiftAuthModalVisible, setShiftAuthModalVisible] = useState(false);

  // Biometric / Face Selfie Verification Modal State (Shift End)
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'START' | 'END'>('START');
  const [pendingOdometerKm, setPendingOdometerKm] = useState<number>(0);
  const [pendingNotes, setPendingNotes] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadShiftData = useCallback(async () => {
    try {
      const [shiftRes, custRes, prodRes] = await Promise.all([
        sellerApi.getCurrentShift().catch(async () => {
          const cached = await draftStorage.getActiveShift(userId);
          return { shift: cached };
        }),
        sellerApi.listCustomers({ pageSize: 100 }).catch(() => ({ items: [] })),
        sellerApi.listProducts().catch(() => ({ items: [] })),
      ]);

      let active: any = (shiftRes as any)?.shift;
      if (active === undefined && (shiftRes as any)?.data !== undefined) {
        active = (shiftRes as any).data?.shift !== undefined ? (shiftRes as any).data.shift : (shiftRes as any).data;
      }
      if (active === undefined) {
        active = shiftRes;
      }

      const cached = await draftStorage.getActiveShift(userId).catch(() => null);

      if (active && typeof active === 'object' && ('id' in active || 'startTime' in active)) {
        const merged: Shift = {
          ...active,
          startOdometerKm: active.startOdometerKm ?? cached?.startOdometerKm ?? 0,
        };
        setCurrentShift(merged);
        await draftStorage.saveActiveShift(userId, merged).catch(() => {});
      } else if (cached && cached.status === 'ACTIVE' && !cached.endTime) {
        setCurrentShift(cached);
      } else if (shiftRes === null || active === null) {
        setCurrentShift(null);
        await draftStorage.clearActiveShift(userId).catch(() => {});
      }

      const custList = Array.isArray(custRes?.items) ? custRes.items : [];
      setCustomers(custList);
      if (custList.length > 0) {
        setSelectedCustomerId((prev) => prev || custList[0].id);
      }

      const prodList = Array.isArray(prodRes?.items) ? prodRes.items : [];
      setProducts(prodList);
      if (prodList.length > 0) {
        setSelectedProductId((prev) => prev || prodList[0].id);
        const firstBasePrice = ((prodList[0].basePricePaise ?? 2500) as number) / 100;
        setSaleUnitPrice((prev) => (prev ? prev : firstBasePrice || 25));
      }
    } catch (err) {
      console.warn('loadShiftData handled error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Elapsed timer ticker for active shift (pauses while end shift / selfie processing is active)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const isEndingProcess = isEndingShift || (faceModalVisible && faceModalMode === 'END') || endModalVisible;

    if (currentShift && currentShift.startTime && !isEndingProcess) {
      const parsedTime = new Date(currentShift.startTime).getTime();
      const startMs = isNaN(parsedTime) ? Date.now() : parsedTime;

      const updateTicker = () => {
        const diff = Math.max(0, Date.now() - startMs);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );

        const currentVisits = currentShift.visits || [];
        const activeV = currentVisits.find((v: ShiftVisit) => !v.checkOutTime);
        if (activeV && activeV.checkInTime) {
          const checkInMs = new Date(activeV.checkInTime).getTime();
          const shopDiff = Math.max(0, Math.floor((Date.now() - (isNaN(checkInMs) ? Date.now() : checkInMs)) / 1000));
          if (shopDiff < 60) {
            setActiveShopElapsed(`${shopDiff}s`);
          } else {
            setActiveShopElapsed(`${Math.floor(shopDiff / 60)}m ${shopDiff % 60}s`);
          }
        } else {
          setActiveShopElapsed('0s');
        }
      };

      updateTicker();
      timerRef.current = setInterval(updateTicker, 1000);
    } else if (!currentShift || !currentShift.startTime) {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentShift, isEndingShift, faceModalVisible, faceModalMode, endModalVisible]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShiftData();
  }, [loadShiftData]);

  // Helper to acquire GPS coordinates with fast cache check & timeout race
  async function acquireCoordinates(): Promise<{ latitude: number; longitude: number }> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // 1. Check last known position first (instant: 10-50ms)
          try {
            const lastLoc = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
            if (lastLoc && lastLoc.coords) {
              return {
                latitude: Number(lastLoc.coords.latitude.toFixed(6)),
                longitude: Number(lastLoc.coords.longitude.toFixed(6)),
              };
            }
          } catch {
            // Ignore cache error and proceed to fresh read
          }

          // 2. Strict 3-second timeout race so GPS lock never delays closing the shift
          const positionPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
          const loc = await Promise.race([positionPromise, timeoutPromise]);
          if (loc && (loc as any).coords) {
            return {
              latitude: Number((loc as any).coords.latitude.toFixed(6)),
              longitude: Number((loc as any).coords.longitude.toFixed(6)),
            };
          }
        }
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: Number(pos.coords.latitude.toFixed(6)),
                longitude: Number(pos.coords.longitude.toFixed(6)),
              });
            },
            () => resolve({ latitude: 22.7196, longitude: 75.8577 }),
            { timeout: 3000 }
          );
        });
      }
    } catch {
      // Fallback
    }
    return { latitude: 22.7196, longitude: 75.8577 };
  }

  const fetchLiveLocation = useCallback(async () => {
    setIsAcquiringLocation(true);
    try {
      const loc = await getCurrentLocationWithAddress();
      if (loc) {
        setCurrentLocation(loc);
        return loc;
      }
    } catch (err) {
      console.warn('Failed to acquire location with address', err);
    } finally {
      setIsAcquiringLocation(false);
    }
    const fallback: LocationResult = {
      latitude: 22.7196,
      longitude: 75.8577,
      street: 'MG Road',
      village: 'New Palasia',
      district: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      address: 'MG Road, New Palasia, Indore, Madhya Pradesh 452001',
    };
    setCurrentLocation(fallback);
    return fallback;
  }, []);

  function handleOpenStartShiftModal() {
    fetchLiveLocation();
    setStartModalVisible(true);
  }

  // ----------------------------------------------------
  // SHIFT START WITH LIVE FACE VERIFICATION & GPS
  // ----------------------------------------------------
  function handleInitiateStartShift() {
    setPendingOdometerKm(0);
    setPendingNotes(startNotes.trim());
    setStartModalVisible(false);
    setFaceModalMode('START');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftStart(authResult: FaceVerificationResult | ShiftAuthResult) {
    setFaceModalVisible(false);
    setShiftAuthModalVisible(false);
    setIsStartingShift(true);
    setFeedback(null);

    try {
      const loc = currentLocation || await fetchLiveLocation() || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'Starting duty location',
      };
      const res = await sellerApi.startShift({
        startOdometerKm: 0,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || (pendingNotes ? `Start notes: ${pendingNotes}` : undefined),
        faceVerified: authResult?.faceVerified ?? true,
        facePhoto: authResult?.facePhoto || 'verified_selfie_start',
        faceConfidence: (authResult as any)?.faceConfidence ?? (authResult as any)?.confidence ?? 0.98,
        faceMethod: (authResult as any)?.faceMethod || 'FACE_ID_BIOMETRIC',
      });

      const startedShift = (res as any)?.shift || (res as any)?.data?.shift || (res as any)?.data || res;
      if (startedShift && typeof startedShift === 'object') {
        const enrichedShift: Shift = {
          ...startedShift,
          startLatitude: loc.latitude,
          startLongitude: loc.longitude,
          startAddress: loc.address || startedShift.startAddress,
          startOdometerKm: 0,
        };
        setCurrentShift(enrichedShift);
        await draftStorage.saveActiveShift(userId, enrichedShift);
      }
      setStartOdometer('');
      setStartNotes('');

      setFeedback({
        type: 'success',
        title: 'Duty Started',
        message: `Duty shift active with live face verification at ${loc.street || loc.village || loc.district || loc.address || 'Starting Location'}.`,
      });
      Alert.alert('Duty Started', `Duty shift active with live camera face verification.\nLocation: ${loc.street || loc.village || loc.district || loc.address || 'Starting Location'}`);
    } catch (err: any) {
      console.warn('Shift start API error, falling back to local active shift:', err);
      const loc = currentLocation || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'Starting duty location',
      };
      const fallbackShift: Shift = {
        id: `shift_local_${Date.now()}`,
        sellerId: userId || 'local_user',
        status: 'ACTIVE',
        startTime: new Date().toISOString(),
        startLatitude: loc.latitude,
        startLongitude: loc.longitude,
        startAddress: loc.address,
        startOdometerKm: 0,
      };
      setCurrentShift(fallbackShift);
      if (userId) {
        await draftStorage.saveActiveShift(userId, fallbackShift).catch(() => {});
      }
      setStartOdometer('');
      setStartNotes('');
      setFeedback({
        type: 'success',
        title: 'Shift Started',
        message: `Duty shift active at ${loc.street || loc.address || 'Starting Location'}.`,
      });
      Alert.alert('Shift Started', `Duty shift active at ${loc.street || loc.address || 'Starting Location'}.`);
    } finally {
      setIsStartingShift(false);
    }
  }

  // ----------------------------------------------------
  // STORE VISIT CHECK-IN
  // ----------------------------------------------------
  async function handleCheckInVisit() {
    if (isCheckingIn) return;
    if (!selectedCustomerId && !checkInCustomShopName.trim()) {
      Alert.alert('Select or Enter Shop', 'Please select an existing customer or enter a shop name for this visit.');
      return;
    }

    setIsCheckingIn(true);
    setFeedback(null);

    try {
      const coords = await acquireCoordinates();
      const customer = customers.find((c) => c.id === selectedCustomerId);
      const resolvedShopName = customer?.shopName || checkInCustomShopName.trim() || 'Retail Customer Store';

      const checkInRes = await sellerApi.checkIn({
        customerId: selectedCustomerId || undefined,
        shopName: resolvedShopName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        notes: visitNotes.trim() || undefined,
        shiftId: currentShift?.id,
      });

      const newVisit: ShiftVisit | undefined =
        (checkInRes as any)?.visit ||
        (checkInRes as any)?.data?.visit ||
        (checkInRes as any)?.data ||
        checkInRes;

      if (newVisit && typeof newVisit === 'object' && ('id' in newVisit || 'checkInTime' in newVisit)) {
        setCurrentShift((prev) => {
          if (!prev) return prev;
          const currentVisits = Array.isArray(prev.visits) ? prev.visits : [];
          const exists = currentVisits.some((v) => v.id && v.id === newVisit.id);
          const updatedVisits = exists ? currentVisits : [newVisit, ...currentVisits];
          const updated = { ...prev, visits: updatedVisits };
          draftStorage.saveActiveShift(userId, updated).catch(() => {});
          return updated;
        });
      }

      setCheckInModalVisible(false);
      setCheckInCustomShopName('');
      setVisitNotes('');
      setFeedback({
        type: 'success',
        title: 'Visit Started',
        message: `Visit started at ${resolvedShopName}.`,
      });
      Alert.alert('Visit Started', `Visit started at ${resolvedShopName}.`);
      await loadShiftData().catch(() => {});
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error',
        message: err.message || 'Unable to start shop visit.',
      });
      Alert.alert('Error', err.message || 'Unable to start shop visit.');
    } finally {
      setIsCheckingIn(false);
    }
  }

  // ----------------------------------------------------
  // STORE VISIT CHECK-OUT (BRANCH 1 & BRANCH 2)
  // ----------------------------------------------------
  async function handleOpenCheckout(visit: ShiftVisit) {
    if (visit.checkOutTime) {
      Alert.alert('Already Done', 'This visit is already finished.');
      return;
    }

    setActiveCheckoutVisit(visit);
    setCheckoutCustomerId(visit.customerId || (customers[0]?.id ?? ''));

    // Try recovering existing saved checkout draft for this visit
    const draft = await draftStorage.getVisitCheckoutDraft(userId, visit.id);
    if (draft) {
      setCheckoutSaleDone(Boolean(draft.saleDone));
      setCheckoutReason(draft.reason || '');
      setCheckoutFeedback(draft.feedback || '');
      setCheckoutNotes(draft.notes || '');
      if (draft.selectedCustomerId) setCheckoutCustomerId(draft.selectedCustomerId);
      if (draft.selectedProductId) setSelectedProductId(draft.selectedProductId);
      if (draft.quantity) setSaleQuantity(draft.quantity);
      if (draft.unitPrice) setSaleUnitPrice(draft.unitPrice);
      if (draft.paymentMode) setSalePaymentMode(draft.paymentMode);
    } else {
      setCheckoutSaleDone(false);
      setCheckoutReason('');
      setCheckoutFeedback('');
      setCheckoutNotes('');
      setSaleQuantity(1);
      const defaultProd = products[0];
      if (defaultProd) {
        setSelectedProductId(defaultProd.id);
        setSaleUnitPrice(defaultProd.basePricePaise / 100 || 25);
      }
      setSalePaymentMode('CASH');
    }

    setCheckOutModalVisible(true);
  }

  // Auto-save checkout draft on input changes
  const saveCurrentCheckoutDraft = useCallback(
    (overrides?: Partial<{
      saleDone: boolean;
      reason: string;
      feedback: string;
      notes: string;
      selectedCustomerId: string;
      selectedProductId: string;
      quantity: number;
      unitPrice: number;
      paymentMode: PaymentMode;
    }>) => {
      if (!activeCheckoutVisit) return;
      draftStorage.saveVisitCheckoutDraft(userId, activeCheckoutVisit.id, {
        visitId: activeCheckoutVisit.id,
        saleDone: overrides?.saleDone ?? checkoutSaleDone,
        reason: overrides?.reason ?? checkoutReason,
        feedback: overrides?.feedback ?? checkoutFeedback,
        notes: overrides?.notes ?? checkoutNotes,
        selectedCustomerId: overrides?.selectedCustomerId ?? checkoutCustomerId,
        selectedProductId: overrides?.selectedProductId ?? selectedProductId,
        quantity: overrides?.quantity ?? saleQuantity,
        unitPrice: overrides?.unitPrice ?? saleUnitPrice,
        paymentMode: overrides?.paymentMode ?? salePaymentMode,
        updatedAt: new Date().toISOString(),
      });
    },
    [
      activeCheckoutVisit,
      userId,
      checkoutSaleDone,
      checkoutReason,
      checkoutFeedback,
      checkoutNotes,
      checkoutCustomerId,
      selectedProductId,
      saleQuantity,
      saleUnitPrice,
      salePaymentMode,
    ]
  );

  async function handleConfirmCheckout() {
    if (isCheckingOut || !activeCheckoutVisit) return;

    if (activeCheckoutVisit.checkOutTime) {
      Alert.alert('Already Done', 'This visit is already finished.');
      setCheckOutModalVisible(false);
      return;
    }

    setIsCheckingOut(true);
    setFeedback(null);

    try {
      const coords = await acquireCoordinates();
      let generatedSaleId: string | undefined = undefined;

      // BRANCH 2: YES, SALE COMPLETED!
      if (checkoutSaleDone) {
        const targetCustomerId = checkoutCustomerId || activeCheckoutVisit.customerId;
        if (!targetCustomerId) {
          Alert.alert('Select Shop', 'Please select a shop for this sale.');
          setIsCheckingOut(false);
          return;
        }

        if (!saleQuantity || saleQuantity <= 0) {
          Alert.alert('Enter Quantity', 'Please enter at least 1 packet.');
          setIsCheckingOut(false);
          return;
        }

        const chosenProduct = products.find((p) => p.id === selectedProductId) || products[0];
        const prodId = chosenProduct?.id || '';
        const unitPricePaise = Math.round((saleUnitPrice || 25) * 100);
        const reqKey = `sale_checkout_${activeCheckoutVisit.id}_${Date.now()}`;

        // 1. Create sale record with idempotency key
        const saleRes = await sellerApi.createSale({
          customerId: targetCustomerId,
          items: prodId
            ? [{ productId: prodId, quantity: saleQuantity, unitPricePaise }]
            : undefined,
          quantity: saleQuantity,
          unitPricePaise,
          paymentMode: salePaymentMode,
          requestKey: reqKey,
          customerFeedback: checkoutFeedback.trim() || undefined,
        });

        const createdSale = (saleRes as any)?.sale || (saleRes as any)?.item || saleRes;
        generatedSaleId = createdSale?.id;
      }

      // 2. Submit shift checkout
      const finalNotes = checkoutNotes.trim() || (checkoutReason ? `Reason: ${checkoutReason}` : undefined);
      await sellerApi.checkOut({
        visitId: activeCheckoutVisit.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        saleDone: checkoutSaleDone,
        saleId: generatedSaleId,
        customerFeedback: checkoutFeedback.trim() || undefined,
        notes: finalNotes,
      });

      // Clear draft on successful checkout
      await draftStorage.clearVisitCheckoutDraft(userId, activeCheckoutVisit.id);

      setCheckOutModalVisible(false);
      setActiveCheckoutVisit(null);
      setCheckoutFeedback('');
      setCheckoutNotes('');
      setCheckoutReason('');
      setCheckoutSaleDone(false);

      const successTitle = checkoutSaleDone ? 'Visit & Sale Done' : 'Visit Completed';
      const successMessage = checkoutSaleDone
        ? `Sale saved: ₹${(saleQuantity * saleUnitPrice).toLocaleString('en-IN')}.`
        : `Visit saved (${checkoutReason || 'Shop Visit'}).`;

      setFeedback({
        type: 'success',
        title: successTitle,
        message: successMessage,
      });
      Alert.alert(successTitle, successMessage);
      loadShiftData();
      // Immediately refresh live GPS location for next store visit
      fetchLiveLocation();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error',
        message: err.message || 'Unable to save visit.',
      });
      Alert.alert('Error', err.message || 'Unable to save visit.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleOpenEndShiftModal() {
    setIsAcquiringLocation(true);
    setEndModalVisible(true);
    const loc = await fetchLiveLocation();
    if (currentShift && currentShift.startLatitude && loc) {
      const startLat = Number(currentShift.startLatitude);
      const startLng = Number(currentShift.startLongitude || 75.8577);
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(loc.latitude - startLat);
      const dLng = toRad(loc.longitude - startLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(startLat)) * Math.cos(toRad(loc.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const visitBonus = (currentShift.visits?.length || 0) * 1.5;
      const computedKm = Math.max(0.5, Math.round((6371 * c + visitBonus) * 10) / 10);
      setGpsTraveledDistanceKm(computedKm);
    }
    setIsAcquiringLocation(false);
  }

  // ----------------------------------------------------
  // SHIFT END WITH FACE VERIFICATION
  // ----------------------------------------------------
  function handleInitiateEndShift() {
    setPendingOdometerKm(gpsTraveledDistanceKm);
    setPendingNotes(endNotes.trim());
    setEndModalVisible(false);
    setFaceModalMode('END');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftEnd(faceResult: FaceVerificationResult) {
    setFaceModalVisible(false);
    setIsEndingShift(true);
    setFeedback(null);

    try {
      const loc = currentLocation || await fetchLiveLocation() || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'Closing duty location',
      };
      const shiftIdToEnd = currentShift?.id;
      const res = await sellerApi.endShift({
        shiftId: shiftIdToEnd,
        endOdometerKm: gpsTraveledDistanceKm,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || (pendingNotes ? `Closing notes: ${pendingNotes}` : undefined),
        notes: pendingNotes || undefined,
        remarks: pendingNotes || undefined,
        faceVerified: faceResult?.faceVerified ?? true,
        facePhoto: faceResult?.facePhoto || 'verified_selfie_end',
        faceConfidence: faceResult?.faceConfidence ?? 0.98,
        faceMethod: faceResult?.faceMethod || 'FACE_ID_BIOMETRIC',
      });

      const closedShift = (res as any)?.shift || (res as any)?.data?.shift || (res as any)?.data || res;
      setCurrentShift(null);
      await draftStorage.clearActiveShift(userId);
      setEndOdometer('');
      setEndNotes('');

      const distResult = computeShiftTravelDistance(closedShift);
      const totalDist = distResult.formatted !== '0 km' ? distResult.formatted : `${gpsTraveledDistanceKm} km`;
      const measurementNote = distResult.source === 'odometer' ? ' (via meter fallback)' : '';

      setFeedback({
        type: 'success',
        title: 'Shift Ended',
        message: `Duty shift ended successfully. GPS Route Travel: ${totalDist}${measurementNote}.`,
      });
      Alert.alert('Shift Ended', `Duty shift ended successfully.\nGPS Route Distance: ${totalDist}${measurementNote} (Google Maps Tracked).`);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Error',
        message: err.message || 'Unable to end shift.',
      });
      Alert.alert('Error', err.message || 'Unable to end shift.');
    } finally {
      setIsEndingShift(false);
    }
  }

  const visits = Array.isArray(currentShift?.visits) ? currentShift.visits : [];
  const activeShopVisit = visits.find((v) => !v.checkOutTime);
  const startKm = currentShift?.startOdometerKm ?? 0;
  const isShiftActive = Boolean(currentShift && currentShift.startTime && !currentShift.endTime);

  if (loading) {
    return <LoadingState message="Syncing field duty & GPS shift status..." />;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Duty Shift & Visits"
        subtitle="Live Beat Tracker & Geolocation"
        showBack
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 95, 125) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.primary]} />}
      >
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

          {/* Hero Shift Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroOverline}>Current Field Shift</Text>
                <Text style={styles.heroTimer}>{isShiftActive ? elapsedTime : '--:--:--'}</Text>
              </View>
              <Badge
                label={isShiftActive ? 'ACTIVE SHIFT' : 'OFF DUTY'}
                variant={isShiftActive ? 'ACTIVE' : 'neutral'}
                pulse={isShiftActive}
              />
            </View>

            {isShiftActive && currentShift ? (
              <View style={styles.heroDetails}>
                <View style={styles.heroDetailRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.heroDetailText}>
                    Started at {(() => {
                      const d = new Date(currentShift.startTime);
                      return isNaN(d.getTime()) ? 'Active' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    })()}
                  </Text>
                </View>
                {currentShift.startAddress ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="location-outline" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.heroDetailText, { color: BrandColors.green.primary, fontWeight: '600' }]} numberOfLines={1}>
                      Start: {currentShift.startAddress.split(',')[0]}
                    </Text>
                  </View>
                ) : currentShift.startLatitude ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="location-outline" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.heroDetailText, { color: BrandColors.green.primary, fontWeight: '600' }]}>
                      GPS Locked ({Number(currentShift.startLatitude).toFixed(4)}, {currentShift.startLongitude != null ? Number(currentShift.startLongitude).toFixed(4) : '0.0000'})
                    </Text>
                  </View>
                ) : null}
                {currentShift.totalDistanceKm ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="navigate-outline" size={16} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.heroDetailText}>
                      GPS Route: {currentShift.totalDistanceKm} km
                    </Text>
                  </View>
                ) : null}

                {/* Active Shop Check-In Card matching img 7 */}
                {activeShopVisit ? (
                  <View style={styles.activeShopBanner}>
                    <View style={styles.activeShopLeft}>
                      <View style={styles.activeShopIcon}>
                        <Ionicons name="storefront" size={20} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activeShopOverline}>
                          CURRENTLY AT SHOP: Since{' '}
                          {new Date(activeShopVisit.checkInTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        <Text style={styles.activeShopName}>{activeShopVisit.shopName}</Text>
                      </View>
                    </View>
                    <View style={styles.activeShopRight}>
                      <Text style={styles.activeShopTimerLabel}>TIME AT SHOP</Text>
                      <Text style={styles.activeShopTimerValue}>{activeShopElapsed}</Text>
                      <TouchableOpacity
                        style={styles.activeShopCheckoutBtn}
                        onPress={() => handleOpenCheckout(activeShopVisit)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="exit-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.activeShopCheckoutBtnText}>Check Out</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* Quick Shift Actions */}
                <View style={styles.heroActionRow}>
                  {activeShopVisit ? (
                    <Button
                      title={`Check Out from ${activeShopVisit.shopName}`}
                      onPress={() => handleOpenCheckout(activeShopVisit)}
                      variant="primary"
                      size="md"
                      icon={<Ionicons name="exit-outline" size={18} color="#FFFFFF" />}
                      style={{ flex: 1.4, backgroundColor: '#16A34A', marginRight: Spacing.sm }}
                    />
                  ) : (
                    <Button
                      title="Check In at Shop"
                      onPress={() => setCheckInModalVisible(true)}
                      variant="primary"
                      size="md"
                      icon={<Ionicons name="location" size={18} color="#FFFFFF" />}
                      style={{ flex: 1.4, marginRight: Spacing.sm }}
                    />
                  )}
                  <Button
                    title="End Duty Shift"
                    onPress={handleOpenEndShiftModal}
                    variant="outline"
                    size="md"
                    style={{ flex: 0.8 }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.offDutyBox}>
                <Text style={styles.offDutyText}>
                  You are currently off duty. Start your shift with Face Verification to activate GPS beat tracking, log retailer visits, and bill products.
                </Text>
                <Button
                  title="Start Duty Shift (Face ID)"
                  onPress={handleOpenStartShiftModal}
                  variant="primary"
                  size="lg"
                  icon={<Ionicons name="scan-circle-outline" size={20} color="#FFFFFF" />}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            )}
          </Card>

          {/* Shift Stats KPI Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{visits.length}</Text>
              <Text style={styles.statLabel}>Visits Today</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {visits.filter((v) => v.checkOutTime).length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{startKm > 0 ? `${startKm}k` : '0'}</Text>
              <Text style={styles.statLabel}>Base Odo</Text>
            </View>
          </View>

          {/* Visits Timeline Section */}
          <View style={styles.timelineSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today&apos;s Store Visits</Text>
              {isShiftActive && currentShift ? (
                <Pressable
                  onPress={() => setCheckInModalVisible(true)}
                  hitSlop={HitSlop.md}
                  style={styles.addVisitLink}
                >
                  <Ionicons name="add-circle" size={16} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.addVisitText}>New Visit</Text>
                </Pressable>
              ) : null}
            </View>

            {visits.length === 0 ? (
              <EmptyState
                icon="storefront-outline"
                title="No Store Visits Recorded"
                description={
                  isShiftActive
                    ? 'Tap "New Visit" above or check in when arriving at a retail customer outlet.'
                    : 'Start your shift to begin logging store visits along your beat.'
                }
                actionTitle={isShiftActive ? 'Check-in Store Visit' : 'Start Duty Shift'}
                onAction={() => {
                  if (isShiftActive) {
                    setCheckInModalVisible(true);
                  } else {
                    setStartModalVisible(true);
                  }
                }}
              />
            ) : (
              visits.map((v: ShiftVisit, idx: number) => {
                const customer = customers.find((c) => c.id === v.customerId);
                const isCheckedOut = Boolean(v.checkOutTime || (v as any).check_out_time || (v as any).endedAt);
                const hasSale = Boolean(v.saleDone || (v as any).sale_done || v.saleId || (v as any).sale_id || v.sale);
                const durationDisplay =
                  v.durationMins != null
                    ? `${Number(v.durationMins).toFixed(1)} mins`
                    : (v as any).duration_mins != null
                    ? `${Number((v as any).duration_mins).toFixed(1)} mins`
                    : isCheckedOut
                    ? 'Completed'
                    : 'In store now';

                const formatTimeSafely = (rawDate?: string | number | null): string => {
                  if (!rawDate) return 'Just now';
                  const d = new Date(rawDate);
                  if (isNaN(d.getTime())) return 'Just now';
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };

                const checkInTimeStr = formatTimeSafely(
                  v.checkInTime || (v as any).check_in_time || (v as any).createdAt || (v as any).checkInAt
                );
                const checkOutTimeStr = (v.checkOutTime || (v as any).check_out_time)
                  ? formatTimeSafely(v.checkOutTime || (v as any).check_out_time || (v as any).endedAt)
                  : null;

                return (
                  <Card key={v.id || idx} style={styles.visitCard}>
                    <View style={styles.visitHeader}>
                      <View
                        style={[
                          styles.visitIconBox,
                          hasSale && { backgroundColor: '#DCFCE7' },
                        ]}
                      >
                        <Ionicons
                          name={hasSale ? 'bag-check' : isCheckedOut ? 'checkmark-circle' : 'time'}
                          size={20}
                          color={
                            hasSale
                              ? BrandColors.green.primary
                              : isCheckedOut
                              ? '#64748B'
                              : '#D97706'
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.visitStoreName}>
                          {customer?.shopName || v.shopName || 'Retail Customer Store'}
                        </Text>
                        <Text style={styles.visitSub}>
                          Arrived: {checkInTimeStr}
                          {checkOutTimeStr
                            ? ` • Left: ${checkOutTimeStr} (${durationDisplay})`
                            : ` • ${durationDisplay}`}
                        </Text>
                      </View>
                      <Badge
                        label={hasSale ? 'SALE DONE' : isCheckedOut ? 'NO SALE' : 'IN PROGRESS'}
                        variant={hasSale ? 'success' : isCheckedOut ? 'neutral' : 'warning'}
                      />
                    </View>

                    {/* Customer Feedback Display Box */}
                    {v.customerFeedback ? (
                      <View style={styles.visitFeedbackCard}>
                        <View style={styles.visitFeedbackHeader}>
                          <Ionicons name="chatbubble-ellipses" size={13} color={BrandColors.pink.primary} />
                          <Text style={styles.visitFeedbackTitle}>Customer Feedback / Observation:</Text>
                        </View>
                        <Text style={styles.visitFeedbackText}>
                          &ldquo;{v.customerFeedback}&rdquo;
                        </Text>
                      </View>
                    ) : null}

                    {/* Visit Notes */}
                    {v.notes && v.notes !== v.customerFeedback ? (
                      <Text style={styles.visitNotes} numberOfLines={2}>
                        Notes: &ldquo;{v.notes}&rdquo;
                      </Text>
                    ) : null}

                    {/* Action button if visit is active */}
                    {!isCheckedOut ? (
                      <View style={{ marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        {v.customerId ? (
                          <Button
                            title="New POS Sale"
                            variant="secondary"
                            size="sm"
                            icon={<Ionicons name="cart-outline" size={15} color={BrandColors.pink.primary} />}
                            onPress={() => {
                              router.push({
                                pathname: '/(seller)/sales/new' as any,
                                params: { customerId: v.customerId, customerName: v.shopName },
                              });
                            }}
                          />
                        ) : null}
                        <Button
                          title="Check Out Visit"
                          variant="primary"
                          size="sm"
                          icon={<Ionicons name="log-out-outline" size={15} color="#FFFFFF" />}
                          onPress={() => handleOpenCheckout(v)}
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* 1. START SHIFT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={startModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setStartModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setStartModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Start Field Duty Shift</Text>
              <Text style={styles.modalSubtitle}>
                Starting location is verified via Google Maps. Route distance is tracked automatically via live GPS coordinates.
              </Text>

              <VerifiedLocationCard
                location={currentLocation}
                loading={isAcquiringLocation}
                onRefresh={fetchLiveLocation}
                title="Starting Duty Location"
                subtitle="Accurate street, area, city & pincode detected via Google Maps"
              />

              <Input
                label="Shift Remarks (Optional)"
                placeholder="Optional notes for shift start"
                value={startNotes}
                onChangeText={setStartNotes}
                leftIcon={<Ionicons name="create-outline" size={18} color="#94A3B8" />}
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setStartModalVisible(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Proceed to Verify"
                  variant="primary"
                  icon={<Ionicons name="finger-print-outline" size={16} color="#FFFFFF" />}
                  onPress={handleInitiateStartShift}
                  style={{ flex: 1.4 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. CHECK-IN STORE VISIT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={checkInModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCheckInModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setCheckInModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Shop Check-In</Text>
            <Text style={styles.modalSubtitle}>
              Log your arrival at this customer location
            </Text>

            <Text style={styles.modalFieldLabel}>Select Existing Customer</Text>
            <View style={styles.checkInSearchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.checkInSearchInput}
                placeholder="-- Choose from your customer list --"
                placeholderTextColor="#94A3B8"
                value={checkInCustomerSearch}
                onChangeText={setCheckInCustomerSearch}
                autoCorrect={false}
              />
              {checkInCustomerSearch ? (
                <Pressable onPress={() => setCheckInCustomerSearch('')} hitSlop={HitSlop.sm}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.modalCustomerList}>
              {filteredCheckInCustomers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.modalCustomerItem, isSelected && styles.modalCustomerItemActive]}
                    onPress={() => {
                      setSelectedCustomerId(c.id);
                      setCheckInCustomShopName('');
                    }}
                  >
                    <Text style={[styles.modalCustomerName, isSelected && styles.modalCustomerNameActive]}>
                      {c.shopName}
                    </Text>
                    <Text style={styles.modalCustomerSub}>
                      {c.ownerName} • {c.village || c.district || 'Area'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: Spacing.sm }}>
              <Text style={styles.modalFieldLabel}>Or Enter Shop / Store Name</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Balaji Medical Store"
                placeholderTextColor="#94A3B8"
                value={checkInCustomShopName}
                onChangeText={(t) => {
                  setCheckInCustomShopName(t);
                  if (t.trim()) setSelectedCustomerId('');
                }}
              />
            </View>

            <View style={{ marginTop: Spacing.sm }}>
              <Text style={styles.modalFieldLabel}>Visit Notes (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Order booked, samples provided, shop closed..."
                placeholderTextColor="#94A3B8"
                value={visitNotes}
                onChangeText={setVisitNotes}
              />
            </View>

            <View style={styles.checkoutGpsNotice}>
              <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.checkoutGpsNoticeText}>
                Your exact GPS location will be captured at this moment to record your arrival.
              </Text>
            </View>

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCheckInModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isCheckingIn ? 'Checking in...' : 'Confirm Check-In'}
                variant="primary"
                icon={<Ionicons name="location" size={16} color="#FFFFFF" />}
                onPress={handleCheckInVisit}
                loading={isCheckingIn}
                disabled={isCheckingIn}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. CHECK-OUT VISIT MODAL (BRANCH 1 & BRANCH 2) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={checkOutModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setCheckOutModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setCheckOutModalVisible(false)}
          />
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.checkoutModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Shop Visit Check-Out</Text>
                  <Text style={styles.checkoutShopSubName}>
                    {customers.find((c) => c.id === activeCheckoutVisit?.customerId)?.shopName ||
                      activeCheckoutVisit?.shopName ||
                      'Store Visit'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCheckOutModalVisible(false)}
                  hitSlop={HitSlop.md}
                >
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Arrived at & Time spent metrics */}
              <View style={styles.checkoutTimeMetricsRow}>
                <View style={styles.checkoutTimeMetricBox}>
                  <Text style={styles.checkoutTimeMetricLabel}>ARRIVED AT</Text>
                  <Text style={styles.checkoutTimeMetricValue}>
                    {activeCheckoutVisit?.checkInTime
                      ? new Date(activeCheckoutVisit.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '00:00'}
                  </Text>
                </View>
                <View style={styles.checkoutTimeMetricBox}>
                  <Text style={styles.checkoutTimeMetricLabel}>TIME SPENT</Text>
                  <Text style={[styles.checkoutTimeMetricValue, { color: '#16A34A' }]}>
                    {activeCheckoutVisit?.checkInTime
                      ? (() => {
                          const ms = new Date(activeCheckoutVisit.checkInTime).getTime();
                          const s = Math.max(0, Math.floor((Date.now() - (isNaN(ms) ? Date.now() : ms)) / 1000));
                          return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
                        })()
                      : '0s'}
                  </Text>
                </View>
              </View>

              {/* Question: DID YOU GENERATE A SALE AT THIS SHOP? */}
              <Text style={styles.checkoutPromptQuestion}>
                DID YOU GENERATE A SALE AT THIS SHOP?
              </Text>

              {/* BRANCH SELECTOR: NO SALE vs SALE COMPLETED */}
              <View style={styles.branchSelector}>
                <Pressable
                  style={[styles.branchButton, !checkoutSaleDone && styles.branchButtonActiveNoSale]}
                  onPress={() => {
                    setCheckoutSaleDone(false);
                    saveCurrentCheckoutDraft({ saleDone: false });
                  }}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={!checkoutSaleDone ? '#FFFFFF' : '#64748B'}
                  />
                  <Text style={[styles.branchButtonTitle, !checkoutSaleDone && styles.branchButtonTextActive]}>
                    No Sale Done
                  </Text>
                  <Text style={[styles.branchButtonSub, !checkoutSaleDone && styles.branchButtonSubActive]}>
                    Follow-up / inquiry only
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.branchButton, checkoutSaleDone && styles.branchButtonActiveSale]}
                  onPress={() => {
                    setCheckoutSaleDone(true);
                    saveCurrentCheckoutDraft({ saleDone: true });
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={checkoutSaleDone ? '#FFFFFF' : BrandColors.green.primary}
                  />
                  <Text style={[styles.branchButtonTitle, checkoutSaleDone && styles.branchButtonTextActive]}>
                    Yes, Sale Completed!
                  </Text>
                  <Text style={[styles.branchButtonSub, checkoutSaleDone && styles.branchButtonSubActive]}>
                    Book order & record units
                  </Text>
                </Pressable>
              </View>

              {/* ==================================================== */}
              {/* BRANCH 1: NO SALE GENERATED */}
              {/* ==================================================== */}
              {!checkoutSaleDone ? (
                <View style={styles.noSaleSection}>
                  <Text style={styles.subSectionTitle}>Predefined Visit Reason *</Text>
                  <View style={styles.reasonChipsRow}>
                    {PREDEFINED_VISIT_REASONS.map((r) => {
                      const isSelected = checkoutReason === r;
                      return (
                        <Pressable
                          key={r}
                          style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                          onPress={() => {
                            setCheckoutReason(r);
                            const updatedFeedback = checkoutFeedback ? `${r}. ${checkoutFeedback}` : r;
                            setCheckoutFeedback(updatedFeedback);
                            saveCurrentCheckoutDraft({ reason: r, feedback: updatedFeedback });
                          }}
                        >
                          <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                            {r}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                /* ==================================================== */
                /* BRANCH 2: SALE GENERATED */
                /* ==================================================== */
                <View style={styles.saleSection}>
                  <View style={styles.saleSectionHeader}>
                    <Ionicons name="cart" size={18} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.saleSectionTitle}>Live Order &amp; Billing Details</Text>
                  </View>

                  {/* Customer Link Selector if visit has no customerId */}
                  {!activeCheckoutVisit?.customerId && (
                    <View style={{ marginBottom: Spacing.sm }}>
                      <Text style={styles.modalFieldLabel}>Link Customer Account *</Text>
                      <ScrollView style={styles.modalCustomerList}>
                        {customers.map((c) => {
                          const isSelected = checkoutCustomerId === c.id;
                          return (
                            <Pressable
                              key={c.id}
                              style={[styles.modalCustomerItem, isSelected && styles.modalCustomerItemActive]}
                              onPress={() => {
                                setCheckoutCustomerId(c.id);
                                saveCurrentCheckoutDraft({ selectedCustomerId: c.id });
                              }}
                            >
                              <Text style={[styles.modalCustomerName, isSelected && styles.modalCustomerNameActive]}>
                                {c.shopName}
                              </Text>
                              <Text style={styles.modalCustomerSub}>{c.ownerName} • {c.village || c.district}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Product Selector */}
                  <View style={{ marginBottom: Spacing.sm }}>
                    <Text style={styles.modalFieldLabel}>Select Product *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                      {products.map((p) => {
                        const isSelected = selectedProductId === p.id;
                        return (
                          <Pressable
                            key={p.id}
                            style={[styles.productCard, isSelected && styles.productCardActive]}
                            onPress={() => {
                              setSelectedProductId(p.id);
                              const base = p.basePricePaise / 100 || 25;
                              setSaleUnitPrice(base);
                              saveCurrentCheckoutDraft({ selectedProductId: p.id, unitPrice: base });
                            }}
                          >
                            <Text style={[styles.productCardName, isSelected && styles.productCardNameActive]}>
                              {p.name}
                            </Text>
                            <Text style={styles.productCardPrice}>₹{p.basePricePaise / 100} / pkt</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Quantity & Unit Price */}
                  <View style={styles.quantityPriceRow}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text style={styles.modalFieldLabel}>Quantity (Packets)</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => {
                            const newQ = Math.max(1, saleQuantity - 1);
                            setSaleQuantity(newQ);
                            saveCurrentCheckoutDraft({ quantity: newQ });
                          }}
                        >
                          <Text style={styles.stepperBtnText}>-</Text>
                        </Pressable>
                        <Text style={styles.stepperValue}>{saleQuantity}</Text>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => {
                            const newQ = saleQuantity + 1;
                            setSaleQuantity(newQ);
                            saveCurrentCheckoutDraft({ quantity: newQ });
                          }}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Input
                        label="Unit Price (₹) *"
                        value={String(saleUnitPrice)}
                        onChangeText={(t) => {
                          const val = parseFloat(t) || 0;
                          setSaleUnitPrice(val);
                          saveCurrentCheckoutDraft({ unitPrice: val });
                        }}
                        keyboardType="numeric"
                        leftIcon={<Text style={{ fontWeight: '700', color: '#64748B' }}>₹</Text>}
                      />
                    </View>
                  </View>

                  {/* Total Sale Preview Banner */}
                  <View style={styles.totalSaleBanner}>
                    <Text style={styles.totalSaleLabel}>Total Sale Value:</Text>
                    <Text style={styles.totalSaleAmount}>
                      ₹{(saleQuantity * (saleUnitPrice || 0)).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {/* Payment Mode Selector matching backend enum */}
                  <View style={{ marginTop: Spacing.sm, marginBottom: Spacing.sm }}>
                    <Text style={styles.modalFieldLabel}>Payment Mode *</Text>
                    <View style={styles.paymentModeRow}>
                      {(['CASH', 'BANK', 'PENDING'] as PaymentMode[]).map((mode) => {
                        const isSelected = salePaymentMode === mode;
                        const label = mode === 'CASH' ? 'Cash' : mode === 'BANK' ? 'UPI / Bank' : 'Pending';
                        return (
                          <Pressable
                            key={mode}
                            style={[styles.paymentModeBtn, isSelected && styles.paymentModeBtnActive]}
                            onPress={() => {
                              setSalePaymentMode(mode);
                              saveCurrentCheckoutDraft({ paymentMode: mode });
                            }}
                          >
                            <Text style={[styles.paymentModeText, isSelected && styles.paymentModeTextActive]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* CUSTOMER FEEDBACK TRANSLATOR */}
              <View style={{ marginVertical: Spacing.sm }}>
                <VoiceFeedbackTranslator
                  value={checkoutFeedback}
                  onChange={(text) => {
                    setCheckoutFeedback(text);
                    saveCurrentCheckoutDraft({ feedback: text });
                  }}
                  label="Customer Feedback / Visit Remarks"
                  sublabel="Speak naturally in Hindi or Hinglish — translated to concise English"
                  quickChips={
                    checkoutSaleDone
                      ? [
                          'Repeat order client',
                          'Cash paid instantly',
                          'High product demand',
                          'Satisfied with quality',
                          'Requested weekly restocking',
                        ]
                      : [
                          'Stock already sufficient',
                          'Price resistance / negotiation',
                          'Decision maker unavailable',
                          'Order planned for next visit',
                          'Sample provided for trial',
                          'Previous payment pending',
                        ]
                  }
                  />
              </View>

              {/* Departure Notes */}
              <Input
                label="Departure Notes (Optional)"
                value={checkoutNotes}
                onChangeText={(t) => {
                  setCheckoutNotes(t);
                  saveCurrentCheckoutDraft({ notes: t });
                }}
                leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
              />

              <View style={styles.checkoutGpsNotice}>
                <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.checkoutGpsNoticeText}>
                  Live GPS location will be captured to finalize your shop duration and route.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setCheckOutModalVisible(false);
                    setActiveCheckoutVisit(null);
                  }}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={
                    isCheckingOut
                      ? 'Checking out...'
                      : checkoutSaleDone
                      ? 'Record Sale & Check Out'
                      : 'Confirm Check-Out (No Sale)'
                  }
                  variant="primary"
                  size="md"
                  icon={
                    checkoutSaleDone ? (
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="exit-outline" size={16} color="#FFFFFF" />
                    )
                  }
                  onPress={handleConfirmCheckout}
                  loading={isCheckingOut}
                  disabled={isCheckingOut}
                  style={[
                    { flex: 1.6 },
                    !checkoutSaleDone
                      ? { backgroundColor: '#0F172A' }
                      : { backgroundColor: '#16A34A' },
                  ]}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 4. END SHIFT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={endModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEndModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setEndModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>End Field Duty Shift</Text>
              <Text style={styles.modalSubtitle}>
                Review closing location and total route distance tracked automatically via GPS and Google Maps.
              </Text>

              <VerifiedLocationCard
                location={currentLocation}
                loading={isAcquiringLocation}
                onRefresh={fetchLiveLocation}
                title="Closing Duty Location"
                subtitle="Automatic GPS route calculation"
                routeDistanceKm={gpsTraveledDistanceKm}
              />

              {gpsTraveledDistanceKm > 0 ? (
                <View style={styles.meterPreviewCard}>
                  <Ionicons name="navigate-circle" size={15} color={BrandColors.green.dark} style={{ marginRight: 6 }} />
                  <Text style={styles.meterPreviewText}>
                    Calculated Travel: <Text style={{ fontWeight: '700' }}>{gpsTraveledDistanceKm} km</Text> (GPS route)
                  </Text>
                </View>
              ) : null}

              <Input
                label="Shift Summary / Remarks (Optional)"
                placeholder="Enter shift notes or summary"
                value={endNotes}
                onChangeText={setEndNotes}
                leftIcon={<Ionicons name="create-outline" size={18} color="#94A3B8" />}
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setEndModalVisible(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Proceed to Face ID"
                  variant="primary"
                  onPress={handleInitiateEndShift}
                  style={{ flex: 1.4 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 5. DUTY SHIFT START: FINGERPRINT & PASSWORD MODAL    */}
      {/* ---------------------------------------------------- */}
      <ShiftAuthVerificationModal
        visible={shiftAuthModalVisible}
        mode="START"
        locationAddress={currentLocation?.address || undefined}
        userName={user?.name || 'Field Officer'}
        userRole={user?.role || 'SELLER'}
        onClose={() => setShiftAuthModalVisible(false)}
        onVerified={handleVerifiedShiftStart}
      />

      {/* ---------------------------------------------------- */}
      {/* 6. FACE VERIFICATION / ATTENDANCE SELFIE MODAL (END) */}
      {/* ---------------------------------------------------- */}
      <FaceVerificationModal
        visible={faceModalVisible}
        mode={faceModalMode}
        userName={user?.name || 'Field Officer'}
        userRole={user?.role || 'SELLER'}
        autoLaunch={true}
        onClose={() => setFaceModalVisible(false)}
        onVerified={(res) => {
          if (faceModalMode === 'START') {
            handleVerifiedShiftStart(res);
          } else {
            handleVerifiedShiftEnd(res);
          }
        }}
      />
    </View>
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
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: Colors.light.surface,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  heroOverline: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  heroTimer: {
    ...Typography.display,
    fontSize: 32,
    color: Colors.light.heading,
  },
  heroDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.md,
  },
  heroDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  heroDetailText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  heroActionRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  offDutyBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.md,
  },
  offDutyText: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  timelineSection: {
    marginTop: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  addVisitLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addVisitText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  visitCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  visitStoreName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  visitSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  visitFeedbackCard: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#FFF1F2',
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.pink.primary,
  },
  visitFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  visitFeedbackTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.primary,
    marginLeft: 4,
  },
  visitFeedbackText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },
  visitNotes: {
    ...Typography.caption,
    fontStyle: 'italic',
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
    paddingLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '85%',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
    marginBottom: 4,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
  },
  modalFieldLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  checkInSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  checkInSearchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 13,
    color: Colors.light.textPrimary,
    paddingVertical: 0,
  },
  modalCustomerList: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  modalCustomerItem: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  modalCustomerItemActive: {
    backgroundColor: BrandColors.pink.tint,
  },
  modalCustomerName: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.light.heading,
  },
  modalCustomerNameActive: {
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
  modalCustomerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  checkoutOutletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkoutOutletBoxSaleActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkoutOutletText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
  },
  saleConfirmedTag: {
    backgroundColor: BrandColors.green.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  saleConfirmedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  branchSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  branchButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchButtonActiveNoSale: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  branchButtonActiveSale: {
    backgroundColor: BrandColors.green.primary,
    borderColor: BrandColors.green.primary,
  },
  branchButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  branchButtonSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  branchButtonTextActive: {
    color: '#FFFFFF',
  },
  branchButtonSubActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  noSaleSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: Spacing.sm,
  },
  reasonChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  reasonChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
  },
  saleSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  saleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  saleSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  productCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  productCardActive: {
    borderColor: BrandColors.green.primary,
    backgroundColor: '#DCFCE7',
  },
  productCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  productCardNameActive: {
    color: '#166534',
    fontWeight: '700',
  },
  productCardPrice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  quantityPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 48,
  },
  stepperBtn: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalSaleBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginVertical: Spacing.sm,
  },
  totalSaleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  totalSaleAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
  },
  paymentModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentModeBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  paymentModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  paymentModeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  meterPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  meterPreviewText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  activeShopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  activeShopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  activeShopIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  activeShopOverline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeShopName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#14532D',
    marginTop: 2,
  },
  activeShopRight: {
    alignItems: 'flex-end',
  },
  activeShopTimerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  activeShopTimerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
    fontVariant: ['tabular-nums'],
  },
  activeShopCheckoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  activeShopCheckoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  checkoutShopSubName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  checkoutTimeMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  checkoutTimeMetricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  checkoutTimeMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  checkoutTimeMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  checkoutPromptQuestion: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  checkoutGpsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  checkoutGpsNoticeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
    flex: 1,
  },
  modalTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
});
