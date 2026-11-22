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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managerApi } from '@/api/manager';
import type { ManagerDashboardData } from '@/api/types';
import { MobileNavigationDrawer } from '@/components/common/MobileNavigationDrawer';
import { useAuth } from '@/context/AuthContext';
import { acquireGpsCoordinates } from '@/utils/locationUtils';

export default function ManagerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('Thane, Maharashtra');
  const [isLocating, setIsLocating] = useState(false);

  const handleNewSale = () => {
    router.push('/(seller)/sales/new' as any);
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
    setIsLocating(true);
    try {
      const res = await acquireGpsCoordinates({ highAccuracyTimeoutMs: 5000 });
      if (res.status === 'acquired') {
        setCurrentLocation(`${user?.district || 'Thane'}, ${user?.state || 'Maharashtra'}`);
      }
    } finally {
      setIsLocating(false);
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
      {/* Top Header with safe area insets */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16) + 4,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
        >
          <Ionicons name="menu-outline" size={28} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Area: {user?.district || 'Thane'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
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
          <Ionicons name="notifications-outline" size={22} color="#0F172A" />
          <View style={styles.notifBadgeDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 85, 110) },
        ]}
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
          {/* 1. Unified Territory & Location Card */}
          <View style={styles.territoryCard}>
            <View style={styles.territoryLeft}>
              <View style={styles.territoryIconCircle}>
                <Ionicons name="location-sharp" size={17} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.territoryCityText} numberOfLines={1}>
                  {currentLocation}
                </Text>
                <View style={styles.territoryStatusRow}>
                  <View style={styles.greenDot} />
                  <Text style={styles.territoryStatusLabel}>Active Area • GPS Verified</Text>
                </View>
              </View>
            </View>

            <View style={styles.territoryRight}>
              <TouchableOpacity
                style={styles.syncGpsBtn}
                onPress={handleChangeLocation}
                activeOpacity={0.75}
                disabled={isLocating}
                accessibilityRole="button"
                accessibilityLabel="Sync GPS location"
              >
                <Ionicons
                  name={isLocating ? 'hourglass-outline' : 'sync-outline'}
                  size={13}
                  color="#881337"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.syncGpsText}>{isLocating ? 'Syncing...' : 'Sync'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewShopsPill}
                onPress={() => router.push('/(manager)/customers' as any)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="View Shops"
              >
                <Text style={styles.viewShopsPillText}>Shops</Text>
                <Ionicons name="chevron-forward" size={12} color="#16A34A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Hero Card: My Field Sales (Maroon Gradient with trend watermark) */}
          <View style={styles.heroCard}>
            {/* Background Ascending Graph Watermark */}
            <View style={styles.heroWatermarkGraph} pointerEvents="none">
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

          {/* 3. Team Performance Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bar-chart-outline" size={18} color="#881337" style={{ marginRight: 6 }} />
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

          {/* 2x2 Performance Grid (Side-by-Side Flex Rows) */}
          <View style={styles.perfGrid}>
            {/* Row 1: Monthly Revenue & Packets Sold */}
            <View style={styles.perfRow}>
              {/* Metric 1: Monthly Revenue */}
              <TouchableOpacity
                style={styles.metricCard}
                onPress={() => router.push('/(manager)/sales' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Monthly Revenue"
              >
                <View style={styles.metricTopRow}>
                  <View style={[styles.metricIconBadge, { backgroundColor: '#FFF1F4' }]}>
                    <Ionicons name="wallet-outline" size={17} color="#881337" />
                  </View>
                  <View style={[styles.metricTrendCircle, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="arrow-up-outline" size={13} color="#16A34A" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Monthly Revenue</Text>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                  {loading ? '₹0.00' : formatRupees(dashboard?.monthlyRevenuePaise || 0)}
                </Text>
                <Text style={styles.metricFooter}>Total sales</Text>
                <View style={[styles.metricGlowAccent, { backgroundColor: '#22C55E' }]} />
              </TouchableOpacity>

              {/* Metric 2: Packets Sold */}
              <TouchableOpacity
                style={styles.metricCard}
                onPress={() => router.push('/(manager)/inventory' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Packets Sold"
              >
                <View style={styles.metricTopRow}>
                  <View style={[styles.metricIconBadge, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="cube-outline" size={17} color="#0284C7" />
                  </View>
                  <View style={[styles.metricTrendCircle, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="arrow-up-outline" size={13} color="#0284C7" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Packets Sold</Text>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                  {loading ? '0' : (dashboard?.monthlyPacketsSold || 0).toLocaleString()}
                </Text>
                <Text style={styles.metricFooter}>Total packets sold</Text>
                <View style={[styles.metricGlowAccent, { backgroundColor: '#38BDF8' }]} />
              </TouchableOpacity>
            </View>

            {/* Row 2: Active Sellers & Shops */}
            <View style={styles.perfRow}>
              {/* Metric 3: Active Sellers */}
              <TouchableOpacity
                style={styles.metricCard}
                onPress={() => router.push('/(manager)/sellers' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Active Sellers"
              >
                <View style={styles.metricTopRow}>
                  <View style={[styles.metricIconBadge, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="people-outline" size={17} color="#16A34A" />
                  </View>
                  <View style={[styles.metricTrendCircle, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="sync-outline" size={13} color="#16A34A" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Active Sellers</Text>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                  {loading
                    ? '0 / 0'
                    : `${dashboard?.activeSellersCount || 0} / ${dashboard?.totalSellers || 0}`}
                </Text>
                <Text style={styles.metricFooter}>Sellers working today</Text>
                <View style={[styles.metricGlowAccent, { backgroundColor: '#4ADE80' }]} />
              </TouchableOpacity>

              {/* Metric 4: Shops */}
              <TouchableOpacity
                style={styles.metricCard}
                onPress={() => router.push('/(manager)/customers' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Shops"
              >
                <View style={styles.metricTopRow}>
                  <View style={[styles.metricIconBadge, { backgroundColor: '#FFF1F2' }]}>
                    <Ionicons name="storefront-outline" size={17} color="#E11D48" />
                  </View>
                  <View style={[styles.metricTrendCircle, { backgroundColor: '#FFF1F2' }]}>
                    <Ionicons name="storefront" size={12} color="#E11D48" />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Shops</Text>
                <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                  {loading ? '0' : (dashboard?.totalCustomers || 0).toLocaleString()}
                </Text>
                <Text style={styles.metricFooter}>Total shops</Text>
                <View style={[styles.metricGlowAccent, { backgroundColor: '#FB7185' }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. Quick Actions Section */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flash-outline" size={18} color="#881337" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <Text style={styles.quickActionsSub}>Shortcuts to your daily tasks</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(manager)/quick-actions' as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View all Quick Actions"
            >
              <Text style={styles.viewAllLink}>View All →</Text>
            </TouchableOpacity>
          </View>

          {/* 2x2 Quick Action Cards Grid */}
          <View style={styles.actionsGrid}>
            <View style={styles.actionsRow}>
              {/* 1. Add New Shop */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(manager)/customers/new' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add New Shop"
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#FFF1F4' }]}>
                  <Ionicons name="storefront-outline" size={20} color="#881337" />
                </View>
                <View style={styles.actionCardTextWrap}>
                  <Text style={styles.actionCardTitle} numberOfLines={1}>
                    Add New Shop
                  </Text>
                  <Text style={styles.actionCardDesc} numberOfLines={1}>
                    Register retail store
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              {/* 2. Check Stock */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(manager)/inventory' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Check Stock"
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="cube-outline" size={20} color="#0284C7" />
                </View>
                <View style={styles.actionCardTextWrap}>
                  <Text style={styles.actionCardTitle} numberOfLines={1}>
                    Check Stock
                  </Text>
                  <Text style={styles.actionCardDesc} numberOfLines={1}>
                    Warehouse & vans
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              {/* 3. Manage Team */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(manager)/sellers' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Manage Team"
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="people-outline" size={20} color="#16A34A" />
                </View>
                <View style={styles.actionCardTextWrap}>
                  <Text style={styles.actionCardTitle} numberOfLines={1}>
                    Manage Team
                  </Text>
                  <Text style={styles.actionCardDesc} numberOfLines={1}>
                    Sales officers duty
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>

              {/* 4. Shift Logs */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(manager)/shifts' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Shift Logs"
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="time-outline" size={20} color="#D97706" />
                </View>
                <View style={styles.actionCardTextWrap}>
                  <Text style={styles.actionCardTitle} numberOfLines={1}>
                    Shift Logs
                  </Text>
                  <Text style={styles.actionCardDesc} numberOfLines={1}>
                    Attendance & visits
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuBtn: {
    padding: 6,
    marginRight: 10,
    borderRadius: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
    position: 'absolute',
    top: 7,
    right: 7,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 12,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  territoryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  territoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  territoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#881337',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  territoryCityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  territoryStatusRow: {
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
  territoryStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  territoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F4',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
  },
  syncGpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#881337',
  },
  viewShopsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewShopsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginRight: 2,
  },
  heroCard: {
    backgroundColor: '#881337',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#881337',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
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
    paddingVertical: 11,
    borderRadius: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 11,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDailyShiftText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  quickActionsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  perfGrid: {
    marginBottom: 16,
  },
  perfRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 114,
    justifyContent: 'space-between',
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3,
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
    opacity: 0.16,
  },
  actionsGrid: {
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionCardTextWrap: {
    flex: 1,
    marginRight: 4,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
