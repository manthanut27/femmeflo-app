import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
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
import { categoriesApi } from '@/api/categories';
import { validateCustomerEmail } from '@/api/domainRules';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PaymentMode, ProductItem, ProductStockItem, Shift, ShiftSummary, ShiftVisit } from '@/api/types';
import {
  AttendanceFilterButton,
  AttendanceFilterModal,
} from '@/components/common/AttendanceFilterModal';
import { FaceVerificationModal, type FaceVerificationResult } from '@/components/common/FaceVerificationModal';
import { ShiftAuthVerificationModal, type ShiftAuthResult } from '@/components/common/ShiftAuthVerificationModal';
import { VerifiedLocationCard } from '@/components/common/VerifiedLocationCard';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { CustomerOnboardingForm } from '@/components/customers/CustomerOnboardingForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import type { DropdownOption } from '@/components/ui/SearchableDropdownModal';
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
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useShopLocationAddress } from '@/hooks/useShopLocationAddress';
import { normalizeCustomerItem } from '@/utils/customerSanitizer';
import {
  buildShiftWaypoints,
  calculateLegDistanceKm,
  calculateWaypointRouteKm,
  computeShiftTimingSummary,
  computeShiftTravelDistance,
  formatDurationHuman,
  getVisitDurationSeconds,
} from '@/utils/distanceUtils';
import { draftStorage } from '@/utils/draftStorage';
import { compressImage, DEFAULT_IMAGE_PICKER_OPTIONS } from '@/utils/imageUtils';
import {
  acquireGpsCoordinates,
  formatShortAddressLabel,
  getCurrentLocationWithAddress,
  isWithinIndiaBounds,
  type LocationResult,
} from '@/utils/locationUtils';
import { useResponsiveLayout } from '@/utils/responsive';
import {
  computeAttendanceKpiMetrics,
  getShiftFilterDateRange,
  mergeLiveShiftIntoFilteredList,
  type ShiftFilterState,
} from '@/utils/shiftFilterUtils';

const PREDEFINED_VISIT_REASONS = [
  'Stock already sufficient',
  'Decision maker unavailable',
  'Shop closed',
  'Customer not interested',
  'Payment pending',
  'Order planned for next visit',
  'Sample provided for trial',
];

function getCustomerSavedCoords(customer?: CustomerItem | null): { latitude: number; longitude: number } | null {
  if (!customer) return null;
  const lat = Number(customer.latitude);
  const lng = Number(customer.longitude);
  if (
    customer.latitude != null &&
    customer.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    isWithinIndiaBounds(lat, lng)
  ) {
    return {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    };
  }
  return null;
}

export default function SellerAttendanceScreen() {
  return <SellerAttendanceView />;
}

export function SellerAttendanceView({
  backRoute,
}: {
  backRoute?: string;
} = {}) {
  const insets = useSafeAreaInsets();
  const { width } = useResponsiveLayout();
  const isCompactScreen = width < 380;
  const { user, role } = useAuth();
  const userId = user?.id || 'anonymous';
  const handleBack = useDashboardBackHandler(backRoute || (role === 'MANAGER' ? '/(manager)' : '/(seller)'));

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [historyServerSummary, setHistoryServerSummary] = useState<ShiftSummary | null>(null);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterState>({ preset: 'today' });
  const shiftFilterRef = useRef<ShiftFilterState>(shiftFilter);
  shiftFilterRef.current = shiftFilter;
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [selectedAuditShift, setSelectedAuditShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
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
  const [checkoutShopSearch, setCheckoutShopSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleQuantityStr, setSaleQuantityStr] = useState('1');
  const [saleUnitPrice, setSaleUnitPrice] = useState(25);
  const [saleUnitPriceStr, setSaleUnitPriceStr] = useState('25');
  const [salePaymentMode, setSalePaymentMode] = useState<PaymentMode>('CASH');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Full-Fledged Add New Shop Modal (In-Place during Check-In / Checkout)
  const [quickAddShopVisible, setQuickAddShopVisible] = useState(false);
  const [quickShopTarget, setQuickShopTarget] = useState<'CHECKIN' | 'CHECKOUT'>('CHECKIN');
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopEmail, setNewShopEmail] = useState('');
  const [newShopCategoryId, setNewShopCategoryId] = useState('');
  const [isNewShopCategoryModalOpen, setIsNewShopCategoryModalOpen] = useState(false);
  const [newShopPhotoUri, setNewShopPhotoUri] = useState<string | null>(null);
  const [newShopNoPhotoReason, setNewShopNoPhotoReason] = useState('');
  const [isNewShopReasonDropdownOpen, setIsNewShopReasonDropdownOpen] = useState(false);
  const [newShopErrors, setNewShopErrors] = useState<Record<string, string>>({});
  const [newShopFeedback, setNewShopFeedback] = useState<{
    type: FeedbackType;
    title?: string;
    message: string;
  } | null>(null);
  const [isSavingQuickShop, setIsSavingQuickShop] = useState(false);

  const quickShopLoc = useShopLocationAddress({
    initialDistrict: user?.district || '',
    initialState: user?.state || 'Maharashtra',
    onNotice: (notice) => setNewShopFeedback(notice),
  });

  const newShopCategoryOptions = useMemo<DropdownOption[]>(() => {
    return categories.map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: cat.description || undefined,
      icon: 'pricetag-outline',
    }));
  }, [categories]);

  const selectedNewShopCategory = useMemo(() => {
    return categories.find((c) => c.id === (newShopCategoryId || categories[0]?.id));
  }, [categories, newShopCategoryId]);

  const filteredCheckoutCustomers = useMemo(() => {
    const q = checkoutShopSearch.trim().toLowerCase();
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
  }, [customers, checkoutShopSearch]);

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
      const range = getShiftFilterDateRange(shiftFilterRef.current);
      const [shiftRes, custRes, prodRes, historyRes, invRes, catRes] = await Promise.all([
        sellerApi.getCurrentShift().catch(async () => {
          const cached = await draftStorage.getActiveShift(userId);
          return { shift: cached };
        }),
        sellerApi.listCustomers({ pageSize: 100 }).catch(() => ({ items: [] })),
        sellerApi.listProducts().catch(() => ({ items: [] })),
        sellerApi
          .getShiftHistory({ page: 1, pageSize: 200, from: range.from, to: range.to })
          .catch(() => ({ items: [], summary: undefined })),
        sellerApi.getInventory().then((inv) => ({ ...inv, _ok: true })).catch(() => ({ balance: 0, products: [], _ok: false })),
        categoriesApi.listCategories().catch(() => ({ items: [] })),
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
      setHistoryServerSummary((historyRes as any)?.summary || null);

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
        setSaleUnitPriceStr((prev) => (prev ? prev : String(firstBasePrice || 25)));
      }

      const map: Record<string, number> = {};
      if ((invRes as any)?.products && Array.isArray((invRes as any).products)) {
        (invRes as any).products.forEach((p: ProductStockItem) => {
          const pId = p.productId || (p as any).id;
          if (pId) {
            map[pId] = p.balance;
          }
        });
      }
      const totalBal = (invRes as any)?.balance ?? (invRes as any)?.remaining ?? 0;
      if (Object.keys(map).length === 0 && totalBal > 0 && prodList.length > 0) {
        prodList.forEach((p) => {
          map[p.id] = totalBal;
        });
      }
      setStockMap(map);
      setInventoryLoaded(Boolean((invRes as any)?._ok));

      const catList = Array.isArray((catRes as any)?.items) ? (catRes as any).items : [];
      setCategories(catList);
      if (catList.length > 0) {
        setNewShopCategoryId((prev) => prev || catList[0].id);
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

  const isFirstFilterRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstFilterRenderRef.current) {
      isFirstFilterRenderRef.current = false;
      return;
    }
    let cancelled = false;
    const range = getShiftFilterDateRange(shiftFilter);
    sellerApi
      .getShiftHistory({ page: 1, pageSize: 200, from: range.from, to: range.to })
      .then((historyRes) => {
        if (cancelled) return;
        const histList = (historyRes as any)?.items ?? (historyRes as any)?.shifts ?? [];
        setPastShifts(Array.isArray(histList) ? histList : []);
        setHistoryServerSummary((historyRes as any)?.summary || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shiftFilter]);

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

  function closeQuickAddShopModal(targetOverride?: 'CHECKIN' | 'CHECKOUT') {
    const target = targetOverride || quickShopTarget;
    setQuickAddShopVisible(false);
    if (target === 'CHECKIN') {
      setCheckInModalVisible(true);
    } else {
      setCheckOutModalVisible(true);
    }
  }

  function openQuickAddShopModal(target: 'CHECKIN' | 'CHECKOUT') {
    setQuickShopTarget(target);
    if (target === 'CHECKIN') {
      setCheckInModalVisible(false);
    } else {
      setCheckOutModalVisible(false);
    }

    setNewShopName(target === 'CHECKIN' && checkInCustomShopName.trim() ? checkInCustomShopName.trim() : '');
    setNewShopOwner('');
    setNewShopPhone('');
    setNewShopEmail('');
    setNewShopPhotoUri(null);
    setNewShopNoPhotoReason('');
    setIsNewShopReasonDropdownOpen(false);
    quickShopLoc.resetFields(user?.district || '', user?.state || 'Maharashtra');
    setNewShopErrors({});
    setNewShopFeedback(null);
    if (!newShopCategoryId && categories.length > 0) {
      setNewShopCategoryId(categories[0].id);
    }

    setQuickAddShopVisible(true);
    quickShopLoc.fetchCurrentLocation(true);
  }

  async function handlePickNewShopPhoto() {
    Alert.alert('Take Shop Photo', 'Choose Camera or Gallery', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Needed', 'Please allow camera access in phone settings.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setNewShopPhotoUri(compressed.uri);
            setIsNewShopReasonDropdownOpen(false);
            if (newShopErrors.noPhotoReason) {
              setNewShopErrors((prev) => ({ ...prev, noPhotoReason: '' }));
            }
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Gallery Needed', 'Please allow photo access in phone settings.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync(DEFAULT_IMAGE_PICKER_OPTIONS);
          if (!res.canceled && res.assets[0]?.uri) {
            const compressed = await compressImage(res.assets[0].uri);
            setNewShopPhotoUri(compressed.uri);
            setIsNewShopReasonDropdownOpen(false);
            if (newShopErrors.noPhotoReason) {
              setNewShopErrors((prev) => ({ ...prev, noPhotoReason: '' }));
            }
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function validateQuickShopForm() {
    const errs: Record<string, string> = {};
    if (!newShopName.trim()) {
      errs.shopName = 'Please enter shop name.';
    }
    if (!newShopOwner.trim()) {
      errs.ownerName = "Please enter owner's name.";
    }
    const cleanPhone = newShopPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Enter valid 10-digit mobile number.';
    }
    const trimmedEmail = newShopEmail.trim();
    if (trimmedEmail && !validateCustomerEmail(trimmedEmail)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!(newShopCategoryId || categories[0]?.id) && categories.length > 0) {
      errs.categoryId = 'Please select shop category.';
    }
    if (
      !quickShopLoc.pincode.trim() ||
      quickShopLoc.pincode.trim().length !== 6 ||
      !/^\d{6}$/.test(quickShopLoc.pincode.trim())
    ) {
      errs.pincode = 'Enter 6-digit PIN code.';
    }
    if (!quickShopLoc.address.trim()) {
      errs.address = 'Please enter full shop address.';
    }
    if (quickShopLoc.locationMode === 'MANUAL' && !quickShopLoc.streetName.trim()) {
      errs.streetName = 'Please enter street or road name.';
    }
    if (!quickShopLoc.district.trim()) {
      errs.district = 'Please enter district.';
    }
    if (!quickShopLoc.stateName.trim()) {
      errs.stateName = 'Please enter state.';
    }
    if (!newShopPhotoUri && !newShopNoPhotoReason.trim()) {
      errs.noPhotoReason = 'Please upload a photo or select why no photo is added.';
    }
    setNewShopErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreateQuickShop() {
    if (isSavingQuickShop) return;
    if (!validateQuickShopForm()) {
      setNewShopFeedback({
        type: 'error',
        title: 'Please Check',
        message: 'Fill all required fields marked in red.',
      });
      Alert.alert('Please Check', 'Fill all required fields marked in red.');
      return;
    }

    const categoryId = newShopCategoryId || categories[0]?.id;
    if (!categoryId) {
      Alert.alert('Category Required', 'No active shop categories found. Please contact Admin.');
      return;
    }

    const cleanPhone = newShopPhone.replace(/\D/g, '').slice(-10);
    setIsSavingQuickShop(true);
    setNewShopFeedback(null);

    try {
      // Strictly resolve according to mode: CURRENT uses GPS; MANUAL forward-geocodes manual address/PIN (never falls back to unrelated GPS!)
      const resolvedCoords = await quickShopLoc.resolveCoordinatesForSubmit();
      const hasResolvedCoords = resolvedCoords.latitude != null && resolvedCoords.longitude != null;

      const res = await sellerApi.createCustomer({
        shopName: newShopName.trim(),
        ownerName: newShopOwner.trim(),
        email: newShopEmail.trim() || undefined,
        phone: `+91${cleanPhone}`,
        categoryId,
        streetName: quickShopLoc.streetName.trim() || undefined,
        address: quickShopLoc.combinedFullAddress || quickShopLoc.address.trim(),
        pincode: quickShopLoc.pincode.trim(),
        state: quickShopLoc.stateName.trim(),
        district: quickShopLoc.district.trim(),
        village: quickShopLoc.village.trim() || undefined,
        latitude: resolvedCoords.latitude,
        longitude: resolvedCoords.longitude,
        accuracy: resolvedCoords.accuracy,
        photoUri: newShopPhotoUri || undefined,
        noPhotoReason: newShopPhotoUri
          ? newShopNoPhotoReason.trim() || 'Storefront photo captured'
          : newShopNoPhotoReason.trim(),
        sellerId: user?.id || undefined,
      });

      let createdCustomer: CustomerItem = normalizeCustomerItem((res as any)?.customer || res);
      if (newShopPhotoUri && createdCustomer?.id) {
        try {
          const photoRes = await sellerApi.uploadCustomerPhoto(createdCustomer.id, newShopPhotoUri);
          if (photoRes?.photoUrl) {
            createdCustomer = { ...createdCustomer, photoUrl: photoRes.photoUrl };
          }
        } catch (photoErr) {
          console.warn('Check-in quick shop photo upload fallback failed, record preserved', photoErr);
        }
      }

      if (createdCustomer?.id) {
        setCustomers((prev) => [createdCustomer, ...prev.filter((c) => c.id !== createdCustomer.id)]);
        if (quickShopTarget === 'CHECKIN') {
          setSelectedCustomerId(createdCustomer.id);
          setCheckInCustomShopName('');
          setCheckInCustomerSearch('');
        } else {
          setCheckoutCustomerId(createdCustomer.id);
          saveCurrentCheckoutDraft({ selectedCustomerId: createdCustomer.id });
        }
        closeQuickAddShopModal();
        Alert.alert(
          'Shop Added',
          `${createdCustomer.shopName} has been saved${
            hasResolvedCoords
              ? quickShopLoc.locationMode === 'MANUAL'
                ? ' with address GPS'
                : ' with GPS'
              : ''
          }${newShopPhotoUri ? ' & photo' : ''} and selected.`
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to save new shop.';
      setNewShopFeedback({ type: 'error', title: 'Could Not Save', message: msg });
      Alert.alert('Could Not Add Shop', msg);
    } finally {
      setIsSavingQuickShop(false);
    }
  }

  async function handleCheckInVisit() {
    if (isCheckingIn) return;
    if (!selectedCustomerId && !checkInCustomShopName.trim()) {
      Alert.alert('Select or Add Shop', 'Please select an existing shop, add a new shop, or type the shop name.');
      return;
    }

    setIsCheckingIn(true);
    setFeedback(null);

    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      const savedCustomerCoords = getCustomerSavedCoords(customer);
      const coords = savedCustomerCoords || (await acquireCoordinates());
      if (!coords) {
        Alert.alert(
          'GPS Location Required',
          'Could not capture your live GPS location at this shop. Please enable High Accuracy GPS and tap Check In again.'
        );
        return;
      }

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
    setCheckoutShopSearch('');

    const draft = await draftStorage.getVisitCheckoutDraft(userId, visit.id);
    if (draft) {
      setCheckoutSaleDone(Boolean(draft.saleDone));
      setCheckoutReason(draft.reason || '');
      setCheckoutFeedback(draft.feedback || '');
      setCheckoutNotes(draft.notes || '');
      if (draft.selectedCustomerId) setCheckoutCustomerId(draft.selectedCustomerId);
      if (draft.selectedProductId) setSelectedProductId(draft.selectedProductId);
      const qVal = draft.quantity || 1;
      setSaleQuantity(qVal);
      setSaleQuantityStr(String(qVal));
      const pVal = draft.unitPrice || 25;
      setSaleUnitPrice(pVal);
      setSaleUnitPriceStr(String(pVal));
      if (draft.paymentMode) setSalePaymentMode(draft.paymentMode);
    } else {
      setCheckoutSaleDone(false);
      setCheckoutReason('');
      setCheckoutFeedback('');
      setCheckoutNotes('');
      setSaleQuantity(1);
      setSaleQuantityStr('1');
      const defaultProd = products[0];
      if (defaultProd) {
        setSelectedProductId(defaultProd.id);
        const baseRupees = defaultProd.basePricePaise / 100 || 25;
        setSaleUnitPrice(baseRupees);
        setSaleUnitPriceStr(String(baseRupees));
      } else {
        setSaleUnitPrice(25);
        setSaleUnitPriceStr('25');
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

    const targetCustomerId = checkoutCustomerId || activeCheckoutVisit.customerId;
    const chosenProduct = products.find((p) => p.id === selectedProductId) || products[0];
    const prodId = chosenProduct?.id || '';
    const availStock = prodId ? (stockMap[prodId] ?? 0) : 0;
    const minPricePaise = chosenProduct?.minimumPricePaise ?? 2500;
    const unitPricePaise = Math.round((saleUnitPrice || 0) * 100);
    const isLowPriceSale = checkoutSaleDone && unitPricePaise > 0 && unitPricePaise < minPricePaise;

    if (checkoutSaleDone) {
      if (!targetCustomerId) {
        Alert.alert('Select or Add Shop', 'Please select a shop or add a new shop for this sale.');
        return;
      }
      if (!saleQuantity || saleQuantity <= 0) {
        Alert.alert('Enter Quantity', 'Please enter at least 1 packet.');
        return;
      }
      if (!saleUnitPrice || saleUnitPrice <= 0) {
        Alert.alert('Enter Price', 'Please enter a valid price per packet.');
        return;
      }
      if (inventoryLoaded && chosenProduct) {
        if (availStock <= 0) {
          Alert.alert('Out of Stock', `You currently have 0 packets of ${chosenProduct.name} available.`);
          return;
        }
        if (saleQuantity > availStock) {
          Alert.alert(
            'Not Enough Stock',
            `Only ${availStock.toLocaleString('en-IN')} packets of ${chosenProduct.name} available (${saleQuantity} entered).`
          );
          return;
        }
      }
    }

    setIsCheckingOut(true);
    setFeedback(null);

    try {
      // Reuse selected shop's saved coordinates or the active visit's check-in pin
      // instead of pulling drifted live indoor GPS during checkout.
      const targetCustomer = customers.find((c) => c.id === targetCustomerId);
      const customerSavedCoords = getCustomerSavedCoords(targetCustomer);
      const visitLat = Number(activeCheckoutVisit.latitude);
      const visitLng = Number(activeCheckoutVisit.longitude);
      const hasValidVisitCoords =
        activeCheckoutVisit.latitude != null &&
        activeCheckoutVisit.longitude != null &&
        Number.isFinite(visitLat) &&
        Number.isFinite(visitLng) &&
        visitLat !== 0 &&
        visitLng !== 0 &&
        isWithinIndiaBounds(visitLat, visitLng);

      const coords =
        customerSavedCoords ||
        (hasValidVisitCoords
          ? { latitude: Number(visitLat.toFixed(6)), longitude: Number(visitLng.toFixed(6)) }
          : await acquireCoordinates());

      if (!coords) {
        Alert.alert(
          'GPS Location Required',
          'Could not determine shop GPS location when finishing visit. Please turn ON High Accuracy GPS and try again.'
        );
        return;
      }

      let generatedSaleId: string | undefined = undefined;
      let createdSaleStatus: string | undefined = undefined;

      if (checkoutSaleDone && targetCustomerId) {
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
        createdSaleStatus = createdSale?.status;
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
      const rawStaySecs = Math.max(
        1,
        Math.round((new Date(checkoutTimestamp).getTime() - (isNaN(checkInMs) ? Date.now() : checkInMs)) / 1000)
      );
      const stayDisplayStr = formatDurationHuman(rawStaySecs);
      const calcDurationMins = updatedVisit?.durationMins ?? Math.round((rawStaySecs / 60) * 100) / 100;

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

      const pendingApproval = createdSaleStatus === 'PENDING_APPROVAL' || isLowPriceSale;
      const successTitle = checkoutSaleDone
        ? pendingApproval
          ? 'Check Out & Sent for Approval'
          : 'Check Out & Sale Saved'
        : 'Checked Out of Shop';
      const successMessage = checkoutSaleDone
        ? pendingApproval
          ? `Stayed ${stayDisplayStr} · Low-price bill (₹${(saleQuantity * (saleUnitPrice || 0)).toLocaleString('en-IN')}) sent to Admin for approval.`
          : `Stayed ${stayDisplayStr} · Sale saved: ₹${(saleQuantity * (saleUnitPrice || 0)).toLocaleString('en-IN')}.`
        : `Stayed ${stayDisplayStr} (${checkoutReason || 'Shop Visit'}).`;

      setFeedback({
        type: pendingApproval ? 'warning' : 'success',
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

  // Attendance filter & KPIs across active period/date
  const dateRangeInfo = useMemo(
    () => getShiftFilterDateRange(shiftFilter),
    [shiftFilter]
  );

  const filteredHistoryShifts = useMemo(
    () => mergeLiveShiftIntoFilteredList(pastShifts, currentShift, shiftFilter),
    [pastShifts, currentShift, shiftFilter]
  );

  const overallMetrics = useMemo(() => {
    const kpi = computeAttendanceKpiMetrics(
      filteredHistoryShifts,
      historyServerSummary,
      Boolean(currentShift)
    );
    return {
      ...kpi,
      totalDays: kpi.totalShifts,
      completedDays: kpi.completedShifts,
      totalShops: kpi.shopsVisited,
      totalKm: kpi.totalDistanceKm.toFixed(1),
    };
  }, [filteredHistoryShifts, historyServerSummary, currentShift]);

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
        showBack
        onBack={handleBack}
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

          {/* 2. Filtered Attendance Summary KPIs */}
          <View style={styles.kpiSectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kpiSectionTitle}>Duty KPIs · {dateRangeInfo.label}</Text>
              <Text style={styles.kpiSectionSub}>
                Shops visited, distance & total time
              </Text>
            </View>
            <AttendanceFilterButton
              onPress={() => setFilterModalVisible(true)}
              hasActiveFilter={shiftFilter.preset !== 'today'}
              accentColor={BrandColors.pink.primary}
              accessibilityLabel="Filter attendance KPI and log"
            />
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsGridRow}>
              <View style={styles.statCol}>
                <StatCard
                  title="Shops Visited"
                  value={overallMetrics.totalShops}
                  subtitle={`${overallMetrics.salesDoneVisits} with sale`}
                  icon="storefront-outline"
                  iconColor="#0284C7"
                  iconBg="#F0F9FF"
                />
              </View>
              <View style={styles.statCol}>
                <StatCard
                  title="Total KM"
                  value={`${overallMetrics.totalKm} km`}
                  subtitle="Distance traveled"
                  icon="navigate-outline"
                  iconColor="#D97706"
                  iconBg="#FFFBEB"
                />
              </View>
            </View>
            <View style={styles.statsGridRow}>
              <View style={styles.statCol}>
                <StatCard
                  title="Total Time"
                  value={overallMetrics.totalTimeLabel}
                  subtitle="Shift duration"
                  icon="time-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>
              <View style={styles.statCol}>
                <StatCard
                  title="Completed"
                  value={`${overallMetrics.completedDays} / ${overallMetrics.totalDays}`}
                  subtitle={`${overallMetrics.activeShifts} active`}
                  icon="checkmark-circle-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
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
                label={`${filteredHistoryShifts.length} ${filteredHistoryShifts.length === 1 ? 'Day' : 'Days'}`}
                variant="neutral"
              />
            </View>

            {filteredHistoryShifts.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyHistoryTitle}>No records for {dateRangeInfo.label}</Text>
                <Text style={styles.emptyHistoryText}>
                  Tap the filter icon above to switch period (Week, Month, 3M, 6M) or select a date.
                </Text>
              </View>
            ) : (
              filteredHistoryShifts.map((s, idx) => {
                const isActive = s.status === 'ACTIVE' || (!s.endTime && Boolean(s.startTime));
                const isExpanded = Boolean(expandedShiftIds[s.id]);
                const shiftVisits = s.visits || [];
                const shiftTiming = computeShiftTimingSummary(s);
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

                const durationStr = shiftTiming.totalSeconds > 0 ? shiftTiming.formattedTotal : '0s';

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
                          {shiftTiming.formattedDistance}
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
              <Text style={styles.modalSubtitle}>Choose an existing shop or add a new shop to check in</Text>

            <View style={styles.sectionLabelRow}>
              <Text style={styles.modalFieldLabel}>Select Shop</Text>
              <Pressable
                style={styles.addShopInlineBtn}
                onPress={() => openQuickAddShopModal('CHECKIN')}
                hitSlop={HitSlop.sm}
              >
                <Ionicons name="add-circle-outline" size={14} color={BrandColors.pink.dark} />
                <Text style={styles.addShopInlineBtnText}>Add New Shop</Text>
              </Pressable>
            </View>
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
              {filteredCheckInCustomers.length === 0 ? (
                <View style={styles.emptyShopBox}>
                  <Ionicons name="storefront-outline" size={24} color="#94A3B8" />
                  <Text style={styles.emptyShopText}>
                    {customers.length === 0
                      ? 'No shops added yet. Add a new shop first to link visits and bills.'
                      : 'No matching shop found.'}
                  </Text>
                  <Button
                    title="+ Add New Shop"
                    size="sm"
                    variant="primary"
                    onPress={() => openQuickAddShopModal('CHECKIN')}
                  />
                </View>
              ) : (
                filteredCheckInCustomers.map((c) => {
                  const isSelected = selectedCustomerId === c.id;
                  const savedPin = getCustomerSavedCoords(c);
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
                        {savedPin ? ' · Saved GPS' : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={{ marginTop: Spacing.sm }}>
              <Text style={styles.modalFieldLabel}>Or Type Walk-In Shop Name</Text>
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

            {(() => {
              const chosenCust = customers.find((c) => c.id === selectedCustomerId);
              const savedPin = getCustomerSavedCoords(chosenCust);
              return (
                <View style={styles.checkoutGpsNotice}>
                  <Ionicons name="location" size={14} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={[styles.checkoutGpsNoticeText, { flex: 1 }]} numberOfLines={2}>
                    {savedPin
                      ? `Using ${chosenCust?.shopName}'s saved GPS (${savedPin.latitude.toFixed(4)}, ${savedPin.longitude.toFixed(4)})`
                      : isAcquiringLocation
                      ? 'Fetching live shop GPS location...'
                      : currentLocation?.address
                      ? `Live GPS Ready: ${formatShortAddressLabel(currentLocation.address)} (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
                      : 'Live shop GPS will be captured when you Check In.'}
                  </Text>
                  {!savedPin ? (
                    <Pressable onPress={() => fetchLiveLocation(true)} hitSlop={HitSlop.sm} style={{ marginLeft: 8 }}>
                      <Ionicons name="refresh" size={16} color="#16A34A" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })()}

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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                          return formatDurationHuman(s);
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
                      <View style={styles.sectionLabelRow}>
                        <Text style={styles.modalFieldLabel}>Select Shop *</Text>
                        <Pressable
                          style={styles.addShopInlineBtn}
                          onPress={() => openQuickAddShopModal('CHECKOUT')}
                          hitSlop={HitSlop.sm}
                        >
                          <Ionicons name="add-circle-outline" size={14} color={BrandColors.pink.dark} />
                          <Text style={styles.addShopInlineBtnText}>Add New Shop</Text>
                        </Pressable>
                      </View>
                      <View style={styles.checkInSearchRow}>
                        <Ionicons name="search" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.checkInSearchInput}
                          placeholder="Search shop..."
                          placeholderTextColor="#94A3B8"
                          value={checkoutShopSearch}
                          onChangeText={setCheckoutShopSearch}
                          autoCorrect={false}
                        />
                        {checkoutShopSearch ? (
                          <Pressable onPress={() => setCheckoutShopSearch('')} hitSlop={HitSlop.sm}>
                            <Ionicons name="close-circle" size={15} color="#94A3B8" />
                          </Pressable>
                        ) : null}
                      </View>
                      <ScrollView style={styles.modalCustomerList} nestedScrollEnabled>
                        {filteredCheckoutCustomers.length === 0 ? (
                          <View style={styles.emptyShopBox}>
                            <Text style={styles.emptyShopText}>
                              No shops found. Add a shop now to bill this sale cleanly.
                            </Text>
                            <Button
                              title="+ Add New Shop"
                              size="sm"
                              variant="primary"
                              onPress={() => openQuickAddShopModal('CHECKOUT')}
                            />
                          </View>
                        ) : (
                          filteredCheckoutCustomers.map((c) => {
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
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}

                  {(() => {
                    const activeProd = products.find((p) => p.id === selectedProductId) || products[0];
                    const activeAvail = activeProd ? (stockMap[activeProd.id] ?? 0) : 0;
                    const minPricePaise = activeProd?.minimumPricePaise ?? 2500;
                    const unitPaise = Math.round((saleUnitPrice || 0) * 100);
                    const isBelowMinPrice = saleUnitPrice > 0 && unitPaise < minPricePaise;
                    const isStockOut = inventoryLoaded && Boolean(activeProd) && activeAvail <= 0;
                    const isOverStock = inventoryLoaded && Boolean(activeProd) && activeAvail > 0 && saleQuantity > activeAvail;

                    return (
                      <>
                        <View style={{ marginBottom: Spacing.sm }}>
                          <Text style={styles.modalFieldLabel}>Select Product *</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                            {products.map((p) => {
                              const isSelected = (activeProd?.id || selectedProductId) === p.id;
                              const pStock = stockMap[p.id] ?? 0;
                              return (
                                <Pressable
                                  key={p.id}
                                  style={[styles.productCard, isSelected && styles.productCardActive]}
                                  onPress={() => {
                                    setSelectedProductId(p.id);
                                    const base = p.basePricePaise / 100 || 25;
                                    setSaleUnitPrice(base);
                                    setSaleUnitPriceStr(String(base));
                                    const clamped = pStock > 0 && saleQuantity > pStock ? pStock : saleQuantity;
                                    if (clamped !== saleQuantity) {
                                      setSaleQuantity(clamped);
                                      setSaleQuantityStr(String(clamped));
                                    }
                                    saveCurrentCheckoutDraft({
                                      selectedProductId: p.id,
                                      unitPrice: base,
                                      quantity: clamped,
                                    });
                                  }}
                                >
                                  <Text style={[styles.productCardName, isSelected && styles.productCardNameActive]}>
                                    {p.name}
                                  </Text>
                                  <Text style={styles.productCardPrice}>₹{p.basePricePaise / 100} / pkt</Text>
                                  <View
                                    style={[
                                      styles.productStockTag,
                                      inventoryLoaded && pStock <= 0 && styles.productStockTagEmpty,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.productStockTagText,
                                        inventoryLoaded && pStock <= 0 && { color: '#B91C1C' },
                                      ]}
                                    >
                                      {!inventoryLoaded
                                        ? 'Stock: —'
                                        : pStock > 0
                                        ? `Avail: ${pStock} pkts`
                                        : 'Out of stock'}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>

                        <View style={styles.quantityPriceRow}>
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <Text style={styles.modalFieldLabel}>
                              Packets {inventoryLoaded && activeProd ? `(${activeAvail} avail)` : ''}
                            </Text>
                            <View style={styles.stepperRow}>
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => {
                                  const newQ = Math.max(1, saleQuantity - 1);
                                  setSaleQuantity(newQ);
                                  setSaleQuantityStr(String(newQ));
                                  saveCurrentCheckoutDraft({ quantity: newQ });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Decrease packets"
                              >
                                <Text style={styles.stepperBtnText}>-</Text>
                              </Pressable>
                              <TextInput
                                keyboardType="numeric"
                                value={saleQuantityStr}
                                onChangeText={(t) => {
                                  const cleaned = t.replace(/[^0-9]/g, '');
                                  setSaleQuantityStr(cleaned);
                                  const parsed = cleaned ? parseInt(cleaned, 10) : 0;
                                  const validQty = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                                  setSaleQuantity(validQty);
                                  saveCurrentCheckoutDraft({ quantity: validQty });
                                }}
                                style={styles.stepperInput}
                                placeholder="0"
                                placeholderTextColor="#94A3B8"
                              />
                              <Pressable
                                style={styles.stepperBtn}
                                onPress={() => {
                                  const candidate = saleQuantity + 1;
                                  const bounded =
                                    inventoryLoaded && activeAvail > 0
                                      ? Math.min(candidate, activeAvail)
                                      : candidate;
                                  setSaleQuantity(bounded);
                                  setSaleQuantityStr(String(bounded));
                                  saveCurrentCheckoutDraft({ quantity: bounded });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Increase packets"
                              >
                                <Text style={styles.stepperBtnText}>+</Text>
                              </Pressable>
                            </View>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Input
                              label="Price per Packet (₹) *"
                              value={saleUnitPriceStr}
                              onChangeText={(t) => {
                                const cleaned = t.replace(/[^0-9.]/g, '');
                                setSaleUnitPriceStr(cleaned);
                                const val = parseFloat(cleaned) || 0;
                                setSaleUnitPrice(val);
                                saveCurrentCheckoutDraft({ unitPrice: val });
                              }}
                              keyboardType="numeric"
                              leftIcon={<Text style={{ fontWeight: '700', color: '#64748B' }}>₹</Text>}
                              containerStyle={{ marginBottom: 0 }}
                            />
                          </View>
                        </View>

                        {isStockOut || isOverStock ? (
                          <View style={styles.stockWarningBox}>
                            <Ionicons name="alert-circle" size={16} color="#DC2626" />
                            <Text style={styles.stockWarningText}>
                              {isStockOut
                                ? `${activeProd?.name || 'Product'} is out of stock (0 packets available).`
                                : `Only ${activeAvail.toLocaleString('en-IN')} packets available (${saleQuantity} entered).`}
                            </Text>
                          </View>
                        ) : null}

                        {isBelowMinPrice ? (
                          <View style={styles.lowPriceWarningBox}>
                            <Ionicons name="warning-outline" size={16} color="#D97706" />
                            <Text style={styles.lowPriceWarningText}>
                              Below ₹{(minPricePaise / 100).toFixed(2)}/pkt floor — Sale will be sent to Admin for price approval.
                            </Text>
                          </View>
                        ) : null}
                      </>
                    );
                  })()}

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

              {gpsTraveledDistanceKm === 0 ? (
                <View style={styles.meterPreviewCard}>
                  <Ionicons name="navigate-circle" size={15} color={BrandColors.green.dark} style={{ marginRight: 6 }} />
                  <Text style={styles.meterPreviewText}>
                    Calculated Travel: <Text style={{ fontWeight: '700' }}>0 km</Text> (Same location · Stationary)
                  </Text>
                </View>
              ) : null}

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
        userRole={role || 'SELLER'}
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
        userRole={role || 'SELLER'}
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
              {(() => {
                const timelineSummary = computeShiftTimingSummary(selectedAuditShift);
                const auditVisits = selectedAuditShift?.visits || [];
                return (
                  <>
                    <View style={styles.auditHeader}>
                      <View style={styles.auditIcon}>
                        <Ionicons name="list" size={22} color={BrandColors.pink.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.modalTitle}>Duty Timeline</Text>
                        <Text style={styles.modalSubtitle}>
                          {user?.name || 'Seller'} · {timelineSummary.formattedDistance}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedAuditShift(null)} hitSlop={HitSlop.md}>
                        <Ionicons name="close" size={22} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {selectedAuditShift ? (
                      <View style={styles.auditTimingCard}>
                        <View style={styles.auditTimingHeader}>
                          <Ionicons name="time" size={13} color="#E11D48" style={{ marginRight: 4 }} />
                          <Text style={styles.auditTimingTitle}>TIME SUMMARY</Text>
                          <Text style={styles.auditTimingStops}>
                            {auditVisits.length} {auditVisits.length === 1 ? 'shop' : 'shops'}
                          </Text>
                        </View>
                        <View style={styles.auditTimingGrid}>
                          <View style={styles.auditTimingCol}>
                            <Text style={styles.auditTimingLabel}>TOTAL TIME</Text>
                            <Text style={styles.auditTimingVal}>{timelineSummary.formattedTotal}</Text>
                          </View>
                          <View style={styles.auditTimingCol}>
                            <Text style={styles.auditTimingLabel}>AT SHOPS</Text>
                            <Text style={[styles.auditTimingVal, { color: '#16A34A' }]}>
                              {timelineSummary.formattedAtShops}
                            </Text>
                          </View>
                          <View style={styles.auditTimingCol}>
                            <Text style={styles.auditTimingLabel}>TRAVEL</Text>
                            <Text
                              style={[
                                styles.auditTimingVal,
                                { color: timelineSummary.travelSeconds > 0 ? '#D97706' : '#64748B' },
                              ]}
                            >
                              {timelineSummary.formattedTravel}
                            </Text>
                          </View>
                          <View style={styles.auditTimingCol}>
                            <Text style={styles.auditTimingLabel}>DISTANCE</Text>
                            <Text style={styles.auditTimingVal}>{timelineSummary.formattedDistance}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {selectedAuditShift ? (
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

                        {auditVisits.length === 0 ? (
                          <View style={styles.auditTimelineRow}>
                            <View style={[styles.auditNodeDot, { backgroundColor: '#94A3B8' }]}>
                              <Ionicons name="location-outline" size={12} color="#FFFFFF" />
                            </View>
                            <View style={styles.auditNodeContent}>
                              <View style={styles.auditNodeHeaderRow}>
                                <Text style={styles.auditNodeTitle}>
                                  {timelineSummary.distanceKm === 0
                                    ? 'Same Location (No Travel)'
                                    : `Travelled ${timelineSummary.formattedDistance}`}
                                </Text>
                                <Text style={styles.auditNodeTime}>0 shops</Text>
                              </View>
                              <Text style={styles.auditNodeAddress}>
                                {timelineSummary.distanceKm === 0
                                  ? 'No location change or shop visits recorded during this duty.'
                                  : 'No shop visits were checked in during this duty.'}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {auditVisits.map((v, vIdx, allVisits) => {
                          const hasSale = Boolean(v.saleDone || (v as any).sale_done || v.saleId);
                          const arriveStr = v.checkInTime
                            ? new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '00:00';
                          const leftStr = v.checkOutTime
                            ? new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Active';
                          const visitSecs = getVisitDurationSeconds(v);
                          const durStr = visitSecs > 0 ? formatDurationHuman(visitSecs) : v.checkOutTime ? '1s' : 'Live';

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
                    ) : null}

                    <View style={styles.auditBottomBar}>
                      <Text style={styles.auditTotalKm}>
                        Total Distance:{' '}
                        <Text style={{ fontWeight: '800', color: BrandColors.pink.primary }}>
                          {timelineSummary.formattedDistance}
                        </Text>
                      </Text>
                      <Button title="Close" variant="outline" size="sm" onPress={() => setSelectedAuditShift(null)} />
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 8. FULL ADD NEW SHOP MODAL (IN-PLACE CHECK-IN / SALE) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={quickAddShopVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => closeQuickAddShopModal()}
      >
        <CustomerOnboardingForm
          role="SELLER"
          showBatchEntry={false}
          onBack={() => closeQuickAddShopModal()}
          onOpenBatchEntry={() => {}}
          locationMode={quickShopLoc.locationMode}
          onSelectCurrentLocation={() => {
            setNewShopFeedback(null);
            quickShopLoc.fetchCurrentLocation(true);
          }}
          onSelectManualAddress={() => {
            setNewShopFeedback(null);
            quickShopLoc.switchToManualMode();
          }}
          onClearManualAddress={() => {
            quickShopLoc.clearManualAddressFields();
            setNewShopErrors((prev) => ({
              ...prev,
              address: '',
              streetName: '',
              pincode: '',
              district: '',
              stateName: '',
            }));
          }}
          isGeocodingManual={quickShopLoc.isGeocodingManual}
          onLookupManualCoordinates={() => quickShopLoc.lookupManualCoordinates()}
          gpsStatus={quickShopLoc.gpsStatus}
          onRefreshLocation={() => quickShopLoc.fetchCurrentLocation(true)}
          latitude={quickShopLoc.latitude}
          longitude={quickShopLoc.longitude}
          photoUri={newShopPhotoUri}
          onPickPhoto={handlePickNewShopPhoto}
          onRemovePhoto={() => setNewShopPhotoUri(null)}
          noPhotoReason={newShopNoPhotoReason}
          onSelectNoPhotoReason={(reason) => {
            setNewShopNoPhotoReason(reason);
            setIsNewShopReasonDropdownOpen(false);
            if (newShopErrors.noPhotoReason) {
              setNewShopErrors((prev) => ({ ...prev, noPhotoReason: '' }));
            }
          }}
          isReasonDropdownOpen={isNewShopReasonDropdownOpen}
          onToggleReasonDropdown={() => setIsNewShopReasonDropdownOpen((prev) => !prev)}
          shopName={newShopName}
          onChangeShopName={(text) => {
            setNewShopName(text);
            if (newShopErrors.shopName) setNewShopErrors((prev) => ({ ...prev, shopName: '' }));
          }}
          ownerName={newShopOwner}
          onChangeOwnerName={(text) => {
            setNewShopOwner(text);
            if (newShopErrors.ownerName) setNewShopErrors((prev) => ({ ...prev, ownerName: '' }));
          }}
          phone={newShopPhone}
          onChangePhone={(text) => {
            setNewShopPhone(text.replace(/[^0-9]/g, ''));
            if (newShopErrors.phone) setNewShopErrors((prev) => ({ ...prev, phone: '' }));
          }}
          email={newShopEmail}
          onChangeEmail={(text) => {
            setNewShopEmail(text);
            if (newShopErrors.email) setNewShopErrors((prev) => ({ ...prev, email: '' }));
          }}
          selectedManagerName={user?.name ? `${user.name} (You)` : 'Your Account'}
          canPickAssignee={false}
          managerLoading={false}
          isManagerModalOpen={false}
          onOpenManagerModal={() => {}}
          onCloseManagerModal={() => {}}
          managerDropdownOptions={[]}
          selectedManagerId={user?.id || ''}
          onSelectManager={() => {}}
          selectedCategory={selectedNewShopCategory}
          categoryLoading={false}
          isCategoryModalOpen={isNewShopCategoryModalOpen}
          onOpenCategoryModal={() => setIsNewShopCategoryModalOpen(true)}
          onCloseCategoryModal={() => setIsNewShopCategoryModalOpen(false)}
          categoryDropdownOptions={newShopCategoryOptions}
          categoryId={newShopCategoryId || categories[0]?.id || ''}
          onSelectCategory={(opt) => {
            setNewShopCategoryId(opt.id);
            setIsNewShopCategoryModalOpen(false);
            if (newShopErrors.categoryId) setNewShopErrors((prev) => ({ ...prev, categoryId: '' }));
          }}
          pincode={quickShopLoc.pincode}
          onChangePincode={(pin) => {
            if (newShopErrors.pincode) {
              setNewShopErrors((prev) => ({ ...prev, pincode: '' }));
            }
            quickShopLoc.handlePincodeChange(pin);
          }}
          pincodeStatus={quickShopLoc.pincodeStatus}
          address={quickShopLoc.address}
          onChangeAddress={(text) => {
            quickShopLoc.setAddress(text);
            if (newShopErrors.address) setNewShopErrors((prev) => ({ ...prev, address: '' }));
            quickShopLoc.scheduleManualGeocode({ address: text });
          }}
          streetName={quickShopLoc.streetName}
          onChangeStreetName={(text) => {
            quickShopLoc.setStreetName(text);
            if (newShopErrors.streetName) setNewShopErrors((prev) => ({ ...prev, streetName: '' }));
            quickShopLoc.scheduleManualGeocode({ streetName: text });
          }}
          landmark={quickShopLoc.landmark}
          onChangeLandmark={(text) => {
            quickShopLoc.setLandmark(text);
            quickShopLoc.scheduleManualGeocode({ landmark: text });
          }}
          village={quickShopLoc.village}
          onChangeVillage={(text) => {
            quickShopLoc.setVillage(text);
            quickShopLoc.scheduleManualGeocode({ village: text });
          }}
          district={quickShopLoc.district}
          onChangeDistrict={(text) => {
            quickShopLoc.setDistrict(text);
            if (newShopErrors.district) setNewShopErrors((prev) => ({ ...prev, district: '' }));
            quickShopLoc.scheduleManualGeocode({ district: text });
          }}
          stateName={quickShopLoc.stateName}
          onChangeStateName={(text) => {
            quickShopLoc.setStateName(text);
            if (newShopErrors.stateName) setNewShopErrors((prev) => ({ ...prev, stateName: '' }));
            quickShopLoc.scheduleManualGeocode({ state: text });
          }}
          formattedAddress={quickShopLoc.formattedAddress}
          errors={newShopErrors}
          feedback={newShopFeedback}
          onDismissFeedback={() => setNewShopFeedback(null)}
          isSubmitting={isSavingQuickShop}
          onSubmit={handleCreateQuickShop}
          savedCustomer={null}
          onResetForm={() => closeQuickAddShopModal()}
          onDoneAfterSave={() => closeQuickAddShopModal()}
        />
      </Modal>

      {/* 7. Attendance KPI & History Date Filter Modal */}
      <AttendanceFilterModal
        visible={filterModalVisible}
        value={shiftFilter}
        onApply={setShiftFilter}
        onClose={() => setFilterModalVisible(false)}
        accentColor={BrandColors.pink.primary}
        defaultPreset="today"
      />
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
  kpiSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  kpiSectionTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  kpiSectionSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
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
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addShopInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.tint,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  addShopInlineBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  emptyShopBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: 8,
  },
  emptyShopText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 4,
    height: '100%',
  },
  productStockTag: {
    marginTop: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  productStockTagEmpty: {
    backgroundColor: '#FEF2F2',
  },
  productStockTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  lowPriceWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  lowPriceWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  stockWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginTop: Spacing.xs,
  },
  stockWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    flex: 1,
  },
  quickCatRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  quickCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickCatChipActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  quickCatChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickCatChipTextActive: {
    color: '#FFFFFF',
  },
  row2Col: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
