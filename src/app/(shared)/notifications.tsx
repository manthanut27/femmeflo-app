import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { notificationsApi } from '@/api/notifications';
import type { NotificationItem } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.listNotifications();
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  async function handleMarkAllAsRead() {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read', err);
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleItemPress(item: NotificationItem) {
    if (!item.read) {
      try {
        await notificationsApi.markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.warn('Failed to mark read', err);
      }
    }
  }

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <Card
      onPress={() => handleItemPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.read ? 'read' : 'unread'}`}
      accessibilityHint={!item.read ? 'Tap to mark as read' : undefined}
      style={[styles.card, !item.read && styles.unreadCard]}
    >
      <View style={styles.headerRow}>
        <View style={styles.leftRow}>
          {!item.read ? <View style={styles.unreadDot} /> : null}
          <Text style={[styles.title, !item.read && styles.unreadTitle]}>{item.title}</Text>
        </View>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle={`${unreadCount} unread alerts`}
        showBack
        rightAction={
          unreadCount > 0 ? (
            <Pressable
              onPress={handleMarkAllAsRead}
              hitSlop={HitSlop.md}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              style={({ pressed }) => [styles.markAllBtn, pressed && styles.markAllBtnPressed]}
            >
              <Ionicons name="checkmark-done" size={16} color={BrandColors.pink.primary} style={{ marginRight: 4 }} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.innerContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="No Notifications"
            description="You are all caught up! New alerts regarding shifts, price approvals, and stock transfers will appear here."
          />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[BrandColors.pink.primary]}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingContainer: {
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Elevation.low,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.tint,
    backgroundColor: BrandColors.pink.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.pink.primary,
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    fontWeight: '600',
  },
  unreadTitle: {
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  date: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  markAllBtnPressed: {
    opacity: 0.7,
  },
  markAllText: {
    ...Typography.caption,
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
});
