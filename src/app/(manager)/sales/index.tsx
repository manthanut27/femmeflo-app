import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import type { PaginationMeta, SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED';

export default function ManagerSalesScreen() {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      const res = await managerApi.listSales({
        page: 1,
        pageSize: 50,
      });
      setSales(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.warn('Failed to load manager sales', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales();
  }, [loadSales]);

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const filteredSales = useMemo(() => {
    let result = sales;
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => s.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.customer?.shopName?.toLowerCase().includes(q) ||
          s.seller?.name?.toLowerCase().includes(q) ||
          s.saleNumber?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sales, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      ALL: sales.length,
      CONFIRMED: sales.filter((s) => s.status === 'CONFIRMED').length,
      PENDING: sales.filter((s) => s.status === 'PENDING').length,
      REJECTED: sales.filter((s) => s.status === 'REJECTED').length,
    };
  }, [sales]);

  const filterTabs = [
    { key: 'ALL' as const, label: 'All', badge: statusCounts.ALL },
    { key: 'CONFIRMED' as const, label: 'Confirmed', badge: statusCounts.CONFIRMED },
    { key: 'PENDING' as const, label: 'Pending', badge: statusCounts.PENDING },
    { key: 'REJECTED' as const, label: 'Rejected', badge: statusCounts.REJECTED },
  ];

  const renderItem = ({ item }: { item: SaleItem }) => (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Order ${item.saleNumber || item.id.slice(0, 8)} for ${item.customer?.shopName || 'Retail Customer'}, ${formatRupees(item.totalAmountPaise)} by officer ${item.seller?.name || 'Assigned Seller'}`}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.customer?.shopName || 'Retail Customer'}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.orderMeta}>
              {item.saleNumber || `Order #${item.id.slice(0, 8)}`} •{' '}
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>
        <Badge label={item.status} variant={item.status} />
      </View>

      <View style={styles.footer}>
        <View style={styles.sellerInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.sellerName}>{item.seller?.name || 'Assigned Seller'}</Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 4 }]}>
            <Ionicons name="cube-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.packets}>{item.packetCount} Packets</Text>
          </View>
        </View>
        <Text style={styles.amount}>{formatRupees(item.totalAmountPaise)}</Text>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Territory Sales"
        subtitle={`${pagination.total} sales recorded across territory`}
      />

      <View style={styles.innerContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search shop, seller, or order #..."
              placeholderTextColor={Colors.light.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              accessibilityLabel="Search sales orders"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Clear search query"
              >
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Status Filter Tabs */}
        <View style={styles.filterSection}>
          <SegmentedTabs
            tabs={filterTabs}
            activeTab={statusFilter}
            activeColor={BrandColors.green.primary}
            onTabChange={(tab) => setStatusFilter(tab as StatusFilter)}
          />
        </View>

        {loading ? (
          <View style={{ padding: Spacing.lg }}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No Sales Found"
            description={
              searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search terms.'
                : 'No sales orders submitted in your territory yet.'
            }
            iconColor={BrandColors.green.primary}
            iconBgColor={BrandColors.green.surface}
            iconBorderColor={BrandColors.green.light}
          />
        ) : (
          <FlatList
            data={filteredSales}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[BrandColors.green.primary]}
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    ...Elevation.low,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    paddingVertical: 0,
  },
  filterSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  card: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  customerName: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  orderMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  sellerInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerName: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
  },
  packets: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  amount: {
    ...Typography.h3,
    fontWeight: '800',
    color: BrandColors.green.primary,
  },
});
