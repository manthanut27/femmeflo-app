import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { AdminDashboardData } from '@/api/types';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  MaxContentWidth,
  Shadows,
  Spacing,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

interface QuickActionButtonItem {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  route: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  badgeText?: string;
  hasAlert?: boolean;
}

export default function AdministrativeActionsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await adminApi.getDashboard();
      if (data) {
        setDashboard(data);
      }
    } catch (err) {
      console.warn('Failed to load status for actions page', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Re-fetch data whenever Actions Hub comes into focus
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

  const pendingCount = Number(dashboard?.pendingApprovalsCount || 0);

  // 13 Quick Action Buttons with easy, simple word meanings
  const quickActions: QuickActionButtonItem[] = useMemo(
    () => [
      {
        id: 'reports',
        index: 1,
        title: 'Daily Sales & Reports',
        subtitle: 'View daily sales, revenue, and summaries',
        route: '/(admin)/reports',
        iconName: 'bar-chart-outline',
        iconBg: '#F0F9FF',
        iconColor: '#0284C7',
      },
      {
        id: 'approvals',
        index: 2,
        title: 'Price Approvals',
        subtitle: 'Approve or reject discount requests',
        route: '/(admin)/approvals',
        iconName: 'checkmark-done-circle-outline',
        iconBg: pendingCount > 0 ? '#FEF2F2' : '#ECFDF5',
        iconColor: pendingCount > 0 ? '#DC2626' : '#059669',
        badgeText: pendingCount > 0 ? `${pendingCount} to review` : undefined,
        hasAlert: pendingCount > 0,
      },
      {
        id: 'products',
        index: 3,
        title: 'Products & Pricing',
        subtitle: 'Manage products, pack sizes, and prices',
        route: '/(admin)/products',
        iconName: 'cube-outline',
        iconBg: '#F5F3FF',
        iconColor: '#7C3AED',
      },
      {
        id: 'invoices',
        index: 4,
        title: 'Customer Invoices',
        subtitle: 'View and download customer bills',
        route: '/(admin)/invoices',
        iconName: 'document-text-outline',
        iconBg: '#EFF6FF',
        iconColor: '#2563EB',
      },
      {
        id: 'sales',
        index: 5,
        title: 'All Orders',
        subtitle: 'See all orders placed by field team',
        route: '/(admin)/sales',
        iconName: 'receipt-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'incentives',
        index: 6,
        title: 'Officer Incentives',
        subtitle: 'Check commission earnings and payouts',
        route: '/(admin)/incentives',
        iconName: 'cash-outline',
        iconBg: BrandColors.green.subtle,
        iconColor: BrandColors.green.primary,
      },
      {
        id: 'shifts',
        index: 7,
        title: 'Field Shifts & Attendance',
        subtitle: 'See officer duty status and daily routes',
        route: '/(admin)/shifts',
        iconName: 'compass-outline',
        iconBg: '#F0FDFA',
        iconColor: '#0D9488',
      },
      {
        id: 'permissions',
        index: 8,
        title: 'Staff Roles & Access',
        subtitle: 'Set what managers and staff can do',
        route: '/(admin)/permissions',
        iconName: 'shield-checkmark-outline',
        iconBg: '#FFFBEB',
        iconColor: '#D97706',
      },
      {
        id: 'customers',
        index: 9,
        title: 'Shops & Store Partners',
        subtitle: 'View retail shops and add new stores',
        route: '/(admin)/customers',
        iconName: 'storefront-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'inventory',
        index: 10,
        title: 'Stock & Warehouses',
        subtitle: 'Move stock between central store and vans',
        route: '/(admin)/inventory/transfer',
        iconName: 'swap-horizontal-outline',
        iconBg: '#ECFDF5',
        iconColor: '#059669',
      },
      {
        id: 'users',
        index: 11,
        title: 'Team & Staff',
        subtitle: 'Manage managers and field officers',
        route: '/(admin)/users',
        iconName: 'people-outline',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
      },
      {
        id: 'categories',
        index: 12,
        title: 'Customer Categories',
        subtitle: 'Manage shop types and customer groups',
        route: '/(admin)/categories',
        iconName: 'pricetags-outline',
        iconBg: '#FFF7ED',
        iconColor: '#EA580C',
      },
      {
        id: 'settings',
        index: 13,
        title: 'Company Settings',
        subtitle: 'Company details, GST, and invoice setup',
        route: '/(admin)/settings',
        iconName: 'settings-outline',
        iconBg: '#F1F5F9',
        iconColor: '#475569',
      },
    ],
    [pendingCount]
  );

  return (
    <View style={styles.container}>
      <Header
        title="Administrative Actions"
        subtitle="Quick Actions • 13 Modules"
        showBack
        onBack={handleBack}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Tap any action below to open that section immediately
            </Text>
          </View>

          {/* 13 Quick Action Buttons */}
          <View style={styles.actionsList}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionCardBtn,
                  action.hasAlert && styles.actionCardBtnAlert,
                ]}
                onPress={() => handleNavigateToAction(action.route)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.title}
              >
                <View style={[styles.iconBox, { backgroundColor: action.iconBg }]}>
                  <Ionicons name={action.iconName} size={22} color={action.iconColor} />
                </View>

                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle} numberOfLines={1}>
                    {action.title}
                  </Text>
                  <Text style={styles.actionSubtitle} numberOfLines={1}>
                    {action.subtitle}
                  </Text>
                </View>

                {action.badgeText ? (
                  <View
                    style={[
                      styles.badgePill,
                      action.hasAlert && styles.badgePillAlert,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgePillText,
                        action.hasAlert && styles.badgePillTextAlert,
                      ]}
                    >
                      {action.badgeText}
                    </Text>
                  </View>
                ) : null}

                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 100,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  actionsList: {
    gap: 10,
  },
  actionCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  actionCardBtnAlert: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF5F7',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  badgePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  badgePillAlert: {
    backgroundColor: '#FEE2E2',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  badgePillTextAlert: {
    color: '#DC2626',
  },
});
