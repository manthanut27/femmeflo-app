import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { CustomerItem, PaginationMeta } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatISTDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function AdminCustomersScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const handleBack = useCallback(() => {
    try {
      (navigation as any).navigate('actions/index');
    } catch {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [navigation, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  async function handleExportCsv() {
    if (isExportingCsv || customers.length === 0) return;
    setIsExportingCsv(true);
    try {
      const headers = [
        'Shop Name',
        'Owner / Contact',
        'Phone',
        'Email',
        'Category',
        'State',
        'District',
        'Village / Area',
        'Address',
        'Pincode',
        'Active Status',
        'Onboarded Date',
      ];
      const rows = customers.map((c) => [
        c.shopName || '',
        c.contactName || c.ownerName || '',
        c.phone || '',
        c.email || '',
        c.category?.name || (c as any).categoryName || '',
        c.state || '',
        c.district || '',
        c.village || '',
        c.address || '',
        c.pincode || '',
        c.active !== false ? 'ACTIVE' : 'INACTIVE',
        c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '',
      ]);

      const csvContent = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((r) => r.map(escapeCsvCell).join(',')),
      ].join('\r\n');

      const filename = `femmeflo-customers-${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const localUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(localUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Customers CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('CSV Exported', `Saved to ${localUri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Could not export customers CSV.');
    } finally {
      setIsExportingCsv(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await adminApi.listCustomers({
        page: 1,
        pageSize: 100,
        search: debouncedSearch.trim() || undefined,
      });
      setCustomers(res.items || []);
      setPagination(res.pagination || { page: 1, pageSize: 100, total: res.items.length, totalPages: 1 });
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

  const renderItem = ({ item }: { item: CustomerItem }) => {
    const hasPhoto = Boolean(item.photoUrl || (item as any).photoPath);
    const photoReason = (item as any).noPhotoReason || (item as any).photoSkipReason;
    const hasGps = item.latitude != null && item.longitude != null;
    const onboardedDate = formatISTDate(item.createdAt || (item as any).createdDate);

    return (
      <Card
        style={styles.card}
        onPress={() => router.push(`/(admin)/customers/${item.id}` as any)}
        accessibilityLabel={`Store ${item.shopName}, Owner ${item.ownerName || item.contactName || 'Owner'}, Category ${item.category?.name || 'Retail'}`}
        accessibilityHint="Tap to view and edit store details"
      >
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.shopName}>{item.shopName}</Text>
            <Text style={styles.owner}>
              Contact: {item.contactName || item.ownerName || 'Owner'} • Phone: {item.phone}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={item.category?.name || 'Retail'} variant="info" size="sm" />
              <Badge label={item.active ? 'Active' : 'Inactive'} variant={item.active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </View>

        {/* Location & Onboarding */}
        <View style={styles.detailsRow}>
          <View style={styles.detailCol}>
            <Ionicons name="location-outline" size={13} color="#64748B" />
            <Text style={styles.detailText}>
              {[item.village, item.district, item.state].filter(Boolean).join(', ') || 'Territory'}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Ionicons name="calendar-outline" size={13} color="#64748B" />
            <Text style={styles.detailText}>Onboarded: {onboardedDate}</Text>
          </View>
        </View>

        {/* GPS & Photo Badges */}
        <View style={styles.badgeRow}>
          {hasPhoto ? (
            <View style={styles.verifiedPhotoBadge}>
              <Ionicons name="camera" size={12} color={BrandColors.green.primary} />
              <Text style={styles.verifiedPhotoText}>Photo Verified</Text>
            </View>
          ) : (
            <View style={styles.exemptPhotoBadge}>
              <Ionicons name="alert-circle-outline" size={12} color="#D97706" />
              <Text style={styles.exemptPhotoText}>
                Exempt: {photoReason || 'No Photo'}
              </Text>
            </View>
          )}

          {hasGps ? (
            <View style={styles.gpsBadge}>
              <Ionicons name="navigate-outline" size={12} color="#0284C7" />
              <Text style={styles.gpsText}>
                GPS: {item.latitude!.toFixed(4)}, {item.longitude!.toFixed(4)}
              </Text>
            </View>
          ) : (
            <View style={styles.noGpsBadge}>
              <Ionicons name="location-outline" size={12} color="#94A3B8" />
              <Text style={styles.noGpsText}>No GPS</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Customer Directory"
        subtitle={`${pagination.total} registered retail outlets across nation`}
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to administrative actions"
            onPress={handleBack}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export customer directory to CSV"
              style={({ pressed }) => [styles.exportBtn, pressed && styles.btnPressed]}
              onPress={handleExportCsv}
              disabled={isExportingCsv || customers.length === 0}
            >
              {isExportingCsv ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.exportBtnText}>CSV</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Batch onboard customers"
              style={styles.batchBtn}
              onPress={() => router.push('/(admin)/customers/bulk' as any)}
            >
              <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Onboard new customer"
              style={styles.addBtn}
              onPress={() => router.push('/(admin)/customers/new' as any)}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />

      <View style={styles.searchBarOuter}>
        <View style={styles.searchBar}>
          <Input
            placeholder="Search customers across all territories..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          />
        </View>
      </View>

      {/* Bulk Action Shortcut Banner */}
      <View style={styles.bulkBannerWrapper}>
        <TouchableOpacity
          style={styles.bulkBanner}
          onPress={() => router.push('/(admin)/customers/bulk' as any)}
          accessibilityRole="button"
          accessibilityLabel="Add Multiple Customers in Bulk"
        >
          <View style={styles.bulkBannerIcon}>
            <Ionicons name="layers" size={18} color={BrandColors.pink.dark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bulkBannerTitle}>Add Multiple Customers (Bulk Mode)</Text>
            <Text style={styles.bulkBannerSub}>
              Batch onboard up to 100 retailers at once with shared territory defaults
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={BrandColors.pink.dark} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : customers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Customers Found"
          description={search ? 'No outlets matching your filter.' : 'No customers have been registered yet.'}
          actionTitle="Onboard Customer"
          onAction={() => router.push('/(admin)/customers/new' as any)}
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
              colors={[BrandColors.pink.dark]}
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
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.pink.primary,
    gap: 4,
  },
  exportBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 11,
  },
  btnPressed: {
    opacity: 0.75,
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
  bulkBannerWrapper: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  bulkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: BrandColors.pink.subtle,
    borderRadius: BorderRadius.md,
  },
  bulkBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBannerTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#0F172A',
  },
  bulkBannerSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  loadingContainer: {
    padding: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  shopName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  owner: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
    marginTop: Spacing.xs,
  },
  detailCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  verifiedPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BrandColors.green.subtle,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  verifiedPhotoText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  exemptPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  exemptPhotoText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  gpsText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  noGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.xs,
  },
  noGpsText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
