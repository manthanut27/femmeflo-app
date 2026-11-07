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
import { Badge } from '@/components/ui/Badge';
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
        '/(admin)/inventory': 'inventory',
      };

      const tabName = directTabs[route];
      if (tabName) {
        try {
          (navigation as any).navigate(tabName, { from: 'actions' });
          return;
        } catch {
          // fallback to router
        }
      }
      try {
        router.push({ pathname: route as any, params: { from: 'actions' } });
      } catch {
        try {
          router.navigate({ pathname: route as any, params: { from: 'actions' } });
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
        title: 'Daily Sales Analytics & Reports',
        buttonTitle: 'Daily Reports & Analytics',
        categoryLabel: 'Financial & Sales',
        route: '/(admin)/reports',
        iconName: 'bar-chart-outline',
        iconBg: '#F0F9FF',
        iconColor: '#0284C7',
      },
      {
        id: 'approvals',
        index: 2,
        title: 'Price Approvals Queue',
        buttonTitle: 'Price Approvals Queue',
        categoryLabel: 'Governance & Pricing',
        route: '/(admin)/approvals',
        iconName: 'checkmark-done-circle-outline',
        iconBg: pendingCount > 0 ? '#FEF2F2' : '#ECFDF5',
        iconColor: pendingCount > 0 ? '#DC2626' : '#059669',
        highlightAlert: pendingCount > 0,
      },
      {
        id: 'products',
        index: 3,
        title: 'Product Catalog & SKU Pricing',
        buttonTitle: 'Product Catalog & SKUs',
        categoryLabel: 'Catalog & Stock',
        route: '/(admin)/products',
        iconName: 'cube-outline',
        iconBg: '#F5F3FF',
        iconColor: '#7C3AED',
      },
      {
        id: 'invoices',
        index: 4,
        title: 'National Invoices Central Directory',
        buttonTitle: 'GST Tax Invoices',
        categoryLabel: 'Financial & Sales',
        route: '/(admin)/invoices',
        iconName: 'document-text-outline',
        iconBg: '#EFF6FF',
        iconColor: '#2563EB',
      },
      {
        id: 'sales',
        index: 5,
        title: 'National Sales & Order Directory',
        buttonTitle: 'Sales Order Directory',
        categoryLabel: 'Financial & Sales',
        route: '/(admin)/sales',
        iconName: 'receipt-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'incentives',
        index: 6,
        title: 'Commissions & Incentive Disbursements',
        buttonTitle: 'Incentives & Payouts',
        categoryLabel: 'Financial & Sales',
        route: '/(admin)/incentives',
        iconName: 'cash-outline',
        iconBg: BrandColors.green.subtle,
        iconColor: BrandColors.green.primary,
      },
      {
        id: 'shifts',
        index: 7,
        title: 'National Shifts & Field GPS Audit',
        buttonTitle: 'Field Shifts & GPS Audit',
        categoryLabel: 'Field Operations',
        route: '/(admin)/shifts',
        iconName: 'compass-outline',
        iconBg: '#F0FDFA',
        iconColor: '#0D9488',
      },
      {
        id: 'permissions',
        index: 8,
        title: 'Territory Manager Permissions Matrix',
        buttonTitle: 'Manager Permissions Matrix',
        categoryLabel: 'Governance & Pricing',
        route: '/(admin)/permissions',
        iconName: 'shield-checkmark-outline',
        iconBg: '#FFFBEB',
        iconColor: '#D97706',
      },
      {
        id: 'customers',
        index: 9,
        title: 'Retail Customers & Bulk Onboarding',
        buttonTitle: 'Retail Customers Directory',
        categoryLabel: 'Field Operations',
        route: '/(admin)/customers',
        iconName: 'storefront-outline',
        iconBg: BrandColors.pink.subtle,
        iconColor: BrandColors.pink.primary,
      },
      {
        id: 'inventory',
        index: 10,
        title: 'Inward Factory Stock & Warehouse Transfers',
        buttonTitle: 'Stock Transfers & Inward',
        categoryLabel: 'Catalog & Stock',
        route: '/(admin)/inventory/transfer',
        iconName: 'swap-horizontal-outline',
        iconBg: '#ECFDF5',
        iconColor: '#059669',
      },
      {
        id: 'users',
        index: 11,
        title: 'Manage Managers & Sellers Directory',
        buttonTitle: 'Managers & Field Reps',
        categoryLabel: 'Field Operations',
        route: '/(admin)/users',
        iconName: 'people-outline',
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
      },
      {
        id: 'categories',
        index: 12,
        title: 'Customer Categories Configuration',
        buttonTitle: 'Customer Categories',
        categoryLabel: 'System & Config',
        route: '/(admin)/categories',
        iconName: 'pricetags-outline',
        iconBg: '#FFF7ED',
        iconColor: '#EA580C',
      },
      {
        id: 'settings',
        index: 13,
        title: 'Company Legal & Tax Invoice Settings',
        buttonTitle: 'Legal & Company Settings',
        categoryLabel: 'System & Config',
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
        subtitle="13 Operational Modules"
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
          <View style={[styles.actionList, isTablet && styles.actionListTablet]}>
            {actionItems.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionCard,
                  isTablet && styles.actionCardTablet,
                  action.highlightAlert && styles.actionCardHighlight,
                ]}
                onPress={() => handleNavigateToAction(action.route)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${action.title}`}
              >
                <View style={[styles.iconBox, { backgroundColor: action.iconBg }]}>
                  <Ionicons name={action.iconName} size={22} color={action.iconColor} />
                </View>

                <View style={styles.actionInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.actionTitle} numberOfLines={1}>
                      {action.title}
                    </Text>
                    {action.highlightAlert ? (
                      <Badge label={`${pendingCount} PENDING`} variant="danger" size="sm" />
                    ) : null}
                  </View>
                  <Text style={styles.actionCategory}>
                    #{action.index} • {action.categoryLabel}
                  </Text>
                </View>

                <View style={styles.arrowBox}>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={action.highlightAlert ? '#DC2626' : Colors.light.textTertiary}
                  />
                </View>
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
  actionList: {
    gap: Spacing.sm,
  },
  actionListTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  actionCardTablet: {
    width: '49%',
  },
  actionCardHighlight: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFFDFD',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionInfo: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  actionTitle: {
    ...Typography.subtitle,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  actionCategory: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  arrowBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
