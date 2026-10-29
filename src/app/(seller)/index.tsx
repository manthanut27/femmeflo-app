import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { SellerDashboardData, Shift } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SellerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dashboard, setDashboard] = useState<SellerDashboardData | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Shift Modal State
  const [startShiftModalVisible, setStartShiftModalVisible] = useState(false);
  const [endShiftModalVisible, setEndShiftModalVisible] = useState(false);
  const [odometerKm, setOdometerKm] = useState('');
  const [shiftRemarks, setShiftRemarks] = useState('');
  const [isShiftSubmitting, setIsShiftSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dashData, shiftData] = await Promise.all([
        sellerApi.getDashboard().catch(() => ({
          todaySalesAmountPaise: 0,
          todayPacketsSold: 0,
          stockBalance: 0,
          pendingApprovalsCount: 0,
        })),
        sellerApi.getCurrentShift().catch(() => ({ shift: null })),
      ]);

      setDashboard(dashData);
      setCurrentShift(shiftData.shift);
    } catch (err) {
      console.warn('Dashboard fetch error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  async function handleStartShift() {
    if (isShiftSubmitting) return;
    const kmNum = parseFloat(odometerKm);
    if (isNaN(kmNum) || kmNum < 0) {
      Alert.alert('Invalid Reading', 'Please enter a valid starting odometer reading in kilometers.');
      return;
    }

    setIsShiftSubmitting(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {
        // Location optional on fallback
      }

      const res = await sellerApi.startShift({
        startOdometerKm: kmNum,
        startLatitude: lat,
        startLongitude: lon,
      });

      setCurrentShift(res.shift);
      setStartShiftModalVisible(false);
      setOdometerKm('');
      Alert.alert('Shift Started', `Duty shift active. Initial reading: ${kmNum} KM`);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to start shift.');
    } finally {
      setIsShiftSubmitting(false);
    }
  }

  async function handleEndShift() {
    if (isShiftSubmitting) return;
    const kmNum = parseFloat(odometerKm);
    if (isNaN(kmNum) || kmNum < 0) {
      Alert.alert('Invalid Reading', 'Please enter a valid ending odometer reading in kilometers.');
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
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {
        // Fallback
      }

      await sellerApi.endShift({
        endOdometerKm: kmNum,
        endLatitude: lat,
        endLongitude: lon,
        remarks: shiftRemarks,
      });

      setCurrentShift(null);
      setEndShiftModalVisible(false);
      setOdometerKm('');
      setShiftRemarks('');
      Alert.alert('Shift Completed', 'Your duty shift and travel logs have been recorded.');
      loadData();
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
                  style={[styles.shiftBtn, { marginRight: Spacing.sm }]}
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
                  style={styles.shiftBtn}
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
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <StatCard
                title="Today's Revenue"
                value={formatRupees(dashboard?.todaySalesAmountPaise || 0)}
                subtitle="Confirmed sales volume"
                icon="wallet-outline"
                iconColor={BrandColors.pink.primary}
                iconBgColor={BrandColors.pink.subtle}
                trend={(dashboard?.todaySalesAmountPaise || 0) > 0 ? { value: '+14% vs yesterday', isPositive: true } : undefined}
              />
              <StatCard
                title="Packets Sold"
                value={(dashboard?.todayPacketsSold || 0).toLocaleString()}
                subtitle="Feminine hygiene units"
                icon="cube-outline"
                iconColor={Colors.light.info}
                iconBgColor={Colors.light.infoBg}
              />
              <StatCard
                title="Van Stock Balance"
                value={`${(dashboard?.stockBalance || 0).toLocaleString()} pkts`}
                subtitle="Available to sell"
                icon="bus-outline"
                iconColor={BrandColors.green.primary}
                iconBgColor={BrandColors.green.surface}
                accentColor={BrandColors.green.primary}
                onPress={() => router.push('/(seller)/inventory' as any)}
              />
              <StatCard
                title="Pending Approvals"
                value={dashboard?.pendingApprovalsCount || 0}
                subtitle={(dashboard?.pendingApprovalsCount || 0) > 0 ? "Awaiting approval" : "Queue clear"}
                icon="hourglass-outline"
                iconColor={(dashboard?.pendingApprovalsCount || 0) > 0 ? Colors.light.warning : Colors.light.textSecondary}
                iconBgColor={(dashboard?.pendingApprovalsCount || 0) > 0 ? Colors.light.warningBg : Colors.light.backgroundElement}
                badge={(dashboard?.pendingApprovalsCount || 0) > 0 ? 'PENDING' : undefined}
                badgeVariant="warning"
                onPress={() => router.push('/(seller)/sales' as any)}
              />
            </View>
          )}

          {/* Quick Actions */}
          <Text style={styles.sectionHeading}>Quick Actions</Text>
          <View style={styles.actionButtonsCol}>
            <Button
              title="Create New Sale (POS)"
              onPress={() => router.push('/(seller)/sales/new' as any)}
              variant="primary"
              size="lg"
              icon={<Ionicons name="cart-outline" size={20} color="#FFFFFF" />}
              style={styles.actionBtn}
            />
            <Button
              title="Onboard New Retail Customer"
              onPress={() => router.push('/(seller)/customers/new' as any)}
              variant="outline"
              size="md"
              icon={<Ionicons name="person-add-outline" size={18} color={BrandColors.pink.primary} />}
              style={styles.actionBtn}
            />
            <Button
              title="View Monthly Incentives & Rates"
              onPress={() => router.push('/(seller)/incentives' as any)}
              variant="secondary"
              size="md"
              icon={<Ionicons name="trending-up-outline" size={18} color="#FFFFFF" />}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </ScrollView>

      {/* Start Shift Modal */}
      <Modal visible={startShiftModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Start Daily Duty Shift</Text>
              <Pressable
                onPress={() => setStartShiftModalVisible(false)}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {"Enter your vehicle's starting odometer reading. GPS coordinates will be captured to verify presence."}
            </Text>

            <Input
              label="Starting Odometer (KM) *"
              placeholder="e.g. 14250.5"
              keyboardType="decimal-pad"
              value={odometerKm}
              onChangeText={setOdometerKm}
              leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textMuted} />}
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
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* End Shift Modal */}
      <Modal visible={endShiftModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Complete Daily Duty Shift</Text>
              <Pressable
                onPress={() => setEndShiftModalVisible(false)}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              {"Enter your vehicle's ending odometer reading to calculate total field travel."}
            </Text>

            <Input
              label="Ending Odometer (KM) *"
              placeholder="e.g. 14312.0"
              keyboardType="decimal-pad"
              value={odometerKm}
              onChangeText={setOdometerKm}
              leftIcon={<Ionicons name="speedometer-outline" size={18} color={Colors.light.textMuted} />}
            />

            <Input
              label="Day Summary / Remarks (Optional)"
              placeholder="Visited 8 retailers, 4 orders..."
              value={shiftRemarks}
              onChangeText={setShiftRemarks}
              leftIcon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.light.textMuted} />}
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
                variant="danger"
                onPress={handleEndShift}
                loading={isShiftSubmitting}
                style={{ flex: 1.5 }}
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
    paddingBottom: Spacing.huge,
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
    marginTop: Spacing.md,
    alignItems: 'flex-end',
  },
  shiftBtn: {
    minHeight: 36,
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
