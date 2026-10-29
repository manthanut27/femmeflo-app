import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { WarehouseItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
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

export default function AdminInventoryScreen() {
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await adminApi.getWarehouses();
      setWarehouses(res.items);
    } catch (err) {
      console.warn('Failed to load warehouses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWarehouses();
  }, [loadWarehouses]);

  const renderWarehouse = ({ item }: { item: WarehouseItem }) => (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Warehouse ${item.name}, code ${item.code}, status ${item.active ? 'Operational' : 'Inactive'}`}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.codeRow}>
            <Ionicons name="barcode-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.code}>Facility Code: {item.code}</Text>
          </View>
        </View>
        <Badge
          label={item.active ? 'OPERATIONAL' : 'INACTIVE'}
          variant={item.active ? 'ACTIVE' : 'INACTIVE'}
          size="sm"
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
          <Text style={styles.location}>
            {[item.district, item.state].filter(Boolean).join(', ') || item.address}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title="HQ & Warehouses"
        subtitle="National Storage & Logistics Network"
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New stock transfer"
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={() => router.push('/(admin)/inventory/transfer' as any)}
            hitSlop={HitSlop.md}
          >
            <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.innerContainer}>
        {/* Action Banner */}
        <View style={styles.actionBanner}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={styles.bannerTitle}>Stock Inward & Transfers</Text>
            <Text style={styles.bannerSub}>Record factory receipts and transfers to sellers.</Text>
          </View>
          <Button
            title="New Transfer"
            size="sm"
            variant="secondary"
            icon={<Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />}
            onPress={() => router.push('/(admin)/inventory/transfer' as any)}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : (
          <FlatList
            data={warehouses}
            keyExtractor={(item) => item.id}
            renderItem={renderWarehouse}
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
  addButton: {
    backgroundColor: BrandColors.pink.dark,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.low,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  bannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  bannerSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
  name: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  code: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  footer: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
});
