import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import { sellerApi } from '@/api/seller';
import type { ProductItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
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
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { canMonitorStock } from '@/utils/permissions';

interface SellerInventoryItem {
  seller: {
    id: string;
    name: string;
    phone?: string | null;
    state?: string | null;
    district?: string | null;
    village?: string | null;
  };
  assigned: number;
  sold: number;
  remaining: number;
}

export default function ManagerInventoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const handleBack = useDashboardBackHandler('/(manager)');
  const allowStock = canMonitorStock(user);

  const [summary, setSummary] = useState({
    totalSellers: 0,
    totalAssigned: 0,
    totalSold: 0,
    totalRemaining: 0,
  });
  const [sellers, setSellers] = useState<SellerInventoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'SELLERS' | 'SKUS'>('SELLERS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!allowStock) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [invRes, prodRes] = await Promise.all([
        managerApi.getInventory(),
        managerApi.listProducts().catch(() => ({ items: [] })),
      ]);

      let resolvedSellers: SellerInventoryItem[] = (invRes as any)?.data?.sellers ?? (invRes as any)?.sellers ?? [];
      let resolvedSummary = (invRes as any)?.data?.summary ?? (invRes as any)?.summary;

      // Dual-role fallback: if manager inventory shows 0 remaining/sellers, query sellerApi.getInventory()
      if ((!resolvedSellers || resolvedSellers.length === 0 || resolvedSummary?.totalRemaining === 0) && (user?.isSeller || user?.role === 'MANAGER')) {
        try {
          const sellerInv = await sellerApi.getInventory();
          const remaining = sellerInv.remaining ?? sellerInv.balance ?? 0;
          const assigned = sellerInv.assignedPackets ?? (remaining + (sellerInv.soldPackets ?? 0));
          const sold = sellerInv.soldPackets ?? 0;
          if (sellerInv && (remaining > 0 || assigned > 0)) {
            const selfSeller: SellerInventoryItem = {
              seller: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                state: user.state,
                district: user.district,
                village: user.village,
              },
              assigned,
              sold,
              remaining,
            };
            if (!resolvedSellers || resolvedSellers.length === 0) {
              resolvedSellers = [selfSeller];
            } else if (!resolvedSellers.some((s: any) => s.seller?.id === user.id)) {
              resolvedSellers = [selfSeller, ...resolvedSellers];
            }
            resolvedSummary = {
              totalSellers: resolvedSellers.length,
              totalAssigned: Math.max(resolvedSummary?.totalAssigned ?? 0, selfSeller.assigned),
              totalSold: Math.max(resolvedSummary?.totalSold ?? 0, selfSeller.sold),
              totalRemaining: Math.max(resolvedSummary?.totalRemaining ?? 0, selfSeller.remaining),
            };
          }
        } catch {
          // Keep existing
        }
      }

      if (resolvedSummary) {
        setSummary({
          totalSellers: resolvedSummary.totalSellers ?? resolvedSellers.length,
          totalAssigned: resolvedSummary.totalAssigned ?? 0,
          totalSold: resolvedSummary.totalSold ?? 0,
          totalRemaining: resolvedSummary.totalRemaining ?? 0,
        });
      }
      setSellers(resolvedSellers);
      setProducts(prodRes.items || []);
    } catch (err) {
      console.warn('Failed to load manager inventory', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowStock]);

  useEffect(() => {
    loadData();

    // Real-time synchronization listeners for area stock and allocations
    const sub1 = DeviceEventEmitter.addListener('INVENTORY_SYNC', () => {
      loadData();
    });
    const sub2 = DeviceEventEmitter.addListener('REALTIME_DATA_SYNC', () => {
      loadData();
    });
    const sub3 = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', () => {
      loadData();
    });

    // Slow background fallback ticker (primary instant updates come via realtime sync)
    const liveTicker = setInterval(() => {
      loadData();
    }, 45000);

    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
      clearInterval(liveTicker);
    };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter sellers by name, phone, or village
  const filteredSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((item) => {
      const name = (item.seller?.name || '').toLowerCase();
      const phone = (item.seller?.phone || '').toLowerCase();
      const village = (item.seller?.village || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || village.includes(q);
    });
  }, [sellers, searchQuery]);

  if (!allowStock) {
    return (
      <View style={styles.container}>
        <Header
          title="Area Inventory & Stock"
          subtitle={`Area: ${user?.district || 'Field Operations'} • ${user?.name}`}
          showBack
          onBack={handleBack}
        />
        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="Access Restricted"
            description="You do not have permission to monitor area stock. Please contact your administrator to request 'Monitor area stock' permission."
            iconColor={Colors.light.danger}
            iconBgColor={Colors.light.dangerBg}
            actionTitle="Back to Dashboard"
            buttonVariant="secondary"
            onAction={() => router.replace('/(manager)' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Area Stock"
        subtitle={`Area: ${user?.district || 'My Area'}`}
        showBack
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.green.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* KPI Summary Cards */}
          {loading ? (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
                <View style={styles.kpiCardWrapper}>
                  <CardSkeleton />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.kpiContainer}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Given Stock"
                    value={`${summary.totalAssigned.toLocaleString('en-IN')} pkts`}
                    subtitle="Total packets"
                    icon="cube-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Sold"
                    value={`${summary.totalSold.toLocaleString('en-IN')} pkts`}
                    subtitle="To shops"
                    icon="checkmark-done-circle-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                  />
                </View>
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Left Stock"
                    value={`${summary.totalRemaining.toLocaleString('en-IN')} pkts`}
                    subtitle="With sellers"
                    icon="bus-outline"
                    iconColor={summary.totalRemaining < 50 ? Colors.light.warning : BrandColors.green.primary}
                    iconBg={summary.totalRemaining < 50 ? Colors.light.warningBg : BrandColors.green.subtle}
                    accentColor={summary.totalRemaining < 50 ? Colors.light.warning : BrandColors.green.primary}
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Sellers"
                    value={String(summary.totalSellers || sellers.length)}
                    subtitle="Active team"
                    icon="people-outline"
                    iconColor={BrandColors.pink.primary}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>
              </View>
            </View>
          )}

          {/* View Tab Switcher */}
          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => setActiveTab('SELLERS')}
              style={[styles.tabBtn, activeTab === 'SELLERS' && styles.tabBtnActive]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === 'SELLERS' ? BrandColors.green.dark : Colors.light.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'SELLERS' && styles.tabBtnTextActive]}>
                By Seller ({sellers.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('SKUS')}
              style={[styles.tabBtn, activeTab === 'SKUS' && styles.tabBtnActive]}
            >
              <Ionicons
                name="pricetags-outline"
                size={16}
                color={activeTab === 'SKUS' ? BrandColors.green.dark : Colors.light.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'SKUS' && styles.tabBtnTextActive]}>
                By Product ({products.length})
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: SELLER-WISE VAN STOCK */}
          {activeTab === 'SELLERS' && (
            <View>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
                <TextInput
                  placeholder="Search name, phone or area..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  placeholderTextColor={Colors.light.textTertiary}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={HitSlop.sm}>
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </Pressable>
                )}
              </View>

              {loading ? (
                <View style={{ paddingVertical: Spacing.xl }}>
                  <ActivityIndicator size="small" color={BrandColors.green.primary} />
                </View>
              ) : filteredSellers.length === 0 ? (
                <EmptyState
                  title="No sellers found"
                  description={
                    searchQuery
                      ? 'No field officers match your search criteria.'
                      : 'No sellers have been assigned inventory in your area yet.'
                  }
                  icon="people-outline"
                />
              ) : (
                <View style={styles.sellerList}>
                  {filteredSellers.map((item) => {
                    const assigned = item.assigned || 0;
                    const sold = item.sold || 0;
                    const remaining = item.remaining || 0;
                    const soldPct = assigned > 0 ? Math.min(100, Math.round((sold / assigned) * 100)) : 0;

                    let statusVariant: 'ACTIVE' | 'PENDING' | 'REJECTED' = 'ACTIVE';
                    let statusLabel = 'In Stock';
                    if (remaining === 0) {
                      statusVariant = 'REJECTED';
                      statusLabel = 'Empty';
                    } else if (remaining < 20) {
                      statusVariant = 'PENDING';
                      statusLabel = 'Low Stock';
                    }

                    const sellerObj = item.seller || {
                      id: String(Math.random()),
                      name: 'Seller',
                      phone: '',
                      village: '',
                      district: '',
                    };

                    return (
                      <Card key={sellerObj.id} style={styles.sellerCard}>
                        {/* Seller Header */}
                        <View style={styles.sellerCardTop}>
                          <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
                            <Text style={styles.sellerName} numberOfLines={1}>{sellerObj.name}</Text>
                            <Text style={styles.sellerLoc} numberOfLines={1}>
                              {sellerObj.phone ? `${sellerObj.phone} • ` : ''}
                              {sellerObj.village || sellerObj.district || 'Area'}
                            </Text>
                          </View>
                          <Badge label={statusLabel} variant={statusVariant} />
                        </View>

                        {/* Inventory Figures Grid */}
                        <View style={styles.figuresGrid}>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Given</Text>
                            <Text style={styles.figValueBlue}>{assigned} pkts</Text>
                          </View>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Sold</Text>
                            <Text style={styles.figValueGreen}>{sold} pkts</Text>
                          </View>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Left</Text>
                            <Text
                              style={[
                                styles.figValueDark,
                                remaining === 0 && { color: Colors.light.danger },
                              ]}
                            >
                              {remaining} pkts
                            </Text>
                          </View>
                        </View>

                        {/* Progress Track */}
                        <View style={styles.progressContainer}>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${soldPct}%`,
                                  backgroundColor:
                                    soldPct >= 80
                                      ? BrandColors.green.primary
                                      : soldPct >= 40
                                      ? '#0284C7'
                                      : Colors.light.warning,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.pctText}>{soldPct}% sold</Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: SKU-WISE CATALOG */}
          {activeTab === 'SKUS' && (
            <View style={styles.skuList}>
              {products.length === 0 ? (
                <EmptyState
                  title="No SKUs configured"
                  description="Products catalog is not yet populated from head office."
                  icon="cube-outline"
                />
              ) : (
                products.map((prod) => (
                  <Card key={prod.id} style={styles.skuCard}>
                    <View style={styles.skuCardRow}>
                      <View style={styles.skuIconBox}>
                        <Ionicons name="pricetag" size={18} color={BrandColors.green.primary} />
                      </View>
                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={styles.skuName}>{prod.name}</Text>
                        <Text style={styles.skuSub}>
                          SKU: {prod.sku || 'STD-01'} • Base Price: ₹
                          {((prod.basePricePaise || 3500) / 100).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Badge label="ACTIVE SKU" variant="ACTIVE" />
                        <Text style={styles.floorPriceNote}>
                          Min floor: ₹{((prod.minimumPricePaise || 2500) / 100).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  bannerCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.green.dark,
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  kpiContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  kpiCardWrapper: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: Radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: Radius.md,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: BrandColors.green.light,
    borderWidth: 1,
  },
  tabBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  tabBtnTextActive: {
    color: BrandColors.green.dark,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    padding: 0,
  },
  sellerList: {
    gap: Spacing.md,
  },
  sellerCard: {
    padding: Spacing.md,
  },
  sellerCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sellerName: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  sellerLoc: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  figuresGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  figCol: {
    flex: 1,
    alignItems: 'center',
  },
  figLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  figValueBlue: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0284C7',
  },
  figValueGreen: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  figValueDark: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  pctText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    width: 55,
    textAlign: 'right',
  },
  skuList: {
    gap: Spacing.md,
  },
  skuCard: {
    padding: Spacing.md,
  },
  skuCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skuIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  skuName: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  skuSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  floorPriceNote: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
