import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { type ColorValue, StyleSheet, Text, View } from 'react-native';
import { BrandColors, Radius } from '@/constants/theme';

export interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focusedName?: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color?: ColorValue | null;
  size?: number;
  tintColor?: string;
  badge?: number | string | boolean;
  isSmallMobile?: boolean;
}

/**
 * Premium responsive bottom navbar icon with active highlight pill and optional badge.
 */
export function TabBarIcon({
  name,
  focusedName,
  focused,
  color,
  size = 22,
  tintColor = BrandColors.pink.primary,
  badge,
  isSmallMobile = false,
}: TabBarIconProps) {
  const iconName = focused && focusedName ? focusedName : name;
  const isGreen =
    tintColor === BrandColors.green.primary ||
    tintColor === BrandColors.green.dark;

  const pillBg = focused
    ? isGreen
      ? '#ECFDF5'
      : '#FFF1F5'
    : 'transparent';

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            paddingHorizontal: isSmallMobile ? 6 : 10,
            paddingVertical: isSmallMobile ? 2 : 3,
            minWidth: isSmallMobile ? 36 : 42,
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={size}
          color={(color as any) ?? tintColor}
        />
      </View>
      {badge !== undefined && badge !== false && badge !== 0 ? (
        <View style={styles.badgeWrapper}>
          {typeof badge === 'number' || typeof badge === 'string' ? (
            <View style={styles.countBadge}>
              <Text style={styles.badgeCountText} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ) : (
            <View style={styles.dotBadge} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pill: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -2,
    right: -4,
  },
  dotBadge: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BrandColors.pink.primary,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  countBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BrandColors.pink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
