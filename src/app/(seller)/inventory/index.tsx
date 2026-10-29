import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SellerInventoryData, StockTransactionItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';

export default function SellerInventoryScreen() {
  const [inventory, setInventory] = useState<SellerInventoryData | null>(null);
  const [transactions, setTransactions] = useState<StockTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [invRes, txRes] = await Promise.all([
        sellerApi.getInventory().catch(() => ({
          balance: 0,
          assignedPackets: 0,
          soldPackets: 0,
          locationName: 'Van Stock',
          products: [],
        })),
        sellerApi.listTransactions({ pageSize: 20 }).catch(() => ({ items: [] })),
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
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const renderTx = ({ item }: { item: StockTransactionItem }) => (
    <Card style={styles.txCard}>
      <View style={styles.txHeader}>
        <Text style={styles.txProduct}>{item.product?.name || 'FemmeFlo Sanitary Packets'}</Text>
        <Badge
          label={item.type}
          variant={item.type.includes('IN') || item.type.includes('RECEIPT') ? 'success' : 'neutral'}
          size="sm"
        />
      </View>
      <View style={styles.txFooter}>
        <Text style={styles.txDate}>
          {new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <Text
          style={[
            styles.txQty,
            item.quantity > 0 ? styles.txQtyPositive : styles.txQtyNegative,
          ]}
        >
          {item.quantity > 0 ? `+${item.quantity}` : item.quantity} pkts
        </Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header title="Personal Stock" subtitle="Van Inventory & Movements" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={transactions}
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
                  <Text style={styles.balanceLabel}>Current Available Balance</Text>
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="cube-outline" size={18} color={BrandColors.green.primary} />
                  </View>
                </View>
                <Text style={styles.balanceValue}>
                  {(inventory?.balance ?? 0).toLocaleString()} <Text style={styles.balanceUnit}>Packets</Text>
                </Text>

                <View style={styles.balanceRow}>
                  <View style={styles.balanceStat}>
                    <Text style={styles.statLabel}>Assigned Stock</Text>
                    <Text style={styles.statVal}>
                      {(inventory?.assignedPackets ?? 0).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.balanceStat}>
                    <Text style={styles.statLabel}>Confirmed Sold</Text>
                    <Text style={[styles.statVal, { color: BrandColors.pink.primary }]}>
                      {(inventory?.soldPackets ?? 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* SKU Level Breakdown */}
              <Text style={styles.sectionHeading}>Product SKU Stock</Text>
              {inventory?.products && inventory.products.length > 0 ? (
                inventory.products.map((p) => (
                  <Card key={p.productId} style={styles.skuCard}>
                    <View style={styles.skuHeader}>
                      <Text style={styles.skuName}>{p.productName}</Text>
                      <Text style={styles.skuBalance}>{p.balance} pkts</Text>
                    </View>
                    <View style={styles.skuFooter}>
                      <Text style={styles.skuMeta}>SKU: {p.productSku || 'STD'}</Text>
                      <Text style={styles.skuMeta}>
                        Assigned: {p.assigned} • Sold: {p.sold}
                      </Text>
                    </View>
                  </Card>
                ))
              ) : (
                <Card variant="flat" style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
                  <Text style={{ color: '#64748B', ...Typography.caption }}>
                    Standard product allocation is active.
                  </Text>
                </Card>
              )}

              <Text style={styles.sectionHeading}>Recent Stock Ledger</Text>
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No Stock Movements"
              description="No recent stock receipts or transfers recorded."
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
    alignItems: 'center',
  },
  balanceLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceValue: {
    ...Typography.display,
    color: BrandColors.green.primary,
    marginVertical: Spacing.xs,
  },
  balanceUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  balanceRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  balanceStat: {
    flex: 1,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statVal: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
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
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txProduct: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txDate: {
    ...Typography.caption,
    color: Colors.light.textMuted,
  },
  txQty: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  txQtyPositive: {
    color: BrandColors.green.primary,
  },
  txQtyNegative: {
    color: Colors.light.textSecondary,
  },
});
