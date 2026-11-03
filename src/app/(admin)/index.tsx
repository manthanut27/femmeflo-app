import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
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
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  DropdownOption,
  SearchableDropdownModal,
} from '@/components/ui/SearchableDropdownModal';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type ActiveDropdownType =
  | 'state'
  | 'district'
  | 'village'
  | 'manager'
  | 'seller'
  | 'category'
  | null;

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Applied Filters State (active on dashboard)
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Filter Dialog Modal Visibility & Draft State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [draftDistrict, setDraftDistrict] = useState('');
  const [draftVillage, setDraftVillage] = useState('');
  const [draftManagerId, setDraftManagerId] = useState('');
  const [draftSellerId, setDraftSellerId] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');

  // Active dropdown modal selector for pickers
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownType>(null);

  // Available filter options loaded from backend (with comprehensive defaults matching web)
  const [filterOptions, setFilterOptions] = useState<{
    categories: Array<{ id: string; name: string }>;
    managers: Array<{ id: string; name: string; state?: string | null; district?: string | null }>;
    sellers: Array<{ id: string; name: string; managerId?: string | null; state?: string | null; district?: string | null }>;
    states: string[];
    districts: string[];
    villages: string[];
    rawDistricts?: Array<{ state: string; district: string } | string>;
    rawVillages?: Array<{ state: string; district: string; village: string } | string>;
  }>({
    categories: [
      { id: 'cat_01', name: 'Sanitary Pads' },
      { id: 'cat_02', name: 'Intimate Care' },
      { id: 'cat_03', name: 'Wellness & Nutrition' },
    ],
    managers: [
      { id: 'usr_manager_01', name: 'Rajesh Kumar', state: 'Madhya Pradesh', district: 'Indore' },
      { id: 'usr_manager_02', name: 'Sunil Verma', state: 'Madhya Pradesh', district: 'Bhopal' },
      { id: 'usr_manager_03', name: 'Meenakshi Iyer', state: 'Maharashtra', district: 'Nagpur' },
    ],
    sellers: [
      { id: 'usr_seller_01', name: 'Pooja Sharma', managerId: 'usr_manager_01', state: 'Madhya Pradesh', district: 'Indore' },
      { id: 'usr_seller_02', name: 'Kavita Patel', managerId: 'usr_manager_01', state: 'Madhya Pradesh', district: 'Indore' },
      { id: 'usr_seller_03', name: 'Aakash Solanki', managerId: 'usr_manager_01', state: 'Madhya Pradesh', district: 'Indore' },
      { id: 'usr_seller_04', name: 'Deepika Rathore', managerId: 'usr_manager_02', state: 'Madhya Pradesh', district: 'Bhopal' },
    ],
    states: ['Bihar', 'Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh'],
    districts: ['Bhopal', 'Indore', 'Jaipur', 'Mumbai', 'Nagpur', 'Patna', 'Thane', 'Varanasi'],
    villages: ['Andheri', 'Cantonment', 'Diva', 'Indore City', 'Kolar', 'Mhow', 'Rau', 'Sanwer', 'Sehore', 'Shivpur'],
    rawDistricts: [
      { state: 'Madhya Pradesh', district: 'Indore' },
      { state: 'Madhya Pradesh', district: 'Bhopal' },
      { state: 'Maharashtra', district: 'Thane' },
      { state: 'Maharashtra', district: 'Mumbai' },
      { state: 'Maharashtra', district: 'Nagpur' },
      { state: 'Uttar Pradesh', district: 'Varanasi' },
      { state: 'Bihar', district: 'Patna' },
      { state: 'Rajasthan', district: 'Jaipur' },
    ],
    rawVillages: [
      { state: 'Madhya Pradesh', district: 'Indore', village: 'Indore City' },
      { state: 'Madhya Pradesh', district: 'Indore', village: 'Rau' },
      { state: 'Madhya Pradesh', district: 'Indore', village: 'Mhow' },
      { state: 'Madhya Pradesh', district: 'Indore', village: 'Sanwer' },
      { state: 'Madhya Pradesh', district: 'Bhopal', village: 'Kolar' },
      { state: 'Madhya Pradesh', district: 'Bhopal', village: 'Sehore' },
      { state: 'Maharashtra', district: 'Thane', village: 'Diva' },
      { state: 'Maharashtra', district: 'Mumbai', village: 'Andheri' },
      { state: 'Uttar Pradesh', district: 'Varanasi', village: 'Shivpur' },
      { state: 'Uttar Pradesh', district: 'Varanasi', village: 'Cantonment' },
    ],
  });

  // Load filter options on mount
  useEffect(() => {
    adminApi
      .getDashboardFilters()
      .then((opts) => {
        if (!opts) return;
        setFilterOptions((prev) => ({
          categories: Array.isArray(opts.categories) && opts.categories.length > 0 ? opts.categories : prev.categories,
          managers: Array.isArray(opts.managers) && opts.managers.length > 0 ? opts.managers : prev.managers,
          sellers: Array.isArray(opts.sellers) && opts.sellers.length > 0 ? opts.sellers : prev.sellers,
          states: Array.isArray(opts.states) && opts.states.length > 0 ? opts.states : prev.states,
          districts: Array.isArray(opts.districts) && opts.districts.length > 0 ? opts.districts : prev.districts,
          villages: Array.isArray(opts.villages) && opts.villages.length > 0 ? opts.villages : prev.villages,
          rawDistricts: opts.rawDistricts && opts.rawDistricts.length > 0 ? opts.rawDistricts : prev.rawDistricts,
          rawVillages: opts.rawVillages && opts.rawVillages.length > 0 ? opts.rawVillages : prev.rawVillages,
        }));
      })
      .catch(() => {});
  }, []);

  // Date preset detection helpers (matching web)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);

  // Draft preset detection (for inside filter dialog)
  const activeDraftPreset = useMemo(() => {
    if (!draftFromDate || !draftToDate) return null;
    if (draftFromDate === todayStr && draftToDate === todayStr) return 'today';
    if (draftFromDate === sevenDaysAgoStr && draftToDate === todayStr) return '7days';
    if (draftFromDate === thirtyDaysAgoStr && draftToDate === todayStr) return '30days';
    if (draftFromDate === monthStartStr && draftToDate === todayStr) return 'month';
    return 'custom';
  }, [draftFromDate, draftToDate, todayStr, sevenDaysAgoStr, thirtyDaysAgoStr, monthStartStr]);

  // Open filter modal and synchronize draft state from applied state
  const handleOpenFilterModal = useCallback(() => {
    setDraftState(selectedState);
    setDraftDistrict(selectedDistrict);
    setDraftVillage(selectedVillage);
    setDraftManagerId(selectedManagerId);
    setDraftSellerId(selectedSellerId);
    setDraftCategoryId(selectedCategoryId);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setFilterModalVisible(true);
  }, [
    selectedState,
    selectedDistrict,
    selectedVillage,
    selectedManagerId,
    selectedSellerId,
    selectedCategoryId,
    fromDate,
    toDate,
  ]);

  // Apply filters from draft to active state
  const handleApplyFilters = useCallback(() => {
    setSelectedState(draftState);
    setSelectedDistrict(draftDistrict);
    setSelectedVillage(draftVillage);
    setSelectedManagerId(draftManagerId);
    setSelectedSellerId(draftSellerId);
    setSelectedCategoryId(draftCategoryId);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFilterModalVisible(false);
  }, [
    draftState,
    draftDistrict,
    draftVillage,
    draftManagerId,
    draftSellerId,
    draftCategoryId,
    draftFromDate,
    draftToDate,
  ]);

  // Reset draft inside dialog
  const handleResetDraft = useCallback(() => {
    setDraftState('');
    setDraftDistrict('');
    setDraftVillage('');
    setDraftManagerId('');
    setDraftSellerId('');
    setDraftCategoryId('');
    setDraftFromDate('');
    setDraftToDate('');
  }, []);

  // Clear all applied filters from main screen
  const handleClearFilters = useCallback(() => {
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedVillage('');
    setSelectedManagerId('');
    setSelectedSellerId('');
    setSelectedCategoryId('');
    setFromDate('');
    setToDate('');
  }, []);

  // 1. Cascaded States
  const availableStates = useMemo(() => {
    return filterOptions.states;
  }, [filterOptions.states]);

  // 2. Cascaded Districts (filtered by draftState inside dialog)
  const availableDistricts = useMemo(() => {
    const list = filterOptions.rawDistricts && filterOptions.rawDistricts.length > 0
      ? filterOptions.rawDistricts
      : filterOptions.districts;
    if (draftState) {
      return list
        .filter((d: any) =>
          typeof d === 'object' && d?.state
            ? d.state.toLowerCase() === draftState.toLowerCase()
            : true
        )
        .map((d: any) => (typeof d === 'object' ? d.district : d))
        .filter(Boolean);
    }
    const set = new Set<string>();
    for (const d of list) {
      set.add(typeof d === 'object' ? (d as any).district : d);
    }
    return Array.from(set).filter(Boolean).sort();
  }, [filterOptions, draftState]);

  // 3. Cascaded Villages (filtered by draftState and draftDistrict inside dialog)
  const availableVillages = useMemo(() => {
    const list = filterOptions.rawVillages && filterOptions.rawVillages.length > 0
      ? filterOptions.rawVillages
      : filterOptions.villages;
    const set = new Set<string>();
    for (const v of list) {
      if (typeof v === 'string') {
        set.add(v);
      } else if (v && typeof v === 'object') {
        const matchesState = !draftState || ((v as any).state || '').toLowerCase() === draftState.toLowerCase();
        const matchesDistrict = !draftDistrict || ((v as any).district || '').toLowerCase() === draftDistrict.toLowerCase();
        if (matchesState && matchesDistrict && (v as any).village) {
          set.add((v as any).village);
        }
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [filterOptions, draftState, draftDistrict]);

  // 4. Cascaded Managers (filtered by state/district)
  const availableManagers = useMemo(() => {
    return filterOptions.managers.filter((m) => {
      const matchesState = !draftState || !m.state || m.state.toLowerCase() === draftState.toLowerCase();
      const matchesDistrict = !draftDistrict || !m.district || m.district.toLowerCase() === draftDistrict.toLowerCase();
      return matchesState && matchesDistrict;
    });
  }, [filterOptions.managers, draftState, draftDistrict]);

  // 5. Cascaded Sellers (filtered by manager, state, or district)
  const availableSellers = useMemo(() => {
    return filterOptions.sellers.filter((s) => {
      const matchesManager = !draftManagerId || s.managerId === draftManagerId;
      const matchesState = !draftState || !s.state || s.state.toLowerCase() === draftState.toLowerCase();
      const matchesDistrict = !draftDistrict || !s.district || s.district.toLowerCase() === draftDistrict.toLowerCase();
      return matchesManager && matchesState && matchesDistrict;
    });
  }, [filterOptions.sellers, draftManagerId, draftState, draftDistrict]);

  // 6. Categories
  const availableCategories = useMemo(() => {
    return filterOptions.categories;
  }, [filterOptions.categories]);

  const activeFiltersCount = [
    selectedState,
    selectedDistrict,
    selectedVillage,
    selectedManagerId,
    selectedSellerId,
    selectedCategoryId,
    fromDate,
    toDate,
  ].filter(Boolean).length;

  const activeDraftCount = [
    draftState,
    draftDistrict,
    draftVillage,
    draftManagerId,
    draftSellerId,
    draftCategoryId,
    draftFromDate,
    draftToDate,
  ].filter(Boolean).length;

  // Unified loadData matching web dashboard
  const loadData = useCallback(async (isManual = false) => {
    try {
      setLoadError(null);
      if (isManual) {
        setRefreshing(true);
      } else if (!dashboard) {
        setLoading(true);
      }

      // 1. Scope parameters for hierarchy and territory
      const scopeFilters = {
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        village: selectedVillage || undefined,
        managerId: selectedManagerId || undefined,
        sellerId: selectedSellerId || undefined,
        categoryId: selectedCategoryId || undefined,
      };

      // 2. Fetch live dashboard stock/headcount and sales report metrics concurrently
      const [dashRes, salesRes] = await Promise.all([
        adminApi.getDashboard(scopeFilters).catch((err) => {
          console.warn('Dashboard overview API notice:', err?.message || err);
          return null;
        }),
        adminApi.getSalesReport({
          state: selectedState || undefined,
          district: selectedDistrict || undefined,
          village: selectedVillage || undefined,
          managerId: selectedManagerId || undefined,
          sellerId: selectedSellerId || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          status: 'CONFIRMED',
        }).catch((err) => {
          console.warn('Sales report API notice:', err?.message || err);
          return null;
        }),
      ]);

      const isFiltered = Boolean(
        fromDate ||
        toDate ||
        selectedState ||
        selectedDistrict ||
        selectedVillage ||
        selectedManagerId ||
        selectedSellerId ||
        selectedCategoryId
      );

      const netPaise = salesRes?.summary?.netSalesPaise || salesRes?.summary?.grossSalesPaise || 0;
      const netRupees = salesRes?.summary?.netSalesRupees || salesRes?.summary?.grossSalesRupees || (netPaise / 100);
      const packetsSold = salesRes?.summary?.totalQuantitySold || 0;

      const filteredIncentivePaise = salesRes?.items
        ? salesRes.items.reduce(
            (acc, it: any) => acc + (it.incentiveAmountPaise || it.incentivePaise || 0),
            0
          )
        : 0;
      const filteredIncentiveRupees =
        filteredIncentivePaise > 0 ? filteredIncentivePaise / 100 : packetsSold * 5;

      const baseMetrics = dashRes?.metrics ?? {
        totalPacketsSold: 0,
        totalEarningsPaise: 0,
        totalEarningsRupees: 0,
        totalStates: 0,
        totalShops: 0,
        totalManagers: 0,
        totalSellers: 0,
        totalInventory: 0,
        hqStock: 0,
        warehouseStock: 0,
        sellerStock: 0,
        totalIncentivePaise: 0,
        totalIncentiveRupees: 0,
      };

      if (isFiltered) {
        setDashboard({
          totalRevenuePaise: netPaise,
          totalPacketsSold: packetsSold,
          totalCustomers: baseMetrics.totalShops || dashRes?.totalCustomers || 0,
          activeSellers: baseMetrics.totalSellers || dashRes?.activeSellers || 0,
          pendingApprovalsCount: dashRes?.pendingApprovalsCount || 0,
          warehouseStockBalance: baseMetrics.warehouseStock || baseMetrics.totalInventory || 0,
          metrics: {
            ...baseMetrics,
            totalEarningsPaise: netPaise,
            totalEarningsRupees: netRupees,
            totalPacketsSold: packetsSold,
            totalIncentivePaise: filteredIncentivePaise,
            totalIncentiveRupees: filteredIncentiveRupees,
          },
          appliedFilters: {
            state: selectedState || undefined,
            district: selectedDistrict || undefined,
            village: selectedVillage || undefined,
            managerId: selectedManagerId || undefined,
            sellerId: selectedSellerId || undefined,
            categoryId: selectedCategoryId || undefined,
          },
        });
      } else {
        if (dashRes) {
          setDashboard(dashRes);
        } else {
          setDashboard({
            totalRevenuePaise: 0,
            totalPacketsSold: 0,
            totalCustomers: 0,
            activeSellers: 0,
            pendingApprovalsCount: 0,
            warehouseStockBalance: 0,
            metrics: baseMetrics,
            appliedFilters: {},
          });
        }
      }
    } catch (err: any) {
      console.warn('Admin dashboard error', err);
      const msg = err?.message || 'Failed to sync executive operations data.';
      setLoadError(msg);
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
    fromDate,
    toDate,
    dashboard,
  ]);

  // Debounced auto-fetch on applied filter change
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      loadData(false);
    }, 250);
    return () => clearTimeout(fetchTimeoutRef.current);
  }, [
    selectedState,
    selectedDistrict,
    selectedVillage,
    selectedManagerId,
    selectedSellerId,
    selectedCategoryId,
    fromDate,
    toDate,
  ]);

  // Focus re-sync
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
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
      loadData(false);
    });

    return () => {
      sub.remove();
    };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

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

  // Resolved normalized metrics (identical to web)
  const metrics = useMemo(() => {
    const rawMetrics = dashboard?.metrics;
    const netRupees = rawMetrics?.totalEarningsRupees ?? (
      rawMetrics?.totalEarningsPaise
        ? rawMetrics.totalEarningsPaise / 100
        : (dashboard?.totalRevenuePaise ? dashboard.totalRevenuePaise / 100 : 0)
    );
    const hq = rawMetrics?.hqStock ?? 0;
    const warehouse = rawMetrics?.warehouseStock ?? 0;
    const seller = rawMetrics?.sellerStock ?? 0;
    const totalInv = rawMetrics?.totalInventory ?? (hq + warehouse + seller || dashboard?.warehouseStockBalance || 0);

    return {
      totalEarningsRupees: netRupees,
      totalPacketsSold: rawMetrics?.totalPacketsSold ?? dashboard?.totalPacketsSold ?? 0,
      totalInventory: totalInv,
      hqStock: hq,
      warehouseStock: warehouse,
      sellerStock: seller,
      totalShops: rawMetrics?.totalShops ?? dashboard?.totalCustomers ?? 0,
      totalSellers: rawMetrics?.totalSellers ?? dashboard?.activeSellers ?? 0,
      totalManagers: rawMetrics?.totalManagers ?? 0,
      totalStates: rawMetrics?.totalStates ?? 0,
    };
  }, [dashboard]);

  const pendingCount = Number(dashboard?.pendingApprovalsCount || 0);

  // Build options for dropdown modals (modifies draft state)
  const activeDropdownConfig = useMemo(() => {
    if (!activeDropdown) return null;

    if (activeDropdown === 'state') {
      const options: DropdownOption[] = [
        { id: '', title: 'All states' },
        ...availableStates.map((s) => ({ id: s, title: s })),
      ];
      return {
        title: 'Select State',
        searchPlaceholder: 'Search states...',
        options,
        selectedId: draftState,
        onSelect: (opt: DropdownOption) => {
          setDraftState(opt.id);
          setDraftDistrict('');
          setDraftVillage('');
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown === 'district') {
      const options: DropdownOption[] = [
        { id: '', title: 'All districts' },
        ...availableDistricts.map((d) => ({ id: d, title: d })),
      ];
      return {
        title: 'Select District',
        searchPlaceholder: 'Search districts...',
        options,
        selectedId: draftDistrict,
        onSelect: (opt: DropdownOption) => {
          setDraftDistrict(opt.id);
          setDraftVillage('');
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown === 'village') {
      const options: DropdownOption[] = [
        { id: '', title: 'All villages' },
        ...availableVillages.map((v) => ({ id: v, title: v })),
      ];
      return {
        title: 'Select Village / Area',
        searchPlaceholder: 'Search villages or areas...',
        options,
        selectedId: draftVillage,
        onSelect: (opt: DropdownOption) => {
          setDraftVillage(opt.id);
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown === 'manager') {
      const options: DropdownOption[] = [
        { id: '', title: 'All managers' },
        ...availableManagers.map((m) => ({
          id: m.id,
          title: m.name,
          subtitle: [m.district, m.state].filter(Boolean).join(', ') || undefined,
        })),
      ];
      return {
        title: 'Select Manager',
        searchPlaceholder: 'Search managers...',
        options,
        selectedId: draftManagerId,
        onSelect: (opt: DropdownOption) => {
          setDraftManagerId(opt.id);
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown === 'seller') {
      const options: DropdownOption[] = [
        { id: '', title: 'All field officers' },
        ...availableSellers.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: [s.district, s.state].filter(Boolean).join(', ') || undefined,
        })),
      ];
      return {
        title: 'Select Field Officer',
        searchPlaceholder: 'Search field officers...',
        options,
        selectedId: draftSellerId,
        onSelect: (opt: DropdownOption) => {
          setDraftSellerId(opt.id);
          setActiveDropdown(null);
        },
      };
    }

    if (activeDropdown === 'category') {
      const options: DropdownOption[] = [
        { id: '', title: 'All categories' },
        ...availableCategories.map((c) => ({ id: c.id, title: c.name })),
      ];
      return {
        title: 'Select Category',
        searchPlaceholder: 'Search categories...',
        options,
        selectedId: draftCategoryId,
        onSelect: (opt: DropdownOption) => {
          setDraftCategoryId(opt.id);
          setActiveDropdown(null);
        },
      };
    }

    return null;
  }, [
    activeDropdown,
    availableStates,
    availableDistricts,
    availableVillages,
    availableManagers,
    availableSellers,
    availableCategories,
    draftState,
    draftDistrict,
    draftVillage,
    draftManagerId,
    draftSellerId,
    draftCategoryId,
  ]);

  return (
    <View style={styles.container}>
      <Header
        title="Admin overview"
        subtitle="Operations command"
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
          {/* Header Action Bar: Operations Command Eyebrow + Title + Filter Action Controls */}
          <View style={styles.pageHeaderBlock}>
            <View style={styles.eyebrowRow}>
              <Text style={styles.eyebrowText}>OPERATIONS COMMAND</Text>
            </View>
            <View style={styles.titleActionRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.mainTitle}>Admin overview</Text>
                <Text style={styles.mainDesc}>
                  Live operational metrics across HQ inventory, regional warehouses, assigned managers, active sellers, and field retail coverage.
                </Text>
              </View>

              {/* Action Buttons: Refresh + Filter Trigger + Reset */}
              <View style={styles.headerButtonsRow}>
                <TouchableOpacity
                  style={styles.refreshIconBtn}
                  onPress={() => loadData(true)}
                  disabled={loading || refreshing}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh dashboard metrics"
                >
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={refreshing ? BrandColors.pink.primary : '#334155'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterToggleBtn,
                    activeFiltersCount > 0 && styles.filterToggleBtnActive,
                  ]}
                  onPress={handleOpenFilterModal}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open Territory & Scope Filters Dialog"
                >
                  <Ionicons
                    name="options-outline"
                    size={16}
                    color={activeFiltersCount > 0 ? BrandColors.pink.primary : '#0F172A'}
                  />
                  <Text
                    style={[
                      styles.filterToggleBtnText,
                      activeFiltersCount > 0 && styles.filterToggleBtnTextActive,
                    ]}
                  >
                    Filter
                  </Text>
                  {activeFiltersCount > 0 ? (
                    <View style={styles.filterBadgeActive}>
                      <Text style={styles.filterBadgeActiveText}>{activeFiltersCount}</Text>
                    </View>
                  ) : (
                    <View style={styles.filterBadgeScope}>
                      <Text style={styles.filterBadgeScopeText}>All India</Text>
                    </View>
                  )}
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {activeFiltersCount > 0 && (
                  <TouchableOpacity
                    style={styles.resetHeaderBtn}
                    onPress={handleClearFilters}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Reset all filters"
                  >
                    <Ionicons name="refresh-outline" size={14} color="#64748B" />
                    <Text style={styles.resetHeaderBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Sync Error Alert Banner (if error occurred) */}
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
                  onPress={() => loadData(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry Loading Operations Data"
                >
                  <Ionicons name="reload" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : null}

          {/* ACTIVE FILTER BADGES STRIP (Shows on main screen when filters applied) */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFiltersStrip}>
              <Text style={styles.filteringByLabel}>Filtering by:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipsScroll}>
                {selectedState ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>State: {selectedState}</Text>
                    <Pressable
                      onPress={() => {
                        setSelectedState('');
                        setSelectedDistrict('');
                        setSelectedVillage('');
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {selectedDistrict ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>District: {selectedDistrict}</Text>
                    <Pressable
                      onPress={() => {
                        setSelectedDistrict('');
                        setSelectedVillage('');
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {selectedVillage ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>Village: {selectedVillage}</Text>
                    <Pressable onPress={() => setSelectedVillage('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {selectedManagerId ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      Manager: {availableManagers.find((m) => m.id === selectedManagerId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedManagerId('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {selectedSellerId ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      Officer: {availableSellers.find((s) => s.id === selectedSellerId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedSellerId('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {selectedCategoryId ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      Category: {availableCategories.find((c) => c.id === selectedCategoryId)?.name || 'Selected'}
                    </Text>
                    <Pressable onPress={() => setSelectedCategoryId('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}

                {(fromDate || toDate) ? (
                  <View style={styles.activeFilterChip}>
                    <Text style={styles.activeFilterChipText}>
                      Date: {fromDate || 'Earliest'} to {toDate || 'Latest'}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setFromDate('');
                        setToDate('');
                      }}
                      hitSlop={6}
                    >
                      <Ionicons name="close-circle" size={14} color={BrandColors.pink.primary} />
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity onPress={handleClearFilters} style={styles.clearAllFiltersBtn}>
                <Text style={styles.clearAllFiltersText}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* EMPTY SALES HELPER BANNER (Matching Web) */}
          {activeFiltersCount > 0 && metrics.totalPacketsSold === 0 && !loading && (
            <Card style={styles.emptySalesBanner}>
              <View style={styles.emptySalesRow}>
                <View style={styles.emptySalesIconBox}>
                  <Ionicons name="calendar-outline" size={20} color={BrandColors.pink.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptySalesTitle}>
                    No confirmed sales for selected period & filters
                  </Text>
                  <Text style={styles.emptySalesDesc}>
                    {fromDate || toDate
                      ? `Zero transactions recorded between ${fromDate || 'earliest'} and ${toDate || 'today'}. Revenue and packets sold show 0.`
                      : 'No sales match your current territory filters. Stock balances below reflect live inventory.'}
                  </Text>
                </View>
              </View>
              <View style={styles.emptySalesActionsRow}>
                {(fromDate || toDate) && (
                  <TouchableOpacity
                    style={styles.emptyActionBtnOutline}
                    onPress={() => {
                      setFromDate('');
                      setToDate('');
                    }}
                  >
                    <Text style={styles.emptyActionBtnOutlineText}>Clear Dates</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.emptyActionBtnSolid}
                  onPress={handleClearFilters}
                >
                  <Text style={styles.emptyActionBtnSolidText}>Reset All Filters</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* PRIMARY 4 KPI CARDS GRID (Matching Web Screenshot 1 & 2) */}
          {loading && !dashboard ? (
            <View style={styles.kpiGrid}>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.kpiGrid}>
              {/* 1. Total Revenue */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => router.push('/(admin)/sales' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.kpiTopRow}>
                  <Text style={styles.kpiLabel}>Total Revenue ↗</Text>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#EBF6EF' }]}>
                    <Ionicons name="cash-outline" size={16} color="#156035" />
                  </View>
                </View>
                <Text style={styles.kpiValue}>
                  ₹{Math.round(metrics.totalEarningsRupees).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.kpiNote} numberOfLines={1}>
                  {metrics.totalPacketsSold === 0
                    ? activeFiltersCount > 0
                      ? '0 sales in selected filter / period'
                      : 'No confirmed sales recorded yet'
                    : 'Confirmed sales across network'}
                </Text>
              </TouchableOpacity>

              {/* 2. Packets Sold */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => router.push('/(admin)/reports' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.kpiTopRow}>
                  <Text style={styles.kpiLabel}>Packets Sold ↗</Text>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#FFF5F7' }]}>
                    <Ionicons name="cube-outline" size={16} color="#E61C5D" />
                  </View>
                </View>
                <Text style={styles.kpiValue}>
                  {metrics.totalPacketsSold.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.kpiNote} numberOfLines={1}>
                  {metrics.totalPacketsSold === 0
                    ? activeFiltersCount > 0
                      ? '0 packets in selected filter / period'
                      : 'No field distribution recorded yet'
                    : 'Confirmed field distribution'}
                </Text>
              </TouchableOpacity>

              {/* 3. Total Inventory */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => router.push('/(admin)/inventory' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.kpiTopRow}>
                  <Text style={styles.kpiLabel}>Total Inventory ↗</Text>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="cube" size={16} color="#D97706" />
                  </View>
                </View>
                <Text style={styles.kpiValue}>
                  {metrics.totalInventory.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.kpiNote} numberOfLines={1}>
                  HQ, warehouses & field team
                </Text>
              </TouchableOpacity>

              {/* 4. Active Field Officers */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => router.push('/(admin)/sellers' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.kpiTopRow}>
                  <Text style={styles.kpiLabel}>Active Field Officers ↗</Text>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#EBF6EF' }]}>
                    <Ionicons name="people-outline" size={16} color="#156035" />
                  </View>
                </View>
                <Text style={styles.kpiValue}>
                  {metrics.totalSellers.toString()}
                </Text>
                <Text style={styles.kpiNote} numberOfLines={1}>
                  Supervised by {metrics.totalManagers} managers
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* "WHERE IS YOUR STOCK?" SECTION (Matching Web Screenshot 1 & 2) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionMainHeading}>Where is your stock?</Text>
            <Text style={styles.sectionMainSub}>
              See how many packets are at HQ, in regional warehouses, and with field officers
            </Text>

            <View style={styles.stockLevelGrid}>
              {/* 1. HQ Central */}
              <TouchableOpacity
                style={styles.stockLevelCard}
                onPress={() => router.push('/(admin)/inventory' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.stockLevelTopRow}>
                  <View style={[styles.stockLevelIconBox, { backgroundColor: '#FFF5F7' }]}>
                    <Ionicons name="layers-outline" size={18} color={BrandColors.pink.primary} />
                  </View>
                  <Text style={styles.stockLevelBadgeText}>HQ CENTRAL →</Text>
                </View>
                <Text style={styles.stockLevelValue}>
                  {metrics.hqStock.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.stockLevelNote}>
                  Packets in central warehouse
                </Text>
              </TouchableOpacity>

              {/* 2. Regional Depots */}
              <TouchableOpacity
                style={styles.stockLevelCard}
                onPress={() => router.push('/(admin)/inventory' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.stockLevelTopRow}>
                  <View style={[styles.stockLevelIconBox, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="cube-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={styles.stockLevelBadgeText}>REGIONAL DEPOTS →</Text>
                </View>
                <Text style={styles.stockLevelValue}>
                  {metrics.warehouseStock.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.stockLevelNote}>
                  Packets in district storage
                </Text>
              </TouchableOpacity>

              {/* 3. With Officers */}
              <TouchableOpacity
                style={styles.stockLevelCard}
                onPress={() => router.push('/(admin)/inventory' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.stockLevelTopRow}>
                  <View style={[styles.stockLevelIconBox, { backgroundColor: '#EBF6EF' }]}>
                    <Ionicons name="people-outline" size={18} color="#156035" />
                  </View>
                  <Text style={styles.stockLevelBadgeText}>WITH OFFICERS →</Text>
                </View>
                <Text style={styles.stockLevelValue}>
                  {metrics.sellerStock.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.stockLevelNote}>
                  Packets with officers ready to sell
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* "STORES & TEAM OVERVIEW" SECTION (Matching Web Screenshot 1 & 2) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionMainHeading}>Stores & Team Overview</Text>
            <Text style={styles.sectionMainSub}>
              Total shops connected, active officers, and commission paid
            </Text>

            <View style={styles.overviewRowsGrid}>
              {/* Retailers / Shops */}
              <TouchableOpacity
                style={styles.overviewRowCard}
                onPress={() => router.push('/(admin)/customers' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.overviewRowLeft}>
                  <View style={[styles.overviewRowIconBox, { backgroundColor: '#EBF6EF' }]}>
                    <Ionicons name="storefront-outline" size={20} color="#156035" />
                  </View>
                  <View>
                    <Text style={styles.overviewRowTitle}>Retailers / Shops</Text>
                    <Text style={styles.overviewRowSub}>Total verified retail shop partners</Text>
                  </View>
                </View>
                <Text style={styles.overviewRowValue}>
                  {metrics.totalShops.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>

              {/* Field Officers */}
              <TouchableOpacity
                style={styles.overviewRowCard}
                onPress={() => router.push('/(admin)/sellers' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.overviewRowLeft}>
                  <View style={[styles.overviewRowIconBox, { backgroundColor: '#FFF5F7' }]}>
                    <Ionicons name="people-outline" size={20} color="#E61C5D" />
                  </View>
                  <View>
                    <Text style={styles.overviewRowTitle}>Field Officers</Text>
                    <Text style={styles.overviewRowSub}>Active team members in the field</Text>
                  </View>
                </View>
                <Text style={styles.overviewRowValue}>
                  {metrics.totalSellers.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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
                    Orders below the ₹25.00/pkt floor are blocked from stock deduction and invoicing until authorized.
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

          {/* Master Operations Command Hub Card */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Administrative Actions</Text>
              <Text style={styles.sectionSubheading}>Operations Command & System Governance</Text>
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

          {/* POLISHED ADMINISTRATIVE ACTIONS CARD & BUTTON (Fixed overflow & elevated UI/UX) */}
          <Card style={styles.actionsHubCard}>
            <View style={styles.actionsHubHeader}>
              <View style={styles.actionsHubIconBadge}>
                <Ionicons name="grid" size={20} color={BrandColors.pink.primary} />
              </View>
              <View style={styles.actionsHubTextCol}>
                <View style={styles.actionsHubTitleRow}>
                  <Text style={styles.actionsHubTitle}>Operations Command Center</Text>
                  <Badge label="13 Modules" variant="ACTIVE" size="sm" />
                </View>
                <Text style={styles.actionsHubDesc}>
                  Access financial ledgers, price approvals, central inventory transfers, field shifts, and customer directories with live data telemetry.
                </Text>
              </View>
            </View>

            {/* Premium, responsive, modern Action Button */}
            <TouchableOpacity
              style={styles.openCommandCenterBtn}
              onPress={handleOpenActionsHub}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open Administrative Actions Hub"
            >
              <View style={styles.btnIconCircle}>
                <Ionicons name="apps" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.openCommandCenterBtnText}>Open Administrative Actions Hub</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>

      {/* RESPONSIVE FILTER DIALOG BOX (Small on screen modal dialog) */}
      <Modal
        visible={filterModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.modalCardContainer}>
            {/* Dialog Header */}
            <View style={styles.modalCardHeader}>
              <View style={styles.modalHeaderTitleLeft}>
                <View style={styles.modalIconBox}>
                  <Ionicons name="options" size={16} color={BrandColors.pink.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modalHeaderTitle}>Territory & Scope Filters</Text>
                  <Text style={styles.modalHeaderSub} numberOfLines={1}>
                    Filter live operational metrics by geographic hierarchy and category
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {activeDraftCount > 0 && (
                  <TouchableOpacity
                    style={styles.modalHeaderResetBtn}
                    onPress={handleResetDraft}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Reset all filters"
                  >
                    <Ionicons name="refresh-outline" size={12} color="#E61C5D" />
                    <Text style={styles.modalHeaderResetText}>Reset all</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setFilterModalVisible(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close filter dialog"
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Date Presets Container */}
              <View style={styles.dateRangeBox}>
                <View style={styles.datePresetsHeader}>
                  <Ionicons name="calendar-outline" size={14} color={BrandColors.pink.primary} />
                  <Text style={styles.dateRangeLabel}>DATE RANGE:</Text>

                  {/* Preset Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetPillsRow}>
                    <TouchableOpacity
                      style={[styles.presetPill, activeDraftPreset === 'today' && styles.presetPillActive]}
                      onPress={() => {
                        setDraftFromDate(todayStr);
                        setDraftToDate(todayStr);
                      }}
                    >
                      <Text style={[styles.presetPillText, activeDraftPreset === 'today' && styles.presetPillTextActive]}>
                        Today
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.presetPill, activeDraftPreset === '7days' && styles.presetPillActive]}
                      onPress={() => {
                        setDraftFromDate(sevenDaysAgoStr);
                        setDraftToDate(todayStr);
                      }}
                    >
                      <Text style={[styles.presetPillText, activeDraftPreset === '7days' && styles.presetPillTextActive]}>
                        Last 7 Days
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.presetPill, activeDraftPreset === '30days' && styles.presetPillActive]}
                      onPress={() => {
                        setDraftFromDate(thirtyDaysAgoStr);
                        setDraftToDate(todayStr);
                      }}
                    >
                      <Text style={[styles.presetPillText, activeDraftPreset === '30days' && styles.presetPillTextActive]}>
                        Last 30 Days
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.presetPill, activeDraftPreset === 'month' && styles.presetPillActive]}
                      onPress={() => {
                        setDraftFromDate(monthStartStr);
                        setDraftToDate(todayStr);
                      }}
                    >
                      <Text style={[styles.presetPillText, activeDraftPreset === 'month' && styles.presetPillTextActive]}>
                        This Month
                      </Text>
                    </TouchableOpacity>

                    {(draftFromDate || draftToDate) && (
                      <TouchableOpacity
                        style={styles.clearDatesBtn}
                        onPress={() => {
                          setDraftFromDate('');
                          setDraftToDate('');
                        }}
                      >
                        <Text style={styles.clearDatesText}>Clear dates</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>

                {/* Custom Date Inputs */}
                <View style={styles.dateInputsRow}>
                  <View style={styles.dateInputCol}>
                    <Text style={styles.dateFieldLabel}>From:</Text>
                    <TextInput
                      style={styles.dateInputField}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={draftFromDate}
                      onChangeText={setDraftFromDate}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.dateInputCol}>
                    <Text style={styles.dateFieldLabel}>To:</Text>
                    <TextInput
                      style={styles.dateInputField}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94A3B8"
                      value={draftToDate}
                      onChangeText={setDraftToDate}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>

              {/* 6 Cascading Dropdowns in Responsive Grid */}
              <View style={styles.dropdownsGrid}>
                {/* 1. STATE */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>STATE</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftState) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('state')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftState) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {draftState || 'All states'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* 2. DISTRICT */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>DISTRICT</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftDistrict) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('district')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftDistrict) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {draftDistrict || 'All districts'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* 3. VILLAGE / AREA */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>VILLAGE / AREA</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftVillage) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('village')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftVillage) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {draftVillage || 'All villages'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* 4. MANAGER */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>MANAGER</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftManagerId) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('manager')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftManagerId) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {availableManagers.find((m) => m.id === draftManagerId)?.name || 'All managers'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* 5. FIELD OFFICER */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>FIELD OFFICER</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftSellerId) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('seller')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftSellerId) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {availableSellers.find((s) => s.id === draftSellerId)?.name || 'All field officers'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* 6. CATEGORY */}
                <View style={styles.dropdownCell}>
                  <Text style={styles.dropdownCellLabel}>CATEGORY</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTriggerBtn,
                      Boolean(draftCategoryId) && styles.dropdownTriggerBtnActive,
                    ]}
                    onPress={() => setActiveDropdown('category')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        Boolean(draftCategoryId) && styles.dropdownTriggerTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {availableCategories.find((c) => c.id === draftCategoryId)?.name || 'All categories'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Sticky Dialog Footer Action Bar with "Apply Filters" & "Reset" */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={handleResetDraft}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={14} color="#64748B" />
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyFilters}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalApplyBtnText}>
                  Apply Filters {activeDraftCount > 0 ? `(${activeDraftCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SEARCHABLE DROPDOWN MODAL FOR DROPDOWNS */}
      {activeDropdownConfig ? (
        <SearchableDropdownModal
          visible={Boolean(activeDropdown)}
          title={activeDropdownConfig.title}
          searchPlaceholder={activeDropdownConfig.searchPlaceholder}
          options={activeDropdownConfig.options}
          selectedId={activeDropdownConfig.selectedId}
          onSelect={activeDropdownConfig.onSelect}
          onClose={() => setActiveDropdown(null)}
        />
      ) : null}
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
    padding: Spacing.md,
    paddingBottom: 120,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },

  // Header Area
  pageHeaderBlock: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#9F2545',
  },
  titleActionRow: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F4626',
    letterSpacing: -0.5,
  },
  mainDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  filterToggleBtnActive: {
    backgroundColor: '#FFF5F7',
    borderColor: '#E61C5D',
  },
  filterToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterToggleBtnTextActive: {
    color: '#E61C5D',
  },
  filterBadgeActive: {
    backgroundColor: '#E61C5D',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeActiveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  filterBadgeScope: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterBadgeScopeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  resetHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  // Error Card
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

  // Active Filter Badges Strip (on main screen)
  activeFiltersStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9FA',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 6,
  },
  filteringByLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  activeChipsScroll: {
    flexDirection: 'row',
    flex: 1,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: BorderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
    ...Shadows.sm,
  },
  activeFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E61C5D',
  },
  clearAllFiltersBtn: {
    paddingHorizontal: 6,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textDecorationLine: 'underline',
  },

  // Empty Sales Helper Banner
  emptySalesBanner: {
    marginBottom: Spacing.lg,
    backgroundColor: '#FFF9FA',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
  },
  emptySalesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emptySalesIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySalesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySalesDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  emptySalesActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    justifyContent: 'flex-end',
  },
  emptyActionBtnOutline: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyActionBtnOutlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  emptyActionBtnSolid: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#E61C5D',
  },
  emptyActionBtnSolidText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 4 Top KPI Cards Grid (Matching Web)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    marginRight: 4,
  },
  kpiIconCircle: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  kpiNote: {
    fontSize: 11,
    color: '#64748B',
  },

  // "Where is your stock?" Section
  sectionBlock: {
    marginBottom: Spacing.xl,
  },
  sectionMainHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F4626',
    marginBottom: 2,
  },
  sectionMainSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: Spacing.md,
  },
  stockLevelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stockLevelCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  stockLevelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stockLevelIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockLevelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  stockLevelValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  stockLevelNote: {
    fontSize: 11,
    color: '#64748B',
  },

  // "Stores & Team Overview" Section
  overviewRowsGrid: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  overviewRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  overviewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  overviewRowIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  overviewRowSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  overviewRowValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F4626',
    marginLeft: 8,
  },

  // Approvals & Command Hub
  approvalAlertCard: {
    marginBottom: Spacing.lg,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  approvalAlertDesc: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubheading: {
    fontSize: 11,
    color: '#64748B',
  },
  viewAllActionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllActionsText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },

  // Administrative Actions Hub Card & Fixed Button UI/UX
  actionsHubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  actionsHubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.md,
  },
  actionsHubIconBadge: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsHubTextCol: {
    flex: 1,
    minWidth: 0,
  },
  actionsHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  actionsHubTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  actionsHubDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  openCommandCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.pink.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
    gap: 8,
  },
  btnIconCircle: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCommandCenterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    flex: 1,
    textAlign: 'center',
  },

  // RESPONSIVE FILTER MODAL DIALOG BOX STYLES
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCardContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  modalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAF8F5',
  },
  modalHeaderTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  modalIconBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFF5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#64748B',
  },
  modalHeaderResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    backgroundColor: '#FFF5F7',
  },
  modalHeaderResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E61C5D',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollView: {
    flexShrink: 1,
  },
  modalScrollContent: {
    padding: Spacing.md,
  },

  // Date Range Box in Modal
  dateRangeBox: {
    padding: Spacing.sm,
    backgroundColor: '#FFF8FA',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginBottom: Spacing.sm,
  },
  datePresetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dateRangeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  presetPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  presetPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  presetPillActive: {
    backgroundColor: '#E61C5D',
    borderColor: '#E61C5D',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  presetPillTextActive: {
    color: '#FFFFFF',
  },
  clearDatesBtn: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clearDatesText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E61C5D',
    textDecorationLine: 'underline',
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dateInputCol: {
    flex: 1,
  },
  dateFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  dateInputField: {
    height: 34,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
  },

  // Dropdowns Grid in Modal
  dropdownsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dropdownCell: {
    width: '48%',
    marginBottom: 6,
  },
  dropdownCellLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#334155',
    marginBottom: 4,
  },
  dropdownTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    paddingHorizontal: 10,
    backgroundColor: '#FAF8F5',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownTriggerBtnActive: {
    backgroundColor: '#FFF5F7',
    borderColor: '#E61C5D',
  },
  dropdownTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 4,
  },
  dropdownTriggerTextActive: {
    color: '#E61C5D',
    fontWeight: '700',
  },

  // Sticky Dialog Footer
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAF8F5',
    gap: Spacing.sm,
  },
  modalResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  modalResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.primary,
    ...Shadows.sm,
  },
  modalApplyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
