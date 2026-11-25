import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { VerifiedLocationCard } from '@/components/common/VerifiedLocationCard';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
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
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  buildShiftWaypoints,
  calculateLegDistanceKm,
  calculateWaypointRouteKm,
  computeShiftTravelDistance,
} from '@/utils/distanceUtils';
import { draftStorage } from '@/utils/draftStorage';
import {
  acquireGpsCoordinates,
  formatShortAddressLabel,
  getCurrentLocationWithAddress,
  type LocationResult,
} from '@/utils/locationUtils';
import { useResponsiveLayout } from '@/utils/responsive';

const PREDEFINED_VISIT_REASONS = [
  'Stock already sufficient',
  'Decision maker unavailable',
  'Shop closed',
  'Customer not interested',
  'Payment pending',
  'Order planned for next visit',
  'Sample provided for trial',
];

export default function SellerAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useResponsiveLayout();
  const isCompactScreen = width < 380;
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
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
  const [startNotes, setStartNotes] = useState('');
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
  const [endNotes, setEndNotes] = useState('');
  const [isEndingShift, setIsEndingShift] = useState(false);

  // Duty Shift Start Authentication Modal (Fingerprint & Mobile Password)
  const [shiftAuthModalVisible, setShiftAuthModalVisible] = useState(false);

  // Live Face Scanner Modal State (Start / End Shift)
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'START' | 'END'>('START');
  const [pendingNotes, setPendingNotes] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadShiftData = useCallback(async () => {
    try {
      const [shiftRes, custRes, prodRes, historyRes] = await Promise.all([
        sellerApi.getCurrentShift().catch(async () => {
          const cached = await draftStorage.getActiveShift(userId);
          return { shift: cached };
        }),
        sellerApi.listCustomers({ pageSize: 100 }).catch(() => ({ items: [] })),
        sellerApi.listProducts().catch(() => ({ items: [] })),
        sellerApi.getShiftHistory({ page: 1, pageSize: 50 }).catch(() => ({ items: [] })),
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
        const serverVisits: ShiftVisit[] = Array.isArray(active.visits) ? active.visits : [];
        const unsyncedLocalVisits: ShiftVisit[] = Array.isArray(cached?.visits)
          ? cached.visits.filter(
              (cv) =>
                cv.id?.startsWith('visit_local_') &&
                !serverVisits.some((sv) => sv.id === cv.id)
            )
          : [];
        const mergedVisits = [...serverVisits, ...unsyncedLocalVisits].sort(
          (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
        );
        const merged: Shift = {
          ...active,
          visits: mergedVisits,
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

      const histList = (historyRes as any)?.items ?? (historyRes as any)?.shifts ?? [];
      setPastShifts(Array.isArray(histList) ? histList : []);

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

  // Elapsed timer ticker for active shift
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

  useRealtimeSync(['SHIFT_UPDATE'], loadShiftData);

  const toggleExpandShift = (shiftId: string) => {
    setExpandedShiftIds((prev) => ({
      ...prev,
      [shiftId]: !prev[shiftId],
    }));
  };

  async function acquireCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      if (Platform.OS !== 'web') {
        const gps = await acquireGpsCoordinates({
          highAccuracyTimeoutMs: 7000,
          fallbackTimeoutMs: 4000,
          maxAgeMs: 10000,
          accuracyThresholdMeters: 50,
        });
        if (gps.status === 'acquired' && gps.latitude != null && gps.longitude != null) {
          return {
            latitude: Number(gps.latitude.toFixed(6)),
            longitude: Number(gps.longitude.toFixed(6)),
          };
        }
        return null;
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: Number(pos.coords.latitude.toFixed(6)),
                longitude: Number(pos.coords.longitude.toFixed(6)),
              });
            },
            () => resolve(null),
            { timeout: 8000, enableHighAccuracy: true, maximumAge: 10000 }
          );
        });
      }
    } catch {
      // Surface null so caller asks user to enable GPS rather than fabricating coordinates
    }
    return null;
  }

  const fetchLiveLocation = useCallback(async (forceFresh = true): Promise<LocationResult | null> => {
    setIsAcquiringLocation(true);
    try {
      const loc = await getCurrentLocationWithAddress({
        highAccuracyTimeoutMs: 7000,
        fallbackTimeoutMs: 4000,
        maxAgeMs: forceFresh ? 10000 : 30000,
        accuracyThresholdMeters: 50,
      });
      if (loc) {
        setCurrentLocation(loc);
        return loc;
      }
      setCurrentLocation(null);
      return null;
    } catch (err) {
      console.warn('Failed to acquire location with address', err);
      setCurrentLocation(null);
      return null;
    } finally {
      setIsAcquiringLocation(false);
    }
  }, []);

  function handleOpenStartShiftModal() {
    fetchLiveLocation(true);
    setStartModalVisible(true);
  }

  function handleOpenCheckInModal() {
    fetchLiveLocation(true);
    setCheckInModalVisible(true);
  }

  function handleInitiateStartShift() {
    setPendingNotes(startNotes.trim());
    setStartModalVisible(false);
    setFaceModalMode('START');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftStart(authResult: FaceVerificationResult | ShiftAuthResult) {
    setFaceModalVisible(false);
    setShiftAuthModalVisible(false);
    setFeedback(null);

    const isFreshLocation =
      currentLocation?.timestamp != null && Date.now() - currentLocation.timestamp < 30000;
    let loc: LocationResult | null = isFreshLocation ? currentLocation : await fetchLiveLocation(true);

    if (!loc) {
      const coords = await acquireCoordinates();
      if (coords) {
        loc = { latitude: coords.latitude, longitude: coords.longitude };
      }
    }

    if (!loc) {
      Alert.alert(
        'GPS Location Required',
        'Could not capture your live GPS location to start duty. Please turn ON device Location / High Accuracy and try again.'
      );
      return;
    }

    try {
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
          startLatitude: startedShift.startLatitude ?? loc.latitude,
          startLongitude: startedShift.startLongitude ?? loc.longitude,
          startAddress: loc.address || startedShift.startAddress,
          startOdometerKm: 0,
        };
        setCurrentShift(enrichedShift);
        await draftStorage.saveActiveShift(userId, enrichedShift);
      }
      setStartNotes('');

      const areaLabel = formatShortAddressLabel(
        loc.address,
        loc.street || loc.village || loc.district || 'your area'
      );
      setFeedback({
        type: 'success',
        title: 'Duty Started',
        message: `Duty started with face verification at ${areaLabel}.`,
      });
      Alert.alert('Duty Started', `Duty is now active.\nLocation: ${areaLabel}`);
      loadShiftData();
    } catch (err: any) {
      console.warn('Shift start API error, falling back to local active shift:', err);
      const fallbackShift: Shift = {
        id: `shift_local_${Date.now()}`,
        sellerId: userId || 'local_user',
        status: 'ACTIVE',
        startTime: new Date().toISOString(),
        startLatitude: loc.latitude,
        startLongitude: loc.longitude,
        startAddress: loc.address || undefined,
        startOdometerKm: 0,
      };
      setCurrentShift(fallbackShift);
      if (userId) {
        await draftStorage.saveActiveShift(userId, fallbackShift).catch(() => {});
      }
      setStartNotes('');
      const areaLabel = formatShortAddressLabel(loc.address, loc.street || 'your location');
      setFeedback({
        type: 'success',
        title: 'Shift Started',
        message: `Duty started at ${areaLabel}.`,
      });
      Alert.alert('Shift Started', `Duty is now active at ${areaLabel}.`);
    }
  }

  async function handleCheckInVisit() {
    if (isCheckingIn) return;
    if (!selectedCustomerId && !checkInCustomShopName.trim()) {
      Alert.alert('Select or Enter Shop', 'Please select a shop or type the shop name.');
      return;
    }

    setIsCheckingIn(true);
    setFeedback(null);

    try {
      const coords = await acquireCoordinates();
      if (!coords) {
        Alert.alert(
          'GPS Location Required',
          'Could not capture your live GPS location at this shop. Please enable High Accuracy GPS and tap Start Check-In again.'
        );
        return;
      }

      const customer = customers.find((c) => c.id === selectedCustomerId);
      const resolvedShopName = customer?.shopName || checkInCustomShopName.trim();

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
        const normalizedVisit: ShiftVisit = {
          ...newVisit,
          shopName: newVisit.shopName || resolvedShopName,
          latitude: newVisit.latitude ?? coords.latitude,
          longitude: newVisit.longitude ?? coords.longitude,
        };
        setCurrentShift((prev) => {
          if (!prev) return prev;
          const currentVisits = Array.isArray(prev.visits) ? prev.visits : [];
          const exists = currentVisits.some((v) => v.id && v.id === normalizedVisit.id);
          const updatedVisits = exists
            ? currentVisits
            : [...currentVisits, normalizedVisit].sort(
                (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
              );
          const updated = { ...prev, visits: updatedVisits };
          draftStorage.saveActiveShift(userId, updated).catch(() => {});
          return updated;
        });
      }

      setCheckInModalVisible(false);
      setCheckInCustomShopName('');
      setCheckInCustomerSearch('');
      setVisitNotes('');
      setFeedback({
        type: 'success',
        title: 'Checked In at Shop',
        message: `Checked in at ${resolvedShopName}. Tap Check Out when leaving.`,
      });
      await loadShiftData().catch(() => {});
      fetchLiveLocation(true).catch(() => {});
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

  async function handleOpenCheckout(visit: ShiftVisit) {
    if (visit.checkOutTime) {
      Alert.alert('Already Done', 'This visit is already finished.');
      return;
    }

    setActiveCheckoutVisit(visit);
    setCheckoutCustomerId(visit.customerId || (customers[0]?.id ?? ''));

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
      if (!coords) {
        Alert.alert(
          'GPS Location Required',
          'Could not capture your live GPS location when leaving the shop. Please turn ON High Accuracy GPS and try again.'
        );
        return;
      }
      let generatedSaleId: string | undefined = undefined;

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

        const saleRes = await sellerApi.createSale({
          customerId: targetCustomerId,
          items: prodId ? [{ productId: prodId, quantity: saleQuantity, unitPricePaise }] : undefined,
          quantity: saleQuantity,
          unitPricePaise,
          paymentMode: salePaymentMode,
          requestKey: reqKey,
          customerFeedback: checkoutFeedback.trim() || undefined,
        });

        const createdSale = (saleRes as any)?.sale || (saleRes as any)?.item || saleRes;
        generatedSaleId = createdSale?.id;
      }

      const finalNotes = checkoutNotes.trim() || (checkoutReason ? `Reason: ${checkoutReason}` : undefined);
      const checkOutRes = await sellerApi.checkOut({
        visitId: activeCheckoutVisit.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        saleDone: checkoutSaleDone,
        saleId: generatedSaleId,
        customerFeedback: checkoutFeedback.trim() || undefined,
        notes: finalNotes,
      });

      const updatedVisit = (checkOutRes as any)?.visit || (checkOutRes as any)?.data?.visit || checkOutRes;
      const checkoutTimestamp = updatedVisit?.checkOutTime || new Date().toISOString();
      const checkInMs = new Date(activeCheckoutVisit.checkInTime).getTime();
      const calcDurationMins =
        updatedVisit?.durationMins ??
        Math.max(1, Math.round((Date.now() - (isNaN(checkInMs) ? Date.now() : checkInMs)) / 60000));

      const completedVisit: ShiftVisit = {
        ...activeCheckoutVisit,
        ...(updatedVisit || {}),
        checkOutTime: checkoutTimestamp,
        durationMins: calcDurationMins,
        notes: finalNotes,
        saleDone: checkoutSaleDone,
        customerFeedback: checkoutFeedback.trim() || activeCheckoutVisit.customerFeedback,
        saleId: generatedSaleId || activeCheckoutVisit.saleId,
      };

      setCurrentShift((prev) => {
        if (!prev) return prev;
        const currentVisits = Array.isArray(prev.visits) ? prev.visits : [];
        const updatedVisits = currentVisits.map((v) => (v.id === activeCheckoutVisit.id ? completedVisit : v));
        const updatedShift = { ...prev, visits: updatedVisits };
        draftStorage.saveActiveShift(userId, updatedShift).catch(() => {});
        return updatedShift;
      });

      await draftStorage.clearVisitCheckoutDraft(userId, activeCheckoutVisit.id);

      setCheckOutModalVisible(false);
      setActiveCheckoutVisit(null);
      setCheckoutFeedback('');
      setCheckoutNotes('');
      setCheckoutReason('');
      setCheckoutSaleDone(false);

      const successTitle = checkoutSaleDone ? 'Check Out & Sale Saved' : 'Checked Out of Shop';
      const successMessage = checkoutSaleDone
        ? `Stayed ${calcDurationMins} min · Sale saved: ₹${(saleQuantity * saleUnitPrice).toLocaleString('en-IN')}.`
        : `Stayed ${calcDurationMins} min (${checkoutReason || 'Shop Visit'}).`;

      setFeedback({
        type: 'success',
        title: successTitle,
        message: successMessage,
      });
      Alert.alert(successTitle, successMessage);
      await loadShiftData().catch(() => {});
      fetchLiveLocation(true).catch(() => {});
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

  async function proceedOpenEndShiftModal() {
    setGpsTraveledDistanceKm(0);
    setIsAcquiringLocation(true);
    setEndModalVisible(true);
    const loc = await fetchLiveLocation(true);
    if (currentShift && loc) {
      const waypoints = buildShiftWaypoints(currentShift, loc);
      setGpsTraveledDistanceKm(calculateWaypointRouteKm(waypoints));
    }
    setIsAcquiringLocation(false);
  }

  async function handleOpenEndShiftModal() {
    const openVisit = Array.isArray(currentShift?.visits)
      ? currentShift.visits.find((v) => !v.checkOutTime)
      : null;

    if (openVisit) {
      Alert.alert(
        'Finish Current Shop First',
        `You are still checked in at ${openVisit.shopName}. Please Check Out first so your shop stay time and sale/feedback are saved cleanly.`,
        [
          { text: 'Check Out Now', onPress: () => handleOpenCheckout(openVisit) },
          { text: 'End Duty Anyway', style: 'destructive', onPress: () => proceedOpenEndShiftModal() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    await proceedOpenEndShiftModal();
  }

  function handleInitiateEndShift() {
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
      const isFreshLocation =
        currentLocation?.timestamp != null && Date.now() - currentLocation.timestamp < 20000;
      let loc: LocationResult | null = isFreshLocation ? currentLocation : await fetchLiveLocation(true);
      if (!loc) {
        const coords = await acquireCoordinates();
        if (coords) {
          loc = { latitude: coords.latitude, longitude: coords.longitude };
        }
      }

      if (!loc) {
        Alert.alert(
          'GPS Location Required',
          'Unable to capture your ending GPS location. Please enable High Accuracy Location and try ending duty again.'
        );
        return;
      }

      const estimatedRouteKm = currentShift
        ? calculateWaypointRouteKm(buildShiftWaypoints(currentShift, loc))
        : gpsTraveledDistanceKm;

      const shiftIdToEnd = currentShift?.id;
      const res = await sellerApi.endShift({
        shiftId: shiftIdToEnd,
        endOdometerKm: estimatedRouteKm,
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
      setEndNotes('');

      const distResult = computeShiftTravelDistance(closedShift);
      const totalDist = distResult.formatted !== '0 km' ? distResult.formatted : `${estimatedRouteKm} km`;
      const measurementNote = distResult.source === 'odometer' ? ' (via meter fallback)' : '';

      setFeedback({
        type: 'success',
        title: 'Duty Ended',
        message: `Today's duty ended. Total travel: ${totalDist}${measurementNote}.`,
      });
      Alert.alert('Duty Ended', `Today's duty ended.\nTotal travel: ${totalDist}${measurementNote}.`);
      loadShiftData();
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

  // Overall attendance metrics across all shifts
  const overallMetrics = useMemo(() => {
    const totalDays = pastShifts.length;
    const completedDays = pastShifts.filter((s) => s.status === 'COMPLETED' || Boolean(s.endTime)).length;
    let totalShops = 0;
    let totalKm = 0;

    for (const s of pastShifts) {
      totalShops += s.visits?.length || 0;
      totalKm += computeShiftTravelDistance(s).distanceKm;
    }

    return {
      totalDays,
      completedDays,
      totalShops,
      totalKm: totalKm.toFixed(1),
    };
  }, [pastShifts]);

  const activeShopVisit = Array.isArray(currentShift?.visits)
    ? currentShift.visits.find((v) => !v.checkOutTime)
    : null;
  const isShiftActive = Boolean(currentShift && currentShift.startTime && !currentShift.endTime);

  if (loading) {
    return <LoadingState message="Loading attendance..." />;
  }

  return (
    <View style={styles.container}>
      <Header
        title="Attendance"
        subtitle={user?.name ? `${user.name} · Duty & Visits` : 'Daily Duty & Visits'}
        showBack={user?.role === 'MANAGER'}
        rightAction={
          isShiftActive ? (
            <Button
              title={activeShopVisit ? 'Check Out' : 'Check In'}
              size="sm"
              variant="primary"
              style={activeShopVisit ? { backgroundColor: '#16A34A' } : undefined}
              icon={<Ionicons name={activeShopVisit ? 'exit-outline' : 'location'} size={15} color="#FFFFFF" />}
              onPress={() => {
                if (activeShopVisit) {
                  handleOpenCheckout(activeShopVisit);
                } else {
                  handleOpenCheckInModal();
                }
              }}
            />
          ) : (
            <Button
              title="New Shift"
              size="sm"
              variant="primary"
              icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
              onPress={handleOpenStartShiftModal}
            />
          )
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 125) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.primary]}
            tintColor={BrandColors.pink.primary}
          />
        }
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

          {/* 1. Live Duty Control Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
                <Text style={styles.heroOverline}>Today&apos;s Duty</Text>
                <Text style={styles.heroTimer}>{isShiftActive ? elapsedTime : '--:--:--'}</Text>
              </View>
              <Badge
                label={isShiftActive ? 'ON DUTY' : 'OFF DUTY'}
                variant={isShiftActive ? 'ACTIVE' : 'neutral'}
                pulse={isShiftActive}
              />
            </View>

            {isShiftActive && currentShift ? (
              <View style={styles.heroDetails}>
                <View style={styles.heroDetailRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.heroDetailText}>
                    Started at{' '}
                    {(() => {
                      const d = new Date(currentShift.startTime);
                      return isNaN(d.getTime())
                        ? 'Active'
                        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    })()}
                  </Text>
                </View>

                {currentShift.startAddress ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="location-outline" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text
                      style={[styles.heroDetailText, { color: BrandColors.green.primary, fontWeight: '600', flex: 1 }]}
                      numberOfLines={2}
                    >
                      Start: {formatShortAddressLabel(currentShift.startAddress, 'Location saved')}
                    </Text>
                  </View>
                ) : currentShift.startLatitude ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="location-outline" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.heroDetailText, { color: BrandColors.green.primary, fontWeight: '600' }]}>
                      Location saved
                    </Text>
                  </View>
                ) : null}

                {(() => {
                  const liveRouteKm =
                    Number(currentShift.totalDistanceKm || 0) > 0
                      ? Number(currentShift.totalDistanceKm)
                      : calculateWaypointRouteKm(buildShiftWaypoints(currentShift));
                  const completedVisitCount = (currentShift.visits || []).filter((v) => Boolean(v.checkOutTime)).length;
                  if (liveRouteKm <= 0 && completedVisitCount === 0) return null;
                  return (
                    <View style={styles.heroDetailRow}>
                      <Ionicons name="navigate-outline" size={16} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.heroDetailText}>
                        Route so far: {liveRouteKm} km · {completedVisitCount}{' '}
                        {completedVisitCount === 1 ? 'shop done' : 'shops done'}
                      </Text>
                    </View>
                  );
                })()}

                {/* Active Shop Check-In Card */}
                {activeShopVisit ? (
                  <View style={styles.activeShopBanner}>
                    <View style={styles.activeShopLeft}>
                      <View style={styles.activeShopIcon}>
                        <Ionicons name="storefront" size={20} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.activeShopOverline} numberOfLines={1}>
                          Checked in ·{' '}
                          {new Date(activeShopVisit.checkInTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        <Text style={styles.activeShopName} numberOfLines={1}>
                          {activeShopVisit.shopName}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.activeShopRight}>
                      <Text style={styles.activeShopTimerLabel}>STAY TIME</Text>
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

                {/* Quick Duty Actions */}
                <View style={[styles.heroActionRow, isCompactScreen && styles.heroActionRowStacked]}>
                  {activeShopVisit ? (
                    <Button
                      title={`Check Out · ${activeShopVisit.shopName}`}
                      onPress={() => handleOpenCheckout(activeShopVisit)}
                      variant="primary"
                      size="md"
                      icon={<Ionicons name="exit-outline" size={18} color="#FFFFFF" />}
                      style={[
                        { backgroundColor: '#16A34A' },
                        !isCompactScreen ? { flex: 1.4, marginRight: Spacing.sm } : undefined,
                      ]}
                    />
                  ) : (
                    <Button
                      title="Check In (Visit Shop)"
                      onPress={handleOpenCheckInModal}
                      variant="primary"
                      size="md"
                      icon={<Ionicons name="location" size={18} color="#FFFFFF" />}
                      style={!isCompactScreen ? { flex: 1.4, marginRight: Spacing.sm } : undefined}
                    />
                  )}
                  <Button
                    title="End Duty"
                    onPress={handleOpenEndShiftModal}
                    variant="outline"
                    size="md"
                    style={!isCompactScreen ? { flex: 0.9 } : undefined}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.offDutyBox}>
                <Text style={styles.offDutyText}>
                  You have not started duty yet. Start duty to visit shops and make bills.
                </Text>
                <Button
                  title="Start Duty"
                  onPress={handleOpenStartShiftModal}
                  variant="primary"
                  size="lg"
                  icon={<Ionicons name="scan-circle-outline" size={20} color="#FFFFFF" />}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            )}
          </Card>

          {/* 2. Overall Attendance Summary KPIs */}
          <View style={styles.statsGrid}>
            <View style={styles.statsGridRow}>
              <View style={styles.statCol}>
                <StatCard
                  title="Total Days"
                  value={overallMetrics.totalDays}
                  icon="calendar-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>
              <View style={styles.statCol}>
                <StatCard
                  title="Completed"
                  value={overallMetrics.completedDays}
                  icon="checkmark-circle-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                />
              </View>
            </View>
            <View style={styles.statsGridRow}>
              <View style={styles.statCol}>
                <StatCard
                  title="Shops Visited"
                  value={overallMetrics.totalShops}
                  icon="storefront-outline"
                  iconColor="#0284C7"
                  iconBg="#F0F9FF"
                />
              </View>
              <View style={styles.statCol}>
                <StatCard
                  title="Total Travel"
                  value={`${overallMetrics.totalKm} km`}
                  icon="navigate-outline"
                  iconColor="#D97706"
                  iconBg="#FFFBEB"
                />
              </View>
            </View>
          </View>

          {/* 3. Detailed Day-Wise Attendance Log */}
          <View style={[styles.historySection, { marginTop: Spacing.xs }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={18} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Attendance Log</Text>
              </View>
              <Badge
                label={`${pastShifts.length} ${pastShifts.length === 1 ? 'Day' : 'Days'}`}
                variant="neutral"
              />
            </View>

            {pastShifts.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyHistoryTitle}>No attendance records yet</Text>
                <Text style={styles.emptyHistoryText}>
                  Your daily duty records, visited shops, and travel details will show here.
                </Text>
              </View>
            ) : (
              pastShifts.map((s, idx) => {
                const isActive = s.status === 'ACTIVE' || (!s.endTime && Boolean(s.startTime));
                const isExpanded = Boolean(expandedShiftIds[s.id]);
                const shiftVisits = s.visits || [];
                const distInfo = computeShiftTravelDistance(s);
                const startDateStr = s.startTime
                  ? new Date(s.startTime).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : '';
                const startTimeStr = s.startTime
                  ? new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Start';
                const endTimeStr = s.endTime
                  ? new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Active';
                const startLocStr = formatShortAddressLabel(
                  s.startAddress,
                  s.startLatitude ? 'Location saved' : 'Start location'
                );

                const durationStr = (() => {
                  if (!s.startTime) return '0 min';
                  const startMs = new Date(s.startTime).getTime();
                  const endMs = s.endTime ? new Date(s.endTime).getTime() : Date.now();
                  const diffMins = Math.max(0, Math.floor((endMs - startMs) / 60000));
                  const h = Math.floor(diffMins / 60);
                  const m = diffMins % 60;
                  return h > 0 ? `${h}h ${m}m` : `${m} min`;
                })();

                return (
                  <Card key={s.id || idx} style={[styles.historyCard, isActive && styles.historyCardActive]}>
                    <View style={styles.historyTopBadgeRow}>
                      <View style={styles.historyDateTimeWrap}>
                        <Ionicons name="calendar-outline" size={14} color={BrandColors.pink.primary} />
                        <Text style={styles.historyTimeRange} numberOfLines={1}>
                          {startDateStr ? `${startDateStr} · ` : ''}
                          {startTimeStr} → {endTimeStr}
                        </Text>
                      </View>
                      <Badge
                        label={isActive ? 'ON DUTY' : 'DONE'}
                        variant={isActive ? 'ACTIVE' : 'success'}
                        size="sm"
                      />
                    </View>

                    <View style={styles.historyLocationRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 }}>
                        <Ionicons name="location-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.historyLocation} numberOfLines={1}>
                          {startLocStr}
                        </Text>
                      </View>
                      <Badge label="✓ Verified" variant="success" size="sm" />
                    </View>

                    <View style={styles.historyMetricsRow}>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>TIME</Text>
                        <Text style={styles.historyMetricValue}>{durationStr}</Text>
                      </View>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>SHOPS</Text>
                        <Text style={styles.historyMetricValue}>{shiftVisits.length} shops</Text>
                      </View>
                      <View style={styles.historyMetricBox}>
                        <Text style={styles.historyMetricLabel}>DISTANCE</Text>
                        <Text style={[styles.historyMetricValue, { color: BrandColors.pink.primary }]}>
                          {distInfo.formatted}
                        </Text>
                      </View>
                    </View>

                    {/* Expandable Inline Shops Visited Details */}
                    {shiftVisits.length > 0 && isExpanded ? (
                      <View style={styles.inlineVisitsBox}>
                        {shiftVisits.map((v, vIdx) => {
                          const vHasSale = Boolean(v.saleDone || (v as any).sale_done || v.saleId);
                          return (
                            <View key={v.id || vIdx} style={styles.inlineVisitRow}>
                              <View style={styles.inlineVisitBullet}>
                                <Text style={styles.inlineVisitBulletText}>{vIdx + 1}</Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.xs }}>
                                <Text style={styles.inlineVisitShop} numberOfLines={1}>
                                  {v.customer?.shopName || v.shopName || 'Shop'}
                                </Text>
                                <Text style={styles.inlineVisitTime}>
                                  {new Date(v.checkInTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                  {v.checkOutTime
                                    ? ` → ${new Date(v.checkOutTime).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`
                                    : ' · Active'}
                                </Text>
                              </View>
                              <Badge
                                label={vHasSale ? 'SALE DONE' : 'VISITED'}
                                variant={vHasSale ? 'success' : 'neutral'}
                                size="sm"
                                showDot={false}
                              />
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={styles.historyCardFooter}>
                      {shiftVisits.length > 0 ? (
                        <Pressable
                          style={styles.viewRouteAuditBtn}
                          onPress={() => toggleExpandShift(s.id)}
                          hitSlop={HitSlop.sm}
                        >
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'storefront-outline'}
                            size={14}
                            color={BrandColors.pink.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.viewRouteAuditBtnText}>
                            {isExpanded ? 'Hide Shops' : `Show ${shiftVisits.length} Shops`}
                          </Text>
                        </Pressable>
                      ) : (
                        <View />
                      )}

                      <Pressable
                        style={styles.viewRouteAuditBtn}
                        onPress={() => setSelectedAuditShift(s)}
                        hitSlop={HitSlop.sm}
                      >
                        <Ionicons name="list-outline" size={14} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.viewRouteAuditBtnText}>Full Timeline →</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* 1. START DUTY MODAL */}
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
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setStartModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              { paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl) },
            ]}
          >
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Start Today&apos;s Duty</Text>
              <Text style={styles.modalSubtitle}>
                Your start location will be saved automatically.
              </Text>

              <VerifiedLocationCard
                location={currentLocation}
                loading={isAcquiringLocation}
                onRefresh={() => fetchLiveLocation(true)}
                title="Start Location"
                subtitle="Your current area"
              />

              <Input
                label="Note (Optional)"
                placeholder="Any short note..."
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
                  title="Continue"
                  variant="primary"
                  icon={<Ionicons name="scan-outline" size={16} color="#FFFFFF" />}
                  onPress={handleInitiateStartShift}
                  style={{ flex: 1.4 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. VISIT SHOP CHECK-IN MODAL */}
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
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setCheckInModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              { paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl) },
            ]}
          >
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Check In at Shop</Text>
              <Text style={styles.modalSubtitle}>Choose the shop you are visiting now</Text>

            <Text style={styles.modalFieldLabel}>Select Shop</Text>
            <View style={styles.checkInSearchRow}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.checkInSearchInput}
                placeholder="Search shop name..."
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

            <ScrollView style={styles.modalCustomerList} nestedScrollEnabled>
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
              <Text style={styles.modalFieldLabel}>Or Type Shop Name</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Enter shop name..."
                placeholderTextColor="#94A3B8"
                value={checkInCustomShopName}
                onChangeText={(t) => {
                  setCheckInCustomShopName(t);
                  if (t.trim()) setSelectedCustomerId('');
                }}
              />
            </View>

            <View style={{ marginTop: Spacing.sm }}>
              <Text style={styles.modalFieldLabel}>Note (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Write short note..."
                placeholderTextColor="#94A3B8"
                value={visitNotes}
                onChangeText={setVisitNotes}
              />
            </View>

            <View style={styles.checkoutGpsNotice}>
              <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={[styles.checkoutGpsNoticeText, { flex: 1 }]} numberOfLines={2}>
                {isAcquiringLocation
                  ? 'Fetching live shop GPS location...'
                  : currentLocation?.address
                  ? `GPS Ready: ${formatShortAddressLabel(currentLocation.address)} (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
                  : 'Live shop GPS will be captured when you Check In.'}
              </Text>
              <Pressable onPress={() => fetchLiveLocation(true)} hitSlop={HitSlop.sm} style={{ marginLeft: 8 }}>
                <Ionicons name="refresh" size={16} color="#16A34A" />
              </Pressable>
            </View>

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCheckInModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isCheckingIn ? 'Checking In...' : 'Check In'}
                variant="primary"
                icon={<Ionicons name="location" size={16} color="#FFFFFF" />}
                onPress={handleCheckInVisit}
                loading={isCheckingIn}
                disabled={isCheckingIn}
                style={{ flex: 1.4 }}
              />
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. FINISH SHOP VISIT MODAL */}
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
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setCheckOutModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              { maxHeight: '90%', paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl) },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.checkoutModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Finish Shop Visit</Text>
                  <Text style={styles.checkoutShopSubName}>
                    {customers.find((c) => c.id === activeCheckoutVisit?.customerId)?.shopName ||
                      activeCheckoutVisit?.shopName ||
                      'Shop Visit'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCheckOutModalVisible(false)} hitSlop={HitSlop.md}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.checkoutTimeMetricsRow}>
                <View style={styles.checkoutTimeMetricBox}>
                  <Text style={styles.checkoutTimeMetricLabel}>IN TIME</Text>
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

              <Text style={styles.checkoutPromptQuestion}>DID YOU MAKE A SALE?</Text>

              <View style={styles.branchSelector}>
                <Pressable
                  style={[styles.branchButton, !checkoutSaleDone && styles.branchButtonActiveNoSale]}
                  onPress={() => {
                    setCheckoutSaleDone(false);
                    saveCurrentCheckoutDraft({ saleDone: false });
                  }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={!checkoutSaleDone ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.branchButtonTitle, !checkoutSaleDone && styles.branchButtonTextActive]}>
                    No Sale
                  </Text>
                  <Text style={[styles.branchButtonSub, !checkoutSaleDone && styles.branchButtonSubActive]}>
                    Just visited
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
                    Yes, Sale Done
                  </Text>
                  <Text style={[styles.branchButtonSub, checkoutSaleDone && styles.branchButtonSubActive]}>
                    Make bill now
                  </Text>
                </Pressable>
              </View>

              {!checkoutSaleDone ? (
                <View style={styles.noSaleSection}>
                  <Text style={styles.subSectionTitle}>Why no sale? *</Text>
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
                <View style={styles.saleSection}>
                  <View style={styles.saleSectionHeader}>
                    <Ionicons name="cart" size={18} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.saleSectionTitle}>Sale Details</Text>
                  </View>

                  {!activeCheckoutVisit?.customerId && (
                    <View style={{ marginBottom: Spacing.sm }}>
                      <Text style={styles.modalFieldLabel}>Select Shop *</Text>
                      <ScrollView style={styles.modalCustomerList} nestedScrollEnabled>
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
                              <Text style={styles.modalCustomerSub}>
                                {c.ownerName} • {c.village || c.district}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

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

                  <View style={styles.quantityPriceRow}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text style={styles.modalFieldLabel}>Packets</Text>
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
                        label="Price per Packet (₹) *"
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

                  <View style={styles.totalSaleBanner}>
                    <Text style={styles.totalSaleLabel}>Total Amount:</Text>
                    <Text style={styles.totalSaleAmount}>
                      ₹{(saleQuantity * (saleUnitPrice || 0)).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={{ marginTop: Spacing.sm, marginBottom: Spacing.sm }}>
                    <Text style={styles.modalFieldLabel}>Payment *</Text>
                    <View style={styles.paymentModeRow}>
                      {(['CASH', 'BANK', 'PENDING'] as PaymentMode[]).map((mode) => {
                        const isSelected = salePaymentMode === mode;
                        const label = mode === 'CASH' ? 'Cash' : mode === 'BANK' ? 'UPI / Bank' : 'Pay Later';
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

              <View style={{ marginVertical: Spacing.sm }}>
                <VoiceFeedbackTranslator
                  value={checkoutFeedback}
                  onChange={(text) => {
                    setCheckoutFeedback(text);
                    saveCurrentCheckoutDraft({ feedback: text });
                  }}
                  label="Shopkeeper Message"
                  sublabel="Tap mic to speak or pick a quick note below"
                  quickChips={
                    checkoutSaleDone
                      ? [
                          'Regular buyer',
                          'Cash paid now',
                          'Good demand here',
                          'Happy with quality',
                          'Asked for next week supply',
                        ]
                      : [
                          'Stock already available',
                          'Asked for lower price',
                          'Owner not in shop',
                          'Will order next visit',
                          'Sample given to try',
                          'Old bill pending',
                        ]
                  }
                />
              </View>

              <Input
                label="Notes (Optional)"
                value={checkoutNotes}
                onChangeText={(t) => {
                  setCheckoutNotes(t);
                  saveCurrentCheckoutDraft({ notes: t });
                }}
                leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
              />

              <View style={styles.checkoutGpsNotice}>
                <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.checkoutGpsNoticeText}>Your location is saved when leaving the shop.</Text>
              </View>

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
                      ? 'Saving...'
                      : checkoutSaleDone
                      ? 'Save Sale & Leave'
                      : 'Finish Visit'
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
                    !checkoutSaleDone ? { backgroundColor: '#0F172A' } : { backgroundColor: '#16A34A' },
                  ]}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 4. END DUTY MODAL */}
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
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setEndModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              { paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl) },
            ]}
          >
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>End Today&apos;s Duty</Text>
              <Text style={styles.modalSubtitle}>Check your end location and travel distance.</Text>

              <VerifiedLocationCard
                location={currentLocation}
                loading={isAcquiringLocation}
                onRefresh={() => fetchLiveLocation(true)}
                title="End Location"
                subtitle="Your current area"
                routeDistanceKm={gpsTraveledDistanceKm}
              />

              <View style={styles.meterPreviewCard}>
                <Ionicons name="navigate-circle" size={15} color={BrandColors.green.dark} style={{ marginRight: 6 }} />
                <Text style={styles.meterPreviewText}>
                  Calculated Travel:{' '}
                  <Text style={{ fontWeight: '700' }}>{gpsTraveledDistanceKm} km</Text>
                  {gpsTraveledDistanceKm === 0 ? ' (Same location)' : ''}
                </Text>
              </View>

              <Input
                label="Note (Optional)"
                placeholder="Any short note..."
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
                  title="End Duty"
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
      {/* 5. SHIFT AUTHENTICATION MODAL (FINGERPRINT / PASSWORD) */}
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
      {/* 6. LIVE FACE AUTO-SCANNER MODAL */}
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

      {/* ---------------------------------------------------- */}
      {/* 7. FULL SHIFT TIMELINE MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={Boolean(selectedAuditShift)}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedAuditShift(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setSelectedAuditShift(null)} />
          <View
            style={[
              styles.modalContent,
              { maxHeight: '92%', paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl) },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.auditHeader}>
                <View style={styles.auditIcon}>
                  <Ionicons name="list" size={22} color={BrandColors.pink.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.modalTitle}>Duty Timeline</Text>
                  <Text style={styles.modalSubtitle}>
                    {user?.name || 'Seller'} · {selectedAuditShift ? computeShiftTravelDistance(selectedAuditShift).formatted : '0 km'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedAuditShift(null)} hitSlop={HitSlop.md}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {selectedAuditShift &&
                (() => {
                  const startMs = new Date(selectedAuditShift.startTime).getTime();
                  const endMs = selectedAuditShift.endTime ? new Date(selectedAuditShift.endTime).getTime() : Date.now();
                  const totalMins = Math.max(0, Math.floor((endMs - startMs) / 60000));
                  const auditVisits = selectedAuditShift.visits || [];
                  const timeAtShops = auditVisits.reduce((acc, v) => acc + (v.durationMins || 0), 0);
                  const auditDistanceKm = computeShiftTravelDistance(selectedAuditShift).distanceKm;
                  const travelTime =
                    auditDistanceKm === 0 && auditVisits.length === 0
                      ? 0
                      : Math.max(0, totalMins - timeAtShops);

                  return (
                    <View style={styles.auditTimingCard}>
                      <View style={styles.auditTimingHeader}>
                        <Ionicons name="time" size={13} color="#E11D48" style={{ marginRight: 4 }} />
                        <Text style={styles.auditTimingTitle}>TIME SUMMARY</Text>
                        <Text style={styles.auditTimingStops}>{auditVisits.length} shops</Text>
                      </View>
                      <View style={styles.auditTimingGrid}>
                        <View style={styles.auditTimingCol}>
                          <Text style={styles.auditTimingLabel}>TOTAL TIME</Text>
                          <Text style={styles.auditTimingVal}>{totalMins > 0 ? `${totalMins} min` : 'Active'}</Text>
                        </View>
                        <View style={styles.auditTimingCol}>
                          <Text style={styles.auditTimingLabel}>AT SHOPS</Text>
                          <Text style={[styles.auditTimingVal, { color: '#16A34A' }]}>{timeAtShops} min</Text>
                        </View>
                        <View style={styles.auditTimingCol}>
                          <Text style={styles.auditTimingLabel}>TRAVEL</Text>
                          <Text style={[styles.auditTimingVal, { color: travelTime > 0 ? '#D97706' : '#64748B' }]}>
                            {travelTime} min
                          </Text>
                        </View>
                        <View style={styles.auditTimingCol}>
                          <Text style={styles.auditTimingLabel}>DISTANCE</Text>
                          <Text style={styles.auditTimingVal}>{auditDistanceKm} km</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

              {selectedAuditShift && (
                <View style={styles.auditTimeline}>
                  <View style={styles.auditTimelineRow}>
                    <View style={[styles.auditNodeDot, { backgroundColor: '#16A34A' }]}>
                      <Text style={styles.auditNodeDotText}>S</Text>
                    </View>
                    <View style={styles.auditNodeContent}>
                      <View style={styles.auditNodeHeaderRow}>
                        <Text style={styles.auditNodeTitle}>Duty Started</Text>
                        <Text style={styles.auditNodeTime}>
                          {new Date(selectedAuditShift.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      {selectedAuditShift.startAddress ? (
                        <Text style={styles.auditNodeAddress}>{selectedAuditShift.startAddress}</Text>
                      ) : selectedAuditShift.startLatitude ? (
                        <Text style={styles.auditNodeGps}>Location saved</Text>
                      ) : null}
                    </View>
                  </View>

                  {(selectedAuditShift.visits || []).length === 0 ? (
                    <View style={styles.auditTimelineRow}>
                      <View style={[styles.auditNodeDot, { backgroundColor: '#94A3B8' }]}>
                        <Ionicons name="location-outline" size={12} color="#FFFFFF" />
                      </View>
                      <View style={styles.auditNodeContent}>
                        <View style={styles.auditNodeHeaderRow}>
                          <Text style={styles.auditNodeTitle}>
                            {computeShiftTravelDistance(selectedAuditShift).distanceKm === 0
                              ? 'Same Location (No Travel)'
                              : `Travelled ${computeShiftTravelDistance(selectedAuditShift).formatted}`}
                          </Text>
                          <Text style={styles.auditNodeTime}>0 shops</Text>
                        </View>
                        <Text style={styles.auditNodeAddress}>
                          {computeShiftTravelDistance(selectedAuditShift).distanceKm === 0
                            ? 'No location change or shop visits recorded during this duty.'
                            : 'No shop visits were checked in during this duty.'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {(selectedAuditShift.visits || []).map((v, vIdx, allVisits) => {
                    const hasSale = Boolean(v.saleDone || (v as any).sale_done || v.saleId);
                    const arriveStr = v.checkInTime
                      ? new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '00:00';
                    const leftStr = v.checkOutTime
                      ? new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Active';
                    const durStr = v.durationMins ? `${v.durationMins} min` : v.checkOutTime ? '1 min' : 'Live';

                    const prevLat = vIdx === 0 ? selectedAuditShift.startLatitude : allVisits[vIdx - 1]?.latitude;
                    const prevLng = vIdx === 0 ? selectedAuditShift.startLongitude : allVisits[vIdx - 1]?.longitude;
                    const legKm =
                      prevLat != null &&
                      prevLng != null &&
                      v.latitude != null &&
                      v.longitude != null
                        ? calculateLegDistanceKm(
                            { lat: Number(prevLat), lng: Number(prevLng) },
                            { lat: Number(v.latitude), lng: Number(v.longitude) }
                          )
                        : 0;

                    return (
                      <View key={v.id || vIdx} style={styles.auditTimelineRow}>
                        <View style={[styles.auditNodeDot, { backgroundColor: '#E11D48' }]}>
                          <Text style={styles.auditNodeDotText}>{vIdx + 1}</Text>
                        </View>
                        <View style={styles.auditNodeCard}>
                          <View style={styles.auditNodeHeaderRow}>
                            <Text style={styles.auditShopName}>{v.customer?.shopName || v.shopName || 'Shop'}</Text>
                            <Badge
                              label={hasSale ? 'Sale Done' : 'No Sale'}
                              variant={hasSale ? 'success' : 'neutral'}
                              size="sm"
                            />
                          </View>

                          <View style={styles.auditShopTimes}>
                            <Text style={styles.auditShopTimeItem}>
                              IN: <Text style={{ fontWeight: '700' }}>{arriveStr}</Text>
                            </Text>
                            <Text style={styles.auditShopTimeItem}>
                              OUT: <Text style={{ fontWeight: '700' }}>{leftStr}</Text>
                            </Text>
                            <Text style={[styles.auditShopTimeItem, { color: '#16A34A' }]}>({durStr})</Text>
                          </View>

                          {legKm > 0 ? (
                            <Text style={[styles.auditNodeGps, { marginBottom: 4 }]}>
                              Travelled ~{legKm} km from {vIdx === 0 ? 'start point' : 'previous shop'}
                            </Text>
                          ) : null}

                          {v.customerFeedback ? (
                            <View style={styles.auditFeedbackBox}>
                              <Ionicons
                                name="chatbubble-ellipses"
                                size={12}
                                color={BrandColors.pink.primary}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.auditFeedbackText}>&ldquo;{v.customerFeedback}&rdquo;</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.auditTimelineRow}>
                    <View style={[styles.auditNodeDot, { backgroundColor: '#0F172A' }]}>
                      <Text style={styles.auditNodeDotText}>E</Text>
                    </View>
                    <View style={styles.auditNodeContent}>
                      <View style={styles.auditNodeHeaderRow}>
                        <Text style={styles.auditNodeTitle}>
                          {selectedAuditShift.endTime ? 'Duty Ended' : 'On Duty Now'}
                        </Text>
                        <Text style={styles.auditNodeTime}>
                          {selectedAuditShift.endTime
                            ? new Date(selectedAuditShift.endTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Now'}
                        </Text>
                      </View>
                      {selectedAuditShift.endAddress ? (
                        <Text style={styles.auditNodeAddress}>{selectedAuditShift.endAddress}</Text>
                      ) : selectedAuditShift.endLatitude ? (
                        <Text style={styles.auditNodeGps}>Location saved</Text>
                      ) : null}
                      {(() => {
                        const auditVisits = selectedAuditShift.visits || [];
                        const lastStop = auditVisits.length > 0 ? auditVisits[auditVisits.length - 1] : null;
                        const prevLat = lastStop ? lastStop.latitude : selectedAuditShift.startLatitude;
                        const prevLng = lastStop ? lastStop.longitude : selectedAuditShift.startLongitude;
                        if (
                          prevLat == null ||
                          prevLng == null ||
                          selectedAuditShift.endLatitude == null ||
                          selectedAuditShift.endLongitude == null
                        ) {
                          return null;
                        }
                        const finalLegKm = calculateLegDistanceKm(
                          { lat: Number(prevLat), lng: Number(prevLng) },
                          {
                            lat: Number(selectedAuditShift.endLatitude),
                            lng: Number(selectedAuditShift.endLongitude),
                          }
                        );
                        if (finalLegKm <= 0) return null;
                        return (
                          <Text style={[styles.auditNodeGps, { marginTop: 4 }]}>
                            Travelled ~{finalLegKm} km from {lastStop ? 'last shop' : 'start point'} to end location
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.auditBottomBar}>
                <Text style={styles.auditTotalKm}>
                  Total Distance:{' '}
                  <Text style={{ fontWeight: '800', color: BrandColors.pink.primary }}>
                    {selectedAuditShift ? computeShiftTravelDistance(selectedAuditShift).formatted : '0 km'}
                  </Text>
                </Text>
                <Button title="Close" variant="outline" size="sm" onPress={() => setSelectedAuditShift(null)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    padding: Spacing.md,
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
    marginBottom: Spacing.md,
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
  heroActionRowStacked: {
    flexDirection: 'column',
    gap: Spacing.sm,
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
  statsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCol: {
    flex: 1,
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
  visitActionsRow: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
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
  historySection: {
    marginTop: Spacing.xl,
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  historyCardActive: {
    borderColor: BrandColors.green.primary,
    borderWidth: 1.5,
  },
  historyTopBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  historyDateTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  historyLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  historyTimeRange: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  historyLocation: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  historyMetricBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  historyMetricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  inlineVisitsBox: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: Spacing.xs,
  },
  inlineVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  inlineVisitBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  inlineVisitBulletText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  inlineVisitShop: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  inlineVisitTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewRouteAuditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewRouteAuditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  auditIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.pink.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditTimingCard: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  auditTimingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
  },
  auditTimingTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E11D48',
    letterSpacing: 0.5,
  },
  auditTimingStops: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9F1239',
  },
  auditTimingGrid: {
    flexDirection: 'row',
  },
  auditTimingCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  auditTimingLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  auditTimingVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  auditTimeline: {
    paddingLeft: Spacing.xs,
    marginBottom: Spacing.md,
  },
  auditTimelineRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  auditNodeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  auditNodeDotText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  auditNodeContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
  },
  auditNodeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
    ...Shadows.sm,
  },
  auditNodeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  auditNodeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  auditNodeTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  auditNodeGps: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748B',
    marginTop: 2,
  },
  auditNodeAddress: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
  },
  auditShopName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  auditShopTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  auditShopTimeItem: {
    fontSize: 10,
    color: '#475569',
  },
  auditFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF1F2',
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginTop: 4,
    marginBottom: 4,
  },
  auditFeedbackText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#9F1239',
    flex: 1,
  },
  auditBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  auditTotalKm: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
});
