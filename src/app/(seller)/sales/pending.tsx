import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sellerApi } from '@/api/seller';
import type { SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  BorderRadius,
  BrandColors,
  Colors,
  HitSlop,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { formatCurrencyINR, formatDateIST } from '@/utils/dateUtils';

function normalizePendingSale(raw: any): SaleItem {
  if (!raw || typeof raw !== 'object') return raw;
  const totalAmountPaise = raw.totalAmountPaise ?? raw.totalPaise ?? raw.amountPaise ?? 0;
  const packetCount = raw.packetCount ?? raw.quantity ?? 0;

  return {
    ...raw,
    totalAmountPaise,
    totalPaise: raw.totalPaise ?? totalAmountPaise,
    packetCount,
    quantity: raw.quantity ?? packetCount,
  };
}

export default function PendingSalesScreen() {
  const router = useRouter();

  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Collection Modal State
  const [activeSaleToCollect, setActiveSaleToCollect] = useState<SaleItem | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [collectMode, setCollectMode] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  const loadPendingSales = useCallback(async () => {
    try {
      const res = await sellerApi.listSales({ pageSize: 100 });
      const items = (res.items || []).map(normalizePendingSale);
      // Filter for uncollected orders (paymentMode === 'PENDING' and not rejected)
      const pendingItems = items.filter(
        (s) => s.paymentMode === 'PENDING' && s.status !== 'REJECTED'
      );
      setSales(pendingItems);
    } catch (err) {
      console.warn('Failed to load pending sales', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPendingSales();
  }, [loadPendingSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPendingSales();
  }, [loadPendingSales]);

  // Filter by search query
  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const shop = s.customer?.shopName?.toLowerCase() || '';
      const owner = s.customer?.ownerName?.toLowerCase() || '';
      const phone = s.customer?.phone?.toLowerCase() || '';
      const village = s.customer?.village?.toLowerCase() || '';
      const district = s.customer?.district?.toLowerCase() || '';
      const saleNo = (s.saleNumber || s.id || '').toLowerCase();
      return (
        shop.includes(q) ||
        owner.includes(q) ||
        phone.includes(q) ||
        village.includes(q) ||
        district.includes(q) ||
        saleNo.includes(q)
      );
    });
  }, [sales, searchQuery]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    const totalPaise = sales.reduce(
      (sum, s) => sum + (s.totalAmountPaise ?? s.totalPaise ?? 0),
      0
    );
    const totalPackets = sales.reduce(
      (sum, s) => sum + (s.packetCount || s.quantity || 0),
      0
    );
    const uniqueShops = new Set(
      sales.map((s) => s.customer?.id || s.customerId).filter(Boolean)
    ).size;

    return {
      totalPaise,
      totalPackets,
      ordersCount: sales.length,
      uniqueShops,
    };
  }, [sales]);

  function handleOpenCollect(item: SaleItem) {
    setActiveSaleToCollect(item);
    setCollectMode('CASH');
    setPaymentRef('');
    setPaymentModalVisible(true);
  }

  async function handleConfirmCollection() {
    if (!activeSaleToCollect || isCollecting) return;
    setIsCollecting(true);

    try {
      await sellerApi.collectPayment(activeSaleToCollect.id, {
        mode: collectMode,
        paymentMode: collectMode,
        paymentReference: paymentRef.trim() || undefined,
      });

      const collectedAmount = activeSaleToCollect.totalAmountPaise ?? activeSaleToCollect.totalPaise ?? 0;
      const shopName = activeSaleToCollect.customer?.shopName || 'Retail Store';

      // Remove collected order from pending list immediately
      setSales((prev) => prev.filter((s) => s.id !== activeSaleToCollect.id));
      setPaymentModalVisible(false);

      Alert.alert(
        'Payment Collected',
        `Successfully collected ${formatCurrencyINR(collectedAmount)} from ${shopName} via ${collectMode}. Order marked as paid.`
      );
    } catch (err: any) {
      Alert.alert('Payment Collection Error', err.message || 'Unable to update payment status.');
    } finally {
      setIsCollecting(false);
    }
  }

  function handleCallCustomer(phone?: string) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Unable to Call', `Cannot dial ${phone} on this device.`);
    });
  }

  const renderItem = ({ item }: { item: SaleItem }) => {
    const totalAmount = item.totalAmountPaise ?? item.totalPaise ?? 0;
    const packets = item.packetCount || item.quantity || 0;
    const customer = item.customer;
    const isApprovalPending = item.status === 'PENDING' || item.status === 'PENDING_APPROVAL';

    return (
      <Card style={styles.orderCard}>
        {/* Card Header: Shop Name & Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.shopInfo}>
            <View style={styles.shopTitleRow}>
              <Ionicons name="storefront" size={18} color={BrandColors.pink.primary} style={{ marginRight: 6 }} />
              <Text style={styles.shopName} numberOfLines={1}>
                {customer?.shopName || 'Retail Outlet'}
              </Text>
            </View>
            <Text style={styles.orderNumber}>
              Order #{item.saleNumber || item.id.slice(0, 8)} • {formatDateIST(item.createdAt, 'short')}
            </Text>
          </View>
          <Badge label="PAYMENT DUE" variant="warning" size="sm" pulse />
        </View>

        {/* Customer Location & Contact */}
        <View style={styles.contactRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.ownerText}>
              Owner: <Text style={{ fontWeight: '700' }}>{customer?.ownerName || (customer as any)?.contactName || '—'}</Text>
            </Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {[customer?.village, customer?.district].filter(Boolean).join(', ') || 'Assigned Beat Territory'}
            </Text>
          </View>
          {customer?.phone ? (
            <Pressable
              style={styles.callPill}
              hitSlop={HitSlop.sm}
              onPress={() => handleCallCustomer(customer.phone)}
            >
              <Ionicons name="call" size={14} color="#047857" style={{ marginRight: 4 }} />
              <Text style={styles.callPillText}>{customer.phone}</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Financial Details Row */}
        <View style={styles.amountBox}>
          <View>
            <Text style={styles.amountLabel}>UNCOLLECTED BALANCE</Text>
            <Text style={styles.amountValue}>{formatCurrencyINR(totalAmount)}</Text>
          </View>
          <View style={styles.volumeBox}>
            <Text style={styles.volumeLabel}>VOLUME</Text>
            <Text style={styles.volumeValue}>{packets} pkts</Text>
          </View>
        </View>

        {/* Approval Notice if not yet authorized */}
        {isApprovalPending ? (
          <View style={styles.approvalNotice}>
            <Ionicons name="alert-circle" size={14} color="#B45309" style={{ marginRight: 6 }} />
            <Text style={styles.approvalNoticeText}>
              Special price order pending Super Admin authorization. You can collect payment once authorized.
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <Button
            title="Collect Payment"
            variant="primary"
            size="md"
            icon={<Ionicons name="cash-outline" size={18} color="#FFFFFF" />}
            onPress={() => handleOpenCollect(item)}
            style={styles.collectBtn}
            disabled={isApprovalPending}
          />
          <Button
            title="View Details"
            variant="outline"
            size="md"
            icon={<Ionicons name="document-text-outline" size={16} color={BrandColors.pink.primary} />}
            onPress={() => router.push(`/(seller)/sales/${item.id}` as any)}
            style={styles.viewBtn}
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Pending Collections"
        subtitle={`${sales.length} uncollected store sales • Total ${formatCurrencyINR(metrics.totalPaise)}`}
        showBack
        onBack={() => router.back()}
      />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : sales.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="checkmark-done-circle"
            title="All Payments Collected!"
            description="There are no outstanding balances to collect. All retail store sales have been paid in full."
            iconColor={BrandColors.green.primary}
            iconBgColor={BrandColors.green.surface}
            actionTitle="Back to Sales & Reports"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.pink.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* KPI Summary Cards */}
              <View style={styles.kpiRow}>
                <Card style={[styles.kpiCard, styles.kpiCardAlert]}>
                  <Text style={styles.kpiLabel}>TOTAL UNCOLLECTED</Text>
                  <Text style={styles.kpiValueAlert}>{formatCurrencyINR(metrics.totalPaise)}</Text>
                  <Text style={styles.kpiSub}>{metrics.ordersCount} pending store {metrics.ordersCount === 1 ? 'sale' : 'sales'}</Text>
                </Card>

                <Card style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>AFFECTED STORES</Text>
                  <Text style={styles.kpiValue}>{metrics.uniqueShops}</Text>
                  <Text style={styles.kpiSub}>{metrics.totalPackets} total packets</Text>
                </Card>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Input
                  placeholder="Search by store name, owner, phone, village..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  leftIcon={<Ionicons name="search" size={18} color={Colors.light.textSecondary} />}
                  rightIcon={
                    searchQuery ? (
                      <Pressable onPress={() => setSearchQuery('')} hitSlop={HitSlop.sm}>
                        <Ionicons name="close-circle" size={18} color={Colors.light.textSecondary} />
                      </Pressable>
                    ) : undefined
                  }
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>

              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>Uncollected Store Accounts</Text>
                <Text style={styles.sectionCountText}>{filteredSales.length} found</Text>
              </View>
            </View>
          }
        />
      )}

      {/* Payment Collection Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdropDismiss} onPress={() => setPaymentModalVisible(false)} />
          <View style={styles.modalContent}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Collect Store Payment</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {activeSaleToCollect?.customer?.shopName || 'Retail Customer'}
                  </Text>
                </View>
                <Pressable hitSlop={HitSlop.md} onPress={() => setPaymentModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
                </Pressable>
              </View>

              {/* Amount to collect display */}
              <View style={styles.modalAmountBox}>
                <Text style={styles.modalAmountLabel}>OUTSTANDING AMOUNT DUE</Text>
                <Text style={styles.modalAmountValue}>
                  {formatCurrencyINR(
                    activeSaleToCollect?.totalAmountPaise ?? activeSaleToCollect?.totalPaise ?? 0
                  )}
                </Text>
                <Text style={styles.modalAmountSub}>
                  Order #{activeSaleToCollect?.saleNumber || activeSaleToCollect?.id.slice(0, 8)} • {activeSaleToCollect?.packetCount} Packets
                </Text>
              </View>

              {/* Payment Mode Selector */}
              <Text style={styles.fieldLabel}>Select Payment Method Received</Text>
              <SegmentedTabs
                tabs={[
                  { label: '💵 Cash Received', value: 'CASH' },
                  { label: '📱 UPI / Bank Transfer', value: 'BANK' },
                ]}
                selectedTab={collectMode}
                onSelect={(val: 'CASH' | 'BANK') => setCollectMode(val)}
                style={{ marginBottom: Spacing.md }}
              />

              {/* Reference number for UPI/Bank */}
              {collectMode === 'BANK' && (
                <Input
                  label="UPI Transaction ID / Reference (UTR)"
                  placeholder="e.g. 431089234190 or UPI Ref"
                  value={paymentRef}
                  onChangeText={setPaymentRef}
                  leftIcon={<Ionicons name="receipt-outline" size={18} color={Colors.light.textSecondary} />}
                />
              )}

              {/* Action Buttons */}
              <View style={styles.modalButtonsRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setPaymentModalVisible(false)}
                  disabled={isCollecting}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={`Confirm ${formatCurrencyINR(activeSaleToCollect?.totalAmountPaise ?? activeSaleToCollect?.totalPaise ?? 0)} Paid`}
                  variant="primary"
                  onPress={handleConfirmCollection}
                  loading={isCollecting}
                  icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
                  style={{ flex: 2 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    padding: Spacing.lg,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerSection: {
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Shadows.sm,
  },
  kpiCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  kpiLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  kpiValue: {
    ...Typography.h2,
    color: Colors.light.heading,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiValueAlert: {
    ...Typography.h2,
    color: '#B45309',
    fontWeight: '800',
    marginTop: 2,
  },
  kpiSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    marginBottom: Spacing.md,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.h3,
    color: Colors.light.heading,
  },
  sectionCountText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  shopInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  shopName: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
    flex: 1,
  },
  orderNumber: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    padding: Spacing.xs + 2,
    marginBottom: Spacing.sm,
  },
  ownerText: {
    ...Typography.caption,
    color: Colors.light.textPrimary,
  },
  locationText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  callPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  callPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  amountValue: {
    ...Typography.h2,
    fontSize: 18,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 1,
  },
  volumeBox: {
    alignItems: 'flex-end',
  },
  volumeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  volumeValue: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 1,
  },
  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  approvalNoticeText: {
    ...Typography.caption,
    fontSize: 10,
    color: '#92400E',
    flex: 1,
    lineHeight: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  collectBtn: {
    flex: 1.4,
  },
  viewBtn: {
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.lg,
    maxHeight: '90%',
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalAmountBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  modalAmountValue: {
    ...Typography.h1,
    fontSize: 26,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
    marginBottom: 2,
  },
  modalAmountSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontSize: 11,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
