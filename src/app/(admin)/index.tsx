import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
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
import type { AdminDashboardData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { PageTransition } from '@/components/ui/PageTransition';
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
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
import { useAuth } from '@/context/AuthContext';
import { parseDateInputToISO } from '@/utils/dateUtils';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Filters State
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<'state' | 'district' | 'village' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'this_month' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Available filter options (strictly populated from DB records)
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    districts: string[];
    villages: string[];
  }>({
    states: [],
    districts: [],
    villages: [],
  });

  const [customerLocations, setCustomerLocations] = useState<
    Array<{ state: string; district: string; village: string }>
  >([]);

  // Load filter options directly from database records
  const loadFilterOptions = useCallback(async () => {
    try {
      const [filterMetaRes, customersRes] = await Promise.allSettled([
        adminApi.getDashboardFilters(),
        adminApi.listCustomers({ pageSize: 100 }),
      ]);

      const opts = filterMetaRes.status === 'fulfilled' ? filterMetaRes.value : null;
      const customerItems =
        customersRes.status === 'fulfilled' && Array.isArray(customersRes.value?.items)
          ? customersRes.value.items
          : [];

      const rawLocations: Array<{ state: string; district: string; village: string }> = [];

      // Extract from customerLocations returned by dashboard API
      if (opts?.customerLocations && Array.isArray(opts.customerLocations)) {
        opts.customerLocations.forEach((loc) => {
          if (loc.state || loc.district || loc.village) {
            rawLocations.push({
              state: (loc.state || '').trim(),
              district: (loc.district || '').trim(),
              village: (loc.village || '').trim(),
            });
          }
        });
      }

      // Extract directly from customer records in database
      customerItems.forEach((c) => {
        if (c.state || c.district || c.village) {
          rawLocations.push({
            state: (c.state || '').trim(),
            district: (c.district || '').trim(),
            village: (c.village || '').trim(),
          });
        }
      });

      setCustomerLocations(rawLocations);

      // Collect unique villages from database records & API
      const vSet = new Set<string>();
      if (opts?.villages && Array.isArray(opts.villages)) {
        opts.villages.forEach((v) => {
          const name = (typeof v === 'string' ? v : (v as any)?.village || '').trim();
          if (name) vSet.add(name);
        });
      }
      rawLocations.forEach((loc) => {
        if (loc.village) vSet.add(loc.village);
      });

      // Collect unique states from database records & API
      const sSet = new Set<string>();
      if (opts?.states && Array.isArray(opts.states)) {
        opts.states.forEach((s) => {
          const name = (typeof s === 'string' ? s : (s as any)?.state || '').trim();
          if (name) sSet.add(name);
        });
      }
      rawLocations.forEach((loc) => {
        if (loc.state) sSet.add(loc.state);
      });

      // Collect unique districts from database records & API
      const dSet = new Set<string>();
      if (opts?.districts && Array.isArray(opts.districts)) {
        opts.districts.forEach((d) => {
          const name = (typeof d === 'string' ? d : (d as any)?.district || '').trim();
          if (name) dSet.add(name);
        });
      }
      rawLocations.forEach((loc) => {
        if (loc.district) dSet.add(loc.district);
      });

      setFilterOptions({
        states: Array.from(sSet).sort((a, b) => a.localeCompare(b)),
        districts: Array.from(dSet).sort((a, b) => a.localeCompare(b)),
        villages: Array.from(vSet).sort((a, b) => a.localeCompare(b)),
      });
    } catch (err) {
      console.warn('Failed to load filter options from database', err);
    }
  }, []);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Compute active date boundaries
  const dateRange = useMemo(() => {
    const now = new Date();
    if (customFrom || customTo) {
      return {
        from: customFrom ? parseDateInputToISO(customFrom) : undefined,
        to: customTo ? parseDateInputToISO(customTo) : undefined,
      };
    }
    if (datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (datePreset === '7days') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (datePreset === '30days') {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    return { from: undefined, to: undefined };
  }, [datePreset, customFrom, customTo]);

  // Active filters count restricted exclusively to: Date Range, State, District, Village / Area
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedState) count++;
    if (selectedDistrict) count++;
    if (selectedVillage) count++;
    if (datePreset !== 'all' || customFrom || customTo) count++;
    return count;
  }, [
    selectedState,
    selectedDistrict,
    selectedVillage,
    datePreset,
    customFrom,
    customTo,
  ]);

  // Filter districts dynamically based on selected state if available
  const displayedDistricts = useMemo(() => {
    if (selectedState) {
      const match = customerLocations.filter(
        (loc) => loc.state?.toLowerCase() === selectedState.toLowerCase() && loc.district
      );
      if (match.length > 0) {
        return Array.from(new Set(match.map((m) => m.district))).sort((a, b) => a.localeCompare(b));
      }
    }
    return filterOptions.districts;
  }, [customerLocations, filterOptions.districts, selectedState]);

  // Filter villages dynamically based on selected district or state if available
  const displayedVillages = useMemo(() => {
    if (selectedDistrict) {
      const match = customerLocations.filter(
        (loc) => loc.district?.toLowerCase() === selectedDistrict.toLowerCase() && loc.village
      );
      if (match.length > 0) {
        return Array.from(new Set(match.map((m) => m.village))).sort((a, b) => a.localeCompare(b));
      }
    }
    if (selectedState) {
      const match = customerLocations.filter(
        (loc) => loc.state?.toLowerCase() === selectedState.toLowerCase() && loc.village
      );
      if (match.length > 0) {
        return Array.from(new Set(match.map((m) => m.village))).sort((a, b) => a.localeCompare(b));
      }
    }
    return filterOptions.villages;
  }, [customerLocations, filterOptions.villages, selectedDistrict, selectedState]);

  const resetFilters = () => {
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedVillage('');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setActivePicker(null);
    setPickerSearch('');
  };

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const params = {
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        village: selectedVillage || undefined,
        from: dateRange.from,
        to: dateRange.to,
      };

      const res = await adminApi.getDashboard(params);
      if (res) {
        setDashboard(res);
        setLoadError(null);
      } else {
        throw new Error('Received empty response from server.');
      }
    } catch (err: any) {
      console.warn('Admin dashboard error', err);
      const msg = err?.message || 'Failed to sync executive operations data.';
      setLoadError(msg);
      // Fallback default structure so UI never crashes even on network failure
      setDashboard((prev) => prev || {
        totalRevenuePaise: 0,
        totalPacketsSold: 0,
        totalCustomers: 0,
        activeSellers: 0,
        pendingApprovalsCount: 0,
        warehouseStockBalance: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    selectedState,
    selectedDistrict,
    selectedVillage,
    dateRange,
  ]);

  // Re-fetch telemetry whenever executive overview comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Real-time synchronization when approvals/rejections happen across admin screens
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', (event?: any) => {
      if (event?.action === 'APPROVE' || event?.action === 'REJECT') {
        setDashboard((prev) => {
          if (!prev) return prev;
          const current = Number(prev.pendingApprovalsCount || 0);
          return {
            ...prev,
            pendingApprovalsCount: Math.max(0, current - 1),
          };
        });
      }
      loadData();
    });

    return () => {
      sub.remove();
    };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatRupees = (paise?: number | null) => {
    const val = Number(paise);
    const safe = isNaN(val) ? 0 : val;
    return `₹${(safe / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatCount = (count?: number | null) => {
    const val = Number(count);
    return (isNaN(val) ? 0 : val).toLocaleString('en-IN');
  };

  const handleOpenActionsHub = useCallback(() => {
    try {
      (navigation as any).navigate('actions/index');
    } catch {
      try {
        router.navigate('/(admin)/actions' as any);
      } catch {
        router.push('/(admin)/actions' as any);
      }
    }
  }, [navigation, router]);

  const pendingCount = Number(dashboard?.pendingApprovalsCount || 0);

  return (
    <View style={styles.container}>
      <Header
        title="Admin Dashboard"
        subtitle={`Hello, ${user?.name || 'Admin'}`}
        showMenu
        onMenuPress={() => setMenuOpen(true)}
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Sync Error Alert Banner (if network or server error occurred) */}
          {loadError ? (
            <Card style={styles.errorAlertCard}>
              <View style={styles.errorAlertRow}>
                <View style={styles.errorIconBadge}>
                  <Ionicons name="cloud-offline-outline" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.errorAlertTitle}>Live Sync Paused</Text>
                  <Text style={styles.errorAlertDesc} numberOfLines={2}>
                    {loadError}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setLoading(true);
                    loadData();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Retry Loading Operations Data"
                >
                  <Ionicons name="reload" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : null}

          {/* Territory & Scope Filters */}
          <Card style={styles.filterTriggerCard}>
            <View style={styles.filterTriggerHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="filter" size={18} color={BrandColors.pink.primary} />
                  <Text style={styles.filterMainTitle}>Area & Scope Filters</Text>
                  {activeFiltersCount > 0 ? (
                    <View style={styles.filterCountBadge}>
                      <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.filterMainSub}>
                  Filter live operational metrics by date and area
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {activeFiltersCount > 0 ? (
                  <TouchableOpacity onPress={resetFilters} style={styles.clearAllBtn} hitSlop={HitSlop.sm}>
                    <Ionicons name="refresh-outline" size={14} color={BrandColors.pink.dark} />
                    <Text style={styles.clearAllText}>Reset</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.filterToggleBtn}
                  onPress={() => setFiltersOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open Area & Scope Filters"
                >
                  <Ionicons name="options-outline" size={16} color="#0F172A" />
                  <Text style={styles.filterToggleText}>Filters</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Filter Chips Strip */}
            {activeFiltersCount > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipsRow}>
                {datePreset !== 'all' || customFrom || customTo ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      Date: {datePreset === 'today' ? 'Today' : datePreset === '7days' ? 'Last 7 Days' : datePreset === '30days' ? 'Last 30 Days' : datePreset === 'this_month' ? 'This Month' : `${customFrom || 'Start'} to ${customTo || 'Now'}`}
                    </Text>
                    <Pressable onPress={() => { setDatePreset('all'); setCustomFrom(''); setCustomTo(''); }}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {selectedState ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>State: {selectedState}</Text>
                    <Pressable onPress={() => setSelectedState('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {selectedDistrict ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>District: {selectedDistrict}</Text>
                    <Pressable onPress={() => setSelectedDistrict('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {selectedVillage ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>Village / Area: {selectedVillage}</Text>
                    <Pressable onPress={() => setSelectedVillage('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.filterEmptyNoticeRow}>
                <Ionicons name="sparkles-outline" size={13} color={BrandColors.pink.primary} />
                <Text style={styles.filterEmptyNoticeText}>
                  Showing all metrics • Tap Filters to scope by date, area, or village
                </Text>
              </View>
            )}
          </Card>

          {/* Pending Approvals Alert Banner */}
          {pendingCount > 0 ? (
            <Card style={styles.approvalAlertCard}>
              <View style={styles.approvalAlertRow}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <View style={styles.alertHeaderRow}>
                    <Ionicons name="alert-circle" size={20} color={Colors.light.warning} style={{ marginRight: 6 }} />
                    <Text style={styles.approvalAlertTitle}>
                      {pendingCount} Special Price {pendingCount === 1 ? 'Order' : 'Orders'} Waiting for Approval
                    </Text>
                  </View>
                  <Text style={styles.approvalAlertDesc}>
                    Special price orders need approval before they can be completed.
                  </Text>
                </View>
                <Button
                  title="View Orders"
                  size="sm"
                  variant="admin"
                  onPress={() => router.push('/(admin)/approvals' as any)}
                />
              </View>
            </Card>
          ) : null}

          {/* Metrics Grid */}
          <Text style={styles.sectionHeading}>
            Key Numbers {activeFiltersCount > 0 ? `(Filtered: ${activeFiltersCount})` : ''}
          </Text>

          {loading && !dashboard ? (
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </View>
              <View style={styles.metricRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </View>
              <View style={styles.metricRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
              </View>
            </View>
          ) : (
            <View style={styles.metricsContainer}>
              {/* Row 1: Sales & Volume */}
              <View style={styles.metricRow}>
                <StatCard
                  title="Total Revenue"
                  value={formatRupees(dashboard?.totalRevenuePaise ?? dashboard?.metrics?.totalEarningsPaise ?? 0)}
                  subtitle="Total sales money"
                  icon="wallet-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                  onPress={() => router.push('/(admin)/sales' as any)}
                />
                <StatCard
                  title="Packets Sold"
                  value={formatCount(dashboard?.totalPacketsSold ?? dashboard?.metrics?.totalPacketsSold ?? 0)}
                  subtitle="Total packets sold"
                  icon="cube-outline"
                  iconColor="#0284C7"
                  iconBg="#F0F9FF"
                  onPress={() => router.push('/(admin)/reports' as any)}
                />
              </View>

              {/* Row 2: Warehouse Stock & Store Network */}
              <View style={styles.metricRow}>
                <StatCard
                  title="HQ Stock"
                  value={`${formatCount(dashboard?.warehouseStockBalance ?? dashboard?.metrics?.warehouseStock ?? dashboard?.metrics?.totalInventory ?? 0)} pkts`}
                  subtitle="Packets in main warehouse"
                  icon="business-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                  accentColor={BrandColors.green.primary}
                  onPress={() => router.push('/(admin)/inventory' as any)}
                />
                <StatCard
                  title="Total Shops"
                  value={formatCount(dashboard?.totalCustomers ?? dashboard?.metrics?.totalShops ?? 0)}
                  subtitle="Registered shops"
                  icon="storefront-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                  onPress={() => router.push('/(admin)/customers' as any)}
                />
              </View>

              {/* Row 3: Active Field Force & Approvals */}
              <View style={styles.metricRow}>
                <StatCard
                  title="Active Sellers"
                  value={formatCount(dashboard?.activeSellers ?? dashboard?.metrics?.totalSellers ?? 0)}
                  subtitle="Sellers working today"
                  icon="people-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                  onPress={() => router.push('/(admin)/shifts' as any)}
                />
                <StatCard
                  title="Waiting Approvals"
                  value={String(pendingCount)}
                  subtitle={pendingCount > 0 ? 'Need approval' : 'All clear'}
                  icon="hourglass-outline"
                  iconColor={pendingCount > 0 ? Colors.light.warning : Colors.light.textTertiary}
                  iconBg={pendingCount > 0 ? Colors.light.warningBg : '#F1F5F9'}
                  accentColor={pendingCount > 0 ? Colors.light.warning : undefined}
                  onPress={() => router.push('/(admin)/approvals' as any)}
                />
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Comprehensive Filter Modal */}
      <Modal
        visible={filtersOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          if (activePicker) {
            setActivePicker(null);
            setPickerSearch('');
          } else {
            setFiltersOpen(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.backdropDismiss}
            onPress={() => {
              setActivePicker(null);
              setPickerSearch('');
              setFiltersOpen(false);
            }}
          />
          <View style={styles.modalContainer}>
            {activePicker ? (
              <View style={styles.pickerContainer}>
                {/* Picker Header */}
                <View style={styles.pickerHeader}>
                  <TouchableOpacity
                    style={styles.pickerBackBtn}
                    onPress={() => {
                      setActivePicker(null);
                      setPickerSearch('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Filters"
                  >
                    <Ionicons name="arrow-back" size={20} color={Colors.light.text} />
                    <Text style={styles.pickerBackText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.pickerHeaderTitle}>
                    {activePicker === 'state' && 'Select State'}
                    {activePicker === 'district' && 'Select District'}
                    {activePicker === 'village' && 'Select Village / Area'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      if (activePicker === 'state') setSelectedState('');
                      if (activePicker === 'district') setSelectedDistrict('');
                      if (activePicker === 'village') setSelectedVillage('');
                      setActivePicker(null);
                      setPickerSearch('');
                    }}
                    style={styles.pickerResetBtn}
                  >
                    <Text style={styles.pickerResetText}>Clear</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Input Bar */}
                <View style={styles.pickerSearchBox}>
                  <Ionicons name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder={
                      activePicker === 'state'
                        ? 'Search states...'
                        : activePicker === 'district'
                        ? 'Search districts...'
                        : 'Search or type village...'
                    }
                    placeholderTextColor="#94A3B8"
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    autoFocus
                    clearButtonMode="while-editing"
                  />
                  {pickerSearch ? (
                    <Pressable onPress={() => setPickerSearch('')} hitSlop={HitSlop.sm}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </Pressable>
                  ) : null}
                </View>

                {/* Options List */}
                <ScrollView contentContainerStyle={styles.pickerListContent} showsVerticalScrollIndicator={false}>
                  {/* Default All Option */}
                  {(() => {
                    let allLabel = '';
                    let isAllSelected = false;
                    let iconName: keyof typeof Ionicons.glyphMap = 'globe-outline';

                    if (activePicker === 'state') {
                      allLabel = 'All states';
                      isAllSelected = !selectedState;
                      iconName = 'globe-outline';
                    } else if (activePicker === 'district') {
                      allLabel = 'All districts';
                      isAllSelected = !selectedDistrict;
                      iconName = 'business-outline';
                    } else if (activePicker === 'village') {
                      allLabel = 'All villages';
                      isAllSelected = !selectedVillage;
                      iconName = 'home-outline';
                    }

                    const showAll = !pickerSearch || allLabel.toLowerCase().includes(pickerSearch.toLowerCase());
                    if (!showAll) return null;

                    return (
                      <TouchableOpacity
                        style={[styles.pickerOptionItem, isAllSelected && styles.pickerOptionItemSelected]}
                        onPress={() => {
                          if (activePicker === 'state') setSelectedState('');
                          if (activePicker === 'district') setSelectedDistrict('');
                          if (activePicker === 'village') setSelectedVillage('');
                          setActivePicker(null);
                          setPickerSearch('');
                        }}
                      >
                        <View style={styles.pickerOptionLeft}>
                          <View style={[styles.pickerOptionIconCircle, isAllSelected && styles.pickerOptionIconCircleActive]}>
                            <Ionicons name={iconName} size={18} color={isAllSelected ? BrandColors.pink.primary : '#64748B'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.pickerOptionTitle, isAllSelected && styles.pickerOptionTitleActive]}>
                              {allLabel}
                            </Text>
                            <Text style={styles.pickerOptionSub}>Reset to view all</Text>
                          </View>
                        </View>
                        {isAllSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={BrandColors.pink.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })()}

                  {/* State Options */}
                  {activePicker === 'state' && (
                    <>
                      {filterOptions.states
                        .filter((s) => !pickerSearch || s.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((st, idx) => {
                          const isSelected = selectedState === st;
                          return (
                            <TouchableOpacity
                              key={`st-${st}-${idx}`}
                              style={[styles.pickerOptionItem, isSelected && styles.pickerOptionItemSelected]}
                              onPress={() => {
                                setSelectedState(st);
                                setActivePicker(null);
                                setPickerSearch('');
                              }}
                            >
                              <View style={styles.pickerOptionLeft}>
                                <View style={[styles.pickerOptionIconCircle, isSelected && styles.pickerOptionIconCircleActive]}>
                                  <Ionicons name="location-outline" size={18} color={isSelected ? BrandColors.pink.primary : '#64748B'} />
                                </View>
                                <Text style={[styles.pickerOptionTitle, isSelected && styles.pickerOptionTitleActive]}>
                                  {st}
                                </Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={BrandColors.pink.primary} />
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}

                      {filterOptions.states.length === 0 && !pickerSearch.trim() ? (
                        <View style={styles.pickerEmptyContainer}>
                          <Ionicons name="map-outline" size={32} color="#94A3B8" />
                          <Text style={styles.pickerEmptyTitle}>No states in database</Text>
                          <Text style={styles.pickerEmptySub}>
                            No state records found in the database.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}

                  {/* District Options */}
                  {activePicker === 'district' && (
                    <>
                      {displayedDistricts
                        .filter((d) => !pickerSearch || d.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((dst, idx) => {
                          const isSelected = selectedDistrict === dst;
                          return (
                            <TouchableOpacity
                              key={`dst-${dst}-${idx}`}
                              style={[styles.pickerOptionItem, isSelected && styles.pickerOptionItemSelected]}
                              onPress={() => {
                                setSelectedDistrict(dst);
                                setActivePicker(null);
                                setPickerSearch('');
                              }}
                            >
                              <View style={styles.pickerOptionLeft}>
                                <View style={[styles.pickerOptionIconCircle, isSelected && styles.pickerOptionIconCircleActive]}>
                                  <Ionicons name="business-outline" size={18} color={isSelected ? BrandColors.pink.primary : '#64748B'} />
                                </View>
                                <Text style={[styles.pickerOptionTitle, isSelected && styles.pickerOptionTitleActive]}>
                                  {dst}
                                </Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={BrandColors.pink.primary} />
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}

                      {displayedDistricts.length === 0 && !pickerSearch.trim() ? (
                        <View style={styles.pickerEmptyContainer}>
                          <Ionicons name="business-outline" size={32} color="#94A3B8" />
                          <Text style={styles.pickerEmptyTitle}>No districts in database</Text>
                          <Text style={styles.pickerEmptySub}>
                            No district records found in the database.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}

                  {/* Village / Area Options */}
                  {activePicker === 'village' && (
                    <>
                      {pickerSearch.trim() && !displayedVillages.some((v) => v.toLowerCase() === pickerSearch.trim().toLowerCase()) ? (
                        <TouchableOpacity
                          style={[styles.pickerOptionItem, selectedVillage.toLowerCase() === pickerSearch.trim().toLowerCase() && styles.pickerOptionItemSelected]}
                          onPress={() => {
                            setSelectedVillage(pickerSearch.trim());
                            setActivePicker(null);
                            setPickerSearch('');
                          }}
                        >
                          <View style={styles.pickerOptionLeft}>
                            <View style={[styles.pickerOptionIconCircle, styles.pickerOptionIconCircleActive]}>
                              <Ionicons name="add-circle-outline" size={18} color={BrandColors.pink.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.pickerOptionTitle, styles.pickerOptionTitleActive]}>
                                Filter by: "{pickerSearch.trim()}"
                              </Text>
                              <Text style={styles.pickerOptionSub}>Custom village or area</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ) : null}

                      {displayedVillages
                        .filter((v) => !pickerSearch || v.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map((v, idx) => {
                          const isSelected = selectedVillage.toLowerCase() === v.toLowerCase();
                          return (
                            <TouchableOpacity
                              key={`v-${v}-${idx}`}
                              style={[styles.pickerOptionItem, isSelected && styles.pickerOptionItemSelected]}
                              onPress={() => {
                                setSelectedVillage(v);
                                setActivePicker(null);
                                setPickerSearch('');
                              }}
                            >
                              <View style={styles.pickerOptionLeft}>
                                <View style={[styles.pickerOptionIconCircle, isSelected && styles.pickerOptionIconCircleActive]}>
                                  <Ionicons name="home-outline" size={18} color={isSelected ? BrandColors.pink.primary : '#64748B'} />
                                </View>
                                <Text style={[styles.pickerOptionTitle, isSelected && styles.pickerOptionTitleActive]}>
                                  {v}
                                </Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={BrandColors.pink.primary} />
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}

                      {displayedVillages.length === 0 && !pickerSearch.trim() ? (
                        <View style={styles.pickerEmptyContainer}>
                          <Ionicons name="home-outline" size={32} color="#94A3B8" />
                          <Text style={styles.pickerEmptyTitle}>No villages in database</Text>
                          <Text style={styles.pickerEmptySub}>
                            No village records found in the database. Type a village or area name in the search box above to filter.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </ScrollView>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Area & Scope Filters</Text>
                    <Text style={styles.modalSub}>Filter live operational metrics by date and area</Text>
                  </View>
                  <Pressable onPress={() => setFiltersOpen(false)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color={Colors.light.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Date Range */}
                  <Text style={styles.filterSectionTitle}>Date Range:</Text>
                  <View style={styles.chipGrid}>
                    {(
                      [
                        { id: 'today', label: 'Today' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: '30days', label: 'Last 30 Days' },
                        { id: 'this_month', label: 'This Month' },
                      ] as const
                    ).map((d) => {
                      const isSelected = datePreset === d.id && !customFrom && !customTo;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.filterChip, isSelected && styles.filterChipActive]}
                          onPress={() => {
                            setDatePreset(isSelected ? 'all' : d.id);
                            setCustomFrom('');
                            setCustomTo('');
                          }}
                        >
                          <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.customDateRow}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text style={styles.inputLabel}>From:</Text>
                      <View style={styles.dateInputWrapper}>
                        <Ionicons name="calendar-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.dateInput}
                          value={customFrom}
                          onChangeText={(val) => {
                            setCustomFrom(val);
                            if (val) setDatePreset('custom');
                          }}
                          placeholder="dd-mm-yyyy"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>To:</Text>
                      <View style={styles.dateInputWrapper}>
                        <Ionicons name="calendar-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                        <TextInput
                          style={styles.dateInput}
                          value={customTo}
                          onChangeText={(val) => {
                            setCustomTo(val);
                            if (val) setDatePreset('custom');
                          }}
                          placeholder="dd-mm-yyyy"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Geographic & Operational Scope Dropdowns with Search */}
                  <View style={styles.dropdownsContainer}>
                    {/* State */}
                    <View style={styles.dropdownField}>
                      <Text style={styles.filterSectionTitle}>State</Text>
                      <TouchableOpacity
                        style={[styles.dropdownTriggerBox, Boolean(selectedState) && styles.dropdownTriggerBoxActive]}
                        onPress={() => {
                          setActivePicker('state');
                          setPickerSearch('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`State: ${selectedState || 'All states'}`}
                      >
                        <View style={styles.dropdownTriggerLeft}>
                          <View style={[styles.dropdownIconBox, Boolean(selectedState) && styles.dropdownIconBoxActive]}>
                            <Ionicons
                              name="map-outline"
                              size={18}
                              color={selectedState ? BrandColors.pink.primary : '#64748B'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownValueText, Boolean(selectedState) && styles.dropdownValueTextActive]}>
                              {selectedState || 'All states'}
                            </Text>
                            <Text style={styles.dropdownSubText}>Tap to search and select state</Text>
                          </View>
                        </View>
                        <View style={styles.dropdownRightIcons}>
                          {selectedState ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedState('');
                              }}
                              hitSlop={HitSlop.sm}
                              style={styles.dropdownClearBtn}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </Pressable>
                          ) : null}
                          <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* District */}
                    <View style={styles.dropdownField}>
                      <Text style={styles.filterSectionTitle}>District</Text>
                      <TouchableOpacity
                        style={[styles.dropdownTriggerBox, Boolean(selectedDistrict) && styles.dropdownTriggerBoxActive]}
                        onPress={() => {
                          setActivePicker('district');
                          setPickerSearch('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`District: ${selectedDistrict || 'All districts'}`}
                      >
                        <View style={styles.dropdownTriggerLeft}>
                          <View style={[styles.dropdownIconBox, Boolean(selectedDistrict) && styles.dropdownIconBoxActive]}>
                            <Ionicons
                              name="business-outline"
                              size={18}
                              color={selectedDistrict ? BrandColors.pink.primary : '#64748B'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownValueText, Boolean(selectedDistrict) && styles.dropdownValueTextActive]}>
                              {selectedDistrict || 'All districts'}
                            </Text>
                            <Text style={styles.dropdownSubText}>Tap to search and select district</Text>
                          </View>
                        </View>
                        <View style={styles.dropdownRightIcons}>
                          {selectedDistrict ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedDistrict('');
                              }}
                              hitSlop={HitSlop.sm}
                              style={styles.dropdownClearBtn}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </Pressable>
                          ) : null}
                          <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Village / Area */}
                    <View style={styles.dropdownField}>
                      <Text style={styles.filterSectionTitle}>Village / Area</Text>
                      <TouchableOpacity
                        style={[styles.dropdownTriggerBox, Boolean(selectedVillage) && styles.dropdownTriggerBoxActive]}
                        onPress={() => {
                          setActivePicker('village');
                          setPickerSearch('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Village / Area: ${selectedVillage || 'All villages'}`}
                      >
                        <View style={styles.dropdownTriggerLeft}>
                          <View style={[styles.dropdownIconBox, Boolean(selectedVillage) && styles.dropdownIconBoxActive]}>
                            <Ionicons
                              name="home-outline"
                              size={18}
                              color={selectedVillage ? BrandColors.pink.primary : '#64748B'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownValueText, Boolean(selectedVillage) && styles.dropdownValueTextActive]}>
                              {selectedVillage || 'All villages'}
                            </Text>
                            <Text style={styles.dropdownSubText}>Tap to search or enter village name</Text>
                          </View>
                        </View>
                        <View style={styles.dropdownRightIcons}>
                          {selectedVillage ? (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedVillage('');
                              }}
                              hitSlop={HitSlop.sm}
                              style={styles.dropdownClearBtn}
                            >
                              <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </Pressable>
                          ) : null}
                          <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalBtnRow}>
                    <Button
                      title="Reset All"
                      variant="outline"
                      onPress={resetFilters}
                      style={{ flex: 1, marginRight: Spacing.sm }}
                    />
                    <Button
                      title="Apply Filters"
                      variant="admin"
                      onPress={() => {
                        setFiltersOpen(false);
                        loadData();
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Slide-out Mobile Navigation Drawer / Sidebar */}
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
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  errorAlertCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  errorAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorIconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  errorAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorAlertDesc: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTriggerCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  filterTriggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterMainTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterMainSub: {
    ...Typography.caption,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
  },
  filterToggleText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterCountBadge: {
    backgroundColor: BrandColors.pink.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  clearAllText: {
    ...Typography.caption,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  activeChipsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
    paddingTop: 4,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: BrandColors.pink.subtle,
    marginRight: 6,
  },
  activeChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: BrandColors.pink.dark,
    fontWeight: '600',
  },
  approvalAlertCard: {
    marginBottom: Spacing.lg,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  approvalAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  approvalAlertTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: '#92400E',
  },
  approvalAlertDesc: {
    ...Typography.caption,
    color: '#B45309',
  },
  sectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  sectionSubheading: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  metricsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  viewAllActionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.subtle,
  },
  viewAllActionsText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
    color: BrandColors.pink.dark,
  },

  // Actions Hub Hero Card
  actionsHubCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  actionsHubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  actionsHubIconBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  actionsHubTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  actionsHubTitle: {
    ...Typography.title,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  actionsHubDesc: {
    ...Typography.body,
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  hubMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  hubMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hubMetricChipAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  hubMetricText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  openCommandCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.pink.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  openCommandCenterBtnText: {
    ...Typography.label,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 4 Priority Quick Launch Grid
  quickLaunchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickLaunchCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm + 2,
    ...Shadows.sm,
  },
  quickLaunchCardAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
  },
  quickLaunchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  quickLaunchIconBox: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLaunchTitle: {
    ...Typography.label,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginTop: 2,
  },
  quickLaunchSub: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },

  actionsCol: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.xs,
  },
  filterSectionTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  horizontalChips: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 6,
    marginBottom: 4,
  },
  filterChipActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customDateRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    height: 42,
  },
  dateInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  filterEmptyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 4,
  },
  filterEmptyNoticeText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#64748B',
  },
  dropdownsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  dropdownField: {
    marginBottom: 2,
  },
  dropdownTriggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownTriggerBoxActive: {
    backgroundColor: '#FFF1F2',
    borderColor: BrandColors.pink.primary,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  dropdownIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownIconBoxActive: {
    backgroundColor: '#FFE4E6',
  },
  dropdownValueText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownValueTextActive: {
    color: BrandColors.pink.dark,
    fontWeight: '700',
  },
  dropdownSubText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  dropdownRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownClearBtn: {
    padding: 2,
  },
  pickerContainer: {
    flex: 1,
    paddingBottom: 20,
    minHeight: 380,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  pickerBackText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pickerHeaderTitle: {
    ...Typography.title,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerResetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pickerResetText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: BrandColors.pink.dark,
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerSearchInput: {
    flex: 1,
    marginLeft: 8,
    ...Typography.body,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  pickerListContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingBottom: 40,
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginVertical: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pickerOptionItemSelected: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  pickerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  pickerOptionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerOptionIconCircleActive: {
    backgroundColor: '#FFE4E6',
  },
  pickerOptionTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  pickerOptionTitleActive: {
    color: BrandColors.pink.dark,
    fontWeight: '700',
  },
  pickerOptionSub: {
    ...Typography.caption,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  pickerEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: Spacing.lg,
  },
  pickerEmptyTitle: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerEmptySub: {
    ...Typography.caption,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
