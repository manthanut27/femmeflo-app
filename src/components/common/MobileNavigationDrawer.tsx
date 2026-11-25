import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/Badge';
import {
  BorderRadius,
  BrandColors,
  Colors,
  HitSlop,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { checkHasActiveShift } from '@/utils/shiftGuard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.86, 380);

export interface MobileNavigationDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function MobileNavigationDrawer({ visible, onClose }: MobileNavigationDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [hasActiveShift, setHasActiveShift] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      checkHasActiveShift(user.id)
        .then((res) => setHasActiveShift(res.hasActiveShift))
        .catch(() => setHasActiveShift(false));
    }
  }, [visible, user?.id]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      try {
        router.push(route as any);
      } catch {
        router.replace(route as any);
      }
    }, 150);
  };

  const handleItemPress = (item: { route: string; [key: string]: any }) => {
    handleNavigate(item.route);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await logout();
          router.replace('/(auth)/login' as any);
        },
      },
    ]);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isManager = user?.role === 'MANAGER';

  const SUPER_ADMIN_MAIN_NAV = [
    { title: 'Dashboard', icon: 'pie-chart-outline', route: '/(admin)' },
    { title: 'Managers', icon: 'people-outline', route: '/(admin)/users' },
    { title: 'Field Officers', icon: 'shield-checkmark-outline', route: '/(admin)/permissions' },
    { title: 'Customers', icon: 'storefront-outline', route: '/(admin)/customers' },
    { title: 'Inventory', icon: 'cube-outline', route: '/(admin)/inventory' },
    { title: 'Products', icon: 'pricetag-outline', route: '/(admin)/products' },
    { title: 'Categories', icon: 'grid-outline', route: '/(admin)/categories' },
    { title: 'Sales', icon: 'receipt-outline', route: '/(admin)/sales' },
    { title: 'Approvals', icon: 'checkmark-done-circle-outline', route: '/(admin)/approvals' },
  ];

  const SUPER_ADMIN_MANAGEMENT_NAV = [
    { title: 'Field Tracking', icon: 'navigate-outline', route: '/(admin)/shifts' },
    { title: 'Reports & Analytics', icon: 'bar-chart-outline', route: '/(admin)/reports' },
    { title: 'Invoices & Billing', icon: 'document-text-outline', route: '/(admin)/invoices' },
    { title: 'Incentives', icon: 'cash-outline', route: '/(admin)/incentives' },
    { title: 'Notifications', icon: 'notifications-outline', route: '/(shared)/notifications' },
    { title: 'System Settings', icon: 'settings-outline', route: '/(admin)/settings' },
    { title: 'Change Password', icon: 'lock-closed-outline', route: '/(admin)/settings/password' },
  ];

  const isRouteActive = (route: string) => {
    const normalized = route.replace('/(admin)', '').replace('/(shared)', '');
    if (!normalized || normalized === '/') {
      return pathname === '/' || pathname === '/(admin)' || pathname === '/index';
    }
    return pathname === normalized || pathname.startsWith(`${normalized}/`);
  };

  const NAV_ITEMS = isSuperAdmin
    ? [
        {
          title: 'Reports & Analytics',
          subtitle: 'Revenue, performance & CSV exports',
          icon: 'bar-chart-outline',
          route: '/(admin)/reports',
          highlight: true,
          badge: 'REPORTS',
        },
        {
          title: 'System Settings',
          subtitle: 'Legal entity, pricing floors & configuration',
          icon: 'settings-outline',
          route: '/(admin)/settings',
        },
        {
          title: 'Invoices & Billing',
          subtitle: 'Official tax invoices, WhatsApp & PDF',
          icon: 'document-text-outline',
          route: '/(admin)/invoices',
        },
        {
          title: 'Duty Shifts & Attendance',
          subtitle: 'Live GPS route tracking & audit timeline',
          icon: 'speedometer-outline',
          route: '/(admin)/shifts',
        },
        {
          title: 'Retail Stores & Customers',
          subtitle: 'Retail outlets, KYC & store visits',
          icon: 'storefront-outline',
          route: '/(admin)/customers',
        },
        {
          title: 'Product Catalog',
          subtitle: 'National SKUs & base price rules',
          icon: 'pricetag-outline',
          route: '/(admin)/products',
        },
        {
          title: 'Product Categories',
          subtitle: 'FMCG classifications, HSN & GST codes',
          icon: 'grid-outline',
          route: '/(admin)/categories',
        },
        {
          title: 'Incentives Engine',
          subtitle: 'Seller commission & payout structures',
          icon: 'cash-outline',
          route: '/(admin)/incentives',
        },
        {
          title: 'Access Permissions',
          subtitle: 'Fine-grained access matrix & security',
          icon: 'key-outline',
          route: '/(admin)/permissions',
        },
        {
          title: 'All Admin Operations',
          subtitle: 'Central launcher for all 13 modules',
          icon: 'apps-outline',
          route: '/(admin)/actions',
          badge: '13 TOOLS',
        },
        {
          title: 'Change Password',
          subtitle: 'Update administrative password',
          icon: 'lock-closed-outline',
          route: '/(admin)/settings/password',
        },
        {
          title: 'Notifications',
          subtitle: 'System alerts & announcements',
          icon: 'notifications-outline',
          route: '/(shared)/notifications',
        },
      ]
    : [
        {
          title: 'Dashboard',
          subtitle: 'Overview & daily metrics',
          icon: 'pie-chart-outline',
          route: isManager ? '/(manager)' : '/(seller)',
        },
        {
          title: 'New Field Sale',
          subtitle: 'Create POS retail bill',
          icon: 'bag-add-outline',
          route: '/(seller)/sales/new',
          highlight: true,
        },
        {
          title: 'My Duty Shift',
          subtitle: hasActiveShift ? 'Duty is running' : 'Start duty & meter log',
          icon: 'speedometer-outline',
          route: '/(seller)/shift',
          badge: hasActiveShift ? 'ACTIVE' : 'START',
        },
        ...(isManager
          ? [
              {
                title: 'Territory Sales',
                subtitle: 'Daily beat & orders report',
                icon: 'receipt-outline',
                route: '/(manager)/sales',
              },
              {
                title: 'Team Sellers',
                subtitle: 'Field sales reps & onboarding',
                icon: 'people-outline',
                route: '/(manager)/sellers',
              },
              {
                title: 'Retail Stores',
                subtitle: 'Shop directory & KYC onboarding',
                icon: 'storefront-outline',
                route: '/(manager)/customers',
              },
              {
                title: 'Depot Stock',
                subtitle: 'Regional inventory balances',
                icon: 'cube-outline',
                route: '/(manager)/inventory',
              },
              {
                title: 'Incentives',
                subtitle: 'Earnings & commissions',
                icon: 'cash-outline',
                route: '/(manager)/incentives',
              },
            ]
          : [
              {
                title: 'My Sales History',
                subtitle: 'Past orders & invoices',
                icon: 'receipt-outline',
                route: '/(seller)/sales',
              },
              {
                title: 'Retail Customers',
                subtitle: 'Shop list & onboarding',
                icon: 'storefront-outline',
                route: '/(seller)/customers',
              },
              {
                title: 'My Stock & Inventory',
                subtitle: 'Packets & transfer history',
                icon: 'cube-outline',
                route: '/(seller)/inventory',
              },
              {
                title: 'My Earnings',
                subtitle: 'Incentives & payouts',
                icon: 'cash-outline',
                route: '/(seller)/incentives',
              },
            ]),
        {
          title: 'My Profile',
          subtitle: 'Account details & password',
          icon: 'person-outline',
          route: isManager ? '/(manager)/profile' : '/(seller)/profile',
        },
        {
          title: 'Notifications',
          subtitle: 'System alerts & announcements',
          icon: 'notifications-outline',
          route: '/(shared)/notifications',
        },
      ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Dismiss */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Drawer Panel */}
        <View
          style={[
            styles.drawerPanel,
            {
              paddingTop: insets.top + Spacing.sm,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          {/* Header (Managers & Sellers only) */}
          {!isSuperAdmin ? (
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.brandTitle}>FemmeFlo</Text>
                  <Text style={styles.brandSubtitle}>Mobile Operations Hub</Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={HitSlop.md}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
              >
                <Ionicons name="close" size={20} color="#8491A3" />
              </Pressable>
            </View>
          ) : null}

          {/* User Profile Card */}
          {isSuperAdmin ? (
            <View style={styles.saProfileCard}>
              <View style={styles.saAvatarWrap}>
                <View style={styles.saAvatar}>
                  <Text style={styles.saAvatarText}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={styles.saOnlineDot} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.saProfileName} numberOfLines={1}>
                  {user?.name || 'Super Admin'}
                </Text>
                <Text style={styles.saProfileRole} numberOfLines={1}>
                  National Headquarters
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={HitSlop.md}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
              >
                <Ionicons name="close" size={20} color="#8491A3" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Authorized User'}
                </Text>
                <Text style={styles.userRole}>
                  {user?.role === 'MANAGER' ? 'TERRITORY MANAGER' : 'FIELD SELLER'}
                </Text>
                <Text style={styles.userTerritory} numberOfLines={1}>
                  📍 {[user?.district, user?.state].filter(Boolean).join(', ') || 'Regional Field'}
                </Text>
              </View>
            </View>
          )}

          {/* Duty Shift Status Banner (Managers & Sellers only) */}
          {isSuperAdmin ? null : (
            <Pressable
              style={[
                styles.shiftBanner,
                hasActiveShift ? styles.shiftBannerActive : styles.shiftBannerInactive,
              ]}
              onPress={() => handleNavigate('/(seller)/shift')}
              accessibilityRole="button"
              accessibilityLabel={`Duty Shift: ${hasActiveShift ? 'Active' : 'Off'}`}
            >
              <View style={styles.shiftIconBox}>
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color={hasActiveShift ? BrandColors.green.dark : '#D97706'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.shiftBannerTitle}>
                    {hasActiveShift ? 'Duty Shift Running' : 'Duty Shift Inactive'}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: hasActiveShift ? BrandColors.green.primary : '#F59E0B' },
                    ]}
                  />
                </View>
                <Text style={styles.shiftBannerSub}>
                  {hasActiveShift
                    ? 'Tap to view visits or punch out'
                    : 'Start duty to record field sales'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.light.textTertiary} />
            </Pressable>
          )}

          {/* Navigation Links ScrollView */}
          <ScrollView
            style={styles.navScroll}
            contentContainerStyle={isSuperAdmin ? styles.saNavScrollContent : styles.navScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isSuperAdmin ? (
              <>
                {SUPER_ADMIN_MAIN_NAV.map((item) => {
                  const active = isRouteActive(item.route);
                  return (
                    <Pressable
                      key={item.route}
                      style={({ pressed }) => [
                        styles.saNavItem,
                        active && styles.saNavItemActive,
                        pressed && !active && styles.saNavItemPressed,
                      ]}
                      onPress={() => handleItemPress(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      {active ? <View style={styles.saActiveIndicator} /> : null}
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={active ? '#006B35' : '#8491A3'}
                      />
                      <Text
                        style={[styles.saNavLabel, active && styles.saNavLabelActive]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}

                <View style={styles.saDivider} />
                <Text style={styles.saSectionLabel}>MANAGEMENT</Text>

                {SUPER_ADMIN_MANAGEMENT_NAV.map((item) => {
                  const active = isRouteActive(item.route);
                  return (
                    <Pressable
                      key={item.route}
                      style={({ pressed }) => [
                        styles.saNavItem,
                        active && styles.saNavItemActive,
                        pressed && !active && styles.saNavItemPressed,
                      ]}
                      onPress={() => handleItemPress(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      {active ? <View style={styles.saActiveIndicator} /> : null}
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={active ? '#006B35' : '#8491A3'}
                      />
                      <Text
                        style={[styles.saNavLabel, active && styles.saNavLabelActive]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>OPERATIONS & ACTIONS</Text>

                {NAV_ITEMS.map((item, idx) => (
                  <Pressable
                    key={`${item.route}_${idx}`}
                    style={({ pressed }) => [
                      styles.navItem,
                      item.highlight && styles.navItemHighlight,
                      pressed && styles.navItemPressed,
                    ]}
                    onPress={() => handleItemPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View
                      style={[
                        styles.navIconBox,
                        item.highlight && styles.navIconBoxHighlight,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={item.highlight ? '#FFFFFF' : BrandColors.green.dark}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.navItemTitle,
                            item.highlight && styles.navItemTitleHighlight,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.badge ? (
                          <Badge
                            label={item.badge}
                            variant={item.badge === 'ACTIVE' ? 'ACTIVE' : 'warning'}
                            size="sm"
                          />
                        ) : null}
                      </View>
                      <Text style={styles.navItemSub} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={item.highlight ? BrandColors.green.primary : Colors.light.textTertiary}
                    />
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>

          {/* Footer / Logout */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.light.error} />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </Pressable>
            <Text style={styles.appVersion}>FemmeFlo v1.0.18</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  drawerPanel: {
    width: DRAWER_WIDTH,
    backgroundColor: Colors.light.surface,
    height: '100%',
    ...Shadows.lg,
    display: 'flex',
    flexDirection: 'column',
    borderTopRightRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.dark,
    fontSize: 16,
  },
  brandSubtitle: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.light.surfaceMuted,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.borderSubtle,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BrandColors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
    fontSize: 14,
  },
  userRole: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: BrandColors.green.dark,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  userTerritory: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  shiftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  shiftBannerActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  shiftBannerInactive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  shiftIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  shiftBannerTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  shiftBannerSub: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  navScroll: {
    flex: 1,
    marginTop: Spacing.sm,
  },
  navScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.light.textTertiary,
    letterSpacing: 0.6,
    marginVertical: Spacing.xs,
  },
  saHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
  },
  saBrandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172033',
    letterSpacing: -0.2,
  },
  saBrandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8491A3',
  },
  saProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
    backgroundColor: '#FFFFFF',
  },
  saAvatarWrap: {
    position: 'relative',
  },
  saAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#006B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  saProfileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#172033',
  },
  saProfileRole: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8491A3',
    marginTop: 1,
  },
  saNavScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saNavItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  saNavItemActive: {
    backgroundColor: 'rgba(0, 107, 53, 0.08)',
  },
  saNavItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  saActiveIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#006B35',
  },
  saNavLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#172033',
  },
  saNavLabelActive: {
    color: '#006B35',
    fontWeight: '600',
  },
  saDivider: {
    height: 1,
    backgroundColor: '#EEF0F3',
    marginVertical: 10,
    marginHorizontal: 4,
  },
  saSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8491A3',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    marginVertical: 2,
    gap: Spacing.sm,
  },
  navItemHighlight: {
    backgroundColor: BrandColors.green.surface,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
  },
  navItemPressed: {
    backgroundColor: Colors.light.surfaceMuted,
  },
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxHighlight: {
    backgroundColor: BrandColors.green.primary,
  },
  navItemTitle: {
    ...Typography.bodyMedium,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  navItemTitleHighlight: {
    color: BrandColors.green.dark,
  },
  navItemSub: {
    ...Typography.caption,
    fontSize: 10.5,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  logoutBtnPressed: {
    opacity: 0.7,
  },
  logoutBtnText: {
    ...Typography.bodyMedium,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.error,
  },
  appVersion: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textTertiary,
  },
});
