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
import { BrandColors, Colors, HitSlop, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { Badge, BadgeVariant } from './Badge';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  changeLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap | React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  iconBg?: string; // Design system alias
  badge?: string;
  badgeVariant?: BadgeVariant;
  trend?: { value: string; isPositive?: boolean };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  variant?: 'pink' | 'green' | 'default' | 'neutral';
}

export function StatCard({
  title,
  value,
  subtitle,
  changeLabel,
  icon,
  iconColor,
  iconBgColor,
  iconBg,
  badge,
  badgeVariant = 'neutral',
  trend,
  onPress,
  style,
  accentColor,
  variant,
}: StatCardProps) {
  const isCustomIcon = React.isValidElement(icon);
  const resolvedAccentColor =
    accentColor ||
    (variant === 'pink' ? BrandColors.pink.primary : variant === 'green' ? BrandColors.green.primary : undefined);
  const resolvedBgColor =
    iconBg ||
    iconBgColor ||
    (variant === 'green' ? BrandColors.green.subtle : BrandColors.pink.subtle);
  const resolvedIconColor =
    iconColor ||
    (variant === 'green' ? BrandColors.green.primary : BrandColors.pink.primary);
  const displaySubtitle = subtitle || changeLabel;

  const content = (
    <View style={[styles.card, resolvedAccentColor ? { borderLeftColor: resolvedAccentColor, borderLeftWidth: 3.5 } : null, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {icon ? (
          isCustomIcon ? (
            icon
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: resolvedBgColor }]}>
              <Ionicons name={icon as any} size={16} color={resolvedIconColor} />
            </View>
          )
        ) : null}
      </View>

      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>

      {trend ? (
        <View style={styles.trendRow}>
          <View style={[styles.trendPill, trend.isPositive !== false ? styles.trendPositive : styles.trendNegative]}>
            <Ionicons
              name={trend.isPositive !== false ? 'trending-up' : 'trending-down'}
              size={12}
              color={trend.isPositive !== false ? '#156035' : '#DC2626'}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.trendText, trend.isPositive !== false ? styles.trendTextPositive : styles.trendTextNegative]}>
              {trend.value}
            </Text>
          </View>
        </View>
      ) : null}

      {displaySubtitle || badge ? (
        <View style={styles.footerRow}>
          {displaySubtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          ) : <View style={{ flex: 1 }} />}
          {badge ? <Badge label={badge} variant={badgeVariant} size="sm" /> : null}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
        hitSlop={HitSlop.sm}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressableWrapper,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
      style={styles.pressableWrapper}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  pressableWrapper: {
    flex: 1,
    minWidth: 140,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
    ...Shadows.sm,
    justifyContent: 'space-between',
    minHeight: 104,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.xs,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...Typography.h2,
    color: Colors.light.heading,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginVertical: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  trendPositive: {
    backgroundColor: '#EDF7F0',
    borderColor: '#BCE3C8',
  },
  trendNegative: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  trendTextPositive: {
    color: '#156035',
  },
  trendTextNegative: {
    color: '#DC2626',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontSize: 11,
    flex: 1,
    marginRight: Spacing.xs,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
