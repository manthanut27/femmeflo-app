import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, Shift, ShiftVisit } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { draftStorage } from '@/utils/draftStorage';

export default function ShiftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Start Shift Modal
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [startOdometer, setStartOdometer] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [isStartingShift, setIsStartingShift] = useState(false);

  // Check-in Visit Modal
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // End Shift Modal
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [endOdometer, setEndOdometer] = useState('');
  const [endNotes, setEndNotes] = useState('');
  const [isEndingShift, setIsEndingShift] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadShiftData = useCallback(async () => {
    try {
      // Server GET /seller/shifts/current is the primary source of truth
      const [shiftRes, custRes] = await Promise.all([
        sellerApi.getCurrentShift().catch(async () => {
          const cached = await draftStorage.getActiveShift(userId);
          return { shift: cached };
        }),
        sellerApi.listCustomers({ pageSize: 50 }).catch(() => ({ items: [] })),
      ]);

      const active = shiftRes.shift;
      setCurrentShift(active);
      await draftStorage.saveActiveShift(userId, active);

      setCustomers(custRes.items);
      if (custRes.items.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custRes.items[0].id);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCustomerId, userId]);

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

  async function handleStartShift() {
    if (isStartingShift) return;
    const km = parseFloat(startOdometer);
    if (isNaN(km) || km < 0) {
      Alert.alert('Invalid Reading', 'Please enter a valid starting odometer reading in kilometers.');
      return;
    }

    setIsStartingShift(true);
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
        startOdometerKm: km,
        startLatitude: lat,
        startLongitude: lon,
        notes: startNotes.trim() || undefined,
      });

      setCurrentShift(res.shift);
      await draftStorage.saveActiveShift(userId, res.shift);
      setStartModalVisible(false);
      setStartOdometer('');
      setStartNotes('');
      Alert.alert('Shift Started', `Field beat shift initialized at ${km} km.`);
    } catch (err: any) {
      Alert.alert('Shift Start Failed', err.message || 'Unable to start shift.');
    } finally {
      setIsStartingShift(false);
    }
  }

  async function handleCheckInVisit() {
    if (isCheckingIn) return;
    if (!selectedCustomerId) {
      Alert.alert('Select Customer', 'Please select a retail outlet for this visit.');
      return;
    }

    setIsCheckingIn(true);
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

      await sellerApi.checkIn({
        customerId: selectedCustomerId,
        latitude: lat,
        longitude: lon,
        notes: visitNotes.trim() || undefined,
      });

      setCheckInModalVisible(false);
      setVisitNotes('');
      Alert.alert('Visit Checked In', 'GPS location captured and store visit recorded.');
      loadShiftData();
    } catch (err: any) {
      Alert.alert('Check-in Failed', err.message || 'Unable to record store visit.');
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function handleEndShift() {
    if (isEndingShift) return;
    const km = parseFloat(endOdometer);
    if (isNaN(km) || km < (currentShift?.startOdometerKm ?? 0)) {
      Alert.alert(
        'Invalid Reading',
        `Closing odometer must be greater than or equal to starting reading (${currentShift?.startOdometerKm ?? 0} km).`
      );
      return;
    }

    setIsEndingShift(true);
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
        endOdometerKm: km,
        endLatitude: lat,
        endLongitude: lon,
        notes: endNotes.trim() || undefined,
      });

      setCurrentShift(null);
      await draftStorage.clearActiveShift(userId);
      setEndModalVisible(false);
      setEndOdometer('');
      setEndNotes('');
      Alert.alert('Shift Ended', 'Shift logged and summarized successfully.');
    } catch (err: any) {
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
                    title="End Shift"
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
                  You are currently off duty. Start your shift to activate GPS beat tracking, log retailer visits, and deduct van stock.
                </Text>
                <Button
                  title="Start Duty Shift"
                  onPress={() => setStartModalVisible(true)}
                  variant="primary"
                  size="lg"
                  icon={<Ionicons name="play" size={18} color="#FFFFFF" />}
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
              <Text style={styles.sectionTitle}>Today's Store Visits</Text>
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
              <Card style={styles.emptyCard}>
                <Ionicons name="storefront-outline" size={36} color={Colors.light.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No store visits recorded yet</Text>
                <Text style={styles.emptySubtitle}>
                  {isShiftActive
                    ? 'Tap "Check-in Store Visit" above when arriving at a retail customer outlet.'
                    : 'Start your shift to begin logging store visits along your beat.'}
                </Text>
              </Card>
            ) : (
              visits.map((v: ShiftVisit, idx: number) => {
                const customer = customers.find((c) => c.id === v.customerId);
                const isCheckedOut = Boolean(v.checkOutTime);
                return (
                  <Card key={v.id || idx} style={styles.visitCard}>
                    <View style={styles.visitHeader}>
                      <View style={styles.visitIconBox}>
                        <Ionicons
                          name={isCheckedOut ? 'checkmark-circle' : 'time'}
                          size={20}
                          color={isCheckedOut ? BrandColors.green.primary : '#D97706'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.visitStoreName}>
                          {customer?.shopName || 'Retail Customer Store'}
                        </Text>
                        <Text style={styles.visitSub}>
                          Arrived: {new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {v.checkOutTime
                            ? ` • Left: ${new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ' • Active Visit'}
                        </Text>
                      </View>
                      <Badge
                        label={isCheckedOut ? 'COMPLETED' : 'IN PROGRESS'}
                        variant={isCheckedOut ? 'success' : 'warning'}
                      />
                    </View>
                    {v.notes || v.summary ? (
                      <Text style={styles.visitNotes} numberOfLines={2}>
                        "{v.notes || v.summary}"
                      </Text>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Start Shift Modal */}
      <Modal visible={startModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Field Shift</Text>
            <Text style={styles.modalSubtitle}>
              Confirm starting odometer reading and lock initial GPS coordinates.
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
                title={isStartingShift ? 'Starting...' : 'Confirm & Start'}
                variant="primary"
                onPress={handleStartShift}
                loading={isStartingShift}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Check-in Store Visit Modal */}
      <Modal visible={checkInModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Check-in Store Visit</Text>
            <Text style={styles.modalSubtitle}>
              Select the outlet and lock your current GPS location coordinates.
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
                    <Text style={styles.modalCustomerSub}>{c.ownerName} • {c.village || c.district || 'Territory'}</Text>
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
                title={isCheckingIn ? 'Checking in...' : 'Lock Location & Visit'}
                variant="secondary"
                onPress={handleCheckInVisit}
                loading={isCheckingIn}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* End Shift Modal */}
      <Modal visible={endModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>End Duty Shift</Text>
            <Text style={styles.modalSubtitle}>
              Record your closing vehicle odometer to compute total distance traveled.
            </Text>

            <Input
              label={`Closing Odometer (≥ ${startKm} km) *`}
              placeholder={`e.g. ${startKm + 25}`}
              value={endOdometer}
              onChangeText={setEndOdometer}
              keyboardType="numeric"
              leftIcon={<Ionicons name="speedometer-outline" size={18} color="#94A3B8" />}
            />

            <Input
              label="Closing Remarks"
              placeholder="e.g. Completed sector 4 beat without stockouts"
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
                title={isEndingShift ? 'Closing...' : 'Confirm & End'}
                variant="admin"
                onPress={handleEndShift}
                loading={isEndingShift}
                style={{ flex: 1 }}
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
  emptyCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.light.heading,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
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
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  visitStoreName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  visitSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  visitNotes: {
    ...Typography.caption,
    fontStyle: 'italic',
    color: Colors.light.textSecondary,
    marginTop: Spacing.sm,
    paddingLeft: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
    marginBottom: Spacing.lg,
  },
  modalFieldLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  modalCustomerList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  modalCustomerItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  modalCustomerItemActive: {
    backgroundColor: BrandColors.pink.subtle,
  },
  modalCustomerName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  modalCustomerNameActive: {
    color: BrandColors.pink.primary,
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
});
