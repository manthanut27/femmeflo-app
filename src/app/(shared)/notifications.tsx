import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MOCK_NOTIFICATIONS } from '@/api/mockData';
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

export type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'SALE'
  | 'APPROVAL'
  | 'INVENTORY'
  | 'SHIFT'
  | 'CUSTOMER'
  | 'OFFICER';

export interface FilterOption {
  key: NotificationFilter;
  label: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

export const FILTER_OPTIONS: FilterOption[] = [
  {
    key: 'ALL',
    label: 'All updates',
    description: 'All system alerts and notifications',
    iconName: 'layers-outline',
    color: '#0F172A',
    bgColor: '#F1F5F9',
  },
  {
    key: 'UNREAD',
    label: 'Unread',
    description: 'Notifications requiring your attention',
    iconName: 'mail-unread-outline',
    color: BrandColors.pink.dark,
    bgColor: '#FFF1F2',
  },
  {
    key: 'SALE',
    label: 'Sales',
    description: 'New orders and retail bookings',
    iconName: 'receipt-outline',
    color: '#1D4ED8',
    bgColor: '#EFF6FF',
  },
  {
    key: 'APPROVAL',
    label: 'Approvals',
    description: 'Price approvals and discounts',
    iconName: 'shield-checkmark-outline',
    color: BrandColors.pink.dark,
    bgColor: '#FFF1F2',
  },
  {
    key: 'INVENTORY',
    label: 'Inventory',
    description: 'Stock inward and dispatches',
    iconName: 'cube-outline',
    color: BrandColors.green.primary,
    bgColor: '#ECFDF5',
  },
  {
    key: 'SHIFT',
    label: 'Duty Shifts',
    description: 'Beat check-ins and field shifts',
    iconName: 'time-outline',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
  },
  {
    key: 'CUSTOMER',
    label: 'Customers',
    description: 'New shops and customer records',
    iconName: 'storefront-outline',
    color: '#C026D3',
    bgColor: '#FDF4FF',
  },
  {
    key: 'OFFICER',
    label: 'Officers',
    description: 'Manager and seller activity',
    iconName: 'person-outline',
    color: '#0D9488',
    bgColor: '#F0FDFA',
  },
];

export const FILTER_TABS = FILTER_OPTIONS.map((o) => ({ key: o.key, label: o.label }));

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
      console.warn('Live notifications endpoint unavailable, serving offline feed', err);
      setNotifications(MOCK_NOTIFICATIONS);
      setUnreadCount(MOCK_NOTIFICATIONS.filter((n) => !n.read).length);
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
    } else if (user?.role === 'SELLER') {
      if (target.startsWith('/(admin)')) {
        target = target.replace('/(admin)', '/(seller)');
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
      INVENTORY: notifications.filter(
        (n) => (n.type || '').toUpperCase() === 'INVENTORY' || (n.type || '').toUpperCase() === 'STOCK'
      ).length,
      SHIFT: notifications.filter((n) => (n.type || '').toUpperCase() === 'SHIFT').length,
      CUSTOMER: notifications.filter((n) => (n.type || '').toUpperCase() === 'CUSTOMER').length,
      OFFICER: notifications.filter((n) => (n.type || '').toUpperCase() === 'OFFICER').length,
    };
    return counts;
  }, [notifications]);

  const activeOption = useMemo(() => {
    return FILTER_OPTIONS.find((opt) => opt.key === activeFilter) || FILTER_OPTIONS[0];
  }, [activeFilter]);

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
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
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
          <View
            style={[
              styles.categoryPill,
              { backgroundColor: visuals.badgeBg, borderColor: visuals.borderColor },
            ]}
          >
            <Ionicons
              name={visuals.iconName}
              size={12}
              color={visuals.badgeColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.categoryPillText, { color: visuals.badgeColor }]}>
              {visuals.label}
            </Text>
          </View>
          <View style={styles.topRightRow}>
            {!item.read && (
              <View style={styles.unreadStatusPill}>
                <View style={styles.unreadPulseDot} />
                <Text style={styles.unreadStatusText}>NEW</Text>
              </View>
            )}
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
              <Ionicons
                name="arrow-forward"
                size={13}
                color={BrandColors.pink.primary}
                style={{ marginLeft: 4 }}
              />
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
            <Ionicons
              name="radio-outline"
              size={14}
              color={BrandColors.pink.primary}
              style={{ marginRight: 6 }}
            />
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

        {/* Search & Filter Controls Section */}
        <View style={styles.controlsSection}>
          {/* Search Input Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
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

          {/* Notification Filter Dropdown Selector */}
          <View style={styles.dropdownBarRow}>
            <TouchableOpacity
              style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerActive]}
              onPress={() => setDropdownOpen(true)}
              activeOpacity={0.75}
              accessibilityRole="combobox"
              accessibilityLabel={`Filter notifications. Currently selected: ${activeOption.label}`}
            >
              <View style={[styles.dropdownIconBox, { backgroundColor: activeOption.bgColor }]}>
                <Ionicons name={activeOption.iconName} size={16} color={activeOption.color} />
              </View>

              <View style={styles.dropdownTextCol}>
                <Text style={styles.dropdownSubLabel}>Category Filter</Text>
                <Text style={styles.dropdownActiveLabel} numberOfLines={1}>
                  {activeOption.label}
                </Text>
              </View>

              <View style={styles.dropdownRightRow}>
                <View style={styles.dropdownCountBadge}>
                  <Text style={styles.dropdownCountText}>{tabCounts[activeOption.key]}</Text>
                </View>
                <Ionicons
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#64748B"
                  style={{ marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            {activeFilter !== 'ALL' && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => setActiveFilter('ALL')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Reset filter to all updates"
              >
                <Ionicons name="refresh-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                <Text style={styles.resetFilterText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Shortcuts Bar (All Updates, Unread, and Quick Dropdown Launcher) */}
          <View style={styles.quickShortcutsRow}>
            <TouchableOpacity
              style={[
                styles.quickShortcutPill,
                activeFilter === 'ALL' && styles.quickShortcutPillActive,
              ]}
              onPress={() => setActiveFilter('ALL')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="layers-outline"
                size={13}
                color={activeFilter === 'ALL' ? '#FFFFFF' : '#64748B'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.quickShortcutText,
                  activeFilter === 'ALL' && styles.quickShortcutTextActive,
                ]}
              >
                All updates
              </Text>
              <View
                style={[
                  styles.quickShortcutBadge,
                  activeFilter === 'ALL' && styles.quickShortcutBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickShortcutBadgeText,
                    activeFilter === 'ALL' && styles.quickShortcutBadgeTextActive,
                  ]}
                >
                  {tabCounts.ALL}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickShortcutPill,
                activeFilter === 'UNREAD' && styles.quickShortcutPillActive,
              ]}
              onPress={() => setActiveFilter('UNREAD')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="mail-unread-outline"
                size={13}
                color={activeFilter === 'UNREAD' ? '#FFFFFF' : BrandColors.pink.dark}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.quickShortcutText,
                  activeFilter === 'UNREAD' && styles.quickShortcutTextActive,
                ]}
              >
                Unread
              </Text>
              <View
                style={[
                  styles.quickShortcutBadge,
                  activeFilter === 'UNREAD' && styles.quickShortcutBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickShortcutBadgeText,
                    activeFilter === 'UNREAD' && styles.quickShortcutBadgeTextActive,
                  ]}
                >
                  {tabCounts.UNREAD}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moreCategoriesBtn}
              onPress={() => setDropdownOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Select from all categories"
            >
              <Ionicons
                name="options-outline"
                size={13}
                color={BrandColors.pink.dark}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.moreCategoriesText}>More Categories</Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={BrandColors.pink.dark}
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Heading & Subtitle */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            {activeFilter === 'ALL'
              ? `All Updates (${filteredNotifications.length})`
              : `${activeOption.label} (${filteredNotifications.length})`}
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
              description={
                searchQuery
                  ? `No updates match "${searchQuery}". Try a different search term.`
                  : `There are currently no alerts matching "${activeOption.label}".`
              }
              actionTitle="Show All Updates"
              onAction={() => {
                setActiveFilter('ALL');
                setSearchQuery('');
              }}
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

      {/* Filter Dropdown Modal Sheet */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDropdownOpen(false)}>
          <Pressable style={styles.dropdownModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="funnel" size={16} color={BrandColors.pink.primary} />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>Filter Notifications</Text>
                  <Text style={styles.modalHeaderSub}>Choose a category to filter live updates</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDropdownOpen(false)}
                hitSlop={HitSlop.md}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close filter menu"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {FILTER_OPTIONS.map((opt) => {
                const isSelected = activeFilter === opt.key;
                const count = tabCounts[opt.key];
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.modalOptionRow, isSelected && styles.modalOptionRowSelected]}
                    onPress={() => {
                      setActiveFilter(opt.key);
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.modalOptionIconCircle, { backgroundColor: opt.bgColor }]}>
                      <Ionicons name={opt.iconName} size={18} color={opt.color} />
                    </View>

                    <View style={styles.modalOptionInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          style={[
                            styles.modalOptionLabel,
                            isSelected && styles.modalOptionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <View
                          style={[
                            styles.modalOptionCountBadge,
                            isSelected && styles.modalOptionCountBadgeSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalOptionCountText,
                              isSelected && styles.modalOptionCountTextSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.modalOptionDesc} numberOfLines={1}>
                        {opt.description}
                      </Text>
                    </View>

                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={BrandColors.pink.primary}
                        style={{ marginLeft: 8 }}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#CBD5E1"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setDropdownOpen(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Done selecting filter"
              >
                <Text style={styles.modalDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  controlsSection: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  dropdownBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
    marginBottom: Spacing.xs,
  },
  dropdownTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    ...Shadows.sm,
  },
  dropdownTriggerActive: {
    borderColor: BrandColors.pink.primary,
  },
  dropdownIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  dropdownTextCol: {
    flex: 1,
  },
  dropdownSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownActiveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  dropdownCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  dropdownCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  quickShortcutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickShortcutPillActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  quickShortcutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginRight: 5,
  },
  quickShortcutTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickShortcutBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  quickShortcutBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  quickShortcutBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  quickShortcutBadgeTextActive: {
    color: '#FFFFFF',
  },
  moreCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    marginLeft: 'auto',
  },
  moreCategoriesText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  sectionHeaderRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
  unreadStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    marginRight: 6,
  },
  unreadPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.pink.primary,
    marginRight: 4,
  },
  unreadStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: BrandColors.pink.dark,
    letterSpacing: 0.5,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: '#FCE7F3',
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
  // Modal styles for dropdown
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  dropdownModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  modalHeaderTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
  },
  modalScrollView: {
    maxHeight: 380,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalOptionRowSelected: {
    backgroundColor: BrandColors.pink.subtle,
  },
  modalOptionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  modalOptionInfo: {
    flex: 1,
  },
  modalOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 6,
  },
  modalOptionLabelSelected: {
    color: BrandColors.pink.dark,
  },
  modalOptionCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  modalOptionCountBadgeSelected: {
    backgroundColor: BrandColors.pink.primary,
  },
  modalOptionCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  modalOptionCountTextSelected: {
    color: '#FFFFFF',
  },
  modalOptionDesc: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: 2,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalDoneBtn: {
    backgroundColor: BrandColors.pink.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
