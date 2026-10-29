import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BrandColors, Colors, Shadows, Typography } from '@/constants/theme';

export default function AdminTabsLayout() {
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
        name="inventory/index"
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
        name="inventory/transfer"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="categories/index"
        options={{ href: null }}
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
