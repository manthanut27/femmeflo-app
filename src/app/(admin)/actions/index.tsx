import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { AdminDashboardData } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/utils/responsive';

interface AdminActionItem {
  id: string;
  index: number;
  title: string;
  buttonTitle: string;
  categoryLabel: string;
  route: string;
  params?: Record<string, string>;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  highlightAlert?: boolean;
}

export default function AdministrativeActionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = Colors.light;
  const { isTablet } = useResponsiveLayout();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await adminApi.getDashboard();
      if (data) {
        setDashboard(data);
      }
    } catch (err) {
      console.warn('Failed to load telemetry for actions page', err);
    } finally {
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
    (route: string, extraParams?: Record<string, string>) => {
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
        '/(admin)/inventory': 'inventory',
      };

      const tabName = directTabs[route];
      if (tabName) {
        try {
          if (tabName === 'inventory') {
            (navigation as any).navigate('inventory', {
              screen: 'index',
              params: { from: 'actions', ...extraParams },
            });
            return;
          }
          if (extraParams && Object.keys(extraParams).length > 0) {
            (navigation as any).navigate(tabName, { from: 'actions', ...extraParams });
          } else {
            (navigation as any).navigate(tabName, { from: 'actions' });
          }
          return;
        } catch {
          // fallback to router
        }
      }
      try {
        if (extraParams && Object.keys(extraParams).length > 0) {
          router.push({ pathname: route as any, params: { from: 'actions', ...extraParams } });
        } else {
          router.push({ pathname: route as any, params: { from: 'actions' } });
        }
      } catch {
        try {
          if (extraParams && Object.keys(extraParams).length > 0) {
            router.navigate({ pathname: route as any, params: { from: 'actions', ...extraParams } });
          } else {
            router.navigate({ pathname: route as any, params: { from: 'actions' } });
          }
        } catch {
          router.push(route as any);
        }
      }
    },
    [navigation, router]
  );

  const pendingCount = Number(dashboard?.pendingApprovalsCount || 0);

  // 13 Administrative Quick Actions
  const actionItems: AdminActionItem[] = useMemo(
    () => [
      {
        id: 'reports',
        index: 1,
        title: 'Daily Sales & Reports',
        buttonTitle: 'Daily Reports',
        categoryLabel: 'Sales & Reports',
        route: '/(admin)/reports',
        iconName: 'bar-chart-outline',
        iconBg: '#F0F9FF',
        iconColor: '#0284C7',
      },
      {
        id: 'approvals',
        index: 2,
        title: 'Price Approvals',
        buttonTitle: 'Price Approvals',
        categoryLabel: 'Approvals',
        route: '/(admin)/approvals',
        iconName: 'checkmark-done-circle-outline',
        iconBg: pendingCount > 0 ? '#FEF2F2' : '#ECFDF5',
        iconColor: pendingCount > 0 ? '#DC2626' : '#059669',
        highlightAlert: pendingCount > 0,
      },
      {
        id: 'products',
        index: 3,
        title: 'Products & Prices',
        buttonTitle: 'Products',
        categoryLabel: 'Products & Stock',
        route: '/(admin)/products',
        iconName: 'cube-outline',
        iconBg: '#F5F3FF',
        iconColor: '#7C3AED',
      },
      {
        id: 'invoices',
        index: 4,
        title: 'GST Tax Invoices',
        buttonTitle: 'Tax Invoices',
        categoryLabel: 'Sales & Reports',
        route: '/(admin)/invoices',
        iconName: 'document-text-outline',
        iconBg: '#EFF6FF',
        iconColor: '#2563EB',
      },
      {
        id: 'sales',
        index: 5,
        title: 'Sales Orders',
        buttonTitle: 'All Orders',
        categoryLabel: 'Sales & Reports',
        route: '/(admin)/sales',
        iconName: 'receipt-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'incentives',
        index: 6,
        title: 'Incentives & Payouts',
        buttonTitle: 'Incentives',
        categoryLabel: 'Sales & Reports',
        route: '/(admin)/incentives',
        iconName: 'cash-outline',
        iconBg: BrandColors.green.subtle,
        iconColor: BrandColors.green.primary,
      },
      {
        id: 'shifts',
        index: 7,
        title: 'Staff Shifts & Routes',
        buttonTitle: 'Staff Shifts',
        categoryLabel: 'Field Team',
        route: '/(admin)/shifts',
        iconName: 'compass-outline',
        iconBg: '#F0FDFA',
        iconColor: '#0D9488',
      },
      {
        id: 'permissions',
        index: 8,
        title: 'Manager Permissions',
        buttonTitle: 'Permissions',
        categoryLabel: 'Team & Access',
        route: '/(admin)/permissions',
        iconName: 'shield-checkmark-outline',
        iconBg: '#FFFBEB',
        iconColor: '#D97706',
      },
      {
        id: 'customers',
        index: 9,
        title: 'Shops & Customers',
        buttonTitle: 'Shops',
        categoryLabel: 'Field Team',
        route: '/(admin)/customers',
        iconName: 'storefront-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'inventory',
        index: 10,
        title: 'Stock Movement (Transfer, Inward, History)',
        buttonTitle: 'Stock Movement',
        categoryLabel: 'Products & Stock',
        route: '/(admin)/inventory/transfer',
        iconName: 'swap-horizontal-outline',
        iconBg: '#ECFDF5',
        iconColor: '#059669',
      },
      {
        id: 'warehouse',
        index: 11,
        title: 'Regional Warehouses',
        buttonTitle: 'Add Warehouse',
        categoryLabel: 'Products & Stock',
        route: '/(admin)/inventory/new',
        iconName: 'business-outline',
        iconBg: '#F0FDF4',
        iconColor: '#16A34A',
      },
      {
        id: 'users',
        index: 12,
        title: 'Managers & Sellers',
        buttonTitle: 'Team Members',
        categoryLabel: 'Team & Access',
        route: '/(admin)/users',
        iconName: 'people-outline',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
      },
      {
        id: 'categories',
        index: 13,
        title: 'Shop Categories',
        buttonTitle: 'Categories',
        categoryLabel: 'Settings',
        route: '/(admin)/categories',
        iconName: 'pricetags-outline',
        iconBg: '#FFF7ED',
        iconColor: '#EA580C',
      },
      {
        id: 'settings',
        index: 14,
        title: 'Company & Invoice Settings',
        buttonTitle: 'Settings',
        categoryLabel: 'Settings',
        route: '/(admin)/settings',
        iconName: 'settings-outline',
        iconBg: '#F1F5F9',
        iconColor: '#475569',
      },
    ],
    [pendingCount]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header
        title="Quick Actions"
        subtitle="14 Operational Modules"
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
          <View style={styles.headerInfoRow}>
            <Text style={styles.sectionTitle}>Operational Modules</Text>
            <Badge label="14 Modules" variant="neutral" size="sm" />
          </View>

          <View style={[styles.actionGrid, isTablet && styles.actionGridTablet]}>
            {actionItems.map((action) => (
              <Card
                key={action.id}
                variant="elevated"
                style={[
                  styles.actionCard,
                  isTablet && styles.actionCardTablet,
                  action.highlightAlert && styles.actionCardHighlight,
                ]}
                onPress={() => handleNavigateToAction(action.route, action.params)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${action.title}`}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: action.iconBg }]}>
                    <Ionicons name={action.iconName} size={22} color={action.iconColor} />
                  </View>
                  {action.highlightAlert ? (
                    <Badge label={`${pendingCount} PENDING`} variant="danger" size="sm" />
                  ) : (
                    <View style={styles.arrowBox}>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Colors.light.textTertiary}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.actionTitle} numberOfLines={2}>
                    {action.buttonTitle || action.title}
                  </Text>
                  <Text style={styles.actionCategory} numberOfLines={1}>
                    #{action.index} • {action.categoryLabel}
                  </Text>
                </View>
              </Card>
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
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 40,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  actionGridTablet: {
    justifyContent: 'flex-start',
    gap: Spacing.md,
  },
  actionCard: {
    width: '48.5%',
    minHeight: 128,
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  actionCardTablet: {
    width: '31.8%',
  },
  actionCardHighlight: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFFDFD',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    justifyContent: 'flex-end',
  },
  actionTitle: {
    ...Typography.subtitle,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 4,
  },
  actionCategory: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
