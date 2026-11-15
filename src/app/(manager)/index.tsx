import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import type { ManagerDashboardData } from '@/api/types';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
import { useAuth } from '@/context/AuthContext';
import { acquireGpsCoordinates } from '@/utils/locationUtils';
import { requireActiveShift } from '@/utils/shiftGuard';

export default function ManagerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('Thane, Maharashtra');

  const handleNewSale = async () => {
    const hasActive = await requireActiveShift(user?.id, 'record field sales', () => {
      router.push('/(seller)/shift' as any);
    });
    if (hasActive) {
      router.push('/(seller)/sales/new' as any);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const res = await managerApi.getDashboard().catch(() => ({
        totalSellers: 0,
        activeSellersCount: 0,
        monthlyRevenuePaise: 0,
        monthlyPacketsSold: 0,
        totalCustomers: 0,
      }));
      setDashboard(res);
    } catch (err) {
      console.warn('Manager dashboard error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (user?.district && user?.state) {
      setCurrentLocation(`${user.district}, ${user.state}`);
    }
  }, [loadData, user?.district, user?.state]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleChangeLocation = async () => {
    const res = await acquireGpsCoordinates({ highAccuracyTimeoutMs: 5000 });
    if (res.status === 'acquired') {
      setCurrentLocation(`${user?.district || 'Thane'}, ${user?.state || 'Maharashtra'}`);
    }
  };

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View style={styles.container}>
      {/* Top Header matching reference image */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
        >
          <Ionicons name="menu-outline" size={28} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            Territory: {user?.district || 'Thane'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Manager: {user?.name || (user as any)?.username || 'test45'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/(shared)/notifications' as any)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={24} color="#0F172A" />
          <View style={styles.notifBadgeDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#881337']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* 1. Location / Current Location Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationLeft}>
              <View style={styles.locationIconCircle}>
                <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.locationCityText}>{currentLocation}</Text>
                <View style={styles.currentLocRow}>
                  <View style={styles.greenDot} />
                  <Text style={styles.currentLocLabel}>Current Location</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeLocBtn}
              onPress={handleChangeLocation}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change location"
            >
              <Ionicons name="sync-outline" size={14} color="#881337" style={{ marginRight: 4 }} />
              <Text style={styles.changeLocText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* 2. Hero Card: My Field Sales (Maroon Gradient with trend watermark) */}
          <View style={styles.heroCard}>
            {/* Background Ascending Graph Watermark */}
            <View style={styles.heroWatermarkGraph}>
              <View style={[styles.graphBar, { height: 16 }]} />
              <View style={[styles.graphBar, { height: 26 }]} />
              <View style={[styles.graphBar, { height: 38 }]} />
              <View style={[styles.graphBar, { height: 52 }]} />
              <Ionicons name="trending-up" size={40} color="rgba(255,255,255,0.22)" style={styles.graphArrow} />
            </View>

            <View style={styles.heroHeaderRow}>
              <View style={styles.heroIconBox}>
                <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.heroTitle}>My Field Sales</Text>
                <Text style={styles.heroSubtitle}>Track your daily performance</Text>
              </View>
            </View>

            <View style={styles.heroButtonsRow}>
              {/* White Pill Button: New Sale */}
              <TouchableOpacity
                style={styles.heroNewSaleBtn}
                onPress={handleNewSale}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="New Sale"
              >
                <Ionicons name="cart" size={16} color="#881337" style={{ marginRight: 6 }} />
                <Text style={styles.heroNewSaleText}>New Sale</Text>
              </TouchableOpacity>

              {/* Translucent Outline Pill Button: Daily Shift */}
              <TouchableOpacity
                style={styles.heroDailyShiftBtn}
                onPress={() => router.push('/(seller)/shift' as any)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Daily Shift"
              >
                <Ionicons name="speedometer-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.heroDailyShiftText}>Daily Shift</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. My Area Status Card */}
          <TouchableOpacity
            style={styles.myAreaCard}
            onPress={() => router.push('/(manager)/customers' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="My Area details"
          >
            <View style={styles.myAreaLeft}>
              <View style={styles.myAreaIconCircle}>
                <Ionicons name="location-sharp" size={18} color="#16A34A" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.myAreaTitle}>My Area</Text>
                <Text style={styles.myAreaSubtitle}>
                  Area: {user?.district || 'Thane'}, {user?.state || 'Maharashtra'}
                </Text>
              </View>
            </View>

            <View style={styles.myAreaRight}>
              <View style={styles.managerRoleBadge}>
                <Ionicons name="person-outline" size={12} color="#16A34A" style={{ marginRight: 4 }} />
                <Text style={styles.managerRoleBadgeText}>Manager</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#16A34A" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* 4. Team Performance Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="stats-chart" size={18} color="#881337" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Team Performance</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(manager)/sellers' as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View All Team Performance"
            >
              <Text style={styles.viewAllLink}>View All →</Text>
            </TouchableOpacity>
          </View>

          {/* 2x2 Performance Grid */}
          <View style={styles.perfGrid}>
            {/* Metric 1: Monthly Revenue */}
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push('/(manager)/sales' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBadge, { backgroundColor: '#FFF1F4' }]}>
                  <Ionicons name="wallet-outline" size={16} color="#881337" />
                </View>
                <View style={[styles.metricTrendCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="arrow-up-outline" size={13} color="#16A34A" />
                </View>
              </View>
              <Text style={styles.metricLabel}>Monthly Revenue</Text>
              <Text style={styles.metricValue}>
                {loading ? '₹0.00' : formatRupees(dashboard?.monthlyRevenuePaise || 0)}
              </Text>
              <Text style={styles.metricFooter}>Total sales</Text>
              {/* Subtle green ambient accent glow */}
              <View style={[styles.metricGlowAccent, { backgroundColor: '#22C55E' }]} />
            </TouchableOpacity>

            {/* Metric 2: Packets Sold */}
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push('/(manager)/inventory' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBadge, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="cube-outline" size={16} color="#0284C7" />
                </View>
                <View style={[styles.metricTrendCircle, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="arrow-up-outline" size={13} color="#0284C7" />
                </View>
              </View>
              <Text style={styles.metricLabel}>Packets Sold</Text>
              <Text style={styles.metricValue}>
                {loading ? '0' : (dashboard?.monthlyPacketsSold || 0).toLocaleString()}
              </Text>
              <Text style={styles.metricFooter}>Total packets sold</Text>
              {/* Subtle blue ambient accent glow */}
              <View style={[styles.metricGlowAccent, { backgroundColor: '#38BDF8' }]} />
            </TouchableOpacity>

            {/* Metric 3: Active Sellers */}
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push('/(manager)/sellers' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBadge, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="people-outline" size={16} color="#16A34A" />
                </View>
                <View style={[styles.metricTrendCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="sync-outline" size={13} color="#16A34A" />
                </View>
              </View>
              <Text style={styles.metricLabel}>Active Sellers</Text>
              <Text style={styles.metricValue}>
                {loading
                  ? '0 / 0'
                  : `${dashboard?.activeSellersCount || 0} / ${dashboard?.totalSellers || 0}`}
              </Text>
              <Text style={styles.metricFooter}>Sellers working today</Text>
              {/* Subtle green ambient accent glow */}
              <View style={[styles.metricGlowAccent, { backgroundColor: '#4ADE80' }]} />
            </TouchableOpacity>

            {/* Metric 4: Shops */}
            <TouchableOpacity
              style={styles.metricCard}
              onPress={() => router.push('/(manager)/customers' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.metricTopRow}>
                <View style={[styles.metricIconBadge, { backgroundColor: '#FFF1F2' }]}>
                  <Ionicons name="storefront-outline" size={16} color="#E11D48" />
                </View>
                <View style={[styles.metricTrendCircle, { backgroundColor: '#FFF1F2' }]}>
                  <Ionicons name="storefront" size={12} color="#E11D48" />
                </View>
              </View>
              <Text style={styles.metricLabel}>Shops</Text>
              <Text style={styles.metricValue}>
                {loading ? '0' : (dashboard?.totalCustomers || 0).toLocaleString()}
              </Text>
              <Text style={styles.metricFooter}>Total shops</Text>
              {/* Subtle pink ambient accent glow */}
              <View style={[styles.metricGlowAccent, { backgroundColor: '#FB7185' }]} />
            </TouchableOpacity>
          </View>

          {/* 5. Quick Actions Section */}
          <TouchableOpacity
            style={styles.quickActionsSectionHeader}
            onPress={() => router.push('/(manager)/quick-actions' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open all Quick Actions"
          >
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flash" size={17} color="#881337" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <Text style={styles.quickActionsSub}>Shortcuts to your tasks</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#881337" />
          </TouchableOpacity>

          {/* Top Highlight Action Banner: New Sale */}
          <TouchableOpacity
            style={styles.quickSaleBanner}
            onPress={handleNewSale}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="New Sale shortcut"
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text style={styles.quickSaleBannerText}>New Sale</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* 4 Icon Action Shortcuts Grid */}
          <View style={styles.quickShortcutsRow}>
            {/* 1. Daily Shift (Punch-In) */}
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => router.push('/(seller)/shift' as any)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Daily Shift Punch-In"
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="time-outline" size={22} color="#16A34A" />
              </View>
              <Text style={styles.shortcutLabel}>Daily Shift{'\n'}(Punch-In)</Text>
            </TouchableOpacity>

            {/* 2. Check Van Stock */}
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => router.push('/(manager)/inventory' as any)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Check Van Stock"
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: '#FFF1F4' }]}>
                <Ionicons name="storefront-outline" size={20} color="#881337" />
              </View>
              <Text style={styles.shortcutLabel}>Check{'\n'}Van Stock</Text>
            </TouchableOpacity>

            {/* 3. Add New Shop */}
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => router.push('/(manager)/customers/new' as any)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Add New Shop"
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: '#FFF1F4' }]}>
                <Ionicons name="gift-outline" size={20} color="#881337" />
              </View>
              <Text style={styles.shortcutLabel}>Add{'\n'}New Shop</Text>
            </TouchableOpacity>

            {/* 4. Manage Sellers */}
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => router.push('/(manager)/sellers' as any)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Manage Sellers"
            >
              <View style={[styles.shortcutIconCircle, { backgroundColor: '#FFF1F4' }]}>
                <Ionicons name="people-outline" size={20} color="#881337" />
              </View>
              <Text style={styles.shortcutLabel}>Manage{'\n'}Sellers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Slide-out Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF9FA',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 16,
    paddingBottom: 12,
    backgroundColor: '#FBF9FA',
  },
  menuBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notifBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  locationCard: {
    backgroundColor: '#FFF1F4',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationCityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  currentLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  currentLocLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  changeLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#881337',
  },
  heroCard: {
    backgroundColor: '#881337',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  heroWatermarkGraph: {
    position: 'absolute',
    right: 14,
    top: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    opacity: 0.22,
  },
  graphBar: {
    width: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  graphArrow: {
    marginLeft: 4,
    marginBottom: -6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
  },
  heroButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroNewSaleBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heroNewSaleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#881337',
  },
  heroDailyShiftBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDailyShiftText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  myAreaCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  myAreaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  myAreaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myAreaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  myAreaSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  myAreaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  managerRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  managerRoleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#881337',
  },
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTrendCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 2,
  },
  metricFooter: {
    fontSize: 11,
    color: '#94A3B8',
  },
  metricGlowAccent: {
    position: 'absolute',
    bottom: -16,
    right: -16,
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.18,
  },
  quickActionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  quickActionsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  quickSaleBanner: {
    backgroundColor: '#881337',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  quickSaleBannerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 16,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  shortcutIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
  },
});
