import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { BrandColors, Colors, Shadows, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AdminTabsLayout() {
  const { user, state, isLoading } = useAuth();
  const router = useRouter();

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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.pink.dark,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Executive',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'pie-chart' : 'pie-chart-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals/index"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'checkmark-done-circle' : 'checkmark-done-circle-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'HQ Stock',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="users/index"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'people-circle' : 'people-circle-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="categories/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="customers"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="products/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="incentives/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="shifts/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="permissions/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="sales/index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="invoices/index"
        options={{ href: null }}
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
