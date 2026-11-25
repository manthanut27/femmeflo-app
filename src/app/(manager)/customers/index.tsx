import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managerApi } from '@/api/manager';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { CustomerItem, PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { canOnboardCustomers, canViewCustomers } from '@/utils/permissions';

export default function ManagerCustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const allowView = canViewCustomers(user);
  const allowOnboard = canOnboardCustomers(user);

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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    if (!allowView) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await managerApi.listCustomers({
        page: 1,
        pageSize: 50,
        search: debouncedSearch.trim() || undefined,
      });
      setCustomers(res.items);
      setPagination(res.pagination);
      setLoadError(null);
    } catch (err: any) {
      console.warn('Failed to load customers', err);
      setLoadError(err?.message || 'Unable to load shops right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowView, debouncedSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useRealtimeSync(['CUSTOMER_UPDATE'], loadCustomers);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCustomers();
  }, [loadCustomers]);

  const renderItem = ({ item }: { item: CustomerItem }) => {
    const initials = item.shopName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const photoUri = item.photoUrl || (item as any).photoPath;

    return (
      <Card
        style={styles.card}
        onPress={() => router.push(`/(manager)/customers/${item.id}` as any)}
        accessibilityLabel={`Store ${item.shopName}, Owner ${item.ownerName}, Category ${item.category?.name || 'Retail'}`}
        accessibilityHint="Tap to view and edit store details"
      >
        <View style={styles.header}>
          <View style={styles.shopAvatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.shopAvatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.shopAvatarText}>{initials || 'ST'}</Text>
            )}
          </View>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.shopName} numberOfLines={1}>
              {item.shopName}
            </Text>
            <Text style={styles.owner} numberOfLines={1}>
              Owner: {item.ownerName}
            </Text>
          </View>
          <Badge label={item.category?.name || 'Retail'} variant="info" size="sm" />
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
          <Text style={styles.locationText} numberOfLines={1}>
            {[item.village, item.district].filter(Boolean).join(', ') || item.address || 'Area'}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.phone}>{item.phone}</Text>
            </View>
            <View style={styles.sellerRow}>
              <Ionicons name="person-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.sellerTag} numberOfLines={1}>
                Seller: {item.seller?.name || 'Assigned'}
              </Text>
            </View>
          </View>

          <View style={styles.cardActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call ${item.shopName}`}
              style={({ pressed }) => [styles.quickContactBtn, pressed && styles.quickBtnPressed]}
              onPress={(e) => {
                e.stopPropagation();
                if (item.phone) Linking.openURL(`tel:${item.phone}`).catch(() => {});
              }}
              hitSlop={HitSlop.sm}
            >
              <Ionicons name="call" size={14} color={BrandColors.pink.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp message to ${item.shopName}`}
              style={({ pressed }) => [styles.quickContactBtn, styles.quickWhatsAppBtn, pressed && styles.quickBtnPressed]}
              onPress={(e) => {
                e.stopPropagation();
                if (item.phone) {
                  const clean = item.phone.replace(/\D/g, '');
                  const phoneWithCountry = clean.length === 10 ? `91${clean}` : clean;
                  Linking.openURL(`https://wa.me/${phoneWithCountry}`).catch(() => {});
                }
              }}
              hitSlop={HitSlop.sm}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
            </Pressable>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </View>
      </Card>
    );
  };

  if (!allowView) {
    return (
      <View style={styles.container}>
        <Header title="Shops" subtitle="Directory" showBack />
        <View style={styles.restrictedContainer}>
          <EmptyState
            icon="lock-closed-outline"
            title="No Permission"
            description="You do not have permission to view shops. Please ask your administrator to turn on this permission."
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
        title="Shops"
        subtitle={`${pagination.total} registered shops`}
        rightAction={
          allowOnboard ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Batch onboard customers"
                style={styles.batchBtn}
                onPress={() => router.push('/(manager)/customers/bulk' as any)}
              >
                <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Onboard new customer"
                style={styles.addBtn}
                onPress={() => router.push('/(manager)/customers/new' as any)}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : undefined
        }
      />

      <View style={styles.searchBarOuter}>
        <View style={styles.searchBar}>
          <Input
            placeholder="Search by shop or owner name..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color="#94A3B8" />}
            rightIcon={
              search ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={HitSlop.sm}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              ) : undefined
            }
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
          icon={loadError ? 'cloud-offline-outline' : 'storefront-outline'}
          title={loadError ? "Couldn't Load Shops" : 'No Shops Found'}
          description={loadError || 'No shops added in your area yet.'}
          iconColor={loadError ? Colors.light.warning : BrandColors.green.primary}
          iconBgColor={loadError ? '#FFFBEB' : BrandColors.green.surface}
          iconBorderColor={loadError ? '#FDE68A' : BrandColors.green.light}
          actionTitle={loadError ? 'Retry' : undefined}
          onAction={loadError ? onRefresh : undefined}
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 110, 140) },
          ]}
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
  batchBtn: {
    backgroundColor: '#0F172A',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: BrandColors.pink.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  shopAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  shopAvatarImage: {
    width: '100%',
    height: '100%',
  },
  shopAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    paddingLeft: 46,
  },
  locationText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    flex: 1,
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
  footerLeft: {
    flex: 1,
    gap: 4,
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickContactBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickWhatsAppBtn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  quickBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
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
