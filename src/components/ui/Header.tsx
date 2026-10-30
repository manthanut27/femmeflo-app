import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors, HitSlop, MaxContentWidth, Spacing, Typography } from '../../constants/theme';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  showNotificationBell?: boolean;
  unreadCount?: number;
  style?: ViewStyle;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  showNotificationBell = false,
  unreadCount = 0,
  style,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }

  function handleOpenNotifications() {
    router.push('/(shared)/notifications' as any);
  }

  return (
    <View style={[styles.outerContainer, { paddingTop: insets.top + Spacing.sm }, style]}>
      <View style={styles.innerContainer}>
        <View style={styles.leftContainer}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={handleBack}
              hitSlop={HitSlop.md}
              style={({ pressed }) => [styles.backButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="arrow-back" size={24} color="#0F172A" />
            </Pressable>
          ) : null}
          <View style={styles.titleWrapper}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightContainer}>
          {showNotificationBell ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              onPress={handleOpenNotifications}
              hitSlop={HitSlop.md}
              style={({ pressed }) => [styles.bellButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="notifications-outline" size={22} color="#0F172A" />
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    width: '100%',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  backButton: {
    marginRight: Spacing.md,
    padding: 2,
    borderRadius: 8,
  },
  iconPressed: {
    opacity: 0.6,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    ...Typography.h1,
    fontSize: 20,
    lineHeight: 26,
    color: '#0F172A',
  },
  subtitle: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  bellButton: {
    position: 'relative',
    padding: Spacing.xs + 2,
    borderRadius: 8,
  },
  unreadBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: BrandColors.pink.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
