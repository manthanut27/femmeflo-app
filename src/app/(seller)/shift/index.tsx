import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, PaymentMode, ProductItem, Shift, ShiftVisit } from '@/api/types';
import { FaceVerificationModal, type FaceVerificationResult } from '@/components/common/FaceVerificationModal';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { draftStorage } from '@/utils/draftStorage';

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

  // Check-in Visit Form State
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

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

  // Biometric / Face Selfie Verification Modal State
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

      const active = shiftRes.shift;
      setCurrentShift(active);
      await draftStorage.saveActiveShift(userId, active);

      setCustomers(custRes.items || []);
      if (custRes.items?.length > 0) {
        setSelectedCustomerId((prev) => prev || custRes.items[0].id);
      }

      setProducts(prodRes.items || []);
      if (prodRes.items?.length > 0) {
        setSelectedProductId((prev) => prev || prodRes.items[0].id);
        const firstBasePrice = prodRes.items[0].basePricePaise / 100;
        setSaleUnitPrice((prev) => (prev ? prev : firstBasePrice || 25));
      }
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

    if (currentShift && currentShift.startTime) {
      const startMs = new Date(currentShift.startTime).getTime();

      const updateTicker = () => {
        const diff = Math.max(0, Date.now() - startMs);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      };

      updateTicker();
      timerRef.current = setInterval(updateTicker, 1000);
    } else {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentShift]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShiftData();
  }, [loadShiftData]);

  // Helper to acquire GPS coordinates with fallback
  async function acquireCoordinates(): Promise<{ latitude: number; longitude: number }> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          return {
            latitude: Number(loc.coords.latitude.toFixed(6)),
            longitude: Number(loc.coords.longitude.toFixed(6)),
          };
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
            { timeout: 6000 }
          );
        });
      }
    } catch {
      // Fallback
    }
    return { latitude: 22.7196, longitude: 75.8577 };
  }

  // ----------------------------------------------------
  // SHIFT START WITH FACE VERIFICATION
  // ----------------------------------------------------
  function handleInitiateStartShift() {
    const km = parseFloat(startOdometer);
    if (isNaN(km) || km < 0) {
      Alert.alert('Invalid Reading', 'Please enter a valid starting odometer reading in kilometers (0 or positive).');
      return;
    }

    setPendingOdometerKm(km);
    setPendingNotes(startNotes.trim());
    setStartModalVisible(false);
    setFaceModalMode('START');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftStart(faceResult: FaceVerificationResult) {
    setFaceModalVisible(false);
    setIsStartingShift(true);
    setFeedback(null);

    try {
      const coords = await acquireCoordinates();
      const res = await sellerApi.startShift({
        startOdometerKm: pendingOdometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: pendingNotes ? `Start notes: ${pendingNotes}` : undefined,
        faceVerified: faceResult.faceVerified,
        facePhoto: faceResult.facePhoto,
        faceConfidence: faceResult.faceConfidence,
        faceMethod: faceResult.faceMethod,
      });

      setCurrentShift(res.shift);
      await draftStorage.saveActiveShift(userId, res.shift);
      setStartOdometer('');
      setStartNotes('');

      setFeedback({
        type: 'success',
        title: 'Duty Shift Started (Face ID Verified)',
        message: `Duty shift active at ${pendingOdometerKm} km. Location locked and selfie attendance recorded.`,
      });
      Alert.alert('Shift Started', `Field beat shift initialized at ${pendingOdometerKm} km.`);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Shift Start Failed',
        message: err.message || 'Unable to start duty shift.',
      });
      Alert.alert('Shift Start Failed', err.message || 'Unable to start shift.');
    } finally {
      setIsStartingShift(false);
    }
  }

  // ----------------------------------------------------
  // STORE VISIT CHECK-IN
  // ----------------------------------------------------
  async function handleCheckInVisit() {
    if (isCheckingIn) return;
    if (!selectedCustomerId) {
      Alert.alert('Select Customer', 'Please select a retail outlet for this visit.');
      return;
    }

    setIsCheckingIn(true);
    try {
      const coords = await acquireCoordinates();
      const customer = customers.find((c) => c.id === selectedCustomerId);

      await sellerApi.checkIn({
        customerId: selectedCustomerId,
        shopName: customer?.shopName || 'Retail Customer Store',
        latitude: coords.latitude,
        longitude: coords.longitude,
        notes: visitNotes.trim() || undefined,
      });

      setCheckInModalVisible(false);
      setVisitNotes('');
      setFeedback({
        type: 'success',
        title: 'Visit Checked In',
        message: `GPS location captured at ${customer?.shopName || 'retail outlet'}. Store timer running.`,
      });
      Alert.alert('Visit Checked In', 'GPS location captured and store visit recorded.');
      loadShiftData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Check-in Failed',
        message: err.message || 'Unable to record store visit.',
      });
      Alert.alert('Check-in Failed', err.message || 'Unable to record store visit.');
    } finally {
      setIsCheckingIn(false);
    }
  }

  // ----------------------------------------------------
  // STORE VISIT CHECK-OUT (BRANCH 1 & BRANCH 2)
  // ----------------------------------------------------
  async function handleOpenCheckout(visit: ShiftVisit) {
    if (visit.checkOutTime) {
      Alert.alert('Already Completed', 'This store visit has already been checked out.');
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
      Alert.alert('Visit Completed', 'This visit is already checked out.');
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
          Alert.alert('Select Customer', 'Please choose a retail customer account to associate with this sale.');
          setIsCheckingOut(false);
          return;
        }

        if (!saleQuantity || saleQuantity <= 0) {
          Alert.alert('Invalid Quantity', 'Please enter a valid packet quantity of at least 1.');
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

      const successTitle = checkoutSaleDone ? 'Sale & Visit Completed' : 'Visit Completed (No Sale)';
      const successMessage = checkoutSaleDone
        ? `Sale recorded for ₹${(saleQuantity * saleUnitPrice).toLocaleString('en-IN')} with customer feedback.`
        : `Outcome logged (${checkoutReason || 'Inquiry'}) and departure coordinates locked.`;

      setFeedback({
        type: 'success',
        title: successTitle,
        message: successMessage,
      });
      Alert.alert(successTitle, successMessage);
      loadShiftData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Checkout Failed',
        message: err.message || 'Unable to check out of visit. Your feedback draft has been preserved.',
      });
      Alert.alert('Checkout Failed', err.message || 'Unable to complete checkout. Draft notes preserved.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  // ----------------------------------------------------
  // SHIFT END WITH FACE VERIFICATION
  // ----------------------------------------------------
  function handleInitiateEndShift() {
    const km = parseFloat(endOdometer);
    const startKmVal = currentShift?.startOdometerKm ?? 0;
    if (isNaN(km) || km < startKmVal) {
      Alert.alert(
        'Invalid Reading',
        `Closing odometer (${km || 0} km) must be greater than or equal to starting odometer (${startKmVal} km).`
      );
      return;
    }

    setPendingOdometerKm(km);
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
      const coords = await acquireCoordinates();
      const res = await sellerApi.endShift({
        endOdometerKm: pendingOdometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: pendingNotes ? `Closing notes: ${pendingNotes}` : undefined,
        notes: pendingNotes || undefined,
        faceVerified: faceResult.faceVerified,
        facePhoto: faceResult.facePhoto,
        faceConfidence: faceResult.faceConfidence,
        faceMethod: faceResult.faceMethod,
      });

      setCurrentShift(null);
      await draftStorage.clearActiveShift(userId);
      setEndOdometer('');
      setEndNotes('');

      const totalDist = res.shift?.totalDistanceKm != null ? `${res.shift.totalDistanceKm} km` : '0 km';
      setFeedback({
        type: 'success',
        title: 'Duty Shift Completed (Face ID Verified)',
        message: `Closing odometer logged at ${pendingOdometerKm} km. Total beat route: ${totalDist}.`,
      });
      Alert.alert('Shift Ended', `Shift ended with verified Face ID. Total route: ${totalDist}.`);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'End Shift Failed',
        message: err.message || 'Unable to close duty shift. Never closed locally until confirmed by server.',
      });
      Alert.alert('End Shift Failed', err.message || 'Unable to close duty shift.');
    } finally {
      setIsEndingShift(false);
    }
  }

  const visits = currentShift?.visits ?? [];
  const startKm = currentShift?.startOdometerKm ?? 0;
  const isShiftActive = Boolean(currentShift && currentShift.startTime && !currentShift.endTime);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Duty Shift & Visits"
        subtitle="Live Beat Tracker & Geolocation"
        showBack
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.huge }]}
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
                variant={isShiftActive ? 'success' : 'neutral'}
              />
            </View>

            {isShiftActive && currentShift ? (
              <View style={styles.heroDetails}>
                <View style={styles.heroDetailRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.heroDetailText}>
                    Started at {new Date(currentShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.heroDetailRow}>
                  <Ionicons name="speedometer-outline" size={16} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.heroDetailText}>Starting Odometer: {startKm} km</Text>
                </View>
                {currentShift.startLatitude ? (
                  <View style={styles.heroDetailRow}>
                    <Ionicons name="location-outline" size={16} color={BrandColors.green.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.heroDetailText, { color: BrandColors.green.primary, fontWeight: '600' }]}>
                      GPS Locked ({currentShift.startLatitude.toFixed(4)}, {currentShift.startLongitude?.toFixed(4)})
                    </Text>
                  </View>
                ) : null}

                {/* Quick Shift Actions */}
                <View style={styles.heroActionRow}>
                  <Button
                    title="Check-in Store Visit"
                    onPress={() => setCheckInModalVisible(true)}
                    variant="secondary"
                    size="md"
                    icon={<Ionicons name="location" size={18} color="#FFFFFF" />}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    title="End Duty Shift"
                    onPress={() => setEndModalVisible(true)}
                    variant="outline"
                    size="md"
                    style={{ flex: 1 }}
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
                  onPress={() => setStartModalVisible(true)}
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
                const isCheckedOut = Boolean(v.checkOutTime);
                const hasSale = Boolean(v.saleDone || v.saleId || v.sale);
                const durationDisplay =
                  v.durationMins != null
                    ? `${v.durationMins.toFixed(1)} mins`
                    : isCheckedOut
                    ? 'Completed'
                    : 'In store now';

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
                          Arrived: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {v.checkOutTime
                            ? ` • Left: ${new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${durationDisplay})`
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
                      <View style={{ marginTop: Spacing.sm, alignItems: 'flex-end' }}>
                        <Button
                          title="Check Out & Log Feedback"
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
      <Modal visible={startModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Field Duty Shift</Text>
            <Text style={styles.modalSubtitle}>
              Confirm starting odometer reading and proceed to selfie attendance verification.
            </Text>

            <Input
              label="Starting Odometer (km) *"
              placeholder="e.g. 14250"
              value={startOdometer}
              onChangeText={setStartOdometer}
              keyboardType="numeric"
              leftIcon={<Ionicons name="speedometer-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Shift Remarks (Optional)"
              placeholder="e.g. Morning beat - Market Sector 4"
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
                title="Proceed to Face ID"
                variant="primary"
                onPress={handleInitiateStartShift}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. CHECK-IN STORE VISIT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal visible={checkInModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Check-in Store Visit</Text>
            <Text style={styles.modalSubtitle}>
              Select the retail outlet and lock your current GPS coordinates.
            </Text>

            <Text style={styles.modalFieldLabel}>Select Retail Outlet *</Text>
            <ScrollView style={styles.modalCustomerList}>
              {customers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.modalCustomerItem, isSelected && styles.modalCustomerItemActive]}
                    onPress={() => setSelectedCustomerId(c.id)}
                  >
                    <Text style={[styles.modalCustomerName, isSelected && styles.modalCustomerNameActive]}>
                      {c.shopName}
                    </Text>
                    <Text style={styles.modalCustomerSub}>
                      {c.ownerName} • {c.village || c.district || 'Territory'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Input
              label="Visit Purpose / Notes"
              placeholder="e.g. Routine replenishment, promotional banner delivery"
              value={visitNotes}
              onChangeText={setVisitNotes}
              containerStyle={{ marginTop: Spacing.md }}
              leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCheckInModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isCheckingIn ? 'Checking in...' : 'Lock GPS & Check In'}
                variant="primary"
                onPress={handleCheckInVisit}
                loading={isCheckingIn}
                disabled={isCheckingIn}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. CHECK-OUT VISIT MODAL (BRANCH 1 & BRANCH 2) */}
      {/* ---------------------------------------------------- */}
      <Modal visible={checkOutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Check-out Store Visit</Text>
              <Text style={styles.modalSubtitle}>
                Select outcome, enter quantities or feedback, and lock exit GPS coordinates.
              </Text>

              {/* Outlet name */}
              <View style={styles.checkoutOutletBox}>
                <Ionicons name="storefront" size={18} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
                <Text style={styles.checkoutOutletText}>
                  {customers.find((c) => c.id === activeCheckoutVisit?.customerId)?.shopName ||
                    activeCheckoutVisit?.shopName ||
                    'Retail Outlet Visit'}
                </Text>
              </View>

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
                    Follow-up / Inquiry only
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
                    Yes, Sale Done!
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
                  placeholder={
                    checkoutSaleDone
                      ? 'e.g. Retailer satisfied with standard pack, asked for next delivery on Friday...'
                      : 'e.g. Dukaan band thi owner gaon gaya hai, agle hafte aane ko bola...'
                  }
                />
              </View>

              {/* Departure Notes */}
              <Input
                label="Departure Notes (Optional)"
                placeholder="e.g. Visit concluded cleanly, samples delivered"
                value={checkoutNotes}
                onChangeText={(t) => {
                  setCheckoutNotes(t);
                  saveCurrentCheckoutDraft({ notes: t });
                }}
                leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
              />

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
                      ? 'Submit Sale & Checkout'
                      : 'Complete Checkout'
                  }
                  variant="primary"
                  size="md"
                  onPress={handleConfirmCheckout}
                  loading={isCheckingOut}
                  disabled={isCheckingOut}
                  style={{ flex: 1.6 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 4. END SHIFT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal visible={endModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>End Field Duty Shift</Text>
            <Text style={styles.modalSubtitle}>
              Log final odometer reading and complete shift checkout via Face ID.
            </Text>

            <Input
              label={`Closing Odometer (km) * (Must be >= ${startKm} km)`}
              placeholder={`e.g. ${startKm + 25}`}
              value={endOdometer}
              onChangeText={setEndOdometer}
              keyboardType="numeric"
              leftIcon={<Ionicons name="speedometer-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Shift Summary / Remarks (Optional)"
              placeholder="e.g. Completed South beat, covered 12 outlets"
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
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 5. FACE VERIFICATION / ATTENDANCE SELFIE MODAL */}
      {/* ---------------------------------------------------- */}
      <FaceVerificationModal
        visible={faceModalVisible}
        mode={faceModalMode}
        userName={user?.name || 'Field Officer'}
        userRole={user?.role || 'SELLER'}
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
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '85%',
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
  checkoutOutletText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
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
});
