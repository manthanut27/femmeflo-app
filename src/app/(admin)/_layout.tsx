import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import { BrandColors, Colors, Shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useResponsiveLayout } from '@/utils/responsive';

export default function AdminTabsLayout() {
  const { user, state, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, isSmallMobile, isTablet } = useResponsiveLayout();

  // Dynamic responsive tab bar dimensions
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const tabHeight = (isSmallMobile ? 54 : 60) + bottomInset;
  const horizontalPadding = isTablet ? Math.max((width - 760) / 2, 24) : 4;
  const iconSize = isSmallMobile ? 20 : isTablet ? 24 : 22;
  const labelFontSize = isSmallMobile ? 9.5 : isTablet ? 12 : 10.5;

  useEffect(() => {
    if (isLoading || state === 'INITIALIZING') return;
    if (!user || user.role !== 'SUPER_ADMIN') {
      if (!user) {
        router.replace('/(auth)/login' as any);
      } else if (user.role === 'MANAGER') {
        router.replace('/(manager)' as any);
      } else if (user.role === 'SELLER') {
        router.replace('/(seller)' as any);
      } else {
        router.replace('/(auth)/login' as any);
      }
    }
  }, [user, state, isLoading, router]);

  if (isLoading || state === 'INITIALIZING' || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <View style={styles.authLoadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.dark} />
      </View>
    );
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.pink.dark,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.light.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.light.border,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          paddingHorizontal: horizontalPadding,
          ...Shadows.sm,
        },
        tabBarLabelStyle: {
          fontSize: labelFontSize,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="pie-chart-outline"
              focusedName="pie-chart"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="bar-chart-outline"
              focusedName="bar-chart"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals/index"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="checkmark-done-circle-outline"
              focusedName="checkmark-done-circle"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: isSmallMobile ? 'Stock' : 'Inventory',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="cube-outline"
              focusedName="cube"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="users/index"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="people-circle-outline"
              focusedName="people-circle"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="settings-outline"
              focusedName="settings"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.dark}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
                  <Tabs.Screen
        name="sellers/new"
        options={{
          title: 'Onboard Seller',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="managers/new"
        options={{
          title: 'Onboard Manager',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="users/new"
        options={{
          title: 'Onboard User',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          title: 'Notifications',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="settings/password"
        options={{
          title: 'Change Password',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="actions/index"
        options={{
          title: 'Actions Hub',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="categories/index"
        options={{
          title: 'Categories',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: 'Products',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="incentives/index"
        options={{
          title: 'Incentives',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="shifts/index"
        options={{
          title: 'Shifts',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="permissions/index"
        options={{
          title: 'Permissions',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="sales/index"
        options={{
          title: 'Sales',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{
          title: 'Invoices',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  authLoadingContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
