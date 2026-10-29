import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { Radius, Shadows, Spacing } from '../../constants/theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'flat';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({
  children,
  onPress,
  style,
  variant = 'elevated',
  accessibilityLabel,
  accessibilityHint,
  ...rest
}: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'flat' && styles.flat,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && styles.pressed,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  elevated: {
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  flat: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
});
