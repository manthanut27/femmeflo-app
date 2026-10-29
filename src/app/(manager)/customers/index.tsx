import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { managerApi } from '@/api/manager';
import type { CustomerItem, PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, MaxContentWidth, Spacing, Typography } from '@/constants/theme';

export default function ManagerCustomersScreen() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await managerApi.listCustomers({
        page: 1,
        pageSize: 50,
        search: debouncedSearch.trim() || undefined,
      });
      setCustomers(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.warn('Failed to load customers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCustomers();
  }, [loadCustomers]);

  const renderItem = ({ item }: { item: CustomerItem }) => (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.shopName}>{item.shopName}</Text>
          <Text style={styles.owner}>Proprietor: {item.ownerName}</Text>
        </View>
        <Badge label={item.category?.name || 'Retail'} variant="info" size="sm" />
      </View>
      <View style={styles.footer}>
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
          <Text style={styles.phone}>{item.phone}</Text>
        </View>
        <View style={styles.sellerRow}>
          <Ionicons name="person-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
          <Text style={styles.sellerTag}>
            Officer: {item.seller?.name || 'Assigned'}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Territory Customers"
        subtitle={`${pagination.total} registered stores across sellers`}
      />

      <View style={styles.searchBarOuter}>
        <View style={styles.searchBar}>
          <Input
            placeholder="Search by shop or owner name..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color="#94A3B8" />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : customers.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title="No Customers Found"
          description="No retail stores onboarded in this territory yet."
          iconColor={BrandColors.green.primary}
          iconBgColor={BrandColors.green.surface}
          iconBorderColor={BrandColors.green.light}
        />
      ) : (
        <FlatList
          data={customers}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  searchBarOuter: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  searchBar: {
    padding: Spacing.md,
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
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  shopName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  owner: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    marginTop: Spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    ...Typography.caption,
    color: Colors.light.text,
    fontWeight: '600',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerTag: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
