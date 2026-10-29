import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BrandColors, Spacing, Typography } from '../../constants/theme';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionTitle,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="summary">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={BrandColors.pink.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="sm"
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
    paddingHorizontal: Spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1.5,
    borderColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodySmall,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 320,
  },
  actionButton: {
    marginTop: Spacing.sm,
  },
});
