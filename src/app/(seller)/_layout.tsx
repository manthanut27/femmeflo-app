import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { BrandColors, Colors, Shadows, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SellerTabsLayout() {
  const { user, state, isLoading } = useAuth();
  const router = useRouter();

  const isAllowedSeller =
    user?.role === 'SELLER' ||
    (user?.role === 'MANAGER' && Boolean((user as any).isSeller));

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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.pink.primary,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shift/index"
        options={{
          title: 'Duty Shift',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incentives/index"
        options={{
          href: null,
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
  tabBar: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 8,
    ...Shadows.sm,
  },
  tabBarLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
});
