import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import { BrandColors, Colors, Shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useResponsiveLayout } from '@/utils/responsive';

export default function SellerTabsLayout() {
  const { user, state, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, isSmallMobile, isTablet } = useResponsiveLayout();

  // Dynamic responsive tab bar dimensions
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const tabHeight = (isSmallMobile ? 54 : 60) + bottomInset;
  const horizontalPadding = isTablet ? Math.max((width - 760) / 2, 24) : 4;
  const iconSize = isSmallMobile ? 21 : isTablet ? 25 : 23;
  const labelFontSize = isSmallMobile ? 10 : isTablet ? 12 : 11;

  const isAllowedSeller =
    user?.role === 'SELLER' ||
    user?.role === 'MANAGER';

  useEffect(() => {
    if (isLoading || state === 'INITIALIZING') return;
    if (!user) {
      router.replace('/(auth)/login' as any);
    } else if (!isAllowedSeller) {
      if (user.role === 'SUPER_ADMIN') {
        router.replace('/(admin)' as any);
      } else if (user.role === 'MANAGER') {
        router.replace('/(manager)' as any);
      } else {
        router.replace('/(auth)/login' as any);
      }
    }
  }, [user, state, isLoading, router, isAllowedSeller]);

  if (isLoading || state === 'INITIALIZING' || !user || !isAllowedSeller) {
    return (
      <View style={styles.authLoadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
      </View>
    );
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.pink.primary,
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
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="home-outline"
              focusedName="home"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.primary}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shift/index"
        options={{
          title: 'Shift',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="time-outline"
              focusedName="time"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.primary}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="receipt-outline"
              focusedName="receipt"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.primary}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="people-outline"
              focusedName="people"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.primary}
              isSmallMobile={isSmallMobile}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'Inventory',
          tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="person-outline"
              focusedName="person"
              focused={focused}
              color={color}
              size={iconSize}
              tintColor={BrandColors.pink.primary}
              isSmallMobile={isSmallMobile}
            />
          ),
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
