import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { PublicUser } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FeedbackBanner } from '@/components/ui/FeedbackBanner';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

type UserTab = 'MANAGERS' | 'SELLERS';

export default function AdminUsersScreen() {
  const [tab, setTab] = useState<UserTab>('MANAGERS');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [availableManagers, setAvailableManagers] = useState<PublicUser[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Success / Error Feedback for the screen
  const [screenFeedback, setScreenFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add User Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRole, setModalRole] = useState<'MANAGER' | 'SELLER'>('MANAGER');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('FemmeFlo@2026');
  const [formState, setFormState] = useState('Maharashtra');
  const [formDistrict, setFormDistrict] = useState('Thane');
  const [formManagerId, setFormManagerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadManagersList = useCallback(async () => {
    try {
      const res = await adminApi.listManagers({ pageSize: 100 });
      setAvailableManagers(res.items);
      if (res.items.length > 0 && !formManagerId) {
        setFormManagerId(res.items[0].id);
      }
    } catch (err) {
      console.warn('Failed to fetch managers list for assignment', err);
    }
  }, [formManagerId]);

  const loadUsers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      if (tab === 'MANAGERS') {
        const res = await adminApi.listManagers({ pageSize: 50, search: debouncedSearch.trim() || undefined });
        setUsers(res.items);
        setAvailableManagers(res.items);
      } else {
        const res = await adminApi.listSellers({ pageSize: 50, search: debouncedSearch.trim() || undefined });
        setUsers(res.items);
      }
    } catch (err) {
      console.warn('Failed to load users', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, debouncedSearch]);

  useEffect(() => {
    loadUsers(false);
    loadManagersList();
  }, [loadUsers, loadManagersList]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers(false);
    loadManagersList();
  }, [loadUsers, loadManagersList]);

  function handleOpenAddModal(role: 'MANAGER' | 'SELLER') {
    setModalRole(role);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('FemmeFlo@2026');
    setFormState('Maharashtra');
    setFormDistrict('Thane');
    setFormErrors({});
    setModalError(null);
    if (availableManagers.length > 0) {
      setFormManagerId(availableManagers[0].id);
    }
    setModalVisible(true);
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!formName.trim()) {
      errs.name = 'Full name is required.';
    }
    const cleanPhone = formPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      errs.phone = 'Please enter a valid 10-digit mobile number.';
    }
    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formPassword || formPassword.length < 12) {
      errs.password = 'Initial password must be at least 12 characters.';
    }
    if (modalRole === 'SELLER' && !formManagerId) {
      errs.managerId = 'Please select a supervising Territory Manager.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreateUser() {
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setModalError(null);

    const formattedPhone = formPhone.trim().startsWith('+')
      ? formPhone.trim()
      : `+91${formPhone.replace(/\D/g, '').slice(-10)}`;

    try {
      if (modalRole === 'MANAGER') {
        const res = await adminApi.createManager({
          name: formName.trim(),
          phone: formattedPhone,
          email: formEmail.trim() || undefined,
          password: formPassword,
          state: formState.trim() || undefined,
          district: formDistrict.trim() || undefined,
        });
        setModalVisible(false);
        setScreenFeedback({
          type: 'success',
          message: `Manager ${res.manager.name} (${res.manager.phone || res.manager.email}) onboarded successfully!`,
        });
        setTab('MANAGERS');
        loadUsers(true);
        loadManagersList();
      } else {
        const res = await adminApi.createSeller({
          name: formName.trim(),
          phone: formattedPhone,
          email: formEmail.trim() || undefined,
          password: formPassword,
          managerId: formManagerId,
          state: formState.trim() || undefined,
          district: formDistrict.trim() || undefined,
        });
        setModalVisible(false);
        setScreenFeedback({
          type: 'success',
          message: `Field Seller ${res.seller.name} (${res.seller.phone || res.seller.email}) onboarded successfully!`,
        });
        setTab('SELLERS');
        loadUsers(true);
      }
    } catch (err: any) {
      setModalError(err.message || `Failed to create ${modalRole.toLowerCase()}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const tabs = [
    { key: 'MANAGERS', label: 'Managers', badge: tab === 'MANAGERS' ? users.length : undefined },
    { key: 'SELLERS', label: 'Sellers (Field Force)', badge: tab === 'SELLERS' ? users.length : undefined },
  ];

  const renderItem = ({ item }: { item: PublicUser }) => (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`User ${item.name}, ${item.email || item.phone}, role ${tab === 'MANAGERS' ? 'Manager' : 'Seller'}, status ${item.active ? 'Active' : 'Inactive'}`}
    >
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor:
                  tab === 'MANAGERS' ? BrandColors.green.subtle : BrandColors.pink.subtle,
                borderColor:
                  tab === 'MANAGERS' ? BrandColors.green.tint : BrandColors.pink.tint,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color:
                    tab === 'MANAGERS' ? BrandColors.green.primary : BrandColors.pink.dark,
                },
              ]}
            >
              {item.name?.slice(0, 2).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.email}>{item.email || 'No email registered'}</Text>
          </View>
        </View>
        <Badge
          label={item.active ? 'ACTIVE' : 'INACTIVE'}
          variant={item.active ? 'ACTIVE' : 'INACTIVE'}
          size="sm"
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.phone}>{item.phone || 'No phone registered'}</Text>
        </View>
        <View style={styles.territoryRow}>
          <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.territory}>
            {[item.district, item.state].filter(Boolean).join(', ') || 'All Regions'}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="User Administration"
        subtitle="Managers & Field Officers Directory"
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add user"
            style={styles.headerAddBtn}
            onPress={() => handleOpenAddModal(tab === 'MANAGERS' ? 'MANAGER' : 'SELLER')}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
            <Text style={styles.headerAddBtnText}>Add User</Text>
          </Pressable>
        }
      />

      <View style={styles.innerContainer}>
        {screenFeedback && (
          <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
            <FeedbackBanner
              type={screenFeedback.type}
              message={screenFeedback.message}
              onDismiss={() => setScreenFeedback(null)}
            />
          </View>
        )}

        {/* Tabs Selector & Action Bar */}
        <View style={styles.tabsSection}>
          <SegmentedTabs
            tabs={tabs}
            activeTab={tab}
            activeColor={BrandColors.pink.dark}
            onTabChange={(selected) => {
              if (selected === tab) return;
              setLoading(true);
              setTab(selected as UserTab);
            }}
          />

          <View style={styles.actionPillsRow}>
            <Pressable
              style={[styles.actionPill, styles.actionPillManager]}
              onPress={() => handleOpenAddModal('MANAGER')}
              accessibilityRole="button"
              accessibilityLabel="Add New Manager"
            >
              <Ionicons name="add-circle" size={16} color={BrandColors.green.primary} />
              <Text style={styles.actionPillTextManager}>+ Add Manager</Text>
            </Pressable>

            <Pressable
              style={[styles.actionPill, styles.actionPillSeller]}
              onPress={() => handleOpenAddModal('SELLER')}
              accessibilityRole="button"
              accessibilityLabel="Add New Seller"
            >
              <Ionicons name="add-circle" size={16} color={BrandColors.pink.dark} />
              <Text style={styles.actionPillTextSeller}>+ Add Seller</Text>
            </Pressable>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${tab.toLowerCase()} by name or email...`}
              placeholderTextColor={Colors.light.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              accessibilityLabel={`Search ${tab.toLowerCase()}`}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : users.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title={`No ${tab.toLowerCase()} found`}
            description="No records found matching your filters. You can add a new team member now."
            actionTitle={tab === 'MANAGERS' ? '+ Add New Manager' : '+ Add New Seller'}
            onAction={() => handleOpenAddModal(tab === 'MANAGERS' ? 'MANAGER' : 'SELLER')}
            iconColor={BrandColors.pink.dark}
            iconBgColor={BrandColors.pink.subtle}
            iconBorderColor={BrandColors.pink.tint}
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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

      {/* ======================================================= */}
      {/* ADD MANAGER / SELLER MODAL                              */}
      {/* ======================================================= */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeading}>
                  {modalRole === 'MANAGER' ? 'Onboard Territory Manager' : 'Onboard Field Seller'}
                </Text>
                <Text style={styles.modalSubheading}>
                  {modalRole === 'MANAGER'
                    ? 'Supervises field officers and territory customers'
                    : 'Field force officer for retail visits & POS orders'}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            {/* Role Switcher */}
            <View style={styles.modalRoleSwitcher}>
              <Pressable
                style={[
                  styles.modalRoleTab,
                  modalRole === 'MANAGER' && styles.modalRoleTabActiveManager,
                ]}
                onPress={() => {
                  setModalRole('MANAGER');
                  setFormErrors({});
                  setModalError(null);
                }}
              >
                <Ionicons
                  name="people"
                  size={16}
                  color={modalRole === 'MANAGER' ? '#FFFFFF' : BrandColors.green.primary}
                />
                <Text
                  style={[
                    styles.modalRoleTabText,
                    modalRole === 'MANAGER' && styles.modalRoleTabTextActive,
                  ]}
                >
                  Manager
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalRoleTab,
                  modalRole === 'SELLER' && styles.modalRoleTabActiveSeller,
                ]}
                onPress={() => {
                  setModalRole('SELLER');
                  setFormErrors({});
                  setModalError(null);
                }}
              >
                <Ionicons
                  name="bag-handle"
                  size={16}
                  color={modalRole === 'SELLER' ? '#FFFFFF' : BrandColors.pink.dark}
                />
                <Text
                  style={[
                    styles.modalRoleTabText,
                    modalRole === 'SELLER' && styles.modalRoleTabTextActive,
                  ]}
                >
                  Seller
                </Text>
              </Pressable>
            </View>

            {/* Form Fields Scroll */}
            <ScrollView style={styles.modalFormScroll} keyboardShouldPersistTaps="handled">
              {modalError && (
                <FeedbackBanner
                  type="error"
                  message={modalError}
                  onDismiss={() => setModalError(null)}
                  style={{ marginBottom: Spacing.sm }}
                />
              )}

              <Input
                label="Full Name *"
                placeholder="e.g. Ramesh Patil"
                value={formName}
                onChangeText={setFormName}
                error={formErrors.name}
                leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
              />

              <Input
                label="Mobile Phone Number *"
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                value={formPhone}
                onChangeText={setFormPhone}
                error={formErrors.phone}
                helperText="10-digit Indian mobile number (auto-prefixed with +91)"
                leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
              />

              <Input
                label="Email Address (Optional)"
                placeholder="e.g. ramesh@femmeflo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formEmail}
                onChangeText={setFormEmail}
                error={formErrors.email}
                leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
              />

              <Input
                label="Initial Password *"
                placeholder="Minimum 12 characters"
                value={formPassword}
                onChangeText={setFormPassword}
                error={formErrors.password}
                helperText="Initial access password (min. 12 characters)"
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
              />

              {/* If Seller: Manager Assignment Selection */}
              {modalRole === 'SELLER' && (
                <View style={styles.managerSelectSection}>
                  <Text style={styles.managerSelectLabel}>Supervising Territory Manager *</Text>
                  {availableManagers.length === 0 ? (
                    <Text style={styles.noManagersWarning}>
                      ⚠️ No active Territory Managers found. Please create a Manager first before assigning sellers.
                    </Text>
                  ) : (
                    <View style={styles.managerListWrap}>
                      {availableManagers.map((mgr) => {
                        const isSelected = formManagerId === mgr.id;
                        return (
                          <Pressable
                            key={mgr.id}
                            style={[
                              styles.managerSelectItem,
                              isSelected && styles.managerSelectItemActive,
                            ]}
                            onPress={() => setFormManagerId(mgr.id)}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? BrandColors.pink.dark : Colors.light.textTertiary}
                            />
                            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                              <Text style={[styles.mgrSelectName, isSelected && styles.mgrSelectNameActive]}>
                                {mgr.name}
                              </Text>
                              <Text style={styles.mgrSelectSub}>
                                {mgr.district || 'Territory'}, {mgr.state || 'State'} • {mgr.phone || mgr.email}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {formErrors.managerId && (
                    <Text style={styles.fieldErrorText}>{formErrors.managerId}</Text>
                  )}
                </View>
              )}

              <View style={styles.geoRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="State"
                    placeholder="e.g. Maharashtra"
                    value={formState}
                    onChangeText={setFormState}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="District"
                    placeholder="e.g. Thane"
                    value={formDistrict}
                    onChangeText={setFormDistrict}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                style={{ flex: 1, marginRight: Spacing.sm }}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              />
              <Button
                title={isSubmitting ? 'Creating...' : modalRole === 'MANAGER' ? 'Create Manager' : 'Create Seller'}
                variant="admin"
                size="md"
                style={{ flex: 1.5 }}
                loading={isSubmitting}
                onPress={handleCreateUser}
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
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.dark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  tabsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  actionPillsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
    backgroundColor: '#FFFFFF',
    ...Elevation.low,
  },
  actionPillManager: {
    borderColor: BrandColors.green.primary,
  },
  actionPillSeller: {
    borderColor: BrandColors.pink.dark,
  },
  actionPillTextManager: {
    color: BrandColors.green.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  actionPillTextSeller: {
    color: BrandColors.pink.dark,
    fontWeight: '700',
    fontSize: 12,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    ...Elevation.low,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    paddingVertical: 0,
  },
  loadingContainer: {
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  card: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  name: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  email: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  territoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  territory: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Elevation.high,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalHeading: {
    ...Typography.h2,
    color: BrandColors.pink.dark,
    fontWeight: '800',
  },
  modalSubheading: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: Spacing.sm,
  },
  modalRoleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
    gap: 4,
  },
  modalRoleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  modalRoleTabActiveManager: {
    backgroundColor: BrandColors.green.primary,
  },
  modalRoleTabActiveSeller: {
    backgroundColor: BrandColors.pink.dark,
  },
  modalRoleTabText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  modalRoleTabTextActive: {
    color: '#FFFFFF',
  },
  modalFormScroll: {
    maxHeight: 420,
    marginBottom: Spacing.md,
  },
  managerSelectSection: {
    marginVertical: Spacing.sm,
  },
  managerSelectLabel: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginBottom: 6,
  },
  noManagersWarning: {
    ...Typography.caption,
    color: Colors.light.warning,
    backgroundColor: Colors.light.warningBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  managerListWrap: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    maxHeight: 140,
  },
  managerSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
  },
  managerSelectItemActive: {
    backgroundColor: BrandColors.pink.subtle,
  },
  mgrSelectName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  mgrSelectNameActive: {
    color: BrandColors.pink.dark,
  },
  mgrSelectSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  fieldErrorText: {
    color: Colors.light.danger,
    fontSize: 12,
    marginTop: 4,
  },
  geoRow: {
    flexDirection: 'row',
  },
  modalActionRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
});
