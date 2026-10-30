import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { PaginationMeta, SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

const STATUS_FILTERS: Array<{ label: string; value: string | null }> = [
  { label: 'All Orders', value: null },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending Approval', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function SalesListScreen() {
  const router = useRouter();

  const [sales, setSales] = useState<SaleItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadSales = useCallback(
    async (page = 1, append = false) => {
      try {
        if (!append) setLoading(true);
        const res = await sellerApi.listSales({
          page,
          pageSize: 20,
          status: selectedStatus || undefined,
        });

        if (append) {
          setSales((prev) => [...prev, ...res.items]);
        } else {
          setSales(res.items);
        }
        setPagination(res.pagination);
      } catch (err) {
        console.warn('Failed to load sales', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [selectedStatus]
  );

  useEffect(() => {
    loadSales(1, false);
  }, [loadSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales(1, false);
  }, [loadSales]);

  const onEndReached = () => {
    if (loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    loadSales(pagination.page + 1, true);
  };

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderItem = ({ item }: { item: SaleItem }) => (
    <Card
      onPress={() => router.push(`/(seller)/sales/${item.id}` as any)}
      accessibilityLabel={`Order ${item.saleNumber || item.id.slice(0, 8)} for ${item.customer?.shopName || 'Retail Customer'}, ${formatRupees(item.totalAmountPaise)}`}
      accessibilityHint="Tap to view order line items and tax invoice"
      style={styles.saleCard}
    >
      <View style={styles.cardHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.customer?.shopName || 'Retail Customer'}
          </Text>
          <Text style={styles.orderNumber}>
            #{item.saleNumber || item.id.slice(0, 8)} •{' '}
            {new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
        <Badge label={item.status} variant={item.status} />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.leftFooter}>
          <Text style={styles.packetText}>{item.packetCount} packets</Text>
          <Badge label={item.paymentMode} variant={item.paymentMode} size="sm" showDot={false} />
        </View>

        <Text style={styles.amountText}>{formatRupees(item.totalAmountPaise)}</Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Sales Ledger"
        subtitle={`${pagination.total} orders recorded`}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new sale"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => router.push('/(seller)/sales/new' as any)}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      {/* Status Filter Tabs using SegmentedTabs */}
      <View style={styles.filtersWrapper}>
        <SegmentedTabs
          tabs={STATUS_FILTERS}
          selectedTab={selectedStatus}
          onSelect={setSelectedStatus}
          scrollable
          activeColor={BrandColors.pink.primary}
          accessibilityLabel="Filter sales orders by status"
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : sales.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No Sales Found"
          description={
            selectedStatus
              ? `No ${selectedStatus.toLowerCase()} orders found for this filter.`
              : 'You have not recorded any sales yet today.'
          }
          actionTitle="Create First Sale"
          onAction={() => router.push('/(seller)/sales/new' as any)}
        />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.pink.primary]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreRow}>
                <ActivityIndicator size="small" color={BrandColors.pink.primary} />
                <Text style={styles.loadMoreText}>Loading more sales...</Text>
              </View>
            ) : undefined
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
  addButton: {
    backgroundColor: BrandColors.pink.primary,
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addButtonPressed: {
    backgroundColor: BrandColors.pink.pressed,
    transform: [{ scale: 0.96 }],
  },
  filtersWrapper: {
    paddingVertical: Spacing.sm,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
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
  saleCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  customerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  customerName: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  orderNumber: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  leftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  packetText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  amountText: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.primary,
  },
  loadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  loadMoreText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    marginLeft: Spacing.sm,
  },
});
