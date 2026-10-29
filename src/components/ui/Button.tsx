import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { BrandColors, HitSlop, Radius, Shadows, Spacing, Typography } from '../../constants/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?:
    | 'primary'
    | 'secondary'
    | 'admin'
    | 'outline'
    | 'outline-secondary'
    | 'outline-admin'
    | 'danger'
    | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  const indicatorColor =
    variant === 'outline' || variant === 'ghost'
      ? BrandColors.pink.primary
      : variant === 'outline-secondary'
      ? BrandColors.green.primary
      : variant === 'outline-admin'
      ? BrandColors.pink.dark
      : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      disabled={!isInteractive}
      hitSlop={size === 'sm' ? HitSlop.md : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        pressed && isInteractive && pressedStyles[variant],
        disabled && disabledContainerStyles[variant],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={indicatorColor}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              styles[`${size}Text`],
              styles[`${variant}Text`],
              disabled && disabledTextStyles[variant],
              icon ? styles.textWithIcon : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  sm: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 38,
  },
  md: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: 48,
  },
  lg: {
    paddingVertical: Spacing.lg - 2,
    paddingHorizontal: Spacing.xxl,
    minHeight: 54,
  },
  primary: {
    backgroundColor: BrandColors.pink.primary,
    ...Shadows.sm,
  },
  secondary: {
    backgroundColor: BrandColors.green.primary,
    ...Shadows.sm,
  },
  admin: {
    backgroundColor: BrandColors.pink.dark,
    ...Shadows.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: BrandColors.pink.primary,
  },
  'outline-secondary': {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: BrandColors.green.primary,
  },
  'outline-admin': {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: BrandColors.pink.dark,
  },
  danger: {
    backgroundColor: BrandColors.pink.deep,
    ...Shadows.sm,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  mdText: {
    ...Typography.bodyMedium,
  },
  lgText: {
    ...Typography.bodyLarge,
    fontWeight: '700',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  adminText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: BrandColors.pink.primary,
  },
  'outline-secondaryText': {
    color: BrandColors.green.primary,
  },
  'outline-adminText': {
    color: BrandColors.pink.dark,
  },
  dangerText: {
    color: '#FFFFFF',
  },
  ghostText: {
    color: BrandColors.pink.primary,
  },
  textWithIcon: {
    marginLeft: Spacing.sm,
  },
});

const pressedStyles = StyleSheet.create({
  primary: {
    backgroundColor: BrandColors.pink.pressed,
    transform: [{ scale: 0.985 }],
  },
  secondary: {
    backgroundColor: BrandColors.green.pressed,
    transform: [{ scale: 0.985 }],
  },
  admin: {
    backgroundColor: BrandColors.pink.deep,
    transform: [{ scale: 0.985 }],
  },
  outline: {
    backgroundColor: BrandColors.pink.subtle,
    transform: [{ scale: 0.985 }],
  },
  'outline-secondary': {
    backgroundColor: BrandColors.green.surface,
    transform: [{ scale: 0.985 }],
  },
  'outline-admin': {
    backgroundColor: BrandColors.pink.subtle,
    transform: [{ scale: 0.985 }],
  },
  danger: {
    backgroundColor: '#881337',
    transform: [{ scale: 0.985 }],
  },
  ghost: {
    backgroundColor: 'rgba(230, 28, 93, 0.08)',
  },
});

const disabledContainerStyles = StyleSheet.create({
  primary: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  secondary: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  admin: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: '#CBD5E1',
  },
  'outline-secondary': {
    backgroundColor: 'transparent',
    borderColor: '#CBD5E1',
  },
  'outline-admin': {
    backgroundColor: 'transparent',
    borderColor: '#CBD5E1',
  },
  danger: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const disabledTextStyles = StyleSheet.create({
  primary: {
    color: '#94A3B8',
  },
  secondary: {
    color: '#94A3B8',
  },
  admin: {
    color: '#94A3B8',
  },
  outline: {
    color: '#94A3B8',
  },
  'outline-secondary': {
    color: '#94A3B8',
  },
  'outline-admin': {
    color: '#94A3B8',
  },
  danger: {
    color: '#94A3B8',
  },
  ghost: {
    color: '#94A3B8',
  },
});
