import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
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
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
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
    adminApi.getDashboardFilters().then((opts) => {
      setFilterOptions({
        categories: opts.categories || [],
        managers: opts.managers || [],
        sellers: opts.sellers || [],
        states: opts.states || ['Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Rajasthan'],
        districts: opts.districts || ['Varanasi', 'Indore', 'Bhopal', 'Patna', 'Jaipur'],
        villages: opts.villages || ['Shivpur', 'Cantonment', 'Indore City', 'Kolar'],
      });
    }).catch(() => {});
  }, []);

  // Compute active date boundaries
  const dateRange = useMemo(() => {
    const now = new Date();
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
    if (datePreset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? new Date(customTo).toISOString() : undefined,
      };
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

      const res = await adminApi.getDashboard(params).catch(() => ({
        totalRevenuePaise: 0,
        totalPacketsSold: 0,
        totalCustomers: 0,
        activeSellers: 0,
        pendingApprovalsCount: 0,
        warehouseStockBalance: 0,
      }));
      setDashboard(res);
    } catch (err) {
      console.warn('Admin dashboard error', err);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const pendingCount = dashboard?.pendingApprovalsCount || 0;

  return (
    <View style={styles.container}>
      <Header
        title="Executive Overview"
        subtitle={`Super Admin • ${user?.name || 'Administrator'}`}
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
                  <Text style={styles.bannerTitle}>National Distribution Control</Text>
                </View>
                <Text style={styles.bannerSub}>HQ Operations, Warehouses & Role Hierarchy</Text>
              </View>
              <Badge label="SUPER ADMIN" variant="ACTIVE" />
            </View>
          </Card>

          {/* Filter Bar Trigger & Active Filters Strip */}
          <Card style={styles.filterTriggerCard}>
            <View style={styles.filterTriggerHeader}>
              <TouchableOpacity
                style={styles.filterToggleBtn}
                onPress={() => setFiltersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open Operations Filters"
              >
                <Ionicons name="options-outline" size={18} color="#0F172A" />
                <Text style={styles.filterToggleText}>Filter Operations</Text>
                {activeFiltersCount > 0 ? (
                  <View style={styles.filterCountBadge}>
                    <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              {activeFiltersCount > 0 ? (
                <TouchableOpacity onPress={resetFilters} style={styles.clearAllBtn}>
                  <Ionicons name="refresh-outline" size={14} color={BrandColors.pink.dark} />
                  <Text style={styles.clearAllText}>Reset Filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Active Filter Chips Strip */}
            {activeFiltersCount > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipsRow}>
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
                    <Text style={styles.activeChipText}>Village: {selectedVillage}</Text>
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
                      Officer: {filterOptions.sellers.find((s) => s.id === selectedSellerId)?.name || 'Selected'}
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
                {datePreset !== 'all' ? (
                  <View style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      Period: {datePreset.toUpperCase()}
                    </Text>
                    <Pressable onPress={() => setDatePreset('all')}>
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
                      {pendingCount} Below-Minimum Price {pendingCount === 1 ? 'Sale' : 'Sales'} Pending
                    </Text>
                  </View>
                  <Text style={styles.approvalAlertDesc}>
                    Orders below ₹25.00/pkt threshold are blocked from stock deduction and invoicing until authorized.
                  </Text>
                </View>
                <Button
                  title="Review Queue"
                  size="sm"
                  variant="admin"
                  onPress={() => router.push('/(admin)/approvals' as any)}
                />
              </View>
            </Card>
          ) : null}

          {/* Metrics Grid */}
          <Text style={styles.sectionHeading}>
            National Operations Metrics {activeFiltersCount > 0 ? `(Filtered: ${activeFiltersCount})` : ''}
          </Text>
          {loading ? (
            <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricHalf}>
                <StatCard
                  title="Total Revenue"
                  value={formatRupees(dashboard?.totalRevenuePaise || dashboard?.metrics?.totalEarningsPaise || 0)}
                  subtitle="Confirmed gross receipts"
                  icon="wallet-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Packets Sold"
                  value={(dashboard?.totalPacketsSold || dashboard?.metrics?.totalPacketsSold || 0).toLocaleString()}
                  subtitle="Sanitary napkins sold"
                  icon="cube-outline"
                  iconColor="#0284C7"
                  iconBg="#F0F9FF"
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="HQ Warehouse Stock"
                  value={`${(dashboard?.warehouseStockBalance || dashboard?.metrics?.warehouseStock || 0).toLocaleString()} pkts`}
                  subtitle="Central inventory pool"
                  icon="business-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                  accentColor={BrandColors.green.primary}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Customer Network"
                  value={(dashboard?.totalCustomers || dashboard?.metrics?.totalShops || 0).toLocaleString()}
                  subtitle="Active retail stores"
                  icon="storefront-outline"
                  iconColor={BrandColors.pink.primary}
                  iconBg={BrandColors.pink.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Active Field Force"
                  value={(dashboard?.activeSellers || dashboard?.metrics?.totalSellers || 0).toLocaleString()}
                  subtitle="Officers on duty"
                  icon="people-outline"
                  iconColor={BrandColors.green.primary}
                  iconBg={BrandColors.green.subtle}
                />
              </View>

              <View style={styles.metricHalf}>
                <StatCard
                  title="Price Approvals"
                  value={String(pendingCount)}
                  subtitle={pendingCount > 0 ? 'Action required' : 'Queue cleared'}
                  icon="hourglass-outline"
                  iconColor={pendingCount > 0 ? Colors.light.warning : Colors.light.textTertiary}
                  iconBg={pendingCount > 0 ? Colors.light.warningBg : '#F1F5F9'}
                  accentColor={pendingCount > 0 ? Colors.light.warning : undefined}
                />
              </View>
            </View>
          )}

          {/* Administration Actions */}
          <Text style={styles.sectionHeading}>Administrative Actions</Text>
          <View style={styles.actionsCol}>
            <Button
              title="Daily Sales Analytics & Reports"
              variant="outline-admin"
              size="lg"
              icon={<Ionicons name="bar-chart-outline" size={20} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/reports' as any)}
            />
            <Button
              title="Price Approvals Queue"
              variant="admin"
              size="lg"
              icon={<Ionicons name="checkmark-done-circle-outline" size={20} color="#FFFFFF" />}
              onPress={() => router.push('/(admin)/approvals' as any)}
            />
            <Button
              title="Product Catalog & SKU Pricing"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="cube-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/products' as any)}
            />
            <Button
              title="National Invoices Central Directory"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="document-text-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/invoices' as any)}
            />
            <Button
              title="National Sales & Order Directory"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="receipt-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/sales' as any)}
            />
            <Button
              title="Commissions & Incentive Disbursements"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="cash-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/incentives' as any)}
            />
            <Button
              title="National Shifts & Field GPS Audit"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="compass-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/shifts' as any)}
            />
            <Button
              title="Territory Manager Permissions Matrix"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="shield-checkmark-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/permissions' as any)}
            />
            <Button
              title="Retail Customers & Bulk Onboarding"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="storefront-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/customers' as any)}
            />
            <Button
              title="Inward Factory Stock & Warehouse Transfers"
              variant="secondary"
              size="md"
              icon={<Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />}
              onPress={() => router.push('/(admin)/inventory/transfer' as any)}
            />
            <Button
              title="Manage Managers & Sellers Directory"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="people-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/users' as any)}
            />
            <Button
              title="Customer Categories Configuration"
              variant="outline-admin"
              size="md"
              icon={<Ionicons name="pricetags-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/categories' as any)}
            />
            <Button
              title="Company Legal & Tax Invoice Settings"
              variant="ghost"
              size="md"
              textStyle={{ color: BrandColors.pink.dark }}
              icon={<Ionicons name="settings-outline" size={18} color={BrandColors.pink.dark} />}
              onPress={() => router.push('/(admin)/settings' as any)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Comprehensive Filter Modal */}
      <Modal visible={filtersOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Filter Dashboard Operations</Text>
                <Text style={styles.modalSub}>Target specific territories, field officers and dates</Text>
              </View>
              <Pressable onPress={() => setFiltersOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Date Presets */}
              <Text style={styles.filterSectionTitle}>Period</Text>
              <View style={styles.chipGrid}>
                {(
                  [
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7days', label: 'Last 7 Days' },
                    { id: '30days', label: 'Last 30 Days' },
                    { id: 'custom', label: 'Custom' },
                  ] as const
                ).map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.filterChip, datePreset === d.id && styles.filterChipActive]}
                    onPress={() => setDatePreset(d.id)}
                  >
                    <Text style={[styles.filterChipText, datePreset === d.id && styles.filterChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {datePreset === 'custom' ? (
                <View style={styles.customDateRow}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={styles.inputLabel}>From Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="2026-10-01"
                      value={customFrom}
                      onChangeText={setCustomFrom}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>To Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="2026-10-31"
                      value={customTo}
                      onChangeText={setCustomTo}
                    />
                  </View>
                </View>
              ) : null}

              {/* State */}
              <Text style={styles.filterSectionTitle}>State</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedState && styles.filterChipActive]}
                  onPress={() => setSelectedState('')}
                >
                  <Text style={[styles.filterChipText, !selectedState && styles.filterChipTextActive]}>
                    All States
                  </Text>
                </TouchableOpacity>
                {filterOptions.states.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.filterChip, selectedState === st && styles.filterChipActive]}
                    onPress={() => setSelectedState(selectedState === st ? '' : st)}
                  >
                    <Text style={[styles.filterChipText, selectedState === st && styles.filterChipTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* District */}
              <Text style={styles.filterSectionTitle}>District</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedDistrict && styles.filterChipActive]}
                  onPress={() => setSelectedDistrict('')}
                >
                  <Text style={[styles.filterChipText, !selectedDistrict && styles.filterChipTextActive]}>
                    All Districts
                  </Text>
                </TouchableOpacity>
                {filterOptions.districts.map((dst) => (
                  <TouchableOpacity
                    key={dst}
                    style={[styles.filterChip, selectedDistrict === dst && styles.filterChipActive]}
                    onPress={() => setSelectedDistrict(selectedDistrict === dst ? '' : dst)}
                  >
                    <Text style={[styles.filterChipText, selectedDistrict === dst && styles.filterChipTextActive]}>
                      {dst}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Village */}
              <Text style={styles.filterSectionTitle}>Village / Cluster</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="Filter by village name (e.g. Shivpur)..."
                value={selectedVillage}
                onChangeText={setSelectedVillage}
              />

              {/* Territory Manager */}
              <Text style={styles.filterSectionTitle}>Territory Manager</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedManagerId && styles.filterChipActive]}
                  onPress={() => setSelectedManagerId('')}
                >
                  <Text style={[styles.filterChipText, !selectedManagerId && styles.filterChipTextActive]}>
                    All Managers
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

              {/* Field Officer / Seller */}
              <Text style={styles.filterSectionTitle}>Field Officer</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedSellerId && styles.filterChipActive]}
                  onPress={() => setSelectedSellerId('')}
                >
                  <Text style={[styles.filterChipText, !selectedSellerId && styles.filterChipTextActive]}>
                    All Officers
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
              <Text style={styles.filterSectionTitle}>Retail Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                <TouchableOpacity
                  style={[styles.filterChip, !selectedCategoryId && styles.filterChipActive]}
                  onPress={() => setSelectedCategoryId('')}
                >
                  <Text style={[styles.filterChipText, !selectedCategoryId && styles.filterChipTextActive]}>
                    All Categories
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
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
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
  filterTriggerCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterTriggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  metricHalf: {
    flex: 1,
    minWidth: 150,
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
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
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
