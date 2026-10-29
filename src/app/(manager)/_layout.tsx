import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BrandColors, Colors, Shadows, Typography } from '@/constants/theme';

export default function ManagerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.green.primary,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
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
        name="sellers"
        options={{
          title: 'Team',
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
        name="customers/index"
        options={{
          title: 'Stores',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'storefront' : 'storefront-outline'}
              size={size}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales/index"
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
