import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  MANAGER_PERMISSIONS,
  PERMISSION_METADATA,
  sanitizeBackendPermissions,
} from '@/utils/permissions';
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
  // User Management Detail & Permissions Modal State
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [modalTab, setModalTab] = useState<'DETAILS' | 'PERMISSIONS'>('DETAILS');
  const [isEditMode, setIsEditMode] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [userModalSuccess, setUserModalSuccess] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Form states for selected user:
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userAlternatePhone, setUserAlternatePhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userState, setUserState] = useState('');
  const [userDistrict, setUserDistrict] = useState('');
  const [userVillage, setUserVillage] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userDailyTarget, setUserDailyTarget] = useState('30');
  const [userActive, setUserActive] = useState(true);
  const [userAssignedManagerId, setUserAssignedManagerId] = useState('');
  const [userIsSeller, setUserIsSeller] = useState(false);
  const [managerPermissions, setManagerPermissions] = useState<string[]>([]);

  // Field Officer permissions flags:
  const [sellerSalesActive, setSellerSalesActive] = useState(true);
  const [sellerOnboardingActive, setSellerOnboardingActive] = useState(true);
  const [sellerVanStockActive, setSellerVanStockActive] = useState(true);
  const [sellerPriceOverrideActive, setSellerPriceOverrideActive] = useState(false);

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

  function handleOpenUserModal(user: PublicUser) {
    setSelectedUser(user);
    setModalTab('DETAILS');
    setIsEditMode(false);
    setUserModalError(null);
    setUserModalSuccess(null);

    setUserName(user.name || '');
    setUserPhone((user.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, ''));
    setUserAlternatePhone(user.alternatePhone || '');
    setUserEmail(user.email || '');
    setUserState(user.state || '');
    setUserDistrict(user.district || '');
    setUserVillage(user.village || '');
    setUserAddress(user.address || '');
    setUserDailyTarget(String((user as any).dailyTarget || 30));
    setUserActive(user.active !== false);
    setUserAssignedManagerId((user as any).managerId || (user as any).manager?.id || '');

    setUserIsSeller(Boolean(user.isSeller));
    const perms = user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0
      ? Array.from(user.permissions)
      : ['onboard_customers', 'view_customers', 'manage_sellers', 'view_inventory'];
    setManagerPermissions(perms);

    setSellerSalesActive(user.active !== false);
    setSellerOnboardingActive(true);
    setSellerVanStockActive(true);
    setSellerPriceOverrideActive(Boolean((user as any).allowPriceOverride));

    // Compatibility states
    if (user.role === 'MANAGER') {
      setEditingManager(user);
      setEditIsSeller(Boolean(user.isSeller));
      setEditMgrName(user.name || '');
      setEditMgrPhone((user.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, ''));
      setEditMgrAlternatePhone(user.alternatePhone || '');
      setEditMgrState(user.state || '');
      setEditMgrDistrict(user.district || '');
      setEditMgrAddress(user.address || '');
      setEditMgrActive(user.active !== false);
      setEditPersonaError(null);
    } else {
      setEditingSeller(user);
      setEditSellerName(user.name || '');
      setEditSellerPhone((user.phone || '').replace(/^\+91\s*/, '').replace(/\D/g, ''));
      setEditSellerAlternatePhone(user.alternatePhone || '');
      setEditSellerVillage(user.village || '');
      setEditSellerState(user.state || '');
      setEditSellerDistrict(user.district || '');
      setEditDailyTarget(String((user as any).dailyTarget || 30));
      setEditSellerAddress(user.address || '');
      setEditSellerActive(user.active !== false);
      setEditSellerError(null);
    }
  }

  function handleCloseUserModal() {
    if (isSavingUser || isUpdatingPersona || isUpdatingSeller) return;
    setSelectedUser(null);
    setEditingManager(null);
    setEditingSeller(null);
    setUserModalError(null);
    setUserModalSuccess(null);
    setIsEditMode(false);
  }

  function handleOpenEditModal(manager: PublicUser) {
    handleOpenUserModal(manager);
  }

  function handleCloseEditModal() {
    handleCloseUserModal();
  }

  function handleOpenEditSellerModal(seller: PublicUser) {
    handleOpenUserModal(seller);
  }

  function handleCloseEditSellerModal() {
    handleCloseUserModal();
  }

  async function handleSaveUserDetails() {
    if (!selectedUser || isSavingUser) return;
    if (!userName.trim()) {
      setUserModalError('Full name is required.');
      return;
    }
    const cleanPhone = userPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setUserModalError('Valid 10-digit mobile phone is required.');
      return;
    }

    const formattedPhone = cleanPhone.startsWith('91') && cleanPhone.length === 12
      ? `+${cleanPhone}`
      : `+91${cleanPhone.slice(-10)}`;

    setIsSavingUser(true);
    setUserModalError(null);
    setUserModalSuccess(null);

    try {
      if (selectedUser.role === 'MANAGER') {
        const res = await adminApi.updateManager(selectedUser.id, {
          name: userName.trim(),
          phone: formattedPhone,
          alternatePhone: userAlternatePhone.trim() || undefined,
          email: userEmail.trim() || undefined,
          state: userState.trim() || undefined,
          district: userDistrict.trim() || undefined,
          address: userAddress.trim() || undefined,
          active: userActive,
        });
        const updated = {
          ...selectedUser,
          ...(res?.manager || {}),
          name: userName.trim(),
          phone: formattedPhone,
          email: userEmail.trim() || selectedUser.email,
          state: userState.trim() || selectedUser.state,
          district: userDistrict.trim() || selectedUser.district,
          address: userAddress.trim() || selectedUser.address,
          active: userActive,
        };
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setUserModalSuccess(`Manager ${updated.name} updated successfully.`);
        setIsEditMode(false);
        setScreenFeedback({ type: 'success', message: `Manager ${updated.name} saved.` });
      } else {
        const targetNum = parseInt(userDailyTarget, 10);
        const res = await adminApi.updateSeller(selectedUser.id, {
          name: userName.trim(),
          phone: formattedPhone,
          alternatePhone: userAlternatePhone.trim() || undefined,
          email: userEmail.trim() || undefined,
          village: userVillage.trim() || undefined,
          state: userState.trim() || undefined,
          district: userDistrict.trim() || undefined,
          address: userAddress.trim() || undefined,
          dailyTarget: isNaN(targetNum) ? 30 : targetNum,
          active: userActive,
          managerId: userAssignedManagerId || undefined,
        });
        const updated = {
          ...selectedUser,
          ...(res?.seller || {}),
          name: userName.trim(),
          phone: formattedPhone,
          email: userEmail.trim() || selectedUser.email,
          village: userVillage.trim() || selectedUser.village,
          state: userState.trim() || selectedUser.state,
          district: userDistrict.trim() || selectedUser.district,
          address: userAddress.trim() || selectedUser.address,
          dailyTarget: isNaN(targetNum) ? 30 : targetNum,
          active: userActive,
        };
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setUserModalSuccess(`Field Officer ${updated.name} updated successfully.`);
        setIsEditMode(false);
        setScreenFeedback({ type: 'success', message: `Seller ${updated.name} saved.` });
      }
      loadUsers(false);
      loadManagersList();
    } catch (err: any) {
      setUserModalError(err.message || 'Failed to update user details.');
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleSaveUserPermissions() {
    if (!selectedUser || isSavingUser) return;
    setIsSavingUser(true);
    setUserModalError(null);
    setUserModalSuccess(null);

    try {
      if (selectedUser.role === 'MANAGER') {
        const sanitized = sanitizeBackendPermissions(managerPermissions);
        await Promise.all([
          adminApi.updateManager(selectedUser.id, {
            isSeller: userIsSeller,
            permissions: sanitized,
          }),
          adminApi.updateManagerPermissions(selectedUser.id, sanitized).catch(() => {}),
        ]);
        const updated = {
          ...selectedUser,
          isSeller: userIsSeller,
          permissions: sanitized,
        };
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setUserModalSuccess(`Permissions & persona saved for Manager ${selectedUser.name}.`);
        setScreenFeedback({ type: 'success', message: `Permissions saved for Manager ${selectedUser.name}.` });
      } else {
        const targetNum = parseInt(userDailyTarget, 10);
        await adminApi.updateSeller(selectedUser.id, {
          active: sellerSalesActive,
          dailyTarget: isNaN(targetNum) ? 30 : targetNum,
          managerId: userAssignedManagerId || undefined,
          allowPriceOverride: sellerPriceOverrideActive,
        } as any);
        const updated = {
          ...selectedUser,
          active: sellerSalesActive,
          allowPriceOverride: sellerPriceOverrideActive,
        };
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setUserModalSuccess(`Operational permissions saved for ${selectedUser.name}.`);
        setScreenFeedback({ type: 'success', message: `Seller ${selectedUser.name} permissions saved.` });
      }
      loadUsers(false);
    } catch (err: any) {
      setUserModalError(err.message || 'Failed to update permissions.');
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleSavePersona() {
    return handleSaveUserPermissions();
  }

  async function handleSaveSeller() {
    return handleSaveUserDetails();
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
          message: `Manager ${res.manager.name} added!`,
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
          message: `Seller ${res.seller.name} added!`,
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
    { key: 'SELLERS', label: 'Sellers', badge: tab === 'SELLERS' ? users.length : undefined },
  ];

  const renderItem = ({ item }: { item: PublicUser }) => {
    const isDualRole = tab === 'MANAGERS' && Boolean(item.isSeller);
    return (
      <Card
        style={styles.card}
        onPress={() => handleOpenUserModal(item)}
        accessibilityRole="button"
        accessibilityLabel={`User ${item.name}, ${item.email || item.phone}, role ${tab === 'MANAGERS' ? 'Manager' : 'Seller'}, status ${item.active ? 'Active' : 'Inactive'}${isDualRole ? ', Can Also Sell' : ''}`}
        accessibilityHint="Tap to view and edit user details and permissions"
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge
                label={item.active ? 'ACTIVE' : 'INACTIVE'}
                variant={item.active ? 'ACTIVE' : 'INACTIVE'}
                size="sm"
              />
              {isDualRole && (
                <Badge
                  label="CAN ALSO SELL"
                  variant="ACTIVE"
                  size="sm"
                  pulse={true}
                />
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </View>
        </View>

        {isDualRole && (
          <View style={styles.dualRoleBadgeRow}>
            <Ionicons name="bus-outline" size={13} color={BrandColors.pink.dark} />
            <Text style={styles.dualRoleBadgeText}>Can take orders & hold van stock</Text>
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
        statusBarTranslucent
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                    <EmptyState
                      icon="search-outline"
                      title={
                        availableManagers.length === 0
                          ? 'No Territory Managers Found'
                          : 'No matching managers found'
                      }
                      description={
                        availableManagers.length === 0
                          ? 'Please onboard a Territory Manager first before adding sellers.'
                          : 'Try searching with a different name, district, or phone number.'
                      }
                      actionTitle={availableManagers.length === 0 ? '+ Onboard Territory Manager First' : undefined}
                      onAction={
                        availableManagers.length === 0
                          ? () => {
                              setIsManagerPickerOpen(false);
                              setModalRole('MANAGER');
                            }
                          : undefined
                      }
                      buttonVariant="admin"
                    />
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
                      accessibilityLabel="Manager can also sell in field and hold van stock"
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
                            <Text style={styles.dualRoleToggleTitle}>Manager Can Also Sell</Text>
                            <Badge
                              label={formIsSeller ? 'CAN SELL & STOCK' : 'OFF'}
                              variant={formIsSeller ? 'ACTIVE' : 'neutral'}
                              size="sm"
                            />
                          </View>
                          <Text style={styles.dualRoleToggleDesc}>
                            Manager can take customer orders, do shop visits, and hold van stock.
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
      {/* USER DETAILS & PERMISSIONS COMPREHENSIVE MODAL          */}
      {/* ======================================================= */}
      <Modal
        visible={Boolean(selectedUser)}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={handleCloseUserModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.backdropDismiss} onPress={handleCloseUserModal} />

          <View style={styles.modalSheetCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeading}>
                  {selectedUser?.role === 'MANAGER' ? 'Manager Profile & Permissions' : 'Field Officer Profile & Permissions'}
                </Text>
                <Text style={styles.modalSubheading}>
                  {isEditMode ? 'Editing user profile and territory details' : 'View complete record, territory scope & system access'}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseUserModal}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            {/* User Profile Header Card */}
            {selectedUser && (
              <View style={styles.editManagerHeaderBox}>
                <View
                  style={[
                    styles.editManagerAvatarCircle,
                    {
                      backgroundColor:
                        selectedUser.role === 'MANAGER' ? BrandColors.green.subtle : BrandColors.pink.subtle,
                      borderColor:
                        selectedUser.role === 'MANAGER' ? BrandColors.green.tint : BrandColors.pink.tint,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.editManagerAvatarText,
                      {
                        color:
                          selectedUser.role === 'MANAGER' ? BrandColors.green.primary : BrandColors.pink.dark,
                      },
                    ]}
                  >
                    {selectedUser.name?.slice(0, 2).toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: Spacing.xs }}>
                  <Text style={styles.editManagerName}>{selectedUser.name}</Text>
                  <Text style={styles.editManagerSub}>
                    {[selectedUser.district, selectedUser.state].filter(Boolean).join(', ') || 'All Regions'} • {selectedUser.phone || selectedUser.email}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={selectedUser.role === 'MANAGER' ? 'MANAGER' : 'OFFICER'}
                    variant={selectedUser.role === 'MANAGER' ? 'ACTIVE' : 'info'}
                    size="sm"
                  />
                  <Badge
                    label={userActive ? 'ACTIVE' : 'INACTIVE'}
                    variant={userActive ? 'ACTIVE' : 'INACTIVE'}
                    size="sm"
                  />
                </View>
              </View>
            )}

            {/* Segmented Sub-Tabs: [Details] vs [Permissions] */}
            <View style={styles.modalTabsRow}>
              <Pressable
                style={[styles.modalSubTab, modalTab === 'DETAILS' && styles.modalSubTabActive]}
                onPress={() => {
                  setModalTab('DETAILS');
                  setUserModalError(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: modalTab === 'DETAILS' }}
              >
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={modalTab === 'DETAILS' ? BrandColors.pink.dark : Colors.light.textSecondary}
                />
                <Text
                  style={[
                    styles.modalSubTabText,
                    modalTab === 'DETAILS' && styles.modalSubTabTextActive,
                  ]}
                >
                  User Details
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modalSubTab, modalTab === 'PERMISSIONS' && styles.modalSubTabActive]}
                onPress={() => {
                  setModalTab('PERMISSIONS');
                  setIsEditMode(false);
                  setUserModalError(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: modalTab === 'PERMISSIONS' }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={15}
                  color={modalTab === 'PERMISSIONS' ? BrandColors.pink.dark : Colors.light.textSecondary}
                />
                <Text
                  style={[
                    styles.modalSubTabText,
                    modalTab === 'PERMISSIONS' && styles.modalSubTabTextActive,
                  ]}
                >
                  Permissions & Persona
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalFormScroll}
              contentContainerStyle={styles.modalFormScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {userModalError && (
                <FeedbackBanner
                  type="error"
                  message={userModalError}
                  onDismiss={() => setUserModalError(null)}
                  style={{ marginBottom: Spacing.sm }}
                />
              )}

              {userModalSuccess && (
                <FeedbackBanner
                  type="success"
                  message={userModalSuccess}
                  onDismiss={() => setUserModalSuccess(null)}
                  style={{ marginBottom: Spacing.sm }}
                />
              )}

              {/* TAB 1: DETAILS TAB */}
              {modalTab === 'DETAILS' && (
                <>
                  {!isEditMode ? (
                    // VIEW DETAILS MODE
                    <View style={styles.viewModeContainer}>
                      <View style={styles.quickContactRow}>
                        {selectedUser?.phone ? (
                          <Pressable
                            style={styles.quickActionPill}
                            onPress={() => Linking.openURL(`tel:${selectedUser.phone}`).catch(() => {})}
                            accessibilityRole="button"
                            accessibilityLabel={`Call ${selectedUser.phone}`}
                          >
                            <Ionicons name="call" size={14} color="#FFFFFF" />
                            <Text style={styles.quickActionPillText}>Call</Text>
                          </Pressable>
                        ) : null}

                        {selectedUser?.email ? (
                          <Pressable
                            style={[styles.quickActionPill, styles.quickEmailPill]}
                            onPress={() => Linking.openURL(`mailto:${selectedUser.email}`).catch(() => {})}
                            accessibilityRole="button"
                            accessibilityLabel={`Email ${selectedUser.email}`}
                          >
                            <Ionicons name="mail" size={14} color="#FFFFFF" />
                            <Text style={styles.quickActionPillText}>Email</Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          style={[styles.quickActionPill, styles.editActionPill]}
                          onPress={() => setIsEditMode(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Edit user details"
                        >
                          <Ionicons name="pencil" size={14} color="#FFFFFF" />
                          <Text style={styles.quickActionPillText}>Edit Details</Text>
                        </Pressable>
                      </View>

                      {/* Details Grid */}
                      <View style={styles.infoSectionCard}>
                        <Text style={styles.infoSectionHeader}>Personal & Contact Details</Text>
                        <View style={styles.infoGridRow}>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>Full Name</Text>
                            <Text style={styles.infoValueBold}>{selectedUser?.name || '—'}</Text>
                          </View>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>Primary Mobile</Text>
                            <Text style={styles.infoValue}>{selectedUser?.phone || 'Not registered'}</Text>
                          </View>
                        </View>

                        <View style={styles.infoGridRow}>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>Email Address</Text>
                            <Text style={styles.infoValue}>{selectedUser?.email || 'No email'}</Text>
                          </View>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>Alternate Phone</Text>
                            <Text style={styles.infoValue}>{selectedUser?.alternatePhone || 'None'}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.infoSectionCard}>
                        <Text style={styles.infoSectionHeader}>Territory & Geography</Text>
                        <View style={styles.infoGridRow}>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>State</Text>
                            <Text style={styles.infoValueBold}>{selectedUser?.state || 'Not assigned'}</Text>
                          </View>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>District</Text>
                            <Text style={styles.infoValueBold}>{selectedUser?.district || 'Not assigned'}</Text>
                          </View>
                        </View>

                        {selectedUser?.village ? (
                          <View style={styles.infoGridRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.infoLabel}>Village / Beat Area</Text>
                              <Text style={styles.infoValue}>{selectedUser.village}</Text>
                            </View>
                          </View>
                        ) : null}

                        {selectedUser?.address ? (
                          <View style={styles.infoGridRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.infoLabel}>Full Address / Office</Text>
                              <Text style={styles.infoValue}>{selectedUser.address}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.infoSectionCard}>
                        <Text style={styles.infoSectionHeader}>Organization & Status</Text>
                        <View style={styles.infoGridRow}>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>System Role</Text>
                            <Text style={styles.infoValueBold}>
                              {selectedUser?.role === 'MANAGER' ? 'Territory Manager' : 'Field Sales Officer'}
                            </Text>
                          </View>
                          <View style={styles.infoGridCol}>
                            <Text style={styles.infoLabel}>Account Status</Text>
                            <Text style={[styles.infoValueBold, { color: userActive ? '#15803D' : '#B91C1C' }]}>
                              {userActive ? 'Active' : 'Disabled'}
                            </Text>
                          </View>
                        </View>

                        {selectedUser?.role === 'SELLER' && (
                          <View style={styles.infoGridRow}>
                            <View style={styles.infoGridCol}>
                              <Text style={styles.infoLabel}>Supervising Manager</Text>
                              <Text style={styles.infoValueBold}>
                                {availableManagers.find((m) => m.id === userAssignedManagerId)?.name || (selectedUser as any).manager?.name || 'Assigned Manager'}
                              </Text>
                            </View>
                            <View style={styles.infoGridCol}>
                              <Text style={styles.infoLabel}>Daily Visit Target</Text>
                              <Text style={styles.infoValueBold}>{userDailyTarget} outlets / day</Text>
                            </View>
                          </View>
                        )}

                        {selectedUser?.role === 'MANAGER' && (
                          <View style={styles.infoGridRow}>
                            <View style={styles.infoGridCol}>
                              <Text style={styles.infoLabel}>Dual Persona</Text>
                              <Text style={styles.infoValueBold}>
                                {userIsSeller ? 'Can Also Sell & Hold Van Stock' : 'Management Only'}
                              </Text>
                            </View>
                            <View style={styles.infoGridCol}>
                              <Text style={styles.infoLabel}>Supervised Officers</Text>
                              <Text style={styles.infoValueBold}>Territory Team Lead</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={{ marginTop: Spacing.sm }}>
                        <Button
                          title="Edit User Details"
                          variant="outline"
                          size="md"
                          onPress={() => setIsEditMode(true)}
                        />
                      </View>
                    </View>
                  ) : (
                    // EDIT DETAILS MODE
                    <View style={styles.editModeContainer}>
                      <Input
                        label="Full Name *"
                        value={userName}
                        onChangeText={setUserName}
                        placeholder="Full legal name"
                        autoCapitalize="words"
                        leftIcon={<Ionicons name="person-outline" size={18} color={Colors.light.textTertiary} />}
                      />

                      <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Input
                            label="Primary Mobile *"
                            value={userPhone}
                            onChangeText={setUserPhone}
                            placeholder="10-digit number"
                            keyboardType="phone-pad"
                            maxLength={10}
                            leftIcon={<Ionicons name="call-outline" size={18} color={Colors.light.textTertiary} />}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <Input
                            label="Alternate Phone"
                            value={userAlternatePhone}
                            onChangeText={setUserAlternatePhone}
                            placeholder="Secondary contact"
                            keyboardType="phone-pad"
                            maxLength={15}
                          />
                        </View>
                      </View>

                      <Input
                        label="Email Address"
                        value={userEmail}
                        onChangeText={setUserEmail}
                        placeholder="email@example.com (optional)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.light.textTertiary} />}
                      />

                      <View style={styles.formRow}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Input
                            label="State"
                            value={userState}
                            onChangeText={setUserState}
                            placeholder="e.g. Maharashtra"
                            autoCapitalize="words"
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <Input
                            label="District"
                            value={userDistrict}
                            onChangeText={setUserDistrict}
                            placeholder="e.g. Thane"
                            autoCapitalize="words"
                          />
                        </View>
                      </View>

                      {selectedUser?.role === 'SELLER' && (
                        <View style={styles.formRow}>
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <Input
                              label="Village / Beat Area"
                              value={userVillage}
                              onChangeText={setUserVillage}
                              placeholder="e.g. Rural Beat 1"
                              autoCapitalize="words"
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                            <Input
                              label="Daily Visit Target"
                              value={userDailyTarget}
                              onChangeText={setUserDailyTarget}
                              placeholder="e.g. 30"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      )}

                      <Input
                        label="Address / Office"
                        value={userAddress}
                        onChangeText={setUserAddress}
                        placeholder="Street or office location"
                        multiline
                        numberOfLines={2}
                        leftIcon={<Ionicons name="business-outline" size={18} color={Colors.light.textTertiary} />}
                      />

                      {/* Active Account Status Switch */}
                      <View style={styles.statusToggleContainer}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.statusToggleTitle}>Account Active Status</Text>
                          <Text style={styles.statusToggleSubtitle}>
                            {userActive ? 'User can log in and perform duties' : 'User account is disabled from logging in'}
                          </Text>
                        </View>
                        <Pressable
                          style={[
                            styles.statusToggleBtn,
                            {
                              backgroundColor: userActive ? '#DCFCE7' : '#FEE2E2',
                              borderColor: userActive ? '#86EFAC' : '#FCA5A5',
                            },
                          ]}
                          onPress={() => setUserActive(!userActive)}
                          accessibilityRole="button"
                          accessibilityLabel="Toggle account active status"
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: userActive ? '#15803D' : '#B91C1C' }}>
                            {userActive ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Edit Actions */}
                      <View style={styles.modalActionRow}>
                        <Button
                          title="Cancel"
                          variant="outline"
                          size="md"
                          style={{ flex: 1, marginRight: Spacing.sm }}
                          onPress={() => setIsEditMode(false)}
                          disabled={isSavingUser}
                        />
                        <Button
                          title={isSavingUser ? 'Saving...' : 'Save User Details'}
                          variant="admin"
                          size="md"
                          style={{ flex: 1.5 }}
                          loading={isSavingUser}
                          onPress={handleSaveUserDetails}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* TAB 2: PERMISSIONS & PERSONA TAB */}
              {modalTab === 'PERMISSIONS' && (
                <View style={styles.permissionsTabContainer}>
                  {selectedUser?.role === 'MANAGER' ? (
                    <>
                      {/* Dual-Role Setting Toggle Card */}
                      <Pressable
                        style={[
                          styles.dualRoleToggleCard,
                          userIsSeller && styles.dualRoleToggleCardActive,
                        ]}
                        onPress={() => setUserIsSeller(!userIsSeller)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: userIsSeller }}
                        accessibilityLabel="Manager can also sell in field and hold van stock"
                      >
                        <View style={styles.dualRoleToggleLeft}>
                          <View style={[styles.dualRoleToggleIconCircle, userIsSeller && styles.dualRoleToggleIconCircleActive]}>
                            <Ionicons
                              name="swap-horizontal"
                              size={20}
                              color={userIsSeller ? '#FFFFFF' : BrandColors.green.primary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.dualRoleToggleTitle}>Manager Can Also Sell</Text>
                              <Badge
                                label={userIsSeller ? 'CAN SELL & STOCK' : 'OFF'}
                                variant={userIsSeller ? 'ACTIVE' : 'neutral'}
                                size="sm"
                              />
                            </View>
                            <Text style={styles.dualRoleToggleDesc}>
                              {userIsSeller
                                ? 'Dual-Role Enabled: Manager can take customer orders, do shop visits, and hold van stock on mobile.'
                                : 'Manager can supervise team only; field selling screens remain hidden.'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.switchTrack, userIsSeller && styles.switchTrackActive]}>
                          <View style={[styles.switchThumb, userIsSeller && styles.switchThumbActive]} />
                        </View>
                      </Pressable>

                      {/* Manager Operational Permissions Matrix */}
                      <Text style={styles.permissionsSectionHeader}>Managerial Access Rights</Text>
                      <Text style={styles.permissionsSectionSub}>
                        Configure territory operational privileges for this manager.
                      </Text>

                      {MANAGER_PERMISSIONS.map((permKey) => {
                        const meta = PERMISSION_METADATA[permKey];
                        const isGranted = managerPermissions.includes(permKey);
                        return (
                          <View key={permKey} style={styles.permissionItemRow}>
                            <View style={styles.permissionItemIconCircle}>
                              <Ionicons
                                name={
                                  permKey.includes('customers')
                                    ? 'storefront-outline'
                                    : permKey.includes('sellers')
                                    ? 'people-outline'
                                    : permKey.includes('inventory')
                                    ? 'cube-outline'
                                    : permKey.includes('approve')
                                    ? 'checkmark-done-circle-outline'
                                    : 'analytics-outline'
                                }
                                size={18}
                                color={isGranted ? BrandColors.green.primary : '#94A3B8'}
                              />
                            </View>
                            <View style={{ flex: 1, marginRight: Spacing.sm }}>
                              <Text style={styles.permissionItemTitle}>{meta?.label || permKey}</Text>
                              <Text style={styles.permissionItemDesc}>{meta?.description || ''}</Text>
                            </View>
                            <Switch
                              value={isGranted}
                              onValueChange={() => {
                                setManagerPermissions((prev) =>
                                  prev.includes(permKey)
                                    ? prev.filter((p) => p !== permKey)
                                    : [...prev, permKey]
                                );
                              }}
                              trackColor={{ false: '#CBD5E1', true: BrandColors.green.tint }}
                              thumbColor={isGranted ? BrandColors.green.primary : '#94A3B8'}
                            />
                          </View>
                        );
                      })}

                      <View style={{ marginTop: Spacing.lg }}>
                        <Button
                          title={isSavingUser ? 'Saving Permissions...' : 'Save Permissions & Persona'}
                          variant="admin"
                          size="md"
                          loading={isSavingUser}
                          onPress={handleSaveUserPermissions}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      {/* Seller Operational Permissions */}
                      <Text style={styles.permissionsSectionHeader}>Field Officer Operational Access</Text>
                      <Text style={styles.permissionsSectionSub}>
                        Configure active selling authorities and capabilities for this field officer.
                      </Text>

                      <View style={styles.permissionItemRow}>
                        <View style={styles.permissionItemIconCircle}>
                          <Ionicons name="cart-outline" size={18} color={sellerSalesActive ? BrandColors.pink.dark : '#94A3B8'} />
                        </View>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.permissionItemTitle}>Active Field Sales Duty</Text>
                          <Text style={styles.permissionItemDesc}>
                            Allow starting daily shifts, logging store visits, and taking orders.
                          </Text>
                        </View>
                        <Switch
                          value={sellerSalesActive}
                          onValueChange={setSellerSalesActive}
                          trackColor={{ false: '#CBD5E1', true: BrandColors.pink.tint }}
                          thumbColor={sellerSalesActive ? BrandColors.pink.dark : '#94A3B8'}
                        />
                      </View>

                      <View style={styles.permissionItemRow}>
                        <View style={styles.permissionItemIconCircle}>
                          <Ionicons name="storefront-outline" size={18} color={sellerOnboardingActive ? BrandColors.pink.dark : '#94A3B8'} />
                        </View>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.permissionItemTitle}>Retailer / Shop Onboarding</Text>
                          <Text style={styles.permissionItemDesc}>
                            Authorized to register new retail shops with GPS location and photo.
                          </Text>
                        </View>
                        <Switch
                          value={sellerOnboardingActive}
                          onValueChange={setSellerOnboardingActive}
                          trackColor={{ false: '#CBD5E1', true: BrandColors.pink.tint }}
                          thumbColor={sellerOnboardingActive ? BrandColors.pink.dark : '#94A3B8'}
                        />
                      </View>

                      <View style={styles.permissionItemRow}>
                        <View style={styles.permissionItemIconCircle}>
                          <Ionicons name="bus-outline" size={18} color={sellerVanStockActive ? BrandColors.pink.dark : '#94A3B8'} />
                        </View>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.permissionItemTitle}>Van Stock Possession</Text>
                          <Text style={styles.permissionItemDesc}>
                            Authorized to hold mobile van inventory and deliver on the spot.
                          </Text>
                        </View>
                        <Switch
                          value={sellerVanStockActive}
                          onValueChange={setSellerVanStockActive}
                          trackColor={{ false: '#CBD5E1', true: BrandColors.pink.tint }}
                          thumbColor={sellerVanStockActive ? BrandColors.pink.dark : '#94A3B8'}
                        />
                      </View>

                      <View style={styles.permissionItemRow}>
                        <View style={styles.permissionItemIconCircle}>
                          <Ionicons name="pricetag-outline" size={18} color={sellerPriceOverrideActive ? BrandColors.pink.dark : '#94A3B8'} />
                        </View>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={styles.permissionItemTitle}>Price & Discount Overrides</Text>
                          <Text style={styles.permissionItemDesc}>
                            Authorized to apply promotional discounts subject to manager approval.
                          </Text>
                        </View>
                        <Switch
                          value={sellerPriceOverrideActive}
                          onValueChange={setSellerPriceOverrideActive}
                          trackColor={{ false: '#CBD5E1', true: BrandColors.pink.tint }}
                          thumbColor={sellerPriceOverrideActive ? BrandColors.pink.dark : '#94A3B8'}
                        />
                      </View>

                      <View style={{ marginTop: Spacing.lg }}>
                        <Button
                          title={isSavingUser ? 'Saving Permissions...' : 'Save Officer Permissions'}
                          variant="admin"
                          size="md"
                          loading={isSavingUser}
                          onPress={handleSaveUserPermissions}
                        />
                      </View>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Comprehensive User Management Modal Styles
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
    gap: 4,
  },
  modalSubTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  modalSubTabActive: {
    backgroundColor: '#FFFFFF',
    ...Elevation.low,
  },
  modalSubTabText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  modalSubTabTextActive: {
    color: BrandColors.pink.dark,
  },
  viewModeContainer: {
    gap: Spacing.sm,
  },
  editModeContainer: {
    gap: Spacing.xs,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.green.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  quickEmailPill: {
    backgroundColor: '#0284C7',
  },
  editActionPill: {
    backgroundColor: BrandColors.pink.dark,
    marginLeft: 'auto',
  },
  quickActionPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  infoSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  infoSectionHeader: {
    ...Typography.caption,
    fontWeight: '800',
    color: BrandColors.pink.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  infoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  infoGridCol: {
    flex: 1,
  },
  infoLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.bodySmall,
    color: Colors.light.textPrimary,
  },
  infoValueBold: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  statusToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
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
  },
  statusToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  permissionsTabContainer: {
    paddingBottom: Spacing.md,
  },
  permissionsSectionHeader: {
    ...Typography.bodyLarge,
    fontWeight: '800',
    color: Colors.light.heading,
    marginTop: Spacing.sm,
  },
  permissionsSectionSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
    marginTop: 2,
  },
  permissionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Elevation.low,
  },
  permissionItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  permissionItemTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  permissionItemDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
