import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerDashboardData, Shift } from '@/api/types';
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

export default function SellerDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Shift Modal State
  const [startShiftModalVisible, setStartShiftModalVisible] = useState(false);
  const [endShiftModalVisible, setEndShiftModalVisible] = useState(false);
  const [odometerKm, setOdometerKm] = useState('');
  const [shiftRemarks, setShiftRemarks] = useState('');
  const [isShiftSubmitting, setIsShiftSubmitting] = useState(false);

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
        sellerApi.getCurrentShift().catch(() => ({ shift: null })),
      ]);

      setData(dashData as SellerDashboardData);
      setCurrentShift(shiftData.shift);
    } catch (err: any) {
      console.warn('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  async function handleStartShift() {
    if (isShiftSubmitting) return;
    const kmNum = Number(odometerKm);
    if (!odometerKm || isNaN(kmNum) || kmNum <= 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid positive odometer KM reading.');
      return;
    }

    setIsShiftSubmitting(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const Location = require('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch {
        // Foreground GPS optional fallback
      }

      const res = await sellerApi.startShift({
        startOdometerKm: kmNum,
        latitude,
        longitude,
      });

      setCurrentShift(res.shift);
      setStartShiftModalVisible(false);
      setOdometerKm('');
      Alert.alert('Shift Started', `Duty shift active. Initial reading: ${kmNum} KM`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to start shift.');
    } finally {
      setIsShiftSubmitting(false);
    }
  }

  async function handleEndShift() {
    if (isShiftSubmitting) return;
    const kmNum = Number(odometerKm);
    if (!odometerKm || isNaN(kmNum) || kmNum <= 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid ending odometer KM reading.');
      return;
    }

    if (currentShift && kmNum < currentShift.startOdometerKm) {
      Alert.alert(
        'Invalid Reading',
        `End odometer (${kmNum} KM) cannot be less than start odometer (${currentShift.startOdometerKm} KM).`
      );
      return;
    }

    setIsShiftSubmitting(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const Location = require('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch {
        // Foreground GPS optional fallback
      }

      await sellerApi.endShift({
        endOdometerKm: kmNum,
        latitude,
        longitude,
        remarks: shiftRemarks,
      });

      setCurrentShift(null);
      setEndShiftModalVisible(false);
      setOdometerKm('');
      setShiftRemarks('');
      Alert.alert('Shift Completed', 'Your duty shift and travel logs have been recorded.');
      loadDashboard();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to end shift.');
    } finally {
      setIsShiftSubmitting(false);
    }
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
        subtitle="Field Operations • Active Session"
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.primary]} />}
      >
        <View style={styles.contentWrapper}>
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
                  <Text style={styles.shiftTitle}>Daily Duty Attendance</Text>
                </View>
                <Text style={styles.shiftSubtitle}>
                  {currentShift
                    ? `Shift Active • Started at ${currentShift.startOdometerKm} KM`
                    : 'No active shift. Record daily travel & store visits.'}
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
                  title="Shift & Visits Tracker"
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
                title="Start Shift with KM"
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
                value={formatRupees(data?.todaySalesPaise || data?.todaySalesAmountPaise || 0)}
                icon={<Ionicons name="wallet-outline" size={20} color={BrandColors.pink.primary} />}
                variant="pink"
                changeLabel="Recorded sales"
              />
              <StatCard
                title="Orders Booked"
                value={String(data?.todayOrdersCount || data?.todayPacketsSold || 0)}
                icon={<Ionicons name="receipt-outline" size={20} color={BrandColors.green.primary} />}
                variant="green"
                changeLabel="In-store visits"
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
                value={formatRupees(data?.monthSalesPaise || 0)}
                icon={<Ionicons name="trending-up-outline" size={20} color={BrandColors.pink.primary} />}
                variant="default"
                changeLabel="Target progress"
              />
              <StatCard
                title="Stock Status"
                value={data?.lowStockCount ? `${data.lowStockCount} Low` : (data?.stockBalance ? `${data.stockBalance} Pkts` : 'Healthy')}
                icon={<Ionicons name="cube-outline" size={20} color={Colors.light.textSecondary} />}
                variant={data?.lowStockCount ? 'pink' : 'default'}
                changeLabel="Warehouse inventory"
              />
            </View>
          )}

          {/* Field Quick Actions */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Field Work Actions</Text>
          </View>

          <View style={styles.actionButtonsCol}>
            <Button
              title="New Store Sale (POS)"
              onPress={() => router.push('/(seller)/sales/new')}
              variant="primary"
              size="lg"
              icon={<Ionicons name="cart" size={20} color="#FFFFFF" />}
              style={styles.actionBtn}
            />
            <Button
              title="Onboard New Retailer"
              onPress={() => router.push('/(seller)/customers/new')}
              variant="outline"
              size="lg"
              icon={<Ionicons name="person-add-outline" size={20} color={BrandColors.pink.primary} />}
              style={styles.actionBtn}
            />
            <Button
              title="Check Inventory Balance"
              onPress={() => router.push('/(seller)/inventory')}
              variant="ghost"
              size="md"
              icon={<Ionicons name="layers-outline" size={18} color={BrandColors.pink.primary} />}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </ScrollView>

      {/* Start Shift Modal */}
      <Modal visible={startShiftModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Start Daily Duty Shift</Text>
              <Pressable hitSlop={HitSlop.md} onPress={() => setStartShiftModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter your vehicle odometer starting KM before beginning travel or store visits.
            </Text>

            <Input
              label="Starting Odometer (KM)"
              placeholder="e.g. 14250"
              keyboardType="numeric"
              value={odometerKm}
              onChangeText={setOdometerKm}
              leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textSecondary} />}
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
                title={isShiftSubmitting ? 'Starting...' : 'Confirm Start'}
                variant="secondary"
                onPress={handleStartShift}
                loading={isShiftSubmitting}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* End Shift Modal */}
      <Modal visible={endShiftModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Complete Daily Duty Shift</Text>
              <Pressable hitSlop={HitSlop.md} onPress={() => setEndShiftModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter your vehicle odometer ending KM to close daily duty and log travel distance.
            </Text>

            <Input
              label="Ending Odometer (KM)"
              placeholder="e.g. 14320"
              keyboardType="numeric"
              value={odometerKm}
              onChangeText={setOdometerKm}
              leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textSecondary} />}
            />

            <Input
              label="End of Day Remarks (Optional)"
              placeholder="e.g. Covered Rau & Pithampur market"
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
                title={isShiftSubmitting ? 'Saving...' : 'End Duty Shift'}
                variant="primary"
                onPress={handleEndShift}
                loading={isShiftSubmitting}
                style={{ flex: 1.4 }}
              />
            </View>
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
    minWidth: 150,
    minHeight: 44,
  },
  endShiftBtn: {
    flex: 1,
    minWidth: 120,
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
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
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
});
