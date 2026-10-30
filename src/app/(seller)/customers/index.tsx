import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { categoriesApi } from '@/api/categories';
import { sellerApi } from '@/api/seller';
import type { CategoryItem, CustomerItem, PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export default function CustomerListScreen() {
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Categories once
  useEffect(() => {
    categoriesApi
      .listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const loadCustomers = useCallback(
    async (page = 1, append = false) => {
      try {
        if (!append) setLoading(true);
        const res = await sellerApi.listCustomers({
          page,
          pageSize: 20,
          search: debouncedSearch.trim() || undefined,
          categoryId: selectedCategory || undefined,
        });

        if (append) {
          setCustomers((prev) => [...prev, ...res.items]);
        } else {
          setCustomers(res.items);
        }
        setPagination(res.pagination);
      } catch (err) {
        console.warn('Failed to load customers', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, selectedCategory]
  );

  useEffect(() => {
    loadCustomers(1, false);
  }, [loadCustomers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCustomers(1, false);
  }, [loadCustomers]);

  const onEndReached = () => {
    if (loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    loadCustomers(pagination.page + 1, true);
  };

  const renderItem = ({ item }: { item: CustomerItem }) => {
    const initials = item.shopName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <Card
        onPress={() => router.push(`/(seller)/customers/${item.id}` as any)}
        accessibilityLabel={`Store ${item.shopName}, owned by ${item.ownerName}, in ${item.district || 'Territory'}`}
        accessibilityHint="Tap to view store ledger and contact options"
        style={styles.customerCard}
      >
        <View style={styles.cardHeader}>
          <View style={styles.shopAvatar}>
            <Text style={styles.shopAvatarText}>{initials || 'ST'}</Text>
          </View>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName} numberOfLines={1}>
              {item.shopName}
            </Text>
            <Text style={styles.ownerName} numberOfLines={1}>
              {item.ownerName}
            </Text>
          </View>
          {item.category?.name ? (
            <Badge label={item.category.name} variant="neutral" size="sm" showDot={false} />
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerCol}>
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.footerText}>{item.phone}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.footerText} numberOfLines={1}>
                {[item.village, item.district].filter(Boolean).join(', ') || item.address}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Store Directory"
        subtitle={`${pagination.total} retail partners`}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onboard new customer"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => router.push('/(seller)/customers/new' as any)}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        }
      />

      {/* Search & Category Filter */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by shop name, owner, or city..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          rightIcon={
            search ? (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={HitSlop.sm}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={Colors.light.textMuted} />
              </Pressable>
            ) : undefined
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="All store categories"
            accessibilityState={{ selected: selectedCategory === null }}
            style={[styles.categoryPill, selectedCategory === null && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryPillText, selectedCategory === null && styles.categoryPillTextActive]}>
              All Stores
            </Text>
          </Pressable>
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="tab"
                accessibilityLabel={`${cat.name} category`}
                accessibilityState={{ selected: active }}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(active ? null : cat.id)}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Customer List Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : customers.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title="No Stores Found"
          description={
            debouncedSearch || selectedCategory
              ? 'No retail stores match your filter criteria. Try resetting your search.'
              : 'You have not onboarded any retail customers yet.'
          }
          actionTitle="Onboard Store Now"
          onAction={() => router.push('/(seller)/customers/new' as any)}
        />
      ) : (
        <FlatList
          data={customers}
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
                <Text style={styles.loadMoreText}>Loading more stores...</Text>
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  categoryScrollContent: {
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: Spacing.xs,
  },
  categoryPillActive: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  categoryPillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  customerCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  shopAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.pink.subtle,
    borderWidth: 1,
    borderColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  shopAvatarText: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
    fontWeight: '700',
  },
  shopInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  shopName: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  ownerName: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
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
  footerCol: {
    flex: 1,
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    flex: 1,
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
