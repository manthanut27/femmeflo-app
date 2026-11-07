import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
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
import { DropdownTrigger } from '@/components/ui/SearchableDropdownModal';
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

type UserTab = 'MANAGERS' | 'SELLERS';

export default function AdminUsersScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

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
  }, [params, navigation, router]);

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
  const [formPassword, setFormPassword] = useState('');
  const [formState, setFormState] = useState('Maharashtra');
  const [formDistrict, setFormDistrict] = useState('Thane');
  const [formManagerId, setFormManagerId] = useState('');
  const [formVillage, setFormVillage] = useState('');
  const [formDailyTarget, setFormDailyTarget] = useState('30');
  const [formIsSeller, setFormIsSeller] = useState(false);
  // Edit Manager Persona Modal State
  const [editingManager, setEditingManager] = useState<PublicUser | null>(null);
  const [editIsSeller, setEditIsSeller] = useState(false);
  const [isUpdatingPersona, setIsUpdatingPersona] = useState(false);
  const [editPersonaError, setEditPersonaError] = useState<string | null>(null);
  const [editMgrName, setEditMgrName] = useState('');
  const [editMgrPhone, setEditMgrPhone] = useState('');
  const [editMgrAlternatePhone, setEditMgrAlternatePhone] = useState('');
  const [editMgrState, setEditMgrState] = useState('');
  const [editMgrDistrict, setEditMgrDistrict] = useState('');
  const [editMgrAddress, setEditMgrAddress] = useState('');
  const [editMgrActive, setEditMgrActive] = useState(true);

  // Edit Seller Modal State for Admin
  const [editingSeller, setEditingSeller] = useState<PublicUser | null>(null);
  const [editSellerName, setEditSellerName] = useState('');
  const [editSellerPhone, setEditSellerPhone] = useState('');
  const [editSellerAlternatePhone, setEditSellerAlternatePhone] = useState('');
  const [editSellerVillage, setEditSellerVillage] = useState('');
  const [editSellerState, setEditSellerState] = useState('');
  const [editSellerDistrict, setEditSellerDistrict] = useState('');
  const [editSellerDailyTarget, setEditDailyTarget] = useState('30');
  const [editSellerAddress, setEditSellerAddress] = useState('');
  const [editSellerActive, setEditSellerActive] = useState(true);
  const [isUpdatingSeller, setIsUpdatingSeller] = useState(false);
  const [editSellerError, setEditSellerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);

  // Searchable Manager Picker Subview State
  const [managerSearchQuery, setManagerSearchQuery] = useState('');
  const [isManagerPickerOpen, setIsManagerPickerOpen] = useState(false);

  const filteredManagers = useMemo(() => {
    const q = managerSearchQuery.trim().toLowerCase();
    if (!q) return availableManagers;
    return availableManagers.filter((m) => {
      const matchName = m.name?.toLowerCase().includes(q) ?? false;
      const matchEmail = m.email?.toLowerCase().includes(q) ?? false;
      const matchPhone = m.phone?.toLowerCase().includes(q) ?? false;
      const matchDistrict = m.district?.toLowerCase().includes(q) ?? false;
      const matchState = m.state?.toLowerCase().includes(q) ?? false;
      return matchName || matchEmail || matchPhone || matchDistrict || matchState;
    });
  }, [availableManagers, managerSearchQuery]);

  const selectedManager = useMemo(() => {
    return availableManagers.find((m) => m.id === formManagerId);
  }, [availableManagers, formManagerId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadManagersList = useCallback(async () => {
    try {
      const res = await adminApi.listManagers({ pageSize: 100 });
      if (res.items && res.items.length > 0) {
        setAvailableManagers(res.items);
      } else {
        const filters = await adminApi.getDashboardFilters();
        if (filters.managers && filters.managers.length > 0) {
          setAvailableManagers(
            filters.managers.map((m) => ({
              id: m.id,
              name: m.name,
              email: (m as any).email || '',
              role: 'MANAGER' as const,
              state: m.state,
              district: m.district,
              active: true,
            }))
          );
        }
      }
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
        if (!debouncedSearch.trim() && res.items && res.items.length > 0) {
          setAvailableManagers(res.items);
        }
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
    if (role === 'MANAGER') {
      router.push('/(admin)/managers/new' as any);
    } else {
      router.push('/(admin)/sellers/new' as any);
    }
  }

  function handleCloseModal() {
    setModalVisible(false);
    setIsManagerPickerOpen(false);
    setManagerSearchQuery('');
    setFormIsSeller(false);
    setFormErrors({});
    setModalError(null);
  }

  function handleOpenEditModal(manager: PublicUser) {
    setEditingManager(manager);
    setEditIsSeller(Boolean(manager.isSeller));
    setEditMgrName(manager.name || '');
    setEditMgrPhone((manager.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, ''));
    setEditMgrAlternatePhone(manager.alternatePhone || '');
    setEditMgrState(manager.state || '');
    setEditMgrDistrict(manager.district || '');
    setEditMgrAddress(manager.address || '');
    setEditMgrActive(manager.active !== false);
    setEditPersonaError(null);
  }

  function handleCloseEditModal() {
    if (isUpdatingPersona) return;
    setEditingManager(null);
    setEditPersonaError(null);
  }

  async function handleSavePersona() {
    if (!editingManager || isUpdatingPersona) return;
    if (!editMgrName.trim()) {
      setEditPersonaError('Manager name is required.');
      return;
    }
    const cleanPhone = editMgrPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setEditPersonaError('Valid 10-digit mobile phone is required.');
      return;
    }

    setIsUpdatingPersona(true);
    setEditPersonaError(null);
    try {
      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : `+91${cleanPhone.slice(-10)}`;

      await adminApi.updateManager(editingManager.id, {
        name: editMgrName.trim(),
        phone: formattedPhone,
        alternatePhone: editMgrAlternatePhone.trim() || undefined,
        state: editMgrState.trim() || undefined,
        district: editMgrDistrict.trim() || undefined,
        address: editMgrAddress.trim() || undefined,
        isSeller: editIsSeller,
        active: editMgrActive,
      });

      setScreenFeedback({
        type: 'success',
        message: `Details updated for Manager ${editMgrName.trim()}.`,
      });
      setEditingManager(null);
      loadUsers(false);
      loadManagersList();
    } catch (err: any) {
      setEditPersonaError(err.message || 'Failed to update manager details.');
    } finally {
      setIsUpdatingPersona(false);
    }
  }

  function handleOpenEditSellerModal(seller: PublicUser) {
    setEditingSeller(seller);
    setEditSellerName(seller.name || '');
    setEditSellerPhone((seller.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, ''));
    setEditSellerAlternatePhone(seller.alternatePhone || '');
    setEditSellerVillage(seller.village || '');
    setEditSellerState(seller.state || '');
    setEditSellerDistrict(seller.district || '');
    setEditDailyTarget(String((seller as any).dailyTarget || 30));
    setEditSellerAddress(seller.address || '');
    setEditSellerActive(seller.active !== false);
    setEditSellerError(null);
  }

  function handleCloseEditSellerModal() {
    if (isUpdatingSeller) return;
    setEditingSeller(null);
    setEditSellerError(null);
  }

  async function handleSaveSeller() {
    if (!editingSeller || isUpdatingSeller) return;
    if (!editSellerName.trim()) {
      setEditSellerError('Seller name is required.');
      return;
    }
    const cleanPhone = editSellerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setEditSellerError('Valid 10-digit phone number is required.');
      return;
    }
    const targetNum = parseInt(editSellerDailyTarget, 10);

    setIsUpdatingSeller(true);
    setEditSellerError(null);
    try {
      const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
        ? `+${cleanPhone}`
        : `+91${cleanPhone.slice(-10)}`;

      await adminApi.updateSeller(editingSeller.id, {
        name: editSellerName.trim(),
        phone: formattedPhone,
        alternatePhone: editSellerAlternatePhone.trim() || undefined,
        village: editSellerVillage.trim() || undefined,
        state: editSellerState.trim() || undefined,
        district: editSellerDistrict.trim() || undefined,
        address: editSellerAddress.trim() || undefined,
        dailyTarget: isNaN(targetNum) ? 30 : targetNum,
        active: editSellerActive,
      });

      setScreenFeedback({
        type: 'success',
        message: `Details updated for Field Officer ${editSellerName.trim()}.`,
      });
      setEditingSeller(null);
      loadUsers(false);
    } catch (err: any) {
      setEditSellerError(err.message || 'Failed to update seller.');
    } finally {
      setIsUpdatingSeller(false);
    }
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
          isSeller: formIsSeller,
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

  const renderItem = ({ item }: { item: PublicUser }) => {
    const isDualRole = tab === 'MANAGERS' && Boolean(item.isSeller);
    return (
      <Card
        style={styles.card}
        accessibilityRole="summary"
        accessibilityLabel={`User ${item.name}, ${item.email || item.phone}, role ${tab === 'MANAGERS' ? 'Manager' : 'Seller'}, status ${item.active ? 'Active' : 'Inactive'}${isDualRole ? ', Dual Role' : ''}`}
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
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge
              label={item.active ? 'ACTIVE' : 'INACTIVE'}
              variant={item.active ? 'ACTIVE' : 'INACTIVE'}
              size="sm"
            />
            {isDualRole && (
              <Badge
                label="DUAL ROLE"
                variant="ACTIVE"
                size="sm"
                pulse={true}
              />
            )}
          </View>
        </View>

        {isDualRole && (
          <View style={styles.dualRoleBadgeRow}>
            <Ionicons name="bus-outline" size={13} color={BrandColors.pink.dark} />
            <Text style={styles.dualRoleBadgeText}>Dedicated Van Stock & Field Sales POS Active</Text>
          </View>
        )}

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

        {tab === 'MANAGERS' && (
          <View style={styles.managerCardActionRow}>
            <Pressable
              style={styles.configurePersonaBtn}
              onPress={() => handleOpenEditModal(item)}
              accessibilityRole="button"
              accessibilityLabel={`Configure persona and edit ${item.name}`}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={BrandColors.green.primary}
              />
              <Text style={styles.configurePersonaBtnText}>
                Edit Details & Persona
              </Text>
            </Pressable>
          </View>
        )}

        {tab === 'SELLERS' && (
          <View style={styles.managerCardActionRow}>
            <Pressable
              style={styles.configurePersonaBtn}
              onPress={() => handleOpenEditSellerModal(item)}
              accessibilityRole="button"
              accessibilityLabel={`Edit details for ${item.name}`}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={BrandColors.pink.dark}
              />
              <Text style={[styles.configurePersonaBtnText, { color: BrandColors.pink.dark }]}>
                Edit Officer Details
              </Text>
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="User Administration"
        subtitle="Managers & Field Officers Directory"
        showBack={Boolean(params?.from === 'actions')}
        onBack={handleBack}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add user"
            style={styles.headerAddBtn}
            onPress={() => {
              if (tab === 'MANAGERS') {
                router.push('/(admin)/managers/new' as any);
              } else {
                router.push('/(admin)/sellers/new' as any);
              }
            }}
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
              onPress={() => router.push('/(admin)/managers/new' as any)}
              accessibilityRole="button"
              accessibilityLabel="Add New Manager"
            >
              <Ionicons name="add-circle" size={16} color={BrandColors.green.primary} />
              <Text style={styles.actionPillTextManager}>+ Add Manager</Text>
            </Pressable>

            <Pressable
              style={[styles.actionPill, styles.actionPillSeller]}
              onPress={() => router.push('/(admin)/sellers/new' as any)}
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
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.backdropDismiss} onPress={handleCloseModal} />

          <View style={styles.modalSheetCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeading}>
                  {isManagerPickerOpen
                    ? 'Supervising Manager'
                    : modalRole === 'MANAGER'
                    ? 'Onboard Territory Manager'
                    : 'Onboard Field Seller'}
                </Text>
                <Text style={styles.modalSubheading}>
                  {isManagerPickerOpen
                    ? 'Search and assign the supervising territory manager'
                    : modalRole === 'MANAGER'
                    ? 'Supervises field officers and territory customers'
                    : 'Field force officer for retail visits & POS orders'}
                </Text>
              </View>
              <Pressable
                onPress={isManagerPickerOpen ? () => setIsManagerPickerOpen(false) : handleCloseModal}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons
                  name={isManagerPickerOpen ? 'arrow-back' : 'close'}
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </Pressable>
            </View>

            {isManagerPickerOpen ? (
              // SEARCHABLE MANAGER PICKER VIEW
              <View style={styles.pickerContainer}>
                {/* Search Bar */}
                <View style={styles.pickerSearchBox}>
                  <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Search by name, district, state, phone..."
                    placeholderTextColor={Colors.light.textPlaceholder}
                    value={managerSearchQuery}
                    onChangeText={setManagerSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  {managerSearchQuery.length > 0 && (
                    <Pressable
                      onPress={() => setManagerSearchQuery('')}
                      hitSlop={HitSlop.md}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                    </Pressable>
                  )}
                </View>

                {/* Filtered Managers List */}
                <FlatList
                  data={filteredManagers}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pickerListContent}
                  renderItem={({ item }) => {
                    const isSelected = formManagerId === item.id;
                    return (
                      <Pressable
                        style={[
                          styles.pickerManagerCard,
                          isSelected && styles.pickerManagerCardSelected,
                        ]}
                        onPress={() => {
                          setFormManagerId(item.id);
                          if (item.state) setFormState(item.state);
                          if (item.district) setFormDistrict(item.district);
                          setFormErrors((prev) => {
                            const next = { ...prev };
                            delete next.managerId;
                            return next;
                          });
                          setIsManagerPickerOpen(false);
                        }}
                      >
                        <View
                          style={[
                            styles.pickerManagerAvatar,
                            isSelected && styles.pickerManagerAvatarSelected,
                          ]}
                        >
                          <Ionicons
                            name="people"
                            size={18}
                            color={isSelected ? '#FFFFFF' : BrandColors.green.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.pickerManagerTitleRow}>
                            <Text
                              style={[
                                styles.pickerManagerName,
                                isSelected && styles.pickerManagerNameSelected,
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Badge
                              label="MANAGER"
                              variant={isSelected ? 'ACTIVE' : 'neutral'}
                              size="sm"
                            />
                          </View>
                          <Text style={styles.pickerManagerSub}>
                            {[item.district, item.state].filter(Boolean).join(', ') || 'All Regions'} • {item.phone || item.email || 'No contact'}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={BrandColors.pink.dark}
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.pickerEmptyContainer}>
                      <Ionicons name="search-outline" size={36} color={Colors.light.textTertiary} />
                      <Text style={styles.pickerEmptyTitle}>
                        {availableManagers.length === 0
                          ? 'No Territory Managers Found'
                          : 'No matching managers found'}
                      </Text>
                      <Text style={styles.pickerEmptySub}>
                        {availableManagers.length === 0
                          ? 'Please onboard a Territory Manager first before adding sellers.'
                          : 'Try searching with a different name, district, or phone number.'}
                      </Text>
                      {availableManagers.length === 0 && (
                        <Button
                          title="+ Onboard Territory Manager First"
                          size="sm"
                          variant="admin"
                          style={{ marginTop: Spacing.md }}
                          onPress={() => {
                            setIsManagerPickerOpen(false);
                            setModalRole('MANAGER');
                          }}
                        />
                      )}
                    </View>
                  }
                />

                <View style={styles.pickerFooterRow}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => setIsManagerPickerOpen(false)}
                  />
                </View>
              </View>
            ) : (
              // MAIN FORM VIEW
              <>
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
                      if (availableManagers.length > 0 && !formManagerId) {
                        setFormManagerId(availableManagers[0].id);
                        if (availableManagers[0].state) setFormState(availableManagers[0].state);
                        if (availableManagers[0].district) setFormDistrict(availableManagers[0].district);
                      }
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
                <ScrollView
                  style={styles.modalFormScroll}
                  contentContainerStyle={styles.modalFormScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
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
                    value={formName}
                    onChangeText={(val) => {
                      setFormName(val);
                      if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
                    }}
                    error={formErrors.name}
                    leftIcon={<Ionicons name="person-outline" size={18} color="#94A3B8" />}
                  />

                  <Input
                    label="Mobile Phone Number *"
                    keyboardType="phone-pad"
                    value={formPhone}
                    onChangeText={(val) => {
                      setFormPhone(val);
                      if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: '' }));
                    }}
                    error={formErrors.phone}
                    helperText="10-digit Indian mobile number (auto-prefixed with +91)"
                    leftIcon={<Ionicons name="call-outline" size={18} color="#94A3B8" />}
                  />

                  <Input
                    label="Email Address (Optional)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formEmail}
                    onChangeText={(val) => {
                      setFormEmail(val);
                      if (formErrors.email) setFormErrors((p) => ({ ...p, email: '' }));
                    }}
                    error={formErrors.email}
                    leftIcon={<Ionicons name="mail-outline" size={18} color="#94A3B8" />}
                  />

                  <Input
                    label="Initial Password *"
                    value={formPassword}
                    onChangeText={(val) => {
                      setFormPassword(val);
                      if (formErrors.password) setFormErrors((p) => ({ ...p, password: '' }));
                    }}
                    error={formErrors.password}
                    helperText="Initial access password (min. 12 characters)"
                    isPassword={true}
                    leftIcon={<Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />}
                  />

                  {/* If Seller: Supervising Territory Manager Dropdown with Search Option */}
                  {modalRole === 'SELLER' && (
                    <DropdownTrigger
                      label="Supervising Territory Manager"
                      required
                      value={selectedManager?.name}
                      subtitle={
                        selectedManager
                          ? `${[selectedManager.district, selectedManager.state].filter(Boolean).join(', ') || 'All Regions'} • ${selectedManager.phone || selectedManager.email || 'No contact'}`
                          : availableManagers.length === 0
                          ? 'No active managers available. Create manager first.'
                          : 'Tap to select supervising manager with search...'
                      }
                      placeholder="Select supervising territory manager..."
                      icon="people"
                      badge={selectedManager ? 'TERRITORY MGR' : undefined}
                      onPress={() => {
                        setManagerSearchQuery('');
                        setIsManagerPickerOpen(true);
                      }}
                      error={formErrors.managerId}
                    />
                  )}

                  <View style={styles.geoFieldsSection}>
                    <Text style={styles.geoSectionHeading}>Assigned Operational Territory</Text>
                    <View style={styles.geoRow}>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Input
                          label="State"
                          value={formState}
                          onChangeText={setFormState}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="District"
                          value={formDistrict}
                          onChangeText={setFormDistrict}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Dual-Role Persona Toggle for Managers */}
                  {modalRole === 'MANAGER' && (
                    <Pressable
                      style={[
                        styles.dualRoleToggleCard,
                        formIsSeller && styles.dualRoleToggleCardActive,
                      ]}
                      onPress={() => setFormIsSeller(!formIsSeller)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: formIsSeller }}
                      accessibilityLabel="Enable Dual-Role Persona for field sales and dedicated van stock"
                    >
                      <View style={styles.dualRoleToggleLeft}>
                        <View style={[styles.dualRoleToggleIconCircle, formIsSeller && styles.dualRoleToggleIconCircleActive]}>
                          <Ionicons
                            name="swap-horizontal"
                            size={18}
                            color={formIsSeller ? '#FFFFFF' : BrandColors.green.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.dualRoleToggleTitle}>Dual-Role Persona</Text>
                            <Badge
                              label={formIsSeller ? 'FIELD SALES & VAN STOCK' : 'OFF'}
                              variant={formIsSeller ? 'ACTIVE' : 'neutral'}
                              size="sm"
                            />
                          </View>
                          <Text style={styles.dualRoleToggleDesc}>
                            Provisions dedicated vehicle/van inventory, allows frontline mobile POS sales, duty shifts, and store onboarding.
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.switchTrack, formIsSeller && styles.switchTrackActive]}>
                        <View style={[styles.switchThumb, formIsSeller && styles.switchThumbActive]} />
                      </View>
                    </Pressable>
                  )}
                </ScrollView>

                {/* Modal Actions */}
                <View style={styles.modalActionRow}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="md"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                    onPress={handleCloseModal}
                    disabled={isSubmitting}
                  />
                  <Button
                    title={
                      isSubmitting
                        ? 'Creating...'
                        : modalRole === 'MANAGER'
                        ? 'Create Manager'
                        : 'Create Seller'
                    }
                    variant="admin"
                    size="md"
                    style={{ flex: 1.5 }}
                    loading={isSubmitting}
                    onPress={handleCreateUser}
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================= */}
      {/* EDIT MANAGER PERSONA & DUAL-ROLE CONFIGURATION MODAL   */}
      {/* ======================================================= */}
      <Modal
        visible={Boolean(editingManager)}
        animationType="slide"
        transparent
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.backdropDismiss} onPress={handleCloseEditModal} />

          <View style={styles.modalSheetCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeading}>Configure Manager Persona</Text>
                <Text style={styles.modalSubheading}>
                  Territory supervision & dual operational field roles
                </Text>
              </View>
              <Pressable
                onPress={handleCloseEditModal}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalFormScroll}
              contentContainerStyle={styles.modalFormScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {editPersonaError && (
                <FeedbackBanner
                  type="error"
                  message={editPersonaError}
                  onDismiss={() => setEditPersonaError(null)}
                  style={{ marginBottom: Spacing.sm }}
                />
              )}

              {/* Manager Card Summary */}
              {editingManager && (
                <View style={styles.editManagerHeaderBox}>
                  <View style={styles.editManagerAvatarCircle}>
                    <Text style={styles.editManagerAvatarText}>
                      {editingManager.name?.slice(0, 2).toUpperCase() || 'TM'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editManagerName}>{editingManager.name}</Text>
                    <Text style={styles.editManagerSub}>
                      {[editingManager.district, editingManager.state].filter(Boolean).join(', ') || 'All Regions'} • {editingManager.phone || editingManager.email}
                    </Text>
                  </View>
                  <Badge label="MANAGER" variant="ACTIVE" size="sm" />
                </View>
              )}

                            {/* Editable Manager Details */}
              <Input
                label="Manager Full Name *"
                value={editMgrName}
                onChangeText={setEditMgrName}
                placeholder="Full legal name"
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Primary Mobile *"
                    value={editMgrPhone}
                    onChangeText={setEditMgrPhone}
                    placeholder="10-digit phone"
                    keyboardType="phone-pad"
                    maxLength={10}
                    leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Alternate Phone"
                    value={editMgrAlternatePhone}
                    onChangeText={setEditMgrAlternatePhone}
                    placeholder="Secondary contact"
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Input
                    label="Assigned State"
                    value={editMgrState}
                    onChangeText={setEditMgrState}
                    placeholder="e.g. Maharashtra"
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Input
                    label="Assigned District"
                    value={editMgrDistrict}
                    onChangeText={setEditMgrDistrict}
                    placeholder="e.g. Thane"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <Input
                label="Office / Address"
                value={editMgrAddress}
                onChangeText={setEditMgrAddress}
                placeholder="Regional headquarters or office"
                multiline
                numberOfLines={2}
                leftIcon={<Ionicons name="business-outline" size={18} color={Colors.light.textTertiary} />}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.light.border, marginBottom: Spacing.md }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ ...Typography.bodyMedium, fontWeight: '700', color: Colors.light.heading }}>Account Status</Text>
                  <Text style={{ ...Typography.caption, color: Colors.light.textSecondary }}>{editMgrActive ? 'Manager is Active with full territory access' : 'Manager is Deactivated'}</Text>
                </View>
                <Pressable
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: editMgrActive ? '#DCFCE7' : '#FEE2E2', borderWidth: 1, borderColor: editMgrActive ? '#86EFAC' : '#FCA5A5' }}
                  onPress={() => setEditMgrActive(!editMgrActive)}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: editMgrActive ? '#15803D' : '#B91C1C' }}>{editMgrActive ? 'ACTIVE' : 'INACTIVE'}</Text>
                </Pressable>
              </View>

              {/* Dual-Role Setting Toggle Card */}
              <Pressable
                style={[
                  styles.dualRoleToggleCard,
                  editIsSeller && styles.dualRoleToggleCardActive,
                ]}
                onPress={() => setEditIsSeller(!editIsSeller)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: editIsSeller }}
                accessibilityLabel="Enable Dual-Role Persona for field sales and dedicated van stock"
              >
                <View style={styles.dualRoleToggleLeft}>
                  <View style={[styles.dualRoleToggleIconCircle, editIsSeller && styles.dualRoleToggleIconCircleActive]}>
                    <Ionicons
                      name="swap-horizontal"
                      size={20}
                      color={editIsSeller ? '#FFFFFF' : BrandColors.green.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.dualRoleToggleTitle}>Dual-Role Persona</Text>
                      <Badge
                        label={editIsSeller ? 'FIELD SALES READY' : 'SUPERVISORY ONLY'}
                        variant={editIsSeller ? 'ACTIVE' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    <Text style={styles.dualRoleToggleDesc}>
                      {editIsSeller
                        ? 'Manager has supervisory privileges AND frontline field capabilities with dedicated van inventory.'
                        : 'Manager operates strictly in supervisory governance without individual field stock balance.'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.switchTrack, editIsSeller && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, editIsSeller && styles.switchThumbActive]} />
                </View>
              </Pressable>

              {/* Architectural Feature Explanation Box */}
              <View style={styles.architectureBox}>
                <View style={styles.archTitleRow}>
                  <Ionicons name="information-circle-outline" size={18} color={BrandColors.pink.primary} />
                  <Text style={styles.archTitle}>What Enabling This Feature Does</Text>
                </View>

                <View style={styles.archItem}>
                  <Ionicons name="swap-horizontal-outline" size={15} color={BrandColors.green.primary} style={styles.archIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archItemHeading}>Dual Portal & Screen Navigation</Text>
                    <Text style={styles.archItemDesc}>
                      Manager Portal: supervisory team reports, audits, price breaches. Seller Portal: frontline mobile POS, store visits, and duty punch-in.
                    </Text>
                  </View>
                </View>

                <View style={styles.archItem}>
                  <Ionicons name="car-outline" size={15} color={BrandColors.green.primary} style={styles.archIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archItemHeading}>Dedicated Field Inventory (Van Stock)</Text>
                    <Text style={styles.archItemDesc}>
                      Provisions an individual field stock balance under this manager. Central HQ or depot inventory can be transferred directly to their vehicle for retail fulfillment.
                    </Text>
                  </View>
                </View>

                <View style={styles.archItem}>
                  <Ionicons name="storefront-outline" size={15} color={BrandColors.green.primary} style={styles.archIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archItemHeading}>Frontline Customer Onboarding</Text>
                    <Text style={styles.archItemDesc}>
                      Directly onboards and KYC-verifies new retail outlets on the road, with those customers automatically mapped under their supervisory territory.
                    </Text>
                  </View>
                </View>

                <View style={styles.archItem}>
                  <Ionicons name="key-outline" size={15} color={BrandColors.green.primary} style={styles.archIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archItemHeading}>Single Identity & Credentials</Text>
                    <Text style={styles.archItemDesc}>
                      Unified login credentials grant access across both seller-level transaction APIs and manager-level governance endpoints.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                style={{ flex: 1, marginRight: Spacing.sm }}
                onPress={handleCloseEditModal}
                disabled={isUpdatingPersona}
              />
              <Button
                title={isUpdatingPersona ? 'Saving...' : 'Save Persona Settings'}
                variant="admin"
                size="md"
                style={{ flex: 1.5 }}
                loading={isUpdatingPersona}
                onPress={handleSavePersona}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheetCard: {
    width: '100%',
    maxWidth: MaxContentWidth,
    maxHeight: '92%',
    minHeight: 520,
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    ...Shadows.lg,
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
    padding: 6,
    marginLeft: Spacing.sm,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.full,
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
    flex: 1,
  },
  modalFormScrollContent: {
    paddingBottom: Spacing.lg,
  },
  geoFieldsSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  geoSectionHeading: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  geoRow: {
    flexDirection: 'row',
  },
  modalActionRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },

  // Searchable Picker Subview
  pickerContainer: {
    flex: 1,
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.sm,
  },
  pickerSearchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    paddingVertical: 0,
    marginLeft: Spacing.xs,
  },
  pickerListContent: {
    paddingBottom: Spacing.md,
  },
  pickerManagerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  pickerManagerCardSelected: {
    borderColor: BrandColors.pink.border,
    backgroundColor: BrandColors.pink.subtle,
  },
  pickerManagerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.green.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  pickerManagerAvatarSelected: {
    backgroundColor: BrandColors.pink.primary,
  },
  pickerManagerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pickerManagerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  pickerManagerNameSelected: {
    color: BrandColors.pink.dark,
  },
  pickerManagerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  pickerEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  pickerEmptyTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: Spacing.sm,
  },
  pickerEmptySub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  pickerFooterRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  dualRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.subtle,
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
  },
  dualRoleBadgeText: {
    ...Typography.caption,
    color: BrandColors.pink.dark,
    fontWeight: '600',
    fontSize: 11,
    marginLeft: 6,
  },
  managerCardActionRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  configurePersonaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  configurePersonaBtnText: {
    ...Typography.caption,
    color: BrandColors.green.primary,
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 4,
  },
  dualRoleToggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dualRoleToggleCardActive: {
    borderColor: BrandColors.green.primary,
    backgroundColor: BrandColors.green.subtle,
  },
  dualRoleToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  dualRoleToggleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  dualRoleToggleIconCircleActive: {
    backgroundColor: BrandColors.green.primary,
  },
  dualRoleToggleTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  dualRoleToggleDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: BrandColors.green.primary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  editManagerHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.sm,
  },
  editManagerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.green.subtle,
    borderWidth: 1,
    borderColor: BrandColors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  editManagerAvatarText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  editManagerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  editManagerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  architectureBox: {
    marginTop: Spacing.lg,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  archTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  archTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginLeft: 6,
  },
  archItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  archIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  archItemHeading: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  archItemDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
});
