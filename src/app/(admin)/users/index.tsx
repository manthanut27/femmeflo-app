import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { PublicUser } from '@/api/types';
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

type UserTab = 'MANAGERS' | 'SELLERS';

export default function AdminUsersScreen() {
  const [tab, setTab] = useState<UserTab>('MANAGERS');
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      if (tab === 'MANAGERS') {
        const res = await adminApi.listManagers({ pageSize: 50, search: debouncedSearch.trim() || undefined });
        setUsers(res.items);
      } else {
        const res = await adminApi.listSellers({ pageSize: 50, search: debouncedSearch.trim() || undefined });
        setUsers(res.items);
      }
    } catch (err) {
      console.warn('Failed to load users', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, debouncedSearch]);

  useEffect(() => {
    loadUsers(false);
  }, [loadUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers(false);
  }, [loadUsers]);

  const tabs = [
    { key: 'MANAGERS', label: 'Managers', badge: tab === 'MANAGERS' ? users.length : undefined },
    { key: 'SELLERS', label: 'Sellers (Field Force)', badge: tab === 'SELLERS' ? users.length : undefined },
  ];

  const renderItem = ({ item }: { item: PublicUser }) => (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`User ${item.name}, ${item.email}, role ${tab === 'MANAGERS' ? 'Manager' : 'Seller'}, status ${item.active ? 'Active' : 'Inactive'}`}
    >
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor:
                  tab === 'MANAGERS' ? BrandColors.green.subtle : BrandColors.pink.subtle,
                borderColor:
                  tab === 'MANAGERS' ? BrandColors.green.tint : BrandColors.pink.tint,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color:
                    tab === 'MANAGERS' ? BrandColors.green.primary : BrandColors.pink.dark,
                },
              ]}
            >
              {item.name?.slice(0, 2).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
        </View>
        <Badge
          label={item.active ? 'ACTIVE' : 'INACTIVE'}
          variant={item.active ? 'ACTIVE' : 'INACTIVE'}
          size="sm"
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.phone}>{item.phone || 'No phone registered'}</Text>
        </View>
        <View style={styles.territoryRow}>
          <Ionicons name="location-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.territory}>
            {[item.district, item.state].filter(Boolean).join(', ') || 'All Regions'}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header title="User Administration" subtitle="Managers & Field Officers Directory" />

      <View style={styles.innerContainer}>
        {/* Tabs Selector */}
        <View style={styles.tabsSection}>
          <SegmentedTabs
            tabs={tabs}
            activeTab={tab}
            activeColor={BrandColors.pink.dark}
            onTabChange={(selected) => {
              setLoading(true);
              setTab(selected as UserTab);
            }}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${tab.toLowerCase()} by name or email...`}
              placeholderTextColor={Colors.light.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              accessibilityLabel={`Search ${tab.toLowerCase()}`}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : users.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title={`No ${tab.toLowerCase()} found`}
            description="Try adjusting your search criteria."
            iconColor={BrandColors.pink.dark}
            iconBgColor={BrandColors.pink.subtle}
            iconBorderColor={BrandColors.pink.tint}
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[BrandColors.pink.dark]}
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
  tabsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
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
  loadingContainer: {
    padding: Spacing.lg,
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  name: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  email: {
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
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  territoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  territory: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
