import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
    try {
      const [invRes, prodRes] = await Promise.all([
        managerApi.getInventory(),
        managerApi.listProducts().catch(() => ({ items: [] })),
      ]);

      if (invRes?.summary) {
        setSummary({
          totalSellers: (invRes as any).summary.totalSellers ?? (invRes as any).sellers?.length ?? 0,
          totalAssigned: (invRes as any).summary.totalAssigned ?? 0,
          totalSold: (invRes as any).summary.totalSold ?? 0,
          totalRemaining: (invRes as any).summary.totalRemaining ?? 0,
        });
      }
      setSellers((invRes as any)?.sellers ?? []);
      setProducts(prodRes.items || []);
    } catch (err) {
      console.warn('Failed to load manager inventory', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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
      const name = (item.seller.name || '').toLowerCase();
      const phone = (item.seller.phone || '').toLowerCase();
      const village = (item.seller.village || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || village.includes(q);
    });
  }, [sellers, searchQuery]);

  return (
    <View style={styles.container}>
      <Header
        title="Territory Van Stock"
        subtitle={`Territory: ${user?.district || 'Field Operations'} • ${user?.name}`}
        showBack
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
          {/* Header Territory Scope Card */}
          <Card style={styles.bannerCard}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerIconBox}>
                <Ionicons name="cube" size={20} color={BrandColors.green.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Field Force Van Stock Supervision</Text>
                <Text style={styles.bannerSub}>
                  Assigned territory: {[user?.district, user?.state].filter(Boolean).join(', ') || 'Assigned Zone'}
                </Text>
              </View>
              <Badge label="INVENTORY VIEW" variant="ACTIVE" />
            </View>
          </Card>

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
                    title="Total Assigned"
                    value={`${summary.totalAssigned.toLocaleString('en-IN')} pkts`}
                    subtitle="Allocated to sellers"
                    icon="cube-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Confirmed Sold"
                    value={`${summary.totalSold.toLocaleString('en-IN')} pkts`}
                    subtitle="Delivered to stores"
                    icon="checkmark-done-circle-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                  />
                </View>
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Remaining Balance"
                    value={`${summary.totalRemaining.toLocaleString('en-IN')} pkts`}
                    subtitle="In active field vans"
                    icon="bus-outline"
                    iconColor={summary.totalRemaining < 50 ? Colors.light.warning : BrandColors.green.primary}
                    iconBg={summary.totalRemaining < 50 ? Colors.light.warningBg : BrandColors.green.subtle}
                    accentColor={summary.totalRemaining < 50 ? Colors.light.warning : BrandColors.green.primary}
                  />
                </View>

                <View style={styles.kpiCardWrapper}>
                  <StatCard
                    title="Supervised Sellers"
                    value={String(summary.totalSellers || sellers.length)}
                    subtitle="Field officers with stock"
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
                Seller-wise Stock ({sellers.length})
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
                SKU-wise Catalog ({products.length})
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
                  placeholder="Search field officer by name, phone, or village..."
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
                      : 'No sellers have been assigned inventory in your territory yet.'
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
                    let statusLabel = 'IN STOCK';
                    if (remaining === 0) {
                      statusVariant = 'REJECTED';
                      statusLabel = 'DEPLETED';
                    } else if (remaining < 20) {
                      statusVariant = 'PENDING';
                      statusLabel = 'LOW STOCK';
                    }

                    return (
                      <Card key={item.seller.id} style={styles.sellerCard}>
                        {/* Seller Header */}
                        <View style={styles.sellerCardTop}>
                          <View style={{ flex: 1, marginRight: Spacing.sm }}>
                            <Text style={styles.sellerName}>{item.seller.name}</Text>
                            <Text style={styles.sellerLoc}>
                              {item.seller.phone ? `${item.seller.phone} • ` : ''}
                              {item.seller.village || item.seller.district || 'Territory Field Force'}
                            </Text>
                          </View>
                          <Badge label={statusLabel} variant={statusVariant} />
                        </View>

                        {/* Inventory Figures Grid */}
                        <View style={styles.figuresGrid}>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Assigned</Text>
                            <Text style={styles.figValueBlue}>{assigned} pkts</Text>
                          </View>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Sold</Text>
                            <Text style={styles.figValueGreen}>{sold} pkts</Text>
                          </View>
                          <View style={styles.figCol}>
                            <Text style={styles.figLabel}>Remaining</Text>
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
});
