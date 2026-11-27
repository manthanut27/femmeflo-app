import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerInventoryData, StockTransactionItem } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';

type HistoryFilter = 'all' | 'in' | 'out';

function isStockOutflow(item: StockTransactionItem, sellerLocationId?: string): boolean {
  if (item.quantity < 0) return true;
  const upperType = (item.type || '').toUpperCase();
  if (upperType === 'SALE' || upperType.includes('SALE') || upperType.includes('OUT')) {
    return true;
  }
  if (sellerLocationId && item.sourceId === sellerLocationId && item.destinationId !== sellerLocationId) {
    return true;
  }
  if (upperType === 'RETURN' && !upperType.includes('IN')) {
    return true;
  }
  return false;
}

function getTransactionMeta(item: StockTransactionItem, outflow: boolean) {
  const upperType = (item.type || '').toUpperCase();
  if (outflow) {
    if (upperType === 'SALE' || upperType.includes('SALE')) {
      return {
        actionLabel: 'Sold',
        subtitle: item.note || item.reference || item.destination?.name || 'Customer sale',
        tagBg: Colors.light.errorBg,
        tagText: BrandColors.pink.primary,
        iconBg: Colors.light.errorBg,
        iconName: 'arrow-up-outline' as const,
      };
    }
    return {
      actionLabel: upperType === 'RETURN' ? 'Returned' : 'Transferred Out',
      subtitle: item.note || item.destination?.name || item.targetLocation || 'Stock deducted',
      tagBg: Colors.light.errorBg,
      tagText: BrandColors.pink.primary,
      iconBg: Colors.light.errorBg,
      iconName: 'arrow-up-outline' as const,
    };
  }

  return {
    actionLabel: 'Received',
    subtitle:
      item.note ||
      (item.source?.name ? `From ${item.source.name}` : item.sourceLocation ? `From ${item.sourceLocation}` : 'Stock added'),
    tagBg: Colors.light.successBg,
    tagText: BrandColors.green.primary,
    iconBg: Colors.light.successBg,
    iconName: 'arrow-down-outline' as const,
  };
}

export default function SellerInventoryScreen() {
  const handleBack = useDashboardBackHandler('/(seller)');
  const [inventory, setInventory] = useState<SellerInventoryData | null>(null);
  const [transactions, setTransactions] = useState<StockTransactionItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [invRes, txRes] = await Promise.all([
        sellerApi.getInventory().catch(() => ({
          balance: 0,
          assignedPackets: 0,
          soldPackets: 0,
          locationName: 'Field Stock',
          products: [],
        })),
        sellerApi.listTransactions({ pageSize: 50 }).catch(() => ({ items: [] })),
      ]);

      setInventory(invRes);
      setTransactions(txRes.items);
    } catch (err) {
      console.warn('Failed to load inventory', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Real-time synchronization listeners for stock transfers, receipts, and order confirmations
    const sub1 = DeviceEventEmitter.addListener('INVENTORY_SYNC', () => {
      loadData();
    });
    const sub2 = DeviceEventEmitter.addListener('REALTIME_DATA_SYNC', () => {
      loadData();
    });
    const sub3 = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', () => {
      loadData();
    });

    // Continuous background sync interval while screen is open
    const liveTicker = setInterval(() => {
      loadData();
    }, 6000);

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

  const { filteredTransactions, receivedCount, soldCount } = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    const filtered: StockTransactionItem[] = [];
    for (const item of transactions) {
      const outflow = isStockOutflow(item, inventory?.locationId);
      if (outflow) outCount += 1;
      else inCount += 1;
      if (
        historyFilter === 'all' ||
        (historyFilter === 'in' && !outflow) ||
        (historyFilter === 'out' && outflow)
      ) {
        filtered.push(item);
      }
    }
    return { filteredTransactions: filtered, receivedCount: inCount, soldCount: outCount };
  }, [transactions, historyFilter, inventory?.locationId]);

  const available = inventory?.balance ?? 0;
  const received = inventory?.assignedPackets ?? 0;
  const sold = inventory?.soldPackets ?? 0;
  const remainingPct = received > 0 ? Math.max(0, Math.min(100, Math.round((available / received) * 100))) : 0;
  const singleProduct = inventory?.products && inventory.products.length === 1 ? inventory.products[0] : null;
  const multipleProducts = inventory?.products && inventory.products.length > 1 ? inventory.products : [];

  const renderTx = ({ item }: { item: StockTransactionItem }) => {
    const outflow = isStockOutflow(item, inventory?.locationId);
    const meta = getTransactionMeta(item, outflow);
    const absQty = Math.abs(item.quantity);
    const dateLabel = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <Card style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={[styles.txIconCircle, { backgroundColor: meta.iconBg }]}>
            <Ionicons name={meta.iconName} size={18} color={meta.tagText} />
          </View>

          <View style={styles.txInfo}>
            <Text style={styles.txProduct} numberOfLines={1}>
              {item.product?.name || singleProduct?.productName || 'FemmeFlo Packets'}
            </Text>
            <Text style={styles.txMeta} numberOfLines={1}>
              {dateLabel} • {meta.subtitle}
            </Text>
          </View>

          <View style={styles.txRight}>
            <Text style={[styles.txQty, outflow ? styles.txQtyNegative : styles.txQtyPositive]}>
              {outflow ? `-${absQty.toLocaleString('en-IN')}` : `+${absQty.toLocaleString('en-IN')}`} pkts
            </Text>
            <View style={[styles.txPill, { backgroundColor: meta.tagBg }]}>
              <Text style={[styles.txPillText, { color: meta.tagText }]}>{meta.actionLabel}</Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="My Stock" subtitle="Available Packets & Movements" showBack onBack={handleBack} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTx}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BrandColors.pink.primary]} />
          }
          ListHeaderComponent={
            <>
              {/* Summary Balance Card */}
              <Card style={styles.balanceCard}>
                <View style={styles.balanceHeaderRow}>
                  <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                    <Text style={styles.balanceLabel}>Available in Hand</Text>
                    {singleProduct ? (
                      <Text style={styles.singleSkuSub}>
                        {singleProduct.productName}
                        {singleProduct.productSku ? ` (${singleProduct.productSku})` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="cube-outline" size={18} color={BrandColors.green.primary} />
                  </View>
                </View>

                <Text style={styles.balanceValue}>
                  {available.toLocaleString('en-IN')}{' '}
                  <Text style={styles.balanceUnit}>Packets</Text>
                </Text>

                {received > 0 ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${remainingPct}%` }]} />
                  </View>
                ) : null}

                <View style={styles.balanceRow}>
                  <View style={styles.balanceStat}>
                    <Text style={styles.statLabel}>Received</Text>
                    <Text style={[styles.statVal, { color: BrandColors.green.primary }]}>
                      +{received.toLocaleString('en-IN')} pkts
                    </Text>
                  </View>

                  <View style={styles.balanceDivider} />

                  <View style={styles.balanceStat}>
                    <Text style={styles.statLabel}>Sold</Text>
                    <Text style={[styles.statVal, { color: BrandColors.pink.primary }]}>
                      -{sold.toLocaleString('en-IN')} pkts
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Multi-SKU Breakdown (shown only when seller carries multiple SKUs) */}
              {multipleProducts.length > 0 ? (
                <>
                  <Text style={styles.sectionHeading}>By Product</Text>
                  {multipleProducts.map((p) => (
                    <Card key={p.productId} style={styles.skuCard}>
                      <View style={styles.skuHeader}>
                        <Text style={styles.skuName}>{p.productName}</Text>
                        <Text style={styles.skuBalance}>{p.balance.toLocaleString('en-IN')} pkts</Text>
                      </View>
                      <View style={styles.skuFooter}>
                        <Text style={styles.skuMeta}>{p.productSku || 'Standard'}</Text>
                        <Text style={styles.skuMeta}>
                          Received: {p.assigned.toLocaleString('en-IN')} • Sold: {p.sold.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </>
              ) : null}

              {/* Stock Movement Filter */}
              <View style={styles.historyHeaderRow}>
                <Text style={styles.sectionHeading}>Stock Movements</Text>
              </View>
              <View style={styles.filterRow}>
                {(
                  [
                    { key: 'all', label: `All (${transactions.length})` },
                    { key: 'in', label: `Received (${receivedCount})` },
                    { key: 'out', label: `Sold (${soldCount})` },
                  ] as const
                ).map((tab) => {
                  const active = historyFilter === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setHistoryFilter(tab.key)}
                      style={[styles.filterTab, active && styles.filterTabActive]}
                    >
                      <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title={historyFilter === 'all' ? 'No Stock Movements' : 'No Matching Entries'}
              description={
                historyFilter === 'all'
                  ? 'Stock received and packet sales will appear here.'
                  : 'Try switching the filter above.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    padding: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  balanceCard: {
    backgroundColor: Colors.light.surface,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.green.primary,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  singleSkuSub: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  balanceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceValue: {
    ...Typography.display,
    color: BrandColors.green.primary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  balanceUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  progressTrack: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.tint,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: BrandColors.green.primary,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  balanceStat: {
    flex: 1,
  },
  balanceDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.light.borderSubtle,
    marginHorizontal: Spacing.md,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
  statVal: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterTabActive: {
    backgroundColor: Colors.light.heading,
    borderColor: Colors.light.heading,
  },
  filterTabText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  skuCard: {
    marginBottom: Spacing.sm,
  },
  skuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  skuName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  skuBalance: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  skuFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skuMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  txCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txProduct: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    fontWeight: '600',
  },
  txMeta: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  txQty: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  txQtyPositive: {
    color: BrandColors.green.primary,
  },
  txQtyNegative: {
    color: BrandColors.pink.primary,
  },
  txPill: {
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  txPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
