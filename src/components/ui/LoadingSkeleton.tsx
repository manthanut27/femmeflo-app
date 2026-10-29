import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Radius, Spacing } from '../../constants/theme';

export interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function LoadingSkeleton({
  width = '100%',
  height = 20,
  borderRadius = Radius.sm,
  style,
}: LoadingSkeletonProps) {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.row}>
        <LoadingSkeleton width="60%" height={20} />
        <LoadingSkeleton width={60} height={20} borderRadius={Radius.full} />
      </View>
      <LoadingSkeleton width="40%" height={14} style={{ marginTop: Spacing.sm }} />
      <LoadingSkeleton width="80%" height={14} style={{ marginTop: Spacing.xs }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E2E8F0',
  },
  cardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
