import { managerApi, ManagerSellerItem } from '@/api/manager';
import type { PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
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
import { canOnboardSellers, canViewSellers } from '@/utils/permissions';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
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

export default function ManagerSellersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const allowView = canViewSellers(user);
  const allowOnboard = canOnboardSellers(user);

  const [sellers, setSellers] = useState<ManagerSellerItem[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Seller Modal States
  const [editingSeller, setEditingSeller] = useState<ManagerSellerItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editDailyTarget, setEditDailyTarget] = useState('30');
  const [editActive, setEditActive] = useState(true);
  const [isUpdatingSeller, setIsUpdatingSeller] = useState(false);
  const [sellerFormErrors, setSellerFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSellers = useCallback(async () => {
    if (!allowView) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await managerApi.listSellers({
        page: 1,
        pageSize: 50,
        search: debouncedSearch.trim() || undefined,
      });
      setSellers(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.warn('Failed to load sellers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowView, debouncedSearch]);

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSellers();
  }, [loadSellers]);

  function handleOpenEditSeller(item: ManagerSellerItem) {
    setEditingSeller(item);
    setEditName(item.name || '');
    const cleanPhone = (item.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, '');
    setEditPhone(cleanPhone);
    setEditAlternatePhone(item.alternatePhone || '');
    setEditVillage(item.village || '');
    setEditAddress(item.address || '');
    setEditPincode(item.pincode || '');
    setEditDailyTarget(String((item as any).dailyTarget || 30));
    setEditActive(item.active !== false);
    setSellerFormErrors({});
  }

  function handleCloseEditSeller() {
    if (isUpdatingSeller) return;
    setEditingSeller(null);
  }

  async function handleSaveSeller() {
    if (!editingSeller) return;

    const errors: Record<string, string> = {};
    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = 'Seller name is required (minimum 2 characters)';
    }

    const cleanPhone = editPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit mobile phone number is required';
    }

    const targetNum = parseInt(editDailyTarget, 10);
    if (isNaN(targetNum) || targetNum <= 0) {
      errors.dailyTarget = 'Daily target must be a positive integer';
    }

    if (editPincode.trim() && !/^\d{6}$/.test(editPincode.trim())) {
      errors.pincode = 'Pincode must be exactly 6 digits';
    }

    if (Object.keys(errors).length > 0) {
      setSellerFormErrors(errors);
      return;
    }

    setIsUpdatingSeller(true);
    setSellerFormErrors({});

    try {
      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : `+91${cleanPhone.slice(-10)}`;

      const res = await managerApi.updateSeller(editingSeller.id, {
        name: trimmedName,
        phone: formattedPhone,
        alternatePhone: editAlternatePhone.trim() || undefined,
        village: editVillage.trim() || undefined,
        address: editAddress.trim() || undefined,
        pincode: editPincode.trim() || undefined,
        dailyTarget: targetNum,
        active: editActive,
      });

      const updated = res.seller;
      setSellers((prev) =>
        prev.map((s) => (s.id === editingSeller.id ? { ...s, ...updated } : s))
      );

      setEditingSeller(null);
      Alert.alert('Seller Saved', `${trimmedName}'s details have been saved.`);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save seller details.');
    } finally {
      setIsUpdatingSeller(false);
    }
  }

  const renderSeller = ({ item }: { item: ManagerSellerItem }) => {
    const initials = item.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <Card style={styles.sellerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'SF'}</Text>
          </View>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.sellerEmail} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <View style={styles.headerRightActions}>
            <Badge
              label={item.active ? 'ACTIVE' : 'INACTIVE'}
              variant={item.active ? 'ACTIVE' : 'INACTIVE'}
              size="sm"
              style={styles.statusBadge}
            />
            <Pressable
              style={({ pressed }) => [styles.editActionBtn, pressed && styles.editActionBtnPressed]}
              onPress={() => handleOpenEditSeller(item)}
              hitSlop={HitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel={`Edit details for ${item.name}`}
            >
              <Ionicons name="create-outline" size={15} color={BrandColors.green.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.phoneText}>{item.phone || 'No phone recorded'}</Text>
          </View>
          <Text style={styles.territoryText}>
            {[item.village, [item.district, item.state].filter(Boolean).join(', ')].filter(Boolean).join(' • ') || 'Assigned Territory'}
          </Text>
        </View>
      </Card>
    );
  };

  if (!allowView) {
    return (
      <View style={styles.container}>
        <Header title="Sellers" subtitle="Team" showBack />
        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="No Permission"
            description="You do not have permission to view sellers in your territory. Please ask your administrator to enable this permission."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Dashboard"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Sellers"
        subtitle={`${pagination.total} Sellers in Team`}
        rightAction={
          allowOnboard ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Onboard new field officer"
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
              onPress={() => router.push('/(manager)/sellers/new' as any)}
              hitSlop={HitSlop.md}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, phone, or village..."
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textTertiary} />}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.listContainer}>
          <CardSkeleton style={{ marginBottom: Spacing.md }} />
          <CardSkeleton style={{ marginBottom: Spacing.md }} />
          <CardSkeleton style={{ marginBottom: Spacing.md }} />
        </View>
      ) : (
        <FlatList
          data={sellers}
          keyExtractor={(item) => item.id}
          renderItem={renderSeller}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BrandColors.green.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No Sellers Found"
              description={
                debouncedSearch
                  ? 'No sellers matched your search.'
                  : 'No sellers in your team yet.'
              }
              actionTitle={allowOnboard ? 'Add Seller' : undefined}
              onAction={allowOnboard ? () => router.push('/(manager)/sellers/new' as any) : undefined}
            />
          }
        />
      )}

      {/* Edit Seller Modal */}
      <Modal
        visible={Boolean(editingSeller)}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={handleCloseEditSeller}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={handleCloseEditSeller} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Field Officer</Text>
                <Text style={styles.modalSubtitle}>
                  Update seller details and status
                </Text>
              </View>
              <Pressable
                onPress={handleCloseEditSeller}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Seller Editor"
              >
                <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScrollBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {editingSeller && (
                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>SELLER EMAIL</Text>
                    <Text style={styles.metaChipVal}>{editingSeller.email || 'N/A'}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>EMPLOYEE CODE</Text>
                    <Text style={styles.metaChipVal}>{editingSeller.employeeCode || 'N/A'}</Text>
                  </View>
                </View>
              )}

              <Input
                label="Full Name *"
                value={editName}
                onChangeText={(val) => {
                  setEditName(val);
                  if (sellerFormErrors.name) setSellerFormErrors((p) => ({ ...p, name: '' }));
                }}
                placeholder="Seller name"
                autoCapitalize="words"
                error={sellerFormErrors.name}
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Primary Mobile Phone *"
                value={editPhone}
                onChangeText={(val) => {
                  setEditPhone(val);
                  if (sellerFormErrors.phone) setSellerFormErrors((p) => ({ ...p, phone: '' }));
                }}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                error={sellerFormErrors.phone}
                helperText="Used for login and SMS"
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Alternate Phone"
                value={editAlternatePhone}
                onChangeText={setEditAlternatePhone}
                placeholder="Optional emergency phone"
                keyboardType="phone-pad"
                maxLength={15}
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1.2, marginRight: Spacing.sm }}>
                  <Input
                    label="Village / Assigned Beat"
                    value={editVillage}
                    onChangeText={setEditVillage}
                    placeholder="e.g. Diva, Mumbra"
                    autoCapitalize="words"
                    leftIcon={<Ionicons name="location-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Daily Target (pkts) *"
                    value={editDailyTarget}
                    onChangeText={(val) => {
                      setEditDailyTarget(val);
                      if (sellerFormErrors.dailyTarget) setSellerFormErrors((p) => ({ ...p, dailyTarget: '' }));
                    }}
                    placeholder="e.g. 30"
                    keyboardType="number-pad"
                    error={sellerFormErrors.dailyTarget}
                  />
                </View>
              </View>

              <Input
                label="Residential / Field Address"
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Full address"
                multiline
                numberOfLines={2}
                leftIcon={<Ionicons name="home-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <Input
                label="Postal Pincode"
                value={editPincode}
                onChangeText={(val) => {
                  setEditPincode(val);
                  if (sellerFormErrors.pincode) setSellerFormErrors((p) => ({ ...p, pincode: '' }));
                }}
                placeholder="6-digit postal code"
                keyboardType="number-pad"
                maxLength={6}
                error={sellerFormErrors.pincode}
                leftIcon={<Ionicons name="pin-outline" size={18} color={Colors.light.textTertiary} />}
              />

              {/* Active Toggle Card */}
              <View style={styles.statusToggleCard}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <Text style={styles.statusToggleTitle}>Officer Field Status</Text>
                  <Text style={styles.statusToggleSubtitle}>
                    {editActive
                      ? 'Officer is active and authorized for shifts, POS sales, and van stock.'
                      : 'Officer is inactive and blocked from starting new shifts or POS orders.'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.togglePill, editActive ? styles.togglePillActive : styles.togglePillInactive]}
                  onPress={() => setEditActive(!editActive)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle officer active status"
                >
                  <Text style={[styles.togglePillText, editActive ? styles.togglePillTextActive : styles.togglePillTextInactive]}>
                    {editActive ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={handleCloseEditSeller}
                style={{ flex: 1, marginRight: Spacing.sm }}
                disabled={isUpdatingSeller}
              />
              <Button
                title={isUpdatingSeller ? 'Saving...' : 'Save Changes'}
                variant="primary"
                size="md"
                onPress={handleSaveSeller}
                loading={isUpdatingSeller}
                style={{ flex: 1.5, backgroundColor: BrandColors.green.primary }}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              />
            </View>
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.light.background,
  },
  searchWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  listContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  sellerCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1.5,
    borderColor: BrandColors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
  sellerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  sellerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  sellerEmail: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  editActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionBtnPressed: {
    opacity: 0.6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    marginTop: Spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  territoryText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.headingSmall,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScrollBody: {
    padding: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  metaChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textTertiary,
    letterSpacing: 0.5,
  },
  metaChipVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statusToggleTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  statusToggleSubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  togglePillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  togglePillInactive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  togglePillTextActive: {
    color: '#15803D',
  },
  togglePillTextInactive: {
    color: '#B91C1C',
  },
  modalActionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
});
