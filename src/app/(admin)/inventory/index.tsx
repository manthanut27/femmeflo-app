import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
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
import { adminApi } from '@/api/admin';
import type { WarehouseItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function AdminInventoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string; openAddModal?: string }>();

  const handleBack = useCallback(() => {
    if (params?.from === 'actions') {
      try {
        (navigation as any).navigate('actions/index');
        return;
      } catch {
        // fallback
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      try {
        (navigation as any).navigate('actions/index');
      } catch {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [params?.from, navigation, router]);

  useEffect(() => {
    if (params?.from === 'actions') {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [params?.from, handleBack]);

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Warehouse Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formState, setFormState] = useState('Uttar Pradesh');
  const [formDistrict, setFormDistrict] = useState('Varanasi');
  const [formAddress, setFormAddress] = useState('');
  const [formType, setFormType] = useState<'WAREHOUSE' | 'HQ'>('WAREHOUSE');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Automatically open modal if requested from Quick Actions
  useEffect(() => {
    if (params?.openAddModal === 'true') {
      setModalVisible(true);
    }
  }, [params?.openAddModal]);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await adminApi.getWarehouses();
      setWarehouses(res.items || []);
    } catch (err) {
      console.warn('Failed to load warehouses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWarehouses();
  }, [loadWarehouses]);

  const generateFacilityCode = () => {
    const raw = formDistrict.trim() || formName.trim() || 'FAC';
    const clean = raw.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    const rand = Math.floor(10 + Math.random() * 90);
    setFormCode(`WH-${clean}-${rand}`);
  };

  const handleOpenAddModal = () => {
    setFormName('');
    setFormCode(`WH-DEPOT-${Math.floor(100 + Math.random() * 900)}`);
    setFormState('Uttar Pradesh');
    setFormDistrict('Varanasi');
    setFormAddress('');
    setFormType('WAREHOUSE');
    setFormError(null);
    setModalVisible(true);
  };

  const handleCreateWarehouse = async () => {
    if (!formName.trim()) {
      setFormError('Please enter warehouse facility name.');
      return;
    }
    if (!formDistrict.trim()) {
      setFormError('District is required.');
      return;
    }
    if (!formState.trim()) {
      setFormError('State is required.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.createWarehouse({
        name: formName.trim(),
        code: formCode.trim() || undefined,
        state: formState.trim(),
        district: formDistrict.trim(),
        address: formAddress.trim() || undefined,
        type: formType,
      });

      setModalVisible(false);
      Alert.alert(
        'Warehouse Registered',
        `${res.warehouse?.name || formName} has been successfully added to the logistics network.`,
        [{ text: 'OK' }]
      );
      loadWarehouses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create warehouse facility.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderWarehouse = ({ item }: { item: WarehouseItem }) => {
    const isHq = item.type === 'HQ';
    return (
      <Card
        style={styles.card}
        accessibilityRole="summary"
        accessibilityLabel={`Warehouse ${item.name}, code ${item.code}, status ${item.active ? 'Operational' : 'Inactive'}`}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.codeRow}>
              <Ionicons name="barcode-outline" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.code}>Facility Code: {item.code}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge
              label={item.active ? 'OPERATIONAL' : 'INACTIVE'}
              variant={item.active ? 'ACTIVE' : 'INACTIVE'}
              size="sm"
            />
            {isHq && <Badge label="CENTRAL HQ" variant="ACTIVE" size="sm" />}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.location}>
              {[item.district, item.state].filter(Boolean).join(', ') || item.address || 'Location registered'}
            </Text>
          </View>
          {typeof item.balance === 'number' && (
            <View style={styles.balancePill}>
              <Text style={styles.balanceText}>{item.balance.toLocaleString('en-IN')} pkts</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="HQ & Warehouses"
        subtitle="National Storage & Logistics Network"
        showBack={Boolean(params?.from === 'actions')}
        onBack={handleBack}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new warehouse facility"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={handleOpenAddModal}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.innerContainer}>
        {/* Action Banner */}
        <View style={styles.actionBanner}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={styles.bannerTitle}>Storage Facilities & Hubs</Text>
            <Text style={styles.bannerSub}>Register regional depots or execute inter-warehouse transfers.</Text>
          </View>
          <View style={styles.bannerBtnGroup}>
            <Button
              title="Add Warehouse"
              size="sm"
              variant="primary"
              icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
              onPress={handleOpenAddModal}
              style={{ marginRight: 6 }}
            />
            <Button
              title="Transfers"
              size="sm"
              variant="outline"
              icon={<Ionicons name="swap-horizontal-outline" size={16} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/inventory/transfer' as any)}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : warehouses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={48} color={Colors.light.textMuted} />
            <Text style={styles.emptyTitle}>No Warehouses Registered</Text>
            <Text style={styles.emptyText}>Add your first regional depot or storage facility to manage nationwide inventory.</Text>
            <Button
              title="Register Warehouse"
              size="md"
              variant="primary"
              onPress={handleOpenAddModal}
              icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        ) : (
          <FlatList
            data={warehouses}
            keyExtractor={(item) => item.id}
            renderItem={renderWarehouse}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[BrandColors.pink.dark]}
              />
            }
          />
        )}
      </View>

      {/* Add New Warehouse Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.modalTitle}>New Warehouse Facility</Text>
                <Text style={styles.modalSubtitle}>
                  Register a regional depot or central facility in the logistics network
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {formError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={Colors.light.error} />
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              )}

              {/* Warehouse Facility Name */}
              <Text style={styles.inputLabel}>Facility / Warehouse Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Varanasi Regional Distribution Hub"
                placeholderTextColor={Colors.light.textMuted}
              />

              {/* Facility Code with Auto-Generator */}
              <View style={styles.codeHeaderRow}>
                <Text style={styles.inputLabel}>Facility Code (optional)</Text>
                <Text style={styles.codeHintText}>Auto-generate</Text>
              </View>
              <View style={styles.codeRowInputWrap}>
                <TextInput
                  style={[styles.modalInput, styles.codeInputFlex]}
                  value={formCode}
                  onChangeText={setFormCode}
                  placeholder="e.g. WH-VNS-01"
                  placeholderTextColor={Colors.light.textMuted}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.codeGenBtn}
                  onPress={generateFacilityCode}
                  accessibilityRole="button"
                  accessibilityLabel="Auto-generate facility code"
                >
                  <Ionicons name="sparkles" size={15} color={BrandColors.green.dark} />
                  <Text style={styles.codeGenBtnText}>Generate</Text>
                </TouchableOpacity>
              </View>

              {/* State & District Row */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formState}
                    onChangeText={setFormState}
                    placeholder="e.g. Uttar Pradesh"
                    placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>District *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formDistrict}
                    onChangeText={setFormDistrict}
                    placeholder="e.g. Varanasi"
                    placeholderTextColor={Colors.light.textMuted}
                  />
                </View>
              </View>

              {/* Address */}
              <Text style={styles.inputLabel}>Physical Address / Industrial Area (optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 64, textAlignVertical: 'top' }]}
                value={formAddress}
                onChangeText={setFormAddress}
                placeholder="e.g. Plot 42, Transport Nagar Phase 2"
                placeholderTextColor={Colors.light.textMuted}
                multiline
                numberOfLines={2}
              />

              {/* Facility Type Selector */}
              <Text style={styles.inputLabel}>Facility Type</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typeSelectorPill,
                    formType === 'WAREHOUSE' && styles.typeSelectorPillActive,
                  ]}
                  onPress={() => setFormType('WAREHOUSE')}
                >
                  <Ionicons
                    name="business-outline"
                    size={16}
                    color={formType === 'WAREHOUSE' ? '#FFFFFF' : Colors.light.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      formType === 'WAREHOUSE' && styles.typeSelectorTextActive,
                    ]}
                  >
                    Regional Depot
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeSelectorPill,
                    formType === 'HQ' && styles.typeSelectorPillActive,
                  ]}
                  onPress={() => setFormType('HQ')}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={formType === 'HQ' ? '#FFFFFF' : Colors.light.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSelectorText,
                      formType === 'HQ' && styles.typeSelectorTextActive,
                    ]}
                  >
                    Central Reserve HQ
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Buttons */}
              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={isSubmitting ? 'Registering...' : 'Register Warehouse'}
                  variant="primary"
                  onPress={handleCreateWarehouse}
                  loading={isSubmitting}
                  style={{ flex: 1, backgroundColor: BrandColors.green.primary }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  addButton: {
    backgroundColor: BrandColors.green.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.low,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  actionBanner: {
    flexDirection: 'column',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
    gap: 12,
  },
  bannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  bannerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.heading,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  card: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  name: {
    ...Typography.h3,
    fontSize: 15,
    color: Colors.light.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  code: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  location: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  balancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.green.surface,
  },
  balanceText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '700',
    color: BrandColors.green.dark,
  },
  modalSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 6,
  },
  errorBannerText: {
    ...Typography.caption,
    color: Colors.light.error,
    fontWeight: '600',
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.textPrimary,
  },
  codeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  codeHintText: {
    ...Typography.caption,
    fontSize: 11,
    color: BrandColors.green.dark,
    fontWeight: '600',
  },
  codeRowInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInputFlex: {
    flex: 1,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.green.surface,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  codeGenBtnText: {
    ...Typography.caption,
    color: BrandColors.green.dark,
    fontWeight: '700',
  },
  twoColumnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  typeSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 6,
  },
  typeSelectorPillActive: {
    backgroundColor: BrandColors.green.dark,
    borderColor: BrandColors.green.dark,
  },
  typeSelectorText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  typeSelectorTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.sm,
  },
});
