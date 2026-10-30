import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants/theme';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'PENDING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CASH'
  | 'BANK';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function Badge({
  label,
  variant = 'neutral',
  style,
  textStyle,
  size = 'sm',
  showDot = true,
}: BadgeProps) {
  const normalizedVariant = getNormalizedVariant(variant);
  const colorScheme = badgeStyles[normalizedVariant];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.base, styles[size], colorScheme.container, style]}
    >
      {showDot ? <View style={[styles.dot, styles[`${size}Dot`], colorScheme.dot]} /> : null}
      <Text
        style={[
          styles.text,
          styles[`${size}Text`],
          colorScheme.text,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function getNormalizedVariant(v: BadgeVariant): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (v) {
    case 'CONFIRMED':
    case 'APPROVED':
    case 'ACTIVE':
    case 'CASH':
      return 'success';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'BANK':
      return 'warning';
    case 'REJECTED':
    case 'INACTIVE':
      return 'danger';
    case 'info':
      return 'info';
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'danger';
    default:
      return 'neutral';
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  sm: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  md: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
  },
  dot: {
    borderRadius: Radius.full,
    marginRight: 5,
  },
  smDot: {
    width: 6,
    height: 6,
  },
  mdDot: {
    width: 8,
    height: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  smText: {
    fontSize: 10,
    lineHeight: 12,
  },
  mdText: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
  },
});

const badgeStyles = {
  success: StyleSheet.create({
    container: {
      backgroundColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    dot: {
      backgroundColor: '#059669',
    },
    text: {
      color: '#065F46',
    },
  }),
  warning: StyleSheet.create({
    container: {
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    dot: {
      backgroundColor: '#D97706',
    },
    text: {
      color: '#92400E',
    },
  }),
  danger: StyleSheet.create({
    container: {
      backgroundColor: '#FFF1F2',
      borderColor: '#FECDD3',
    },
    dot: {
      backgroundColor: '#E11D48',
    },
    text: {
      color: '#9F1239',
    },
  }),
  info: StyleSheet.create({
    container: {
      backgroundColor: '#F0F9FF',
      borderColor: '#BAE6FD',
    },
    dot: {
      backgroundColor: '#0284C7',
    },
    text: {
      color: '#0369A1',
    },
  }),
  neutral: StyleSheet.create({
    container: {
      backgroundColor: '#F1F5F9',
      borderColor: '#CBD5E1',
    },
    dot: {
      backgroundColor: '#64748B',
    },
    text: {
      color: '#334155',
    },
  }),
};
