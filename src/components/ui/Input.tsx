import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { BrandColors, HitSlop, Radius, Spacing, Typography } from '../../constants/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  helperText?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  containerStyle,
  inputStyle,
  leftIcon,
  rightIcon,
  isPassword = false,
  secureTextEntry,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = isPassword ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={[styles.label, isFocused && styles.labelFocused, Boolean(error) && styles.labelError]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      >
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor="#94A3B8"
          secureTextEntry={isSecure}
          accessibilityLabel={label || rest.placeholder}
          accessibilityHint={helperText}
          aria-invalid={Boolean(error)}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.rightIconContainer}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={HitSlop.md}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={isFocused ? BrandColors.pink.primary : '#64748B'}
            />
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        ) : null}
      </View>
      {error ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="alert-circle" size={14} color={BrandColors.pink.deep} style={{ marginRight: 4 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#334155',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelFocused: {
    color: BrandColors.pink.primary,
  },
  labelError: {
    color: BrandColors.pink.deep,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  inputFocused: {
    borderColor: BrandColors.pink.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: BrandColors.pink.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputError: {
    borderColor: BrandColors.pink.deep,
    backgroundColor: '#FFF1F2',
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: '#0F172A',
    paddingVertical: Spacing.sm,
  },
  leftIconContainer: {
    marginRight: Spacing.sm,
  },
  rightIconContainer: {
    marginLeft: Spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: BrandColors.pink.deep,
    fontWeight: '600',
  },
  helperText: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: Spacing.xs,
  },
});
