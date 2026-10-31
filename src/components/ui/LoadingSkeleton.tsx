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

export function CardSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.cardSkeleton, style]}>
      <View style={styles.row}>
        <LoadingSkeleton width="60%" height={20} />
        <LoadingSkeleton width={60} height={20} borderRadius={Radius.full} />
      </View>
      <LoadingSkeleton width="40%" height={14} style={{ marginTop: Spacing.sm }} />
      <LoadingSkeleton width="80%" height={14} style={{ marginTop: Spacing.xs }} />
    </View>
  );
}

export function StatCardSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.statCardSkeleton, style]}>
      <View style={styles.headerRow}>
        <LoadingSkeleton width="55%" height={14} />
        <LoadingSkeleton width={28} height={28} borderRadius={Radius.full} />
      </View>
      <LoadingSkeleton width="65%" height={24} style={{ marginVertical: Spacing.xs }} />
      <View style={styles.footerRow}>
        <LoadingSkeleton width="45%" height={12} />
      </View>
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
    width: '100%',
  },
  statCardSkeleton: {
    flex: 1,
    minWidth: 140,
    minHeight: 104,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
});
