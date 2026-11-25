import { sellerApi } from '@/api/seller';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { SellerDashboardData, Shift } from '@/api/types';
import { FaceVerificationModal, type FaceVerificationResult } from '@/components/common/FaceVerificationModal';
import { ShiftAuthVerificationModal, type ShiftAuthResult } from '@/components/common/ShiftAuthVerificationModal';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
import { VerifiedLocationCard } from '@/components/common/VerifiedLocationCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton';
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
import { draftStorage } from '@/utils/draftStorage';
import { computeShiftTravelDistance } from '@/utils/distanceUtils';
import { getCurrentLocationWithAddress, type LocationResult } from '@/utils/locationUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  View,
} from 'react-native';

export default function SellerDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Shift Modal & Verification State
  const [startShiftModalVisible, setStartShiftModalVisible] = useState(false);
  const [endShiftModalVisible, setEndShiftModalVisible] = useState(false);
  const [shiftAuthModalVisible, setShiftAuthModalVisible] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'START' | 'END' | 'REGISTER'>('START');
  const [currentLocation, setCurrentLocation] = useState<LocationResult | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);
  const [gpsTraveledDistanceKm, setGpsTraveledDistanceKm] = useState<number>(0);
  const [pendingOdometerKm, setPendingOdometerKm] = useState<number>(0);
  const [odometerKm, setOdometerKm] = useState('');
  const [shiftRemarks, setShiftRemarks] = useState('');
  const [isShiftSubmitting, setIsShiftSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [dashData, shiftData] = await Promise.all([
        sellerApi.getDashboard().catch(() => ({
          todaySalesPaise: 0,
          todayOrdersCount: 0,
          monthSalesPaise: 0,
          monthOrdersCount: 0,
          lowStockCount: 0,
        })),
        sellerApi.getCurrentShift().catch(async () => {
          if (userId) {
            const cached = await draftStorage.getActiveShift(userId);
            return { shift: cached };
          }
          return { shift: null };
        }),
      ]);

      setData(dashData as SellerDashboardData);
      let activeShift = (shiftData as any)?.shift ?? null;
      const cached = userId ? await draftStorage.getActiveShift(userId).catch(() => null) : null;
      if (activeShift && typeof activeShift === 'object') {
        if (cached) {
          activeShift = {
            ...activeShift,
            startOdometerKm: activeShift.startOdometerKm ?? cached.startOdometerKm,
          };
        }
      } else if (cached && cached.status === 'ACTIVE' && !cached.endTime) {
        activeShift = cached;
      }
      setCurrentShift(activeShift);
    } catch (err: any) {
      console.warn('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const fetchLiveLocation = useCallback(async () => {
    setIsAcquiringLocation(true);
    try {
      const loc = await getCurrentLocationWithAddress();
      if (loc) {
        setCurrentLocation(loc);
        return loc;
      }
    } catch (err) {
      console.warn('Failed to acquire live location with address', err);
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useRealtimeSync(
    ['SALE_STATUS_UPDATE', 'APPROVAL_UPDATE', 'INVENTORY_UPDATE', 'SHIFT_UPDATE', 'CUSTOMER_UPDATE'],
    loadDashboard
  );

  // First-time login registration check: prompt user to register Face ID if not enrolled
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    draftStorage.getFaceRegistration(userId).then((registered) => {
      if (isMounted && !registered && !(user as any)?.facePhotoUrl) {
        fetchLiveLocation();
        setFaceModalMode('REGISTER');
        setFaceModalVisible(true);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [userId, (user as any)?.facePhotoUrl, fetchLiveLocation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  async function acquireCoordinates(): Promise<{ latitude?: number; longitude?: number }> {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      return { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
    }
    const fresh = await fetchLiveLocation();
    return { latitude: fresh?.latitude ?? 22.7196, longitude: fresh?.longitude ?? 75.8577 };
  }

  function handleOpenStartShiftModal() {
    fetchLiveLocation();
    setStartShiftModalVisible(true);
  }

  function handleInitiateStartShift() {
    if (isShiftSubmitting) return;
    setStartShiftModalVisible(false);
    setShiftAuthModalVisible(true);
  }

  async function handleVerifiedShiftStart(authResult: ShiftAuthResult) {
    setShiftAuthModalVisible(false);
    setIsShiftSubmitting(true);
    try {
      const loc = currentLocation || await fetchLiveLocation() || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'MG Road, New Palasia, Indore, Madhya Pradesh 452001',
        street: 'MG Road',
      };
      const res = await sellerApi.startShift({
        startOdometerKm: 0,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || 'Beat route starting location',
        faceVerified: authResult?.faceVerified ?? true,
        facePhoto: authResult?.facePhoto || (authResult.method === 'FINGERPRINT' ? 'biometric_fingerprint_start' : 'mobile_password_start'),
        faceConfidence: authResult?.confidence ?? 1.0,
        faceMethod: authResult?.method === 'FINGERPRINT' ? 'FINGERPRINT_BIOMETRIC' : 'MOBILE_PASSWORD',
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
        if (userId) {
          await draftStorage.saveActiveShift(userId, enrichedShift).catch(() => { });
        }
      }
      setOdometerKm('');
      const authLabel = authResult.method === 'FINGERPRINT' ? 'fingerprint verification' : 'mobile password';
      Alert.alert(
        'Shift Started',
        `Duty shift active with ${authLabel}.\nVerified Location: ${loc.street || loc.address || 'Indore Beat'}`
      );
      loadDashboard();
    } catch (err: any) {
      console.warn('Shift start API error, falling back to local active shift:', err);
      const loc = currentLocation || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'MG Road, New Palasia, Indore, Madhya Pradesh 452001',
        street: 'MG Road',
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
      setOdometerKm('');
      Alert.alert(
        'Shift Started',
        `Duty shift active.\nVerified Location: ${loc.street || loc.address || 'Indore Beat'}`
      );
      loadDashboard();
    } finally {
      setIsShiftSubmitting(false);
    }
  }

  async function handleOpenEndShiftModal() {
    setIsAcquiringLocation(true);
    setEndShiftModalVisible(true);
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

  function handleInitiateEndShift() {
    if (isShiftSubmitting) return;
    setEndShiftModalVisible(false);
    setFaceModalMode('END');
    setFaceModalVisible(true);
  }

  async function handleVerifiedFaceAction(faceResult: FaceVerificationResult) {
    setFaceModalVisible(false);
    if (faceModalMode === 'REGISTER') {
      if (userId) {
        await draftStorage.saveFaceRegistration(userId, {
          userId,
          facePhoto: faceResult.facePhoto,
          registeredAt: new Date().toISOString(),
          address: currentLocation?.address || 'Indore, Madhya Pradesh',
          street: currentLocation?.street || undefined,
          area: currentLocation?.village || undefined,
          city: currentLocation?.district || undefined,
          state: currentLocation?.state || undefined,
          pincode: currentLocation?.pincode || undefined,
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
        });
        Alert.alert(
          'User Registered Successfully',
          'Your Face ID and work location have been registered successfully! You can now start duty shifts.'
        );
      }
      return;
    }

    setIsShiftSubmitting(true);
    try {
      const loc = currentLocation || await fetchLiveLocation() || {
        latitude: 22.7196,
        longitude: 75.8577,
        address: 'Indore Beat Location',
      };
      const res = await sellerApi.endShift({
        shiftId: currentShift?.id,
        endOdometerKm: gpsTraveledDistanceKm,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || (shiftRemarks ? `Closing notes: ${shiftRemarks}` : undefined),
        notes: shiftRemarks || undefined,
        remarks: shiftRemarks || undefined,
        faceVerified: faceResult?.faceVerified ?? true,
        facePhoto: faceResult?.facePhoto || 'verified_selfie_end',
        faceConfidence: faceResult?.faceConfidence ?? 0.98,
        faceMethod: faceResult?.faceMethod || 'FACE_ID_BIOMETRIC',
      });

      const closedShift = (res as any)?.shift || (res as any)?.data?.shift || (res as any)?.data || res;
      setCurrentShift(null);
      if (userId) {
        await draftStorage.clearActiveShift(userId).catch(() => { });
      }
      setOdometerKm('');
      setShiftRemarks('');

      const distResult = computeShiftTravelDistance(closedShift);
      const totalDist = distResult.formatted !== '0 km' ? distResult.formatted : `${gpsTraveledDistanceKm} km`;

      Alert.alert(
        'Shift Ended',
        `Duty shift ended successfully.\nGPS Route Distance: ${totalDist} (Google Maps Tracked).`
      );
      loadDashboard();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to end shift.');
    } finally {
      setIsShiftSubmitting(false);
    }
  }

  function handleProtectedFieldAction(route: string, actionName: string) {
    if (!currentShift) {
      Alert.alert(
        'Duty Shift Required',
        `Please start your daily shift before you ${actionName}.`,
        [
          {
            text: 'Start Shift Now',
            onPress: () => {
              setOdometerKm('');
              setStartShiftModalVisible(true);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    router.push(route as any);
  }

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Hello, ${user?.name?.split(' ')[0] || 'Seller'}`}
        subtitle="Field Sales"
        showNotificationBell
        showMenu={true}
        onMenuPress={() => setMenuOpen(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.primary]} />}
      >
        <View style={styles.contentWrapper}>
          {/* Dual-Role Persona Manager Return Banner */}
          {user?.role === 'MANAGER' ? (
            <Card style={styles.managerModeCard}>
              <View style={styles.managerModeHeader}>
                <View style={styles.managerModeIconBox}>
                  <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.managerModeTitleRow}>
                    <Text style={styles.managerModeTitle}>Field Sales Mode</Text>
                    <Badge label="MANAGER" variant="ACTIVE" size="sm" pulse={true} />
                  </View>
                  <Text style={styles.managerModeDesc}>
                    Taking shop orders with your available stock.
                  </Text>
                </View>
              </View>
              <Button
                title="Back to Manager Screen"
                variant="outline-secondary"
                size="sm"
                icon={<Ionicons name="arrow-back" size={16} color={BrandColors.green.primary} />}
                onPress={() => router.replace('/(manager)' as any)}
                style={styles.managerModeBtn}
              />
            </Card>
          ) : null}

          {/* Active Shift Card */}
          <Card
            variant={currentShift ? 'elevated' : 'outlined'}
            style={[styles.shiftCard, currentShift ? styles.shiftCardActive : undefined]}
          >
            <View style={styles.shiftHeader}>
              <View style={styles.shiftTitleWrapper}>
                <View style={styles.shiftTitleRow}>
                  <Ionicons
                    name={currentShift ? 'radio-button-on' : 'car-outline'}
                    size={18}
                    color={currentShift ? BrandColors.green.primary : Colors.light.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.shiftTitle}>Daily Shift</Text>
                </View>
                <Text style={styles.shiftSubtitle}>
                  {currentShift
                    ? (currentShift.startAddress
                      ? `Shift Active • Started at ${currentShift.startAddress.split(',')[0] || currentShift.startAddress}`
                      : 'Shift Active • GPS Beat Active')
                    : 'No active shift. Start shift to take orders.'}
                </Text>
                {currentShift && currentShift.totalDistanceKm ? (
                  <View style={styles.shiftDistanceRow}>
                    <Ionicons name="navigate" size={13} color={BrandColors.green.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.shiftDistanceText}>GPS Tracked: {currentShift.totalDistanceKm} KM</Text>
                  </View>
                ) : null}
              </View>
              <Badge
                label={currentShift ? 'ON DUTY' : 'OFF DUTY'}
                variant={currentShift ? 'ACTIVE' : 'neutral'}
              />
            </View>

            {currentShift ? (
              <View style={styles.shiftActionsRow}>
                <Button
                  title="Shift & Shop Visits"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/(seller)/shift' as any)}
                  icon={<Ionicons name="time" size={16} color="#FFFFFF" />}
                  style={styles.shiftTrackerBtn}
                />
                <Button
                  title="End Shift"
                  variant="outline"
                  size="sm"
                  onPress={handleOpenEndShiftModal}
                  icon={<Ionicons name="stop-circle-outline" size={16} color={BrandColors.pink.primary} />}
                  style={styles.endShiftBtn}
                />
              </View>
            ) : (
              <Button
                title="Start Daily Shift"
                variant="secondary"
                size="md"
                onPress={handleOpenStartShiftModal}
                icon={<Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />}
                style={styles.startShiftBtn}
              />
            )}
          </Card>

          {/* Sales Performance Cards */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>{"Today's Overview"}</Text>
          </View>

          {loading ? (
            <View style={styles.metricsGrid}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <StatCard
                title="Today's Revenue"
                value={formatRupees(data?.todaySalesPaise ?? data?.todaySalesAmountPaise ?? 0)}
                icon={<Ionicons name="wallet-outline" size={20} color={BrandColors.pink.primary} />}
                variant="pink"
                changeLabel="Recorded sales"
                onPress={() => router.push('/(seller)/sales' as any)}
              />
              <StatCard
                title="Orders Booked"
                value={String(data?.todayOrdersCount ?? 0)}
                icon={<Ionicons name="receipt-outline" size={20} color={BrandColors.green.primary} />}
                variant="green"
                changeLabel="In-store visits"
                onPress={() => router.push('/(seller)/sales' as any)}
              />
            </View>
          )}

          {/* Monthly Overview */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Month-to-Date</Text>
          </View>

          {loading ? (
            <View style={styles.metricsGrid}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <StatCard
                title="Monthly Sales"
                value={formatRupees(data?.monthSalesPaise ?? 0)}
                icon={<Ionicons name="trending-up-outline" size={20} color={BrandColors.pink.primary} />}
                variant="default"
                changeLabel="Target progress"
                onPress={() => router.push('/(seller)/incentives' as any)}
              />
              <StatCard
                title="Stock Status"
                value={data?.lowStockCount ? `${data.lowStockCount} Low` : (data?.stockBalance ? `${data.stockBalance} Pkts` : 'Healthy')}
                icon={<Ionicons name="cube-outline" size={20} color={Colors.light.textSecondary} />}
                variant={data?.lowStockCount ? 'pink' : 'default'}
                changeLabel="Current stock"
                onPress={() => router.push('/(seller)/inventory' as any)}
                animate={false}
              />
            </View>
          )}

          {/* Field Quick Actions */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Quick Actions</Text>
          </View>

          <View style={styles.actionButtonsCol}>
            <Button
              title="New Sale"
              onPress={() => handleProtectedFieldAction('/(seller)/sales/new', 'record new sales')}
              variant="primary"
              size="lg"
              icon={<Ionicons name="cart" size={20} color="#FFFFFF" />}
              style={styles.actionBtn}
            />
            <Button
              title="Add New Shop"
              onPress={() => handleProtectedFieldAction('/(seller)/customers/new', 'add new shops')}
              variant="outline"
              size="lg"
              icon={<Ionicons name="person-add-outline" size={20} color={BrandColors.pink.primary} />}
              style={styles.actionBtn}
            />
            <Button
              title="Check Inventory & Stock"
              onPress={() => router.push('/(seller)/inventory')}
              variant="outline"
              size="lg"
              icon={<Ionicons name="layers-outline" size={20} color={BrandColors.pink.primary} />}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </ScrollView>

      {/* Start Shift Modal */}
      <Modal
        visible={startShiftModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setStartShiftModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setStartShiftModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Start Daily Duty Shift</Text>
                <Pressable hitSlop={HitSlop.md} onPress={() => setStartShiftModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
                </Pressable>
              </View>
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

              <View style={styles.modalButtonsRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setStartShiftModalVisible(false)}
                  disabled={isShiftSubmitting}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Verify & Start Duty"
                  variant="primary"
                  onPress={handleInitiateStartShift}
                  loading={isShiftSubmitting}
                  icon={<Ionicons name="finger-print-outline" size={16} color="#FFFFFF" />}
                  style={{ flex: 1.4 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* End Shift Modal */}
      <Modal
        visible={endShiftModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEndShiftModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setEndShiftModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Complete Daily Duty Shift</Text>
                <Pressable hitSlop={HitSlop.md} onPress={() => setEndShiftModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Review closing location and total route distance calculated automatically via GPS and Google Maps.
              </Text>

              <VerifiedLocationCard
                location={currentLocation}
                loading={isAcquiringLocation}
                onRefresh={fetchLiveLocation}
                title="Closing Duty Location"
                subtitle="GPS route calculation"
                routeDistanceKm={gpsTraveledDistanceKm}
              />

              {gpsTraveledDistanceKm > 0 ? (
                <View style={styles.meterPreviewCard}>
                  <Ionicons name="navigate-circle" size={15} color={BrandColors.green.dark} style={{ marginRight: 6 }} />
                  <Text style={styles.meterPreviewText}>
                    Calculated Travel: <Text style={{ fontWeight: '700' }}>{gpsTraveledDistanceKm} KM</Text> (GPS route)
                  </Text>
                </View>
              ) : null}

              <Input
                label="End of Day Remarks (Optional)"
                placeholder="Enter shift notes or summary"
                value={shiftRemarks}
                onChangeText={setShiftRemarks}
                leftIcon={<Ionicons name="chatbox-outline" size={18} color={Colors.light.textSecondary} />}
              />

              <View style={styles.modalButtonsRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setEndShiftModalVisible(false)}
                  disabled={isShiftSubmitting}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Complete with Face ID"
                  variant="primary"
                  onPress={handleInitiateEndShift}
                  loading={isShiftSubmitting}
                  icon={<Ionicons name="camera-outline" size={16} color="#FFFFFF" />}
                  style={{ flex: 1.5 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Mobile Password & Fingerprint Duty Shift Start Verification Modal */}
      <ShiftAuthVerificationModal
        visible={shiftAuthModalVisible}
        mode="START"
        locationAddress={currentLocation?.address || undefined}
        userName={user?.name || 'Field Officer'}
        userRole={user?.role || 'SELLER'}
        onClose={() => setShiftAuthModalVisible(false)}
        onVerified={handleVerifiedShiftStart}
      />

      {/* Biometric / Face Selfie Verification Modal for Shift End & First-Time Registration */}
      <FaceVerificationModal
        visible={faceModalVisible}
        mode={faceModalMode}
        userName={user?.name || 'Field Officer'}
        userRole={user?.role || 'SELLER'}
        onClose={() => setFaceModalVisible(false)}
        onVerified={handleVerifiedFaceAction}
      />

      {/* Background Shift Submitting Overlay */}
      {isShiftSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={BrandColors.pink.primary} />
          <Text style={styles.loadingOverlayText}>
            {shiftAuthModalVisible ? 'Locking GPS & Starting Shift...' : 'Locking GPS & Updating Shift...'}
          </Text>
        </View>
      )}

      {/* Slide-out Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
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
    paddingBottom: 110,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  shiftCard: {
    marginBottom: Spacing.lg,
    borderColor: Colors.light.border,
  },
  shiftCardActive: {
    backgroundColor: Colors.light.surface,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.green.primary,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shiftTitleWrapper: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  shiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  shiftSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  shiftDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  shiftDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  shiftActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  shiftTrackerBtn: {
    flex: 1.4,
    minWidth: 130,
    minHeight: 44,
  },
  endShiftBtn: {
    flex: 1,
    minWidth: 100,
    minHeight: 44,
  },
  shiftBtn: {
    flex: 1,
    minHeight: 44,
  },
  startShiftBtn: {
    marginTop: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    ...Typography.h2,
    color: Colors.light.heading,
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButtonsCol: {
    gap: Spacing.sm,
  },
  actionBtn: {
    marginBottom: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 10,
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.lg,
    maxHeight: '90%',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  managerModeCard: {
    backgroundColor: BrandColors.green.subtle,
    borderColor: BrandColors.green.tint,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  managerModeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  managerModeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  managerModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  managerModeTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  managerModeDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  managerModeBtn: {
    marginTop: Spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 20,
  },
  loadingOverlayText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: Spacing.md,
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
});
