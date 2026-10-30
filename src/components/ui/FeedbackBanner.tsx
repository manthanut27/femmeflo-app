import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { HitSlop, Radius, Spacing, Typography } from '../../constants/theme';

export type FeedbackType = 'error' | 'success' | 'warning' | 'info';

export interface FeedbackBannerProps {
  type: FeedbackType;
  message: string;
  title?: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function FeedbackBanner({
  type,
  message,
  title,
  onDismiss,
  actionLabel,
  onAction,
  style,
}: FeedbackBannerProps) {
  const configs = {
    error: {
      icon: 'alert-circle' as const,
      bg: '#FEF2F2',
      border: '#FECACA',
      iconColor: '#DC2626',
      textColor: '#991B1B',
      titleColor: '#7F1D1D',
      badge: 'ERROR',
    },
    success: {
      icon: 'checkmark-circle' as const,
      bg: '#ECFDF5',
      border: '#A7F3D0',
      iconColor: '#10B981',
      textColor: '#065F46',
      titleColor: '#064E3B',
      badge: 'SUCCESS',
    },
    warning: {
      icon: 'warning' as const,
      bg: '#FFFBEB',
      border: '#FDE68A',
      iconColor: '#D97706',
      textColor: '#92400E',
      titleColor: '#78350F',
      badge: 'NOTICE',
    },
    info: {
      icon: 'information-circle' as const,
      bg: '#F0F9FF',
      border: '#BAE6FD',
      iconColor: '#0284C7',
      textColor: '#0369A1',
      titleColor: '#0C4A6E',
      badge: 'INFO',
    },
  };

  const conf = configs[type] || configs.info;

  return (
    <View
      accessibilityRole={type === 'error' ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          backgroundColor: conf.bg,
          borderColor: conf.border,
        },
        style,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={conf.icon} size={20} color={conf.iconColor} />
      </View>

      <View style={styles.textContainer}>
        {title ? (
          <Text style={[styles.title, { color: conf.titleColor }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <Text style={[styles.message, { color: conf.textColor }]}>
          {message}
        </Text>

        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={styles.actionBtn}
            hitSlop={HitSlop.sm}
          >
            <Text style={[styles.actionBtnText, { color: conf.iconColor }]}>
              {actionLabel}
            </Text>
            <Ionicons name="arrow-forward" size={13} color={conf.iconColor} style={{ marginLeft: 3 }} />
          </Pressable>
        ) : null}
      </View>

      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={styles.dismissBtn}
          hitSlop={HitSlop.md}
        >
          <Ionicons name="close" size={18} color={conf.textColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    width: '100%',
  },
  iconContainer: {
    marginRight: Spacing.sm,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: Spacing.xs,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    lineHeight: 18,
  },
  message: {
    ...Typography.bodySmall,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs + 2,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dismissBtn: {
    padding: 2,
    marginLeft: Spacing.xs,
    marginTop: -2,
    opacity: 0.75,
  },
});

