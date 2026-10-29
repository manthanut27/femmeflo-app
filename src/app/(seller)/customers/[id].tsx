import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { CustomerItem, SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerItem | null>(null);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      sellerApi.getCustomer(id).catch(() => ({ customer: null as any })),
      sellerApi.listSales({ customerId: id, pageSize: 10 }).catch(() => ({ items: [] })),
    ])
      .then(([custRes, salesRes]) => {
        if (custRes.customer) setCustomer(custRes.customer);
        if (salesRes.items) setSales(salesRes.items);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleCall() {
    if (!customer?.phone) return;
    Linking.openURL(`tel:${customer.phone}`).catch(() => {
      Alert.alert('Unable to Call', `Phone dialer could not be opened for ${customer.phone}`);
    });
  }

  function handleEmail() {
    if (!customer?.email) return;
    Linking.openURL(`mailto:${customer.email}`).catch(() => {
      Alert.alert('Unable to Email', `Mail app could not be opened for ${customer.email}`);
    });
  }

  function handleOpenMaps() {
    if (customer?.latitude && customer?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Unable to Open Maps', 'Maps application could not be opened.');
      });
    }
  }

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.pink.primary} />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.centerContainer}>
        <Header title="Customer Details" showBack />
        <Text style={styles.errorText}>Customer record not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={customer.shopName} subtitle="Store Ledger & Profile" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* Profile Card */}
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.shopTitle}>{customer.shopName}</Text>
                <Text style={styles.ownerSubtitle}>Proprietor: {customer.ownerName}</Text>
              </View>
              <Badge label={customer.category?.name || 'Retail'} variant="info" size="md" />
            </View>

            {customer.photoUrl ? (
              <Image source={{ uri: customer.photoUrl }} style={styles.customerPhoto} />
            ) : null}

            {/* Quick Contact Buttons */}
            <View style={styles.contactRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${customer.phone}`}
                style={({ pressed }) => [styles.actionPill, pressed && styles.actionPillPressed]}
                onPress={handleCall}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Call</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Email ${customer.email}`}
                style={({ pressed }) => [styles.actionPill, styles.emailPill, pressed && styles.actionPillPressed]}
                onPress={handleEmail}
                hitSlop={HitSlop.md}
              >
                <Ionicons name="mail" size={16} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Email</Text>
              </Pressable>

              {customer.latitude && customer.longitude ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open store location in Maps"
                  style={({ pressed }) => [styles.actionPill, styles.mapsPill, pressed && styles.actionPillPressed]}
                  onPress={handleOpenMaps}
                  hitSlop={HitSlop.md}
                >
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.actionPillText}>Navigate</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.divider} />

            {/* Contact Details */}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Email Address</Text>
              <Text style={styles.detailValue}>{customer.email}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Mobile Number</Text>
              <Text style={styles.detailValue}>{customer.phone}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Full Address</Text>
              <Text style={styles.detailValue}>{customer.address}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Location Area</Text>
              <Text style={styles.detailValue}>
                {[customer.village, customer.district, customer.state, customer.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
          </Card>

          {/* Action: Create Sale for this customer */}
          <Button
            title={`Create New Sale for ${customer.shopName.split(' ')[0]}`}
            variant="primary"
            size="lg"
            onPress={() =>
              router.push({
                pathname: '/(seller)/sales/new' as any,
                params: { customerId: customer.id, customerName: customer.shopName },
              })
            }
            icon={<Ionicons name="cart-outline" size={20} color="#FFFFFF" />}
            style={{ marginBottom: Spacing.xl }}
          />

          {/* Order History */}
          <Text style={styles.sectionHeading}>Order History</Text>
          {sales.length === 0 ? (
            <Card variant="flat" style={styles.emptyCard}>
              <Text style={styles.emptyText}>No orders recorded yet for this customer.</Text>
            </Card>
          ) : (
            sales.map((sale) => (
              <Card
                key={sale.id}
                onPress={() => router.push(`/(seller)/sales/${sale.id}` as any)}
                accessibilityLabel={`Order ${sale.saleNumber || sale.id.slice(0, 8)}, ${formatRupees(sale.totalAmountPaise)}, status ${sale.status}`}
                accessibilityHint="Tap to view order details and invoice"
                style={styles.saleCard}
              >
                <View style={styles.saleHeader}>
                  <View>
                    <Text style={styles.saleNumber}>
                      {sale.saleNumber || `Order #${sale.id.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.saleDate}>
                      {new Date(sale.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Badge label={sale.status} variant={sale.status} />
                </View>

                <View style={styles.saleFooter}>
                  <Text style={styles.packetCount}>{sale.packetCount} packets</Text>
                  <Text style={styles.saleAmount}>{formatRupees(sale.totalAmountPaise)}</Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginTop: Spacing.lg,
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  shopTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  ownerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  customerPhoto: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.pink.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.sm,
  },
  actionPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  emailPill: {
    backgroundColor: Colors.light.info,
  },
  mapsPill: {
    backgroundColor: BrandColors.green.primary,
  },
  actionPillText: {
    color: '#FFFFFF',
    ...Typography.caption,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  detailItem: {
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    ...Typography.bodySmall,
    color: Colors.light.text,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  emptyCard: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.light.textMuted,
  },
  saleCard: {
    marginBottom: Spacing.sm,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saleNumber: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  saleDate: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderSubtle,
  },
  packetCount: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  saleAmount: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: BrandColors.pink.primary,
  },
});
