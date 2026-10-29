import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { BrandColors, Colors, HitSlop, Radius, Spacing, Typography } from '../../constants/theme';

export interface TabOption<T extends string | null = string | null> {
  label: string;
  value?: T;
  key?: T;
  icon?: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
  badge?: number;
}

export interface SegmentedTabsProps<T extends string | null = string | null> {
  tabs: Array<TabOption<T>>;
  selectedTab?: T;
  activeTab?: T;
  onSelect?: (value: T) => void;
  onTabChange?: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  activeColor?: string;
  scrollable?: boolean;
  accessibilityLabel?: string;
}

export function SegmentedTabs<T extends string | null = string | null>({
  tabs,
  selectedTab,
  activeTab,
  onSelect,
  onTabChange,
  style,
  activeColor = BrandColors.pink.primary,
  scrollable = false,
  accessibilityLabel = 'Filter options',
}: SegmentedTabsProps<T>) {
  const currentActive = activeTab !== undefined ? activeTab : selectedTab;
  const notifySelect = onTabChange || onSelect || (() => {});

  const content = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, style]}
    >
      {tabs.map((tab, idx) => {
        const tabVal = (tab.value !== undefined ? tab.value : tab.key) as T;
        const isSelected = tabVal === currentActive;
        const badgeNum = tab.badge !== undefined ? tab.badge : tab.badgeCount;

        return (
          <Pressable
            key={String(tabVal ?? `tab-${idx}`)}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label}${badgeNum !== undefined ? ` (${badgeNum})` : ''}`}
            accessibilityState={{ selected: isSelected }}
            hitSlop={HitSlop.sm}
            onPress={() => notifySelect(tabVal)}
            style={({ pressed }) => [
              styles.tab,
              isSelected && [styles.tabActive, { borderColor: activeColor }],
              pressed && styles.tabPressed,
            ]}
          >
            {tab.icon ? (
              <Ionicons
                name={tab.icon}
                size={14}
                color={isSelected ? activeColor : Colors.light.textSecondary}
                style={styles.icon}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                isSelected && [styles.labelActive, { color: activeColor }],
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {badgeNum !== undefined && badgeNum > 0 ? (
              <View
                style={[
                  styles.badge,
                  isSelected ? { backgroundColor: activeColor } : styles.badgeInactive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected ? styles.badgeTextActive : styles.badgeTextInactive,
                  ]}
                >
                  {badgeNum > 99 ? '99+' : badgeNum}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 34,
  },
  tabActive: {
    backgroundColor: Colors.light.surface,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  tabPressed: {
    opacity: 0.85,
  },
  icon: {
    marginRight: 5,
  },
  label: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInactive: {
    backgroundColor: Colors.light.border,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  badgeTextInactive: {
    color: Colors.light.textSecondary,
  },
});
