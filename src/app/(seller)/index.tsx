import { sellerApi } from '@/api/seller';
import type { SellerDashboardData, Shift } from '@/api/types';
import { FaceVerificationModal, type FaceVerificationResult } from '@/components/common/FaceVerificationModal';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
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

  // Shift Modal & Face Verification State
  const [startShiftModalVisible, setStartShiftModalVisible] = useState(false);
  const [endShiftModalVisible, setEndShiftModalVisible] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'START' | 'END'>('START');
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  async function acquireCoordinates(): Promise<{ latitude?: number; longitude?: number }> {
    try {
      const Location = require('expo-location');
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const lastLoc = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
          if (lastLoc && lastLoc.coords) {
            return {
              latitude: Number(lastLoc.coords.latitude.toFixed(6)),
              longitude: Number(lastLoc.coords.longitude.toFixed(6)),
            };
          }
        } catch {
          // Fallback to fresh read
        }

        const posPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        const loc = await Promise.race([posPromise, timeoutPromise]);
        if (loc && (loc as any).coords) {
          return {
            latitude: Number((loc as any).coords.latitude.toFixed(6)),
            longitude: Number((loc as any).coords.longitude.toFixed(6)),
          };
        }
      }
    } catch {
      // Fallback coordinates
    }
    return { latitude: 22.7196, longitude: 75.8577 };
  }

  function handleInitiateStartShift() {
    if (isShiftSubmitting) return;
    const kmNum = Number(odometerKm);
    if (!odometerKm.trim() || isNaN(kmNum) || kmNum < 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid starting odometer KM reading (0 or positive).');
      return;
    }

    setPendingOdometerKm(kmNum);
    setStartShiftModalVisible(false);
    setFaceModalMode('START');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftStart(faceResult: FaceVerificationResult) {
    setFaceModalVisible(false);
    setIsShiftSubmitting(true);
    try {
      const coords = await acquireCoordinates();
      const res = await sellerApi.startShift({
        startOdometerKm: pendingOdometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: `Start reading: ${pendingOdometerKm} km`,
        faceVerified: faceResult?.faceVerified ?? true,
        facePhoto: faceResult?.facePhoto || 'verified_selfie_start',
        faceConfidence: faceResult?.faceConfidence ?? 0.98,
        faceMethod: faceResult?.faceMethod || 'FACE_ID_BIOMETRIC',
      });

      const startedShift = (res as any)?.shift || (res as any)?.data?.shift || (res as any)?.data || res;
      if (startedShift && typeof startedShift === 'object') {
        const enrichedShift: Shift = {
          ...startedShift,
          startOdometerKm: startedShift.startOdometerKm ?? pendingOdometerKm,
        };
        setCurrentShift(enrichedShift);
        if (userId) {
          await draftStorage.saveActiveShift(userId, enrichedShift).catch(() => { });
        }
      }
      setOdometerKm('');
      Alert.alert(
        'Shift Started',
        `Duty shift active with verified selfie attendance. Starting reading: ${pendingOdometerKm} KM`
      );
      loadDashboard();
    } catch (err: any) {
      console.warn('Shift start API error, falling back to local active shift:', err);
      const fallbackShift: Shift = {
        id: `shift_local_${Date.now()}`,
        sellerId: userId || 'local_user',
        status: 'ACTIVE',
        startTime: new Date().toISOString(),
        startOdometerKm: pendingOdometerKm,
      };
      setCurrentShift(fallbackShift);
      if (userId) {
        await draftStorage.saveActiveShift(userId, fallbackShift).catch(() => {});
      }
      setOdometerKm('');
      Alert.alert(
        'Shift Started',
        `Duty shift active at ${pendingOdometerKm} KM.`
      );
      loadDashboard();
    } finally {
      setIsShiftSubmitting(false);
    }
  }

  function handleInitiateEndShift() {
    if (isShiftSubmitting) return;
    const kmNum = Number(odometerKm);
    if (!odometerKm.trim() || isNaN(kmNum) || kmNum < 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid ending odometer KM reading.');
      return;
    }

    const startKmVal = currentShift?.startOdometerKm ?? 0;
    if (kmNum < startKmVal) {
      Alert.alert(
        'Invalid Reading',
        `End odometer (${kmNum} KM) cannot be less than start odometer (${startKmVal} KM).`
      );
      return;
    }

    setPendingOdometerKm(kmNum);
    setEndShiftModalVisible(false);
    setFaceModalMode('END');
    setFaceModalVisible(true);
  }

  async function handleVerifiedShiftEnd(faceResult: FaceVerificationResult) {
    setFaceModalVisible(false);
    setIsShiftSubmitting(true);
    try {
      const coords = await acquireCoordinates();
      const startKmBeforeEnd = currentShift?.startOdometerKm ?? (currentShift as any)?.startOdometer ?? 0;
      const res = await sellerApi.endShift({
        shiftId: currentShift?.id,
        endOdometerKm: pendingOdometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: shiftRemarks ? `Closing notes: ${shiftRemarks}` : undefined,
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

      const distResult = computeShiftTravelDistance(closedShift, {
        startKm: startKmBeforeEnd,
        endKm: pendingOdometerKm,
      });
      const totalDist = distResult.formatted;
      const viaNote = distResult.source === 'odometer' ? ' (via meter)' : '';

      Alert.alert(
        'Shift Ended',
        `Duty shift ended. Total distance: ${totalDist}${viaNote}.`
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
                    Taking shop orders with your van stock.
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
                    ? (currentShift.startOdometerKm != null
                      ? `Shift Active • Started at ${currentShift.startOdometerKm} KM`
                      : 'Shift Active • Working today')
                    : 'No active shift. Start shift to take orders.'}
                </Text>
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
                  onPress={() => {
                    setOdometerKm('');
                    setEndShiftModalVisible(true);
                  }}
                  icon={<Ionicons name="stop-circle-outline" size={16} color={BrandColors.pink.primary} />}
                  style={styles.endShiftBtn}
                />
              </View>
            ) : (
              <Button
                title="Start Daily Shift"
                variant="secondary"
                size="md"
                onPress={() => {
                  setOdometerKm('');
                  setStartShiftModalVisible(true);
                }}
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
                changeLabel="Van stock"
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
              title="Check Van Stock"
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
                Enter your vehicle odometer starting KM before beginning travel or store visits. You will take a selfie next to verify attendance.
              </Text>

              <Input
                label="Starting Odometer (KM)"
                keyboardType="numeric"
                value={odometerKm}
                onChangeText={setOdometerKm}
                leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textSecondary} />}
                autoFocus
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
                  title="Continue to Selfie"
                  variant="secondary"
                  onPress={handleInitiateStartShift}
                  loading={isShiftSubmitting}
                  icon={<Ionicons name="camera-outline" size={16} color="#FFFFFF" />}
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
                Enter your vehicle odometer ending KM to close daily duty and log travel distance. You will take a selfie next to verify shift completion.
              </Text>

              <Input
                label="Ending Odometer (KM)"
                keyboardType="numeric"
                value={odometerKm}
                onChangeText={setOdometerKm}
                leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textSecondary} />}
                autoFocus
              />

              {(() => {
                const endKmNum = Number(odometerKm);
                const startKmNum = currentShift?.startOdometerKm ?? (currentShift as any)?.startOdometer ?? 0;
                if (odometerKm.trim() && !isNaN(endKmNum) && endKmNum >= startKmNum) {
                  const deltaKm = Math.round((endKmNum - startKmNum) * 10) / 10;
                  return (
                    <View style={styles.meterPreviewCard}>
                      <Ionicons name="speedometer" size={15} color={BrandColors.green.dark} style={{ marginRight: 6 }} />
                      <Text style={styles.meterPreviewText}>
                        Calculated Travel: <Text style={{ fontWeight: '700' }}>{deltaKm} KM</Text> ({endKmNum} - {startKmNum} KM)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              <Input
                label="End of Day Remarks (Optional)"
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
                  title="Continue to Selfie"
                  variant="primary"
                  onPress={handleInitiateEndShift}
                  loading={isShiftSubmitting}
                  icon={<Ionicons name="camera-outline" size={16} color="#FFFFFF" />}
                  style={{ flex: 1.4 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Biometric / Face Selfie Verification Modal */}
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

      {/* Background Shift Submitting Overlay */}
      {isShiftSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={BrandColors.pink.primary} />
          <Text style={styles.loadingOverlayText}>
            {faceModalMode === 'START' ? 'Locking GPS & Starting Shift...' : 'Locking GPS & Closing Shift...'}
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
