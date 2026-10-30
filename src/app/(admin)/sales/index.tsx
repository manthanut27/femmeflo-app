import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { SaleItem, PaymentMode } from '@/api/types';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';

function formatISTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AdminSalesScreen() {
  const router = useRouter();

  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING_APPROVAL' | 'REJECTED'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMode | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_month'>('all');

  // Selected Sale for Detailed Modal
  const [selectedSale, setSelectedSale] = useState<SaleItem | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      const res = await adminApi.listSales({
        page: 1,
        pageSize: 100,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentMode: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        period: periodFilter,
        search: search.trim() || undefined,
      });
      setSales(res.items || res.sales || []);
    } catch (err: any) {
      console.warn('Failed to load sales list', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, paymentFilter, periodFilter, search]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSales();
  }, [fetchSales]);

  const handleOpenInvoice = (saleId: string) => {
    const url = adminApi.getInvoicePdfUrl(saleId);
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Invoice URL', url);
        }
      })
      .catch(() => {
        Alert.alert('Invoice URL', url);
      });
  };

  const renderSaleItem = ({ item }: { item: SaleItem }) => {
    const totalRupees = ((item.totalAmountPaise || item.totalPaise || 0) / 100).toFixed(2);
    const packetCount = item.packetCount || item.quantity || 0;
    const customerName = item.customer?.shopName || 'Retail Customer';
    const sellerName = item.seller?.name || 'Field Officer';
    const createdAt = formatISTDateTime(item.createdAt || (item as any).requestedAt);

    return (
      <Card style={styles.saleCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.shopName}>{customerName}</Text>
            <Text style={styles.saleMeta}>
              Sold by {sellerName} • {createdAt}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={item.status} variant={item.status as BadgeVariant} size="sm" />
            <Badge label={item.paymentMode} variant={item.paymentMode as BadgeVariant} size="sm" />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Packets</Text>
            <Text style={styles.summaryVal}>{packetCount} pkts</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Order Total</Text>
            <Text style={[styles.summaryVal, { color: BrandColors.pink.dark }]}>₹{totalRupees}</Text>
          </View>
        </View>

        {item.customerFeedback ? (
          <View style={styles.feedbackBox}>
            <Ionicons name="chatbox-outline" size={13} color="#64748B" />
            <Text style={styles.feedbackText} numberOfLines={2}>
              "{item.customerFeedback}"
            </Text>
          </View>
        ) : null}

        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedSale(item)}
            accessibilityRole="button"
            accessibilityLabel="View sale details"
          >
            <Ionicons name="receipt-outline" size={15} color="#0F172A" />
            <Text style={styles.detailsBtnText}>Order Details</Text>
          </TouchableOpacity>

          {item.status === 'CONFIRMED' || item.status === 'APPROVED' ? (
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={() => handleOpenInvoice(item.id)}
              accessibilityRole="button"
              accessibilityLabel="Download invoice PDF"
            >
              <Ionicons name="document-text-outline" size={15} color={BrandColors.pink.dark} />
              <Text style={styles.pdfBtnText}>Invoice PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Sales Directory"
        subtitle="National transaction ledger, POS orders and invoices"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={() => router.back()}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
      />

      <View style={styles.filterSection}>
        <View style={styles.searchInner}>
          <Input
            placeholder="Search order ID, shop or seller..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          />
        </View>

        {/* Status filters */}
        <View style={styles.filterTabsRow}>
          {(['ALL', 'CONFIRMED', 'PENDING_APPROVAL', 'REJECTED'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterTab, statusFilter === st && styles.filterTabActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterTabText, statusFilter === st && styles.filterTabTextActive]}>
                {st === 'PENDING_APPROVAL' ? 'PENDING' : st}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment mode filters */}
        <View style={styles.filterTabsRow}>
          {(['ALL', 'CASH', 'BANK', 'PENDING'] as const).map((pm) => (
            <TouchableOpacity
              key={pm}
              style={[styles.filterTab, paymentFilter === pm && styles.filterTabActive]}
              onPress={() => setPaymentFilter(pm)}
            >
              <Text style={[styles.filterTabText, paymentFilter === pm && styles.filterTabTextActive]}>
                {pm === 'ALL' ? 'ALL MODES' : pm}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingPadding}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : sales.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="No Sales Found"
          description={
            search
              ? 'No sales records matching your search.'
              : 'No transactions recorded matching the selected filter.'
          }
        />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleItem}
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

      {/* Sale Detail Modal */}
      <Modal visible={selectedSale !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Order Breakdown</Text>
                <Text style={styles.modalSub}>
                  ID: {selectedSale?.id} • {formatISTDateTime(selectedSale?.createdAt)}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedSale(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Customer & Seller */}
              <Card style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Retail Shop:</Text>
                  <Text style={styles.metaVal}>{selectedSale?.customer?.shopName || 'Retail Store'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Contact:</Text>
                  <Text style={styles.metaVal}>
                    {selectedSale?.customer?.ownerName || selectedSale?.customer?.contactName || '—'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Field Officer:</Text>
                  <Text style={styles.metaVal}>{selectedSale?.seller?.name || 'Seller'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Mode:</Text>
                  <Text style={styles.metaVal}>{selectedSale?.paymentMode}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Order Status:</Text>
                  <Text style={[styles.metaVal, { fontWeight: '700' }]}>{selectedSale?.status}</Text>
                </View>
              </Card>

              {/* Line Items */}
              <Text style={styles.sectionHeading}>Items & SKU Breakdown</Text>
              {selectedSale?.items && selectedSale.items.length > 0 ? (
                selectedSale.items.map((item, idx) => {
                  const lineTotal = ((item.totalPaise || item.totalPricePaise || item.quantity * item.unitPricePaise) / 100).toFixed(2);
                  return (
                    <View key={item.id || idx} style={styles.lineItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineItemName}>
                          {item.productName || item.product?.name || 'FemmeFlo Product'}
                        </Text>
                        <Text style={styles.lineItemMeta}>
                          {item.quantity} pkts × ₹{(item.unitPricePaise / 100).toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>₹{lineTotal}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.lineItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineItemName}>Primary SKU</Text>
                    <Text style={styles.lineItemMeta}>
                      {selectedSale?.packetCount || selectedSale?.quantity} pkts × ₹
                      {(((selectedSale?.unitPricePaise || 3500)) / 100).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.lineItemTotal}>
                    ₹{(((selectedSale?.totalAmountPaise || selectedSale?.totalPaise || 0)) / 100).toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Total Row */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Gross Order Value</Text>
                <Text style={styles.totalVal}>
                  ₹{(((selectedSale?.totalAmountPaise || selectedSale?.totalPaise || 0)) / 100).toFixed(2)}
                </Text>
              </View>

              {/* Feedback */}
              {selectedSale?.customerFeedback ? (
                <View style={styles.feedbackCard}>
                  <Text style={styles.feedbackCardTitle}>Field Observation / Feedback</Text>
                  <Text style={styles.feedbackCardBody}>"{selectedSale.customerFeedback}"</Text>
                </View>
              ) : null}

              {/* Invoice Action */}
              <View style={styles.modalBtnRow}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setSelectedSale(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                {selectedSale?.id ? (
                  <Button
                    title="Open Tax Invoice"
                    variant="admin"
                    icon={<Ionicons name="document-text-outline" size={18} color="#FFFFFF" />}
                    onPress={() => handleOpenInvoice(selectedSale.id)}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  filterSection: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
    gap: 6,
    paddingBottom: Spacing.xs,
  },
  searchInner: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 6,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  filterTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  filterTabActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  filterTabText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  loadingPadding: {
    padding: Spacing.md,
    gap: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  saleCard: {
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  saleMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  summaryVal: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: '#FAF8F5',
    padding: 6,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  feedbackText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.text,
    flex: 1,
    fontStyle: 'italic',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  detailsBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.pink.subtle,
    backgroundColor: '#FFF1F2',
  },
  pdfBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  metaCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  metaVal: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sectionHeading: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  lineItemName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
  },
  lineItemMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  lineItemTotal: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  totalVal: {
    ...Typography.title,
    fontSize: 20,
    fontWeight: '800',
    color: BrandColors.pink.dark,
  },
  feedbackCard: {
    padding: Spacing.sm,
    backgroundColor: '#FAF8F5',
    borderRadius: BorderRadius.md,
  },
  feedbackCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  feedbackCardBody: {
    ...Typography.caption,
    color: Colors.light.text,
    fontStyle: 'italic',
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
});
