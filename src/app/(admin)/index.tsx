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

  // Filters State
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'this_month' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Available filter options
  const [filterOptions, setFilterOptions] = useState<{
    categories: Array<{ id: string; name: string }>;
    managers: Array<{ id: string; name: string; state?: string; district?: string }>;
    sellers: Array<{ id: string; name: string; managerId?: string; state?: string; district?: string }>;
    states: string[];
    districts: string[];
    villages: string[];
  }>({
    categories: [],
    managers: [],
    sellers: [],
    states: [],
    districts: [],
    villages: [],
  });

  // Load filter options on mount
  useEffect(() => {
    adminApi
      .getDashboardFilters()
      .then((opts) => {
        setFilterOptions({
          categories: Array.isArray(opts.categories) ? opts.categories : [],
          managers: Array.isArray(opts.managers) ? opts.managers : [],
          sellers: Array.isArray(opts.sellers) ? opts.sellers : [],
          states: Array.isArray(opts.states) && opts.states.length > 0
            ? opts.states
            : ['Maharashtra', 'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Rajasthan'],
          districts: Array.isArray(opts.districts) && opts.districts.length > 0
            ? opts.districts
            : ['Thane', 'Mumbai', 'Varanasi', 'Indore', 'Bhopal', 'Patna', 'Jaipur'],
          villages: Array.isArray(opts.villages) && opts.villages.length > 0
            ? opts.villages
            : ['Diva', 'Shivpur', 'Cantonment', 'Indore City', 'Kolar'],
        });
      })
      .catch(() => {});
  }, []);

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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedState) count++;
    if (selectedDistrict) count++;
    if (selectedVillage) count++;
    if (selectedManagerId) count++;
    if (selectedSellerId) count++;
    if (selectedCategoryId) count++;
    if (datePreset !== 'all') count++;
    return count;
  }, [
    selectedState,
    selectedDistrict,
    selectedVillage,
    selectedManagerId,
    selectedSellerId,
    selectedCategoryId,
    datePreset,
  ]);

  const resetFilters = () => {
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedVillage('');
    setSelectedManagerId('');
    setSelectedSellerId('');
    setSelectedCategoryId('');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
  };

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const params = {
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        village: selectedVillage || undefined,
        managerId: selectedManagerId || undefined,
        sellerId: selectedSellerId || undefined,
        categoryId: selectedCategoryId || undefined,
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
    selectedManagerId,
    selectedSellerId,
    selectedCategoryId,
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
          {/* National Governance Banner */}
          <Card style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <View style={styles.bannerInfo}>
                <View style={styles.bannerTitleRow}>
                  <View style={styles.bannerIconBadge}>
                    <Ionicons name="shield-checkmark" size={18} color={BrandColors.pink.dark} />
                  </View>
                  <Text style={styles.bannerTitle}>Admin Center</Text>
                </View>
                <Text style={styles.bannerSub}>Manage Warehouses, Team & Stock</Text>
              </View>
              <Badge label="ADMIN" variant="ACTIVE" />
            </View>
          </Card>

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
                  <Text style={styles.filterMainTitle}>Territory & Scope Filters</Text>
                  {activeFiltersCount > 0 ? (
                    <View style={styles.filterCountBadge}>
                      <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.filterMainSub}>
                  Filter live operational metrics by geographic hierarchy and category
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
                  accessibilityLabel="Open Territory & Scope Filters"
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
                {selectedManagerId ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      Manager: {filterOptions.managers.find((m) => m.id === selectedManagerId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedManagerId('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {selectedSellerId ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      Field Officer: {filterOptions.sellers.find((s) => s.id === selectedSellerId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedSellerId('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
                {selectedCategoryId ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      Category: {filterOptions.categories.find((c) => c.id === selectedCategoryId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedCategoryId('')}>
                      <Ionicons name="close-circle" size={14} color="#64748B" />
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
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

          {/* Administration Actions Section Header */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Quick Actions</Text>
              <Text style={styles.sectionSubheading}>Manage All Operations</Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllActionsBtn}
              onPress={handleOpenActionsHub}
              accessibilityRole="button"
              accessibilityLabel="View All 13 Administrative Modules"
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllActionsText}>View All (13)</Text>
              <Ionicons name="arrow-forward" size={14} color={BrandColors.pink.dark} />
            </TouchableOpacity>
          </View>

          {/* Master Operations Command Hub Card */}
          <Card style={styles.actionsHubCard}>
            <View style={styles.actionsHubHeader}>
              <View style={styles.actionsHubIconBadge}>
                <Ionicons name="grid" size={22} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.actionsHubTitleRow}>
                  <Text style={styles.actionsHubTitle}>All Admin Features</Text>
                  <Badge label="13 SECTIONS" variant="ACTIVE" size="sm" />
                </View>
                <Text style={styles.actionsHubDesc}>
                  Manage stock transfers, price approvals, seller shifts, shops, and reports.
                </Text>
              </View>
            </View>

            {/* Quick Metrics Bar inside Hub Card */}
            <View style={styles.hubMetricsRow}>
              <View style={[styles.hubMetricChip, pendingCount > 0 && styles.hubMetricChipAlert]}>
                <Ionicons
                  name={pendingCount > 0 ? 'alert-circle' : 'checkmark-circle'}
                  size={14}
                  color={pendingCount > 0 ? '#DC2626' : '#059669'}
                />
                <Text style={[styles.hubMetricText, pendingCount > 0 && { color: '#DC2626' }]}>
                  {pendingCount > 0 ? `${pendingCount} Waiting Approvals` : 'All Approved'}
                </Text>
              </View>

              <View style={styles.hubMetricChip}>
                <Ionicons name="cube-outline" size={14} color={BrandColors.green.primary} />
                <Text style={styles.hubMetricText}>
                  {formatCount(dashboard?.warehouseStockBalance ?? 0)} HQ Packets
                </Text>
              </View>

              <View style={styles.hubMetricChip}>
                <Ionicons name="people-outline" size={14} color="#0284C7" />
                <Text style={styles.hubMetricText}>
                  {formatCount(dashboard?.activeSellers ?? 0)} Sellers Active
                </Text>
              </View>
            </View>

            {/* Primary Action Button to Open Dedicated Actions Page */}
            <TouchableOpacity
              style={styles.openCommandCenterBtn}
              onPress={handleOpenActionsHub}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View All Features & Settings"
            >
              <Ionicons name="apps" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.openCommandCenterBtnText}>View All Features &amp; Settings</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </Card>

          {/* Quick-Launch 4 Priority Cards Grid */}
          <View style={styles.quickLaunchGrid}>
            {/* 1. Approvals Queue */}
            <TouchableOpacity
              style={[
                styles.quickLaunchCard,
                pendingCount > 0 && styles.quickLaunchCardAlert,
              ]}
              onPress={() => router.push('/(admin)/approvals' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickLaunchCardTop}>
                <View
                  style={[
                    styles.quickLaunchIconBox,
                    { backgroundColor: pendingCount > 0 ? '#FEF2F2' : '#ECFDF5' },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-circle"
                    size={20}
                    color={pendingCount > 0 ? '#DC2626' : '#059669'}
                  />
                </View>
                <Badge
                  label={pendingCount > 0 ? `${pendingCount} Pending` : 'Clear'}
                  variant={pendingCount > 0 ? 'danger' : 'success'}
                  size="sm"
                />
              </View>
              <Text style={styles.quickLaunchTitle}>Price Approvals</Text>
              <Text style={styles.quickLaunchSub}>Authorize orders below ₹25 floor</Text>
            </TouchableOpacity>

            {/* 2. Sales Analytics */}
            <TouchableOpacity
              style={styles.quickLaunchCard}
              onPress={() => router.push('/(admin)/reports' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickLaunchCardTop}>
                <View style={[styles.quickLaunchIconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="bar-chart" size={20} color="#0284C7" />
                </View>
                <Badge label="Analytics" variant="info" size="sm" />
              </View>
              <Text style={styles.quickLaunchTitle}>Sales Analytics</Text>
              <Text style={styles.quickLaunchSub}>Daily revenue & volume trends</Text>
            </TouchableOpacity>

            {/* 3. Warehouse Transfers */}
            <TouchableOpacity
              style={styles.quickLaunchCard}
              onPress={() => router.push('/(admin)/inventory/transfer' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickLaunchCardTop}>
                <View style={[styles.quickLaunchIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="swap-horizontal" size={20} color={BrandColors.green.primary} />
                </View>
                <Badge label="Inward" variant="success" size="sm" />
              </View>
              <Text style={styles.quickLaunchTitle}>Stock Transfers</Text>
              <Text style={styles.quickLaunchSub}>Factory inward & van dispatches</Text>
            </TouchableOpacity>

            {/* 4. Shifts & GPS */}
            <TouchableOpacity
              style={styles.quickLaunchCard}
              onPress={() => router.push('/(admin)/shifts' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickLaunchCardTop}>
                <View style={[styles.quickLaunchIconBox, { backgroundColor: '#F0FDFA' }]}>
                  <Ionicons name="compass" size={20} color="#0D9488" />
                </View>
                <Badge label="Field Live" variant="neutral" size="sm" />
              </View>
              <Text style={styles.quickLaunchTitle}>Shifts & GPS Audit</Text>
              <Text style={styles.quickLaunchSub}>Field rep beats & punch-ins</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Comprehensive Filter Modal */}
      <Modal
        visible={filtersOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setFiltersOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setFiltersOpen(false)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Territory & Scope Filters</Text>
                <Text style={styles.modalSub}>Filter live operational metrics by geographic hierarchy and category</Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>To:</Text>
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

              {/* State */}
              <Text style={styles.filterSectionTitle}>State</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedState && styles.filterChipActive]}
                  onPress={() => setSelectedState('')}
                >
                  <Text style={[styles.filterChipText, !selectedState && styles.filterChipTextActive]}>
                    All states
                  </Text>
                </TouchableOpacity>
                {filterOptions.states.map((st, idx) => {
                  const stateName = typeof st === 'string' ? st : (st as any)?.state || '';
                  if (!stateName) return null;
                  const isSelected = selectedState === stateName;
                  return (
                    <TouchableOpacity
                      key={`st-${stateName}-${idx}`}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedState(isSelected ? '' : stateName)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {stateName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* District */}
              <Text style={styles.filterSectionTitle}>District</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedDistrict && styles.filterChipActive]}
                  onPress={() => setSelectedDistrict('')}
                >
                  <Text style={[styles.filterChipText, !selectedDistrict && styles.filterChipTextActive]}>
                    All districts
                  </Text>
                </TouchableOpacity>
                {filterOptions.districts.map((dst, idx) => {
                  const districtName = typeof dst === 'string' ? dst : (dst as any)?.district || '';
                  if (!districtName) return null;
                  const isSelected = selectedDistrict === districtName;
                  return (
                    <TouchableOpacity
                      key={`dst-${districtName}-${idx}`}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedDistrict(isSelected ? '' : districtName)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {districtName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Village / Area */}
              <Text style={styles.filterSectionTitle}>Village / Area</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="All villages"
                placeholderTextColor="#94A3B8"
                value={selectedVillage}
                onChangeText={setSelectedVillage}
              />
              {filterOptions.villages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.horizontalChips, { marginTop: 6 }]}>
                  <TouchableOpacity
                    style={[styles.filterChip, !selectedVillage && styles.filterChipActive]}
                    onPress={() => setSelectedVillage('')}
                  >
                    <Text style={[styles.filterChipText, !selectedVillage && styles.filterChipTextActive]}>
                      All villages
                    </Text>
                  </TouchableOpacity>
                  {filterOptions.villages.map((v, idx) => {
                    const isSelected = selectedVillage.toLowerCase() === v.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`v-${v}-${idx}`}
                        style={[styles.filterChip, isSelected && styles.filterChipActive]}
                        onPress={() => setSelectedVillage(isSelected ? '' : v)}
                      >
                        <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                          {v}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Manager */}
              <Text style={styles.filterSectionTitle}>Manager</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedManagerId && styles.filterChipActive]}
                  onPress={() => setSelectedManagerId('')}
                >
                  <Text style={[styles.filterChipText, !selectedManagerId && styles.filterChipTextActive]}>
                    All managers
                  </Text>
                </TouchableOpacity>
                {filterOptions.managers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.filterChip, selectedManagerId === m.id && styles.filterChipActive]}
                    onPress={() => setSelectedManagerId(selectedManagerId === m.id ? '' : m.id)}
                  >
                    <Text style={[styles.filterChipText, selectedManagerId === m.id && styles.filterChipTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Field Officer */}
              <Text style={styles.filterSectionTitle}>Field Officer</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedSellerId && styles.filterChipActive]}
                  onPress={() => setSelectedSellerId('')}
                >
                  <Text style={[styles.filterChipText, !selectedSellerId && styles.filterChipTextActive]}>
                    All field officers
                  </Text>
                </TouchableOpacity>
                {filterOptions.sellers.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.filterChip, selectedSellerId === s.id && styles.filterChipActive]}
                    onPress={() => setSelectedSellerId(selectedSellerId === s.id ? '' : s.id)}
                  >
                    <Text style={[styles.filterChipText, selectedSellerId === s.id && styles.filterChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category */}
              <Text style={styles.filterSectionTitle}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedCategoryId && styles.filterChipActive]}
                  onPress={() => setSelectedCategoryId('')}
                >
                  <Text style={[styles.filterChipText, !selectedCategoryId && styles.filterChipTextActive]}>
                    All categories
                  </Text>
                </TouchableOpacity>
                {filterOptions.categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.filterChip, selectedCategoryId === c.id && styles.filterChipActive]}
                    onPress={() => setSelectedCategoryId(selectedCategoryId === c.id ? '' : c.id)}
                  >
                    <Text style={[styles.filterChipText, selectedCategoryId === c.id && styles.filterChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  bannerCard: {
    marginBottom: Spacing.md,
    backgroundColor: BrandColors.pink.surface,
    borderColor: BrandColors.pink.subtle,
    overflow: 'hidden',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerIconBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bannerTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
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
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickLaunchCard: {
    width: '48.5%',
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
    marginBottom: 2,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 13,
    color: Colors.light.text,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
});
