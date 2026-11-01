import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
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
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type ActionCategory = 'all' | 'finance' | 'governance' | 'stock' | 'field' | 'system';

interface AdminActionItem {
  id: string;
  index: number;
  title: string;
  buttonTitle: string;
  category: ActionCategory;
  categoryLabel: string;
  description: string;
  route: string;
  secondaryRoute?: string;
  secondaryRouteTitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  badgeText: string;
  badgeVariant?: BadgeVariant;
  highlightAlert?: boolean;
  metrics: Array<{ label: string; value: string }>;
  keywords: string[];
}

export default function AdministrativeActionsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const theme = Colors.light;

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>('all');

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await adminApi.getDashboard();
      if (data) {
        setDashboard(data);
      }
    } catch (err) {
      console.warn('Failed to load telemetry for actions page', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch telemetry whenever Actions Hub comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // Real-time synchronization when approvals/rejections happen
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', () => {
      setDashboard((prev) => {
        if (!prev) return prev;
        const current = Number(prev.pendingApprovalsCount || 0);
        return {
          ...prev,
          pendingApprovalsCount: Math.max(0, current - 1),
        };
      });
      loadDashboardData();
    });

    return () => {
      sub.remove();
    };
  }, [loadDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const handleBack = useCallback(() => {
    try {
      (navigation as any).navigate('index');
    } catch {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(admin)' as any);
      }
    }
  }, [navigation, router]);

  const handleNavigateToAction = useCallback(
    (route: string) => {
      const directTabs: Record<string, string> = {
        '/(admin)/reports': 'reports/index',
        '/(admin)/approvals': 'approvals/index',
        '/(admin)/products': 'products/index',
        '/(admin)/invoices': 'invoices/index',
        '/(admin)/sales': 'sales/index',
        '/(admin)/incentives': 'incentives/index',
        '/(admin)/shifts': 'shifts/index',
        '/(admin)/permissions': 'permissions/index',
        '/(admin)/customers': 'customers',
        '/(admin)/users': 'users/index',
        '/(admin)/categories': 'categories/index',
        '/(admin)/settings': 'settings/index',
      };

      const tabName = directTabs[route];
      if (tabName) {
        try {
          (navigation as any).navigate(tabName);
          return;
        } catch {
          // fallback to router
        }
      }
      try {
        router.push(route as any);
      } catch {
        router.navigate(route as any);
      }
    },
    [navigation, router]
  );

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

  const pendingCount = Number(dashboard?.pendingApprovalsCount || 0);
  const totalRevenue = formatRupees(dashboard?.totalRevenuePaise ?? dashboard?.metrics?.totalEarningsPaise ?? 0);
  const totalPackets = formatCount(dashboard?.totalPacketsSold ?? dashboard?.metrics?.totalPacketsSold ?? 0);
  const warehouseStock = formatCount(
    dashboard?.warehouseStockBalance ?? dashboard?.metrics?.warehouseStock ?? dashboard?.metrics?.totalInventory ?? 0
  );
  const totalStores = formatCount(dashboard?.totalCustomers ?? dashboard?.metrics?.totalShops ?? 0);
  const activeSellers = formatCount(dashboard?.activeSellers ?? dashboard?.metrics?.totalSellers ?? 0);

  // 13 Administrative Actions definition with live data bindings
  const actionItems: AdminActionItem[] = useMemo(
    () => [
      // 1. Daily Sales Analytics & Reports
      {
        id: 'reports',
        index: 1,
        title: 'Daily Sales Analytics & Reports',
        buttonTitle: 'Daily Reports & Analytics',
        category: 'finance',
        categoryLabel: 'Financial & Sales',
        description: 'Comprehensive gross revenue trends, turnover charts, and scheduled territory export logs.',
        route: '/(admin)/reports',
        iconName: 'bar-chart-outline',
        iconBg: '#F0F9FF',
        iconColor: '#0284C7',
        badgeText: 'Live Telemetry',
        badgeVariant: 'info',
        metrics: [
          { label: 'Gross Revenue', value: totalRevenue },
          { label: 'Volume Sold', value: `${totalPackets} pkts` },
        ],
        keywords: ['sales', 'reports', 'analytics', 'revenue', 'turnover', 'charts', 'excel', 'export'],
      },
      // 2. Price Approvals Queue
      {
        id: 'approvals',
        index: 2,
        title: 'Price Approvals Queue',
        buttonTitle: 'Price Approvals Queue',
        category: 'governance',
        categoryLabel: 'Governance & Pricing',
        description: 'Authorize or reject sales submitted by field officers below the ₹25.00/pkt mandatory price floor.',
        route: '/(admin)/approvals',
        iconName: 'checkmark-done-circle-outline',
        iconBg: pendingCount > 0 ? '#FEF2F2' : '#ECFDF5',
        iconColor: pendingCount > 0 ? '#DC2626' : '#059669',
        badgeText: pendingCount > 0 ? `${pendingCount} Urgent Reviews` : 'Queue Cleared',
        badgeVariant: pendingCount > 0 ? 'danger' : 'success',
        highlightAlert: pendingCount > 0,
        metrics: [
          { label: 'Pending Queue', value: `${pendingCount} Orders` },
          { label: 'Regulatory Floor', value: '₹25.00 / pkt' },
        ],
        keywords: ['approvals', 'price', 'floor', 'breach', 'discount', 'orders', 'authorize', 'queue'],
      },
      // 3. Product Catalog & SKU Pricing
      {
        id: 'products',
        index: 3,
        title: 'Product Catalog & SKU Pricing',
        buttonTitle: 'Product Catalog & SKUs',
        category: 'stock',
        categoryLabel: 'Catalog & Stock',
        description: 'Manage sanitary napkin SKUs, variant specifications, barcode mappings, and MRP rate cards.',
        route: '/(admin)/products',
        iconName: 'cube-outline',
        iconBg: '#F5F3FF',
        iconColor: '#7C3AED',
        badgeText: 'Active Catalog',
        badgeVariant: 'neutral',
        metrics: [
          { label: 'Base Floor', value: '₹25.00 Base' },
          { label: 'Margin Control', value: 'Wholesale Tier' },
        ],
        keywords: ['products', 'catalog', 'sku', 'pricing', 'napkins', 'mrp', 'wholesale', 'sanitary'],
      },
      // 4. National Invoices Central Directory
      {
        id: 'invoices',
        index: 4,
        title: 'National Invoices Central Directory',
        buttonTitle: 'GST Tax Invoices',
        category: 'finance',
        categoryLabel: 'Financial & Sales',
        description: 'Centralized repository of all B2B and retail GST tax invoices with real-time PDF generation.',
        route: '/(admin)/invoices',
        iconName: 'document-text-outline',
        iconBg: '#EFF6FF',
        iconColor: '#2563EB',
        badgeText: 'GST Compliant',
        badgeVariant: 'info',
        metrics: [
          { label: 'Tax Invoices', value: 'Auto Serialized' },
          { label: 'Dispatch', value: 'Instant PDF' },
        ],
        keywords: ['invoices', 'gst', 'tax', 'bills', 'billing', 'pdf', 'collections', 'records'],
      },
      // 5. National Sales & Order Directory
      {
        id: 'sales',
        index: 5,
        title: 'National Sales & Order Directory',
        buttonTitle: 'Sales Order Directory',
        category: 'finance',
        categoryLabel: 'Financial & Sales',
        description: 'Master ledger of all orders recorded by field officers with line item audit and payment states.',
        route: '/(admin)/sales',
        iconName: 'receipt-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
        badgeText: 'Master Order Ledger',
        badgeVariant: 'neutral',
        metrics: [
          { label: 'Packets Distributed', value: `${totalPackets} units` },
          { label: 'Settlement', value: 'Cash & UPI' },
        ],
        keywords: ['sales', 'orders', 'transactions', 'line items', 'ledger', 'cash', 'upi', 'history'],
      },
      // 6. Commissions & Incentive Disbursements
      {
        id: 'incentives',
        index: 6,
        title: 'Commissions & Incentive Disbursements',
        buttonTitle: 'Incentives & Payouts',
        category: 'finance',
        categoryLabel: 'Financial & Sales',
        description: 'Configure slab multipliers, compute seller target incentives, and approve payroll batches.',
        route: '/(admin)/incentives',
        iconName: 'cash-outline',
        iconBg: BrandColors.green.subtle,
        iconColor: BrandColors.green.primary,
        badgeText: 'Slab Payouts',
        badgeVariant: 'success',
        metrics: [
          { label: 'Commission Rules', value: 'Active Slabs' },
          { label: 'Payroll Batch', value: 'Verified Runs' },
        ],
        keywords: ['incentives', 'commissions', 'payout', 'disbursement', 'slabs', 'bonus', 'payroll'],
      },
      // 7. National Shifts & Field GPS Audit
      {
        id: 'shifts',
        index: 7,
        title: 'National Shifts & Field GPS Audit',
        buttonTitle: 'Field Shifts & GPS Audit',
        category: 'field',
        categoryLabel: 'Field Operations',
        description: 'Monitor on-duty field officers, GPS punch-in geofences, beat itineraries, and daily travel tracks.',
        route: '/(admin)/shifts',
        iconName: 'compass-outline',
        iconBg: '#F0FDFA',
        iconColor: '#0D9488',
        badgeText: `${activeSellers} On Duty`,
        badgeVariant: 'success',
        metrics: [
          { label: 'Active Roster', value: `${activeSellers} Field Reps` },
          { label: 'Tracking Mode', value: 'Live Geofence' },
        ],
        keywords: ['shifts', 'gps', 'location', 'field', 'reps', 'officers', 'attendance', 'beats', 'travel'],
      },
      // 8. Territory Manager Permissions Matrix
      {
        id: 'permissions',
        index: 8,
        title: 'Territory Manager Permissions Matrix',
        buttonTitle: 'Manager Permissions Matrix',
        category: 'governance',
        categoryLabel: 'Governance & Pricing',
        description: 'Granular role-based access control, territorial manager scopes, and supervisor override privileges.',
        route: '/(admin)/permissions',
        iconName: 'shield-checkmark-outline',
        iconBg: '#FFFBEB',
        iconColor: '#D97706',
        badgeText: 'RBAC Tier 1',
        badgeVariant: 'warning',
        metrics: [
          { label: 'Territory Scopes', value: 'State / District' },
          { label: 'Role Authority', value: 'Level 4 Security' },
        ],
        keywords: ['permissions', 'matrix', 'rbac', 'access', 'roles', 'managers', 'security', 'privileges'],
      },
      // 9. Retail Customers & Bulk Onboarding
      {
        id: 'customers',
        index: 9,
        title: 'Retail Customers & Bulk Onboarding',
        buttonTitle: 'Retail Customers Directory',
        category: 'field',
        categoryLabel: 'Field Operations',
        description: 'Directory of registered retail pharmacies and clinics, plus batch CSV upload tool for field launch.',
        route: '/(admin)/customers',
        secondaryRoute: '/(admin)/customers/bulk',
        secondaryRouteTitle: 'Bulk Import CSV',
        iconName: 'storefront-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
        badgeText: `${totalStores} Active Stores`,
        badgeVariant: 'neutral',
        metrics: [
          { label: 'Store Network', value: `${totalStores} Shops` },
          { label: 'Onboarding', value: 'Single & CSV Bulk' },
        ],
        keywords: ['customers', 'stores', 'retailers', 'pharmacies', 'bulk', 'csv', 'onboarding', 'shops'],
      },
      // 10. Inward Factory Stock & Warehouse Transfers
      {
        id: 'inventory',
        index: 10,
        title: 'Inward Factory Stock & Warehouse Transfers',
        buttonTitle: 'Stock Transfers & Inward',
        category: 'stock',
        categoryLabel: 'Catalog & Stock',
        description: 'Receive production shipments from factories and transfer stock to regional depots and sales vans.',
        route: '/(admin)/inventory/transfer',
        secondaryRoute: '/(admin)/inventory',
        secondaryRouteTitle: 'View Balances',
        iconName: 'swap-horizontal-outline',
        iconBg: '#ECFDF5',
        iconColor: '#059669',
        badgeText: `${warehouseStock} Pkts in HQ`,
        badgeVariant: 'success',
        metrics: [
          { label: 'Central Pool', value: `${warehouseStock} Pkts` },
          { label: 'Movement', value: 'Depot & Van Inward' },
        ],
        keywords: ['inventory', 'stock', 'transfers', 'factory', 'warehouse', 'inward', 'depot', 'crates'],
      },
      // 11. Manage Managers & Sellers Directory
      {
        id: 'users',
        index: 11,
        title: 'Manage Managers & Sellers Directory',
        buttonTitle: 'Managers & Field Reps',
        category: 'field',
        categoryLabel: 'Field Operations',
        description: 'User governance for Area Sales Managers and Field Officers: provisioning, states, and credentials.',
        route: '/(admin)/users',
        iconName: 'people-outline',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        badgeText: 'Personnel Roster',
        badgeVariant: 'neutral',
        metrics: [
          { label: 'Field Force', value: `${activeSellers} Active Reps` },
          { label: 'Supervisors', value: 'Territory Managers' },
        ],
        keywords: ['users', 'managers', 'sellers', 'staff', 'employees', 'accounts', 'hierarchy', 'roster'],
      },
      // 12. Customer Categories Configuration
      {
        id: 'categories',
        index: 12,
        title: 'Customer Categories Configuration',
        buttonTitle: 'Customer Categories',
        category: 'system',
        categoryLabel: 'System & Config',
        description: 'Define customer classification tiers (Wholesalers, Pharmacies, NGOs) and channel trade terms.',
        route: '/(admin)/categories',
        iconName: 'pricetags-outline',
        iconBg: '#FFF7ED',
        iconColor: '#EA580C',
        badgeText: 'Channel Tiers',
        badgeVariant: 'neutral',
        metrics: [
          { label: 'Taxonomy', value: 'Segment Rules' },
          { label: 'Margins', value: 'Category Level' },
        ],
        keywords: ['categories', 'customer types', 'channels', 'wholesalers', 'pharmacies', 'margins', 'pricing'],
      },
      // 13. Company Legal & Tax Invoice Settings
      {
        id: 'settings',
        index: 13,
        title: 'Company Legal & Tax Invoice Settings',
        buttonTitle: 'Legal & Company Settings',
        category: 'system',
        categoryLabel: 'System & Config',
        description: 'Configure corporate legal entity names, GSTIN registrations, registered address, and invoice series.',
        route: '/(admin)/settings',
        iconName: 'settings-outline',
        iconBg: '#F1F5F9',
        iconColor: '#475569',
        badgeText: 'Enterprise Core',
        badgeVariant: 'neutral',
        metrics: [
          { label: 'GSTIN Slabs', value: 'Configured' },
          { label: 'Tax Format', value: 'GST Compliance' },
        ],
        keywords: ['settings', 'legal', 'tax', 'gstin', 'company', 'address', 'invoice numbering', 'hsn'],
      },
    ],
    [pendingCount, totalRevenue, totalPackets, warehouseStock, totalStores, activeSellers]
  );

  // Filter actions by category and search query
  const filteredActions = useMemo(() => {
    return actionItems.filter((item) => {
      // Category match
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Search match
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCategory = item.categoryLabel.toLowerCase().includes(query);
        const matchesBadge = item.badgeText.toLowerCase().includes(query);
        const matchesKeyword = item.keywords.some((k) => k.toLowerCase().includes(query));
        return matchesTitle || matchesDesc || matchesCategory || matchesBadge || matchesKeyword;
      }

      return true;
    });
  }, [actionItems, selectedCategory, searchQuery]);

  const categoriesList: Array<{ id: ActionCategory; label: string; count: number }> = [
    { id: 'all', label: 'All Workflows', count: actionItems.length },
    { id: 'finance', label: 'Financial & Sales', count: 4 },
    { id: 'governance', label: 'Governance & Pricing', count: 2 },
    { id: 'stock', label: 'Catalog & Stock', count: 2 },
    { id: 'field', label: 'Field Operations', count: 3 },
    { id: 'system', label: 'System & Config', count: 2 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title="Administrative Actions"
        subtitle={`Command Center • ${filteredActions.length} Modules`}
        showBack
        onBack={handleBack}
        showNotificationBell
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.dark]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Executive Telemetry Strip */}
          <Card style={[styles.kpiSummaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.kpiHeader}>
              <View style={styles.kpiBadge}>
                <Ionicons name="shield-checkmark" size={16} color={BrandColors.pink.dark} />
                <Text style={styles.kpiBadgeText}>HQ OPERATIONS COMMAND</Text>
              </View>
              <Text style={[styles.kpiUserText, { color: theme.textSecondary }]}>
                Super Admin • {user?.name || 'Administrator'}
              </Text>
            </View>

            <View style={styles.kpiMetricsRow}>
              {/* Approval status chip */}
              <TouchableOpacity
                style={[
                  styles.kpiChip,
                  { backgroundColor: pendingCount > 0 ? '#FEF2F2' : theme.surfaceMuted, borderColor: pendingCount > 0 ? '#FECDD3' : theme.border },
                ]}
                onPress={() => handleNavigateToAction('/(admin)/approvals')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={pendingCount > 0 ? 'alert-circle' : 'checkmark-circle'}
                  size={16}
                  color={pendingCount > 0 ? '#DC2626' : '#059669'}
                />
                <Text
                  style={[
                    styles.kpiChipValue,
                    { color: pendingCount > 0 ? '#DC2626' : '#059669' },
                  ]}
                >
                  {pendingCount}
                </Text>
                <Text style={[styles.kpiChipLabel, { color: theme.textSecondary }]}>
                  {pendingCount === 1 ? 'Pending Review' : 'Pending Reviews'}
                </Text>
              </TouchableOpacity>

              {/* Warehouse stock chip */}
              <TouchableOpacity
                style={[styles.kpiChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => handleNavigateToAction('/(admin)/inventory/transfer')}
                activeOpacity={0.8}
              >
                <Ionicons name="cube-outline" size={16} color={BrandColors.green.primary} />
                <Text style={[styles.kpiChipValue, { color: theme.heading }]}>{warehouseStock}</Text>
                <Text style={[styles.kpiChipLabel, { color: theme.textSecondary }]}>Central Pkts</Text>
              </TouchableOpacity>

              {/* Field force chip */}
              <TouchableOpacity
                style={[styles.kpiChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => handleNavigateToAction('/(admin)/shifts')}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={16} color="#0284C7" />
                <Text style={[styles.kpiChipValue, { color: theme.heading }]}>{activeSellers}</Text>
                <Text style={[styles.kpiChipLabel, { color: theme.textSecondary }]}>Reps on Duty</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* 13 Administrative Action Buttons Grid Showcase */}
          <View style={styles.buttonsSectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sectionMainTitle}>All 13 Operational Action Buttons</Text>
                <Badge label="13 READY" variant="ACTIVE" size="sm" />
              </View>
              <Text style={styles.buttonsCountText}>13 Modules</Text>
            </View>
            <Text style={styles.sectionMainSub}>
              Tap any of the 13 command buttons below to immediately open that module or execute jobs.
            </Text>
          </View>

          {/* 13 Action Buttons Grid */}
          <View style={styles.quickButtonsGrid}>
            {actionItems.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickButtonCard,
                  action.highlightAlert && styles.quickButtonCardAlert,
                ]}
                onPress={() => handleNavigateToAction(action.route)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Button ${action.index}: ${action.title}`}
              >
                <View style={styles.quickButtonTop}>
                  <View style={[styles.quickButtonIconBox, { backgroundColor: action.iconBg }]}>
                    <Ionicons name={action.iconName} size={20} color={action.iconColor} />
                  </View>
                  <View style={styles.quickButtonNumBadge}>
                    <Text style={styles.quickButtonNumText}>#{action.index}</Text>
                  </View>
                </View>
                <Text style={styles.quickButtonTitle} numberOfLines={2}>
                  {action.buttonTitle}
                </Text>
                <View style={styles.quickButtonFooter}>
                  <Text style={styles.quickButtonCategory} numberOfLines={1}>
                    {action.categoryLabel}
                  </Text>
                  <Ionicons
                    name="arrow-forward-circle"
                    size={16}
                    color={action.highlightAlert ? '#DC2626' : BrandColors.pink.primary}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Detailed Module Management & Search Section */}
          <View style={styles.actionListHeader}>
            <Text style={styles.sectionMainTitle}>Detailed Module Management & Audit</Text>
            <Text style={styles.sectionMainSub}>
              Search, filter and inspect live records, telemetry, and secondary actions
            </Text>
          </View>

          {/* Interactive Search & Domain Categories Filter */}
          <View style={styles.searchSection}>
            <View style={[styles.searchBarContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={20} color={theme.textPlaceholder} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search 13 admin modules, SKUs, or permissions..."
                placeholderTextColor={theme.textPlaceholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.textPlaceholder} />
                </Pressable>
              ) : null}
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categoriesList.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      isActive && styles.categoryPillActive,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryPillText, { color: theme.textSecondary }, isActive && styles.categoryPillTextActive]}>
                      {cat.label}
                    </Text>
                    <View style={[styles.categoryCountBadge, isActive && styles.categoryCountBadgeActive]}>
                      <Text style={[styles.categoryCountText, { color: theme.textSecondary }, isActive && styles.categoryCountTextActive]}>
                        {cat.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Action Cards List */}
          <View style={styles.actionList}>
            {filteredActions.length === 0 ? (
              <Card style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="search" size={40} color={theme.textPlaceholder} style={{ marginBottom: Spacing.sm }} />
                <Text style={[styles.emptyTitle, { color: theme.heading }]}>No matching administrative modules</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  We could not find any modules matching "{searchQuery}". Try a different keyword or reset filters.
                </Text>
                <TouchableOpacity
                  style={styles.resetSearchBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  <Text style={styles.resetSearchText}>Reset All Filters</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              filteredActions.map((action) => (
                <Card
                  key={action.id}
                  style={[
                    styles.actionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    action.highlightAlert && styles.actionCardHighlight,
                  ]}
                >
                  {/* Top Bar: Icon, Category Pill & Status Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.actionIconContainer, { backgroundColor: action.iconBg }]}>
                        <Ionicons name={action.iconName} size={22} color={action.iconColor} />
                      </View>
                      <View style={styles.cardMeta}>
                        <Text style={[styles.categoryTag, { color: theme.textMuted }]}>
                          BUTTON #{action.index} • {action.categoryLabel.toUpperCase()}
                        </Text>
                        <Text style={[styles.actionTitle, { color: theme.heading }]}>{action.title}</Text>
                      </View>
                    </View>
                    <Badge
                      label={action.badgeText}
                      variant={action.badgeVariant || 'neutral'}
                      size="sm"
                    />
                  </View>

                  {/* Operational Description */}
                  <Text style={[styles.actionDescription, { color: theme.textSecondary }]}>{action.description}</Text>

                  {/* Telemetry Metrics Row */}
                  <View style={[styles.metricsBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
                    {action.metrics.map((metric, idx) => (
                      <View key={idx} style={styles.metricBlock}>
                        <Text style={[styles.metricLabel, { color: theme.textMuted }]}>{metric.label}</Text>
                        <Text style={[styles.metricValue, { color: theme.heading }]}>{metric.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        action.highlightAlert && styles.primaryActionBtnAlert,
                      ]}
                      onPress={() => handleNavigateToAction(action.route)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${action.buttonTitle}`}
                    >
                      <Text style={styles.primaryActionBtnText}>Open {action.buttonTitle}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    {action.secondaryRoute ? (
                      <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => handleNavigateToAction(action.secondaryRoute!)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.secondaryActionBtnText}>
                          {action.secondaryRouteTitle || 'Quick Action'}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={BrandColors.pink.dark}
                          style={{ marginLeft: 2 }}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 40,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },

  // KPI Summary Card
  kpiSummaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  kpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiBadgeText: {
    ...Typography.caption,
    fontWeight: '800',
    fontSize: 10,
    color: BrandColors.pink.dark,
    letterSpacing: 0.5,
  },
  kpiUserText: {
    ...Typography.caption,
    fontSize: 11,
  },
  kpiMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  kpiChip: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  kpiChipAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  kpiChipValue: {
    ...Typography.label,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 2,
  },
  kpiChipLabel: {
    ...Typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },

  // 13 Quick Action Buttons Grid Showcase
  buttonsSectionHeaderRow: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionMainTitle: {
    ...Typography.subtitle,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionMainSub: {
    ...Typography.caption,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  buttonsCountText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  quickButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickButtonCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm + 2,
    ...Shadows.sm,
  },
  quickButtonCardAlert: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFFDFD',
  },
  quickButtonTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickButtonIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonNumBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickButtonNumText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  quickButtonTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
    minHeight: 36,
  },
  quickButtonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickButtonCategory: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    flex: 1,
    marginRight: 4,
  },
  actionListHeader: {
    marginBottom: Spacing.sm,
  },

  // Search & Filter Section
  searchSection: {
    marginBottom: Spacing.md,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm,
    height: 48,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...Typography.body,
    fontSize: 13,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: Spacing.xs,
  },
  categoryPillActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  categoryPillText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryCountBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  categoryCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryCountText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  categoryCountTextActive: {
    color: '#FFFFFF',
  },

  // Action Cards List
  actionList: {
    gap: Spacing.sm,
  },
  actionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  actionCardHighlight: {
    borderColor: '#F87171',
    backgroundColor: '#FFFDFD',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  cardMeta: {
    flex: 1,
  },
  categoryTag: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionTitle: {
    ...Typography.subtitle,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  actionDescription: {
    ...Typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: Spacing.sm,
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },

  // Card Action Buttons
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.pink.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    flex: 1,
  },
  primaryActionBtnAlert: {
    backgroundColor: '#DC2626',
  },
  primaryActionBtnText: {
    ...Typography.label,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F7',
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
  },
  secondaryActionBtnText: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },

  // Empty state
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...Typography.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  resetSearchBtn: {
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  resetSearchText: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
});
