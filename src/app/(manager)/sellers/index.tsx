import { managerApi, ManagerSellerItem } from '@/api/manager';
import type { PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ManagerSellersScreen() {
  const router = useRouter();

  const [sellers, setSellers] = useState<ManagerSellerItem[]>([]);
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

  const loadSellers = useCallback(async () => {
    try {
      const res = await managerApi.listSellers({
        page: 1,
        pageSize: 50,
        search: debouncedSearch.trim() || undefined,
      });
      setSellers(res.items);
      setPagination(res.pagination);
    } catch (err) {
      console.warn('Failed to load sellers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSellers();
  }, [loadSellers]);

  const renderSeller = ({ item }: { item: ManagerSellerItem }) => {
    const initials = item.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <Card style={styles.sellerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'SF'}</Text>
          </View>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>{item.name}</Text>
            <Text style={styles.sellerEmail}>{item.email}</Text>
          </View>
          <Badge
            label={item.active ? 'ACTIVE' : 'INACTIVE'}
            variant={item.active ? 'ACTIVE' : 'INACTIVE'}
            size="sm"
          />
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.phoneText}>{item.phone || 'No phone recorded'}</Text>
          </View>
          <Text style={styles.territoryText}>
            {[item.district, item.state].filter(Boolean).join(', ') || 'Assigned Territory'}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Field Force"
        subtitle={`${pagination.total} assigned sellers`}
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onboard new field officer"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => router.push('/(manager)/sellers/new' as any)}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.searchBarOuter}>
        <View style={styles.searchBar}>
          <Input
            placeholder="Search field officers by name or phone..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : sellers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Field Officers Found"
          description={
            search
              ? 'No sellers match your search query.'
              : 'No field officers assigned to your territory yet.'
          }
          iconColor={BrandColors.green.primary}
          iconBgColor={BrandColors.green.surface}
          iconBorderColor={BrandColors.green.light}
          actionTitle="Onboard First Officer"
          buttonVariant="secondary"
          onAction={() => router.push('/(manager)/sellers/new' as any)}
        />
      ) : (
        <FlatList
          data={sellers}
          keyExtractor={(item) => item.id}
          renderItem={renderSeller}
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
  addButton: {
    backgroundColor: BrandColors.green.primary,
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addButtonPressed: {
    backgroundColor: BrandColors.green.pressed,
    transform: [{ scale: 0.96 }],
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
  sellerCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: BrandColors.green.surface,
    borderWidth: 1,
    borderColor: BrandColors.green.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    ...Typography.bodyMedium,
    color: BrandColors.green.primary,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  sellerName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  sellerEmail: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
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
  phoneText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  territoryText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
