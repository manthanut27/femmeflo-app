import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { notificationsApi } from '@/api/notifications';
import type { NotificationItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'SALE'
  | 'APPROVAL'
  | 'INVENTORY'
  | 'SHIFT'
  | 'CUSTOMER'
  | 'OFFICER';

interface FilterTabOption {
  key: NotificationFilter;
  label: string;
}

const FILTER_TABS: FilterTabOption[] = [
  { key: 'ALL', label: 'All updates' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'SALE', label: 'Sales' },
  { key: 'APPROVAL', label: 'Approvals' },
  { key: 'INVENTORY', label: 'Inventory' },
  { key: 'SHIFT', label: 'Duty Shifts' },
  { key: 'CUSTOMER', label: 'Customers' },
  { key: 'OFFICER', label: 'Officers' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Desktop / Mobile notification permission state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Check initial notification permission on Mobile/Web
  useEffect(() => {
    async function checkPermission() {
      try {
        const stored = await AsyncStorage.getItem('@femmeflo:mobile_notifications_enabled');
        if (stored === 'true') {
          setNotificationsEnabled(true);
          return;
        }
      } catch {}
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          setNotificationsEnabled(true);
        }
      }
    }
    checkPermission();
  }, []);

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

  async function handleActionClick(item: NotificationItem) {
    await handleItemPress(item);
    if (!item.actionUrl) return;

    if (item.actionUrl.startsWith('http')) {
      try {
        await Linking.openURL(item.actionUrl);
      } catch (e) {
        console.warn('Could not open external url', e);
      }
      return;
    }

    // Role-aware internal routing
    let target = item.actionUrl;
    if (user?.role === 'MANAGER') {
      if (target.startsWith('/(admin)')) {
        target = target.replace('/(admin)', '/(manager)');
      }
    }
    try {
      router.push(target as any);
    } catch (e) {
      console.warn('Could not navigate to target', target, e);
    }
  }

  async function handleEnableDesktopNotifications() {
    if (notificationsEnabled) return;
    setIsRequestingPermission(true);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          await AsyncStorage.setItem('@femmeflo:mobile_notifications_enabled', 'true');
        }
      } else {
        // Mobile platform: activate mobile alerts authorization
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('@femmeflo:mobile_notifications_enabled', 'true');
      }
    } catch (err) {
      console.warn('Notification permission request error', err);
    } finally {
      setIsRequestingPermission(false);
    }
  }

  // Count items per filter tab
  const tabCounts = useMemo(() => {
    const counts: Record<NotificationFilter, number> = {
      ALL: notifications.length,
      UNREAD: notifications.filter((n) => !n.read).length,
      SALE: notifications.filter((n) => (n.type || '').toUpperCase() === 'SALE').length,
      APPROVAL: notifications.filter((n) => (n.type || '').toUpperCase() === 'APPROVAL').length,
      INVENTORY: notifications.filter((n) => (n.type || '').toUpperCase() === 'INVENTORY' || (n.type || '').toUpperCase() === 'STOCK').length,
      SHIFT: notifications.filter((n) => (n.type || '').toUpperCase() === 'SHIFT').length,
      CUSTOMER: notifications.filter((n) => (n.type || '').toUpperCase() === 'CUSTOMER').length,
      OFFICER: notifications.filter((n) => (n.type || '').toUpperCase() === 'OFFICER').length,
    };
    return counts;
  }, [notifications]);

  // Filtered list with tab filter and real-time search
  const filteredNotifications = useMemo(() => {
    let list = notifications;
    if (activeFilter === 'UNREAD') {
      list = list.filter((n) => !n.read);
    } else if (activeFilter === 'INVENTORY') {
      list = list.filter(
        (n) => (n.type || '').toUpperCase() === 'INVENTORY' || (n.type || '').toUpperCase() === 'STOCK'
      );
    } else if (activeFilter !== 'ALL') {
      list = list.filter((n) => (n.type || '').toUpperCase() === activeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((n) => {
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchMsg = (n.message || '').toLowerCase().includes(q);
      const matchCat = (n.categoryLabel || '').toLowerCase().includes(q);
      const matchType = (n.type || '').toLowerCase().includes(q);
      return matchTitle || matchMsg || matchCat || matchType;
    });
  }, [notifications, activeFilter, searchQuery]);

  function formatTimestamp(isoString: string): string {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = d.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      let hours = d.getHours();
      const mins = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours.toString().padStart(2, '0');
      return `${day} ${month}, ${hoursStr}:${mins} ${ampm}`;
    } catch {
      return isoString;
    }
  }

  function getCategoryVisuals(item: NotificationItem) {
    const type = (item.type || '').toUpperCase();
    switch (type) {
      case 'APPROVAL':
        return {
          label: item.categoryLabel || 'Approval Alerts',
          iconName: 'shield-checkmark-outline' as const,
          badgeColor: BrandColors.pink.dark,
          badgeBg: '#FFF1F2',
          borderColor: '#FECDD3',
        };
      case 'INVENTORY':
      case 'STOCK':
        return {
          label: item.categoryLabel || 'Inventory & Warehouses',
          iconName: 'cube-outline' as const,
          badgeColor: BrandColors.green.primary,
          badgeBg: '#ECFDF5',
          borderColor: '#A7F3D0',
        };
      case 'SALE':
        return {
          label: item.categoryLabel || 'Sales Orders',
          iconName: 'receipt-outline' as const,
          badgeColor: '#1D4ED8',
          badgeBg: '#EFF6FF',
          borderColor: '#BFDBFE',
        };
      case 'SHIFT':
        return {
          label: item.categoryLabel || 'Duty Shifts',
          iconName: 'time-outline' as const,
          badgeColor: '#7C3AED',
          badgeBg: '#F5F3FF',
          borderColor: '#DDD6FE',
        };
      case 'CUSTOMER':
        return {
          label: item.categoryLabel || 'Customers',
          iconName: 'storefront-outline' as const,
          badgeColor: '#C026D3',
          badgeBg: '#FDF4FF',
          borderColor: '#F5D0FE',
        };
      case 'OFFICER':
        return {
          label: item.categoryLabel || 'Officers',
          iconName: 'person-outline' as const,
          badgeColor: '#0D9488',
          badgeBg: '#F0FDFA',
          borderColor: '#99F6E4',
        };
      default:
        return {
          label: item.categoryLabel || 'System',
          iconName: 'information-circle-outline' as const,
          badgeColor: '#475569',
          badgeBg: '#F8FAFC',
          borderColor: '#E2E8F0',
        };
    }
  }

  const workspaceBreadcrumb =
    user?.role === 'SUPER_ADMIN'
      ? 'Admin workspace / Notifications'
      : user?.role === 'MANAGER'
      ? 'Manager workspace / Notifications'
      : 'Seller workspace / Notifications';

  const renderNotificationCard = ({ item }: { item: NotificationItem }) => {
    const visuals = getCategoryVisuals(item);

    return (
      <Card
        onPress={() => handleActionClick(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.read ? 'read' : 'unread'}`}
        style={[styles.card, !item.read && styles.unreadCard]}
      >
        {/* Top Tag & Time Row */}
        <View style={styles.cardTopRow}>
          <View style={[styles.categoryPill, { backgroundColor: visuals.badgeBg, borderColor: visuals.borderColor }]}>
            <Ionicons name={visuals.iconName} size={12} color={visuals.badgeColor} style={{ marginRight: 4 }} />
            <Text style={[styles.categoryPillText, { color: visuals.badgeColor }]}>{visuals.label}</Text>
          </View>
          <View style={styles.topRightRow}>
            {!item.read && <View style={styles.unreadPulseDot} />}
            <Text style={styles.timestampText}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}>{item.title}</Text>

        {/* Message */}
        <Text style={styles.cardMessage}>{item.message}</Text>

        {/* Action Link Button if provided */}
        {item.actionUrl && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => handleActionClick(item)}
              hitSlop={HitSlop.md}
              style={({ pressed }) => [styles.actionLinkBtn, pressed && styles.actionLinkBtnPressed]}
              accessibilityRole="link"
              accessibilityLabel={`${item.actionLabel || 'Open details'} for ${item.title}`}
            >
              <Text style={styles.actionLinkText}>{item.actionLabel || 'Open details'}</Text>
              <Ionicons name="arrow-forward" size={13} color={BrandColors.pink.primary} style={{ marginLeft: 3 }} />
            </Pressable>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle="Live system feeds"
        showBack
        rightAction={
          <Pressable
            onPress={handleMarkAllAsRead}
            disabled={unreadCount === 0 || isMarkingAll}
            hitSlop={HitSlop.md}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            style={({ pressed }) => [
              styles.markAllBtn,
              unreadCount === 0 && { opacity: 0.5 },
              pressed && styles.markAllBtnPressed,
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={16}
              color={unreadCount > 0 ? BrandColors.pink.primary : '#94A3B8'}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.markAllText, unreadCount === 0 && { color: '#94A3B8' }]}>
              Mark all as read
            </Text>
          </Pressable>
        }
      />

      <View style={styles.innerContainer}>
        {/* Workspace Breadcrumb & Summary Header */}
        <View style={styles.breadcrumbBanner}>
          <View style={styles.breadcrumbRow}>
            <Ionicons name="radio-outline" size={14} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
            <Text style={styles.breadcrumbText}>{workspaceBreadcrumb}</Text>
          </View>
          <Text style={styles.workspaceLeadDescription}>
            Real-time notification center for sales, stock allocations, shop duty shifts, approvals, and team activity.
          </Text>
        </View>

        {/* Enable Desktop mobile Notifications Card */}
        <Card variant="flat" style={styles.desktopNotificationCard}>
          <View style={styles.desktopCardLeft}>
            <View style={styles.desktopIconCircle}>
              <Ionicons
                name={notificationsEnabled ? 'notifications' : 'phone-portrait-outline'}
                size={22}
                color={notificationsEnabled ? BrandColors.green.primary : BrandColors.pink.primary}
              />
            </View>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={styles.desktopCardTitle}>Enable Desktop mobile Notifications</Text>
              <Text style={styles.desktopCardDesc}>
                Receive alerts when sales are booked, stock is moved, or shifts are started.
              </Text>
            </View>
          </View>
          <Button
            title={notificationsEnabled ? 'Notifications Active ✓' : 'Allow Notifications'}
            onPress={handleEnableDesktopNotifications}
            variant={notificationsEnabled ? 'outline' : 'primary'}
            size="sm"
            loading={isRequestingPermission}
            disabled={notificationsEnabled}
            icon={
              notificationsEnabled ? (
                <Ionicons name="checkmark-circle" size={15} color={BrandColors.green.primary} />
              ) : (
                <Ionicons name="notifications" size={15} color="#FFFFFF" />
              )
            }
            style={styles.allowButton}
          />
        </Card>

        {/* Filter Category Scrollable Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {FILTER_TABS.map((tab) => {
              const isSelected = activeFilter === tab.key;
              const count = tabCounts[tab.key];
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveFilter(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.filterTabPill, isSelected && styles.filterTabPillActive]}
                >
                  <Text style={[styles.filterTabText, isSelected && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 || tab.key === 'ALL' || tab.key === 'UNREAD' ? (
                    <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                      <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notifications..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={HitSlop.sm}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        {/* Section Heading & Subtitle */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            {activeFilter === 'ALL'
              ? `All Updates (${filteredNotifications.length})`
              : `${FILTER_TABS.find((t) => t.key === activeFilter)?.label || 'Updates'} (${filteredNotifications.length})`}
          </Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Click any notification to open the associated operational module.
          </Text>
        </View>

        {/* Main List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={{ flex: 1, padding: Spacing.lg }}>
            <EmptyState
              icon="notifications-off-outline"
              title="No Notifications Found"
              description={`There are currently no alerts matching "${FILTER_TABS.find((t) => t.key === activeFilter)?.label}".`}
            />
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotificationCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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
  breadcrumbBanner: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  breadcrumbText: {
    ...Typography.overline,
    color: BrandColors.pink.primary,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  workspaceLeadDescription: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  desktopNotificationCard: {
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    ...Shadows.sm,
  },
  desktopCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  desktopIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  desktopCardTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    marginBottom: 2,
  },
  desktopCardDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  allowButton: {
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  tabsWrapper: {
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tabsContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 6,
  },
  filterTabPillActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  filterTabText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginRight: 6,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  sectionHeaderRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  sectionHeaderTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  sectionHeaderSubtitle: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  loadingContainer: {
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.pink.primary,
    borderColor: '#FCE7F3',
    backgroundColor: '#FFFDFE',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BrandColors.pink.primary,
    marginRight: 6,
  },
  timestampText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
  },
  cardTitle: {
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardTitleUnread: {
    color: '#09090B',
    fontWeight: '800',
  },
  cardMessage: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  actionRow: {
    marginTop: Spacing.xs,
    alignItems: 'flex-start',
  },
  actionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.pink.subtle,
  },
  actionLinkBtnPressed: {
    opacity: 0.7,
  },
  actionLinkText: {
    ...Typography.caption,
    color: BrandColors.pink.primary,
    fontWeight: '700',
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
