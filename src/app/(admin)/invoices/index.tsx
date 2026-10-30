import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { InvoiceItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { formatCurrencyINR } from '@/utils/dateUtils';

type PaymentFilter = 'ALL' | 'PAID' | 'PENDING';

export default function AdminInvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await adminApi.listInvoices({ pageSize: 100 });
      const list = res.items || res.invoices || [];
      setInvoices(list);
    } catch (err: any) {
      Alert.alert('Invoices Error', err.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const searchLower = search.toLowerCase().trim();
    const invNum = inv.number?.toLowerCase() || '';
    const shopName = inv.sale?.customer?.shopName?.toLowerCase() || '';
    const contactName = inv.sale?.customer?.contactName?.toLowerCase() || '';
    const sellerName = inv.sale?.seller?.name?.toLowerCase() || '';
    const saleRef = (inv.sale?.saleNumber || inv.saleId || '').toLowerCase();

    const matchesSearch =
      !searchLower ||
      invNum.includes(searchLower) ||
      shopName.includes(searchLower) ||
      contactName.includes(searchLower) ||
      sellerName.includes(searchLower) ||
      saleRef.includes(searchLower);

    if (!matchesSearch) return false;

    const isPending = inv.sale?.paymentMode === 'PENDING' || inv.sale?.paymentMode === 'CREDIT';
    if (paymentFilter === 'PAID' && isPending) return false;
    if (paymentFilter === 'PENDING' && !isPending) return false;

    return true;
  });

  async function handleViewPdf(invoice: InvoiceItem) {
    const pdfUrl = adminApi.getAdminInvoicePdfUrl(invoice.id, false);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(pdfUrl, '_blank');
      }
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (canOpen) {
        await Linking.openURL(pdfUrl);
      } else {
        // Fall back to downloading and sharing
        await handleSharePdf(invoice);
      }
    } catch {
      await handleSharePdf(invoice);
    }
  }

  async function handleSharePdf(invoice: InvoiceItem) {
    if (downloadingId) return;
    setDownloadingId(invoice.id);

    try {
      const pdfUrl = adminApi.getAdminInvoicePdfUrl(invoice.id, true);

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(pdfUrl, '_blank');
        }
        return;
      }

      const filename = `${invoice.number || `Invoice_${invoice.id}`}.pdf`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadRes = await FileSystem.downloadAsync(pdfUrl, localUri);

      if (downloadRes.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadRes.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Share ${invoice.number}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Saved', `Invoice downloaded to device: ${downloadRes.uri}`);
        }
      } else {
        Alert.alert('Download Error', 'Could not fetch PDF from server.');
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to download invoice PDF.');
    } finally {
      setDownloadingId(null);
    }
  }

  function renderInvoiceItem({ item }: { item: InvoiceItem }) {
    const sale = item.sale;
    const isPendingPayment = sale?.paymentMode === 'PENDING' || sale?.paymentMode === 'CREDIT';
    const amountPaise = sale?.totalAmountPaise || sale?.totalPaise || 0;
    const dateFormatted = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';
    const deliveriesText =
      item.deliveries && item.deliveries.length > 0
        ? item.deliveries.map((d) => d.channel).join(' · ')
        : 'Generated Tax Invoice';

    return (
      <Card style={styles.invoiceCard}>
        {/* Header row: Invoice number & status */}
        <View style={styles.cardHeader}>
          <View style={styles.invoiceIconCircle}>
            <Ionicons name="receipt" size={20} color={BrandColors.pink.dark} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.invoiceNumber}>{item.number}</Text>
            <Text style={styles.dateText}>{dateFormatted}</Text>
          </View>
          <Badge
            label={isPendingPayment ? 'PENDING' : 'PAID'}
            variant={isPendingPayment ? 'PENDING' : 'ACTIVE'}
          />
        </View>

        {/* Details row: Customer, Officer, Sale Ref */}
        <View style={styles.detailsBlock}>
          <View style={styles.detailRow}>
            <Ionicons name="storefront-outline" size={15} color={Colors.light.textSecondary} />
            <Text style={styles.detailLabel}>Customer:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {sale?.customer?.shopName || 'Registered Customer'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={Colors.light.textSecondary} />
            <Text style={styles.detailLabel}>Officer:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {sale?.seller?.name || 'Assigned Seller'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="pricetag-outline" size={15} color={Colors.light.textSecondary} />
            <Text style={styles.detailLabel}>Sale Ref:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {sale?.saleNumber || item.saleId || 'N/A'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="send-outline" size={15} color={Colors.light.textSecondary} />
            <Text style={styles.detailLabel}>Delivery:</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {deliveriesText}
            </Text>
          </View>
        </View>

        {/* Footer row: Total amount & Actions */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>{formatCurrencyINR(amountPaise)}</Text>
          </View>

          <View style={styles.actionButtonGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View PDF for ${item.number}`}
              style={({ pressed }) => [styles.pdfBtn, pressed && styles.btnPressed]}
              onPress={() => handleViewPdf(item)}
            >
              <Ionicons name="eye-outline" size={16} color={BrandColors.pink.dark} />
              <Text style={styles.pdfBtnText}>View</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share PDF for ${item.number}`}
              style={({ pressed }) => [styles.shareBtn, pressed && styles.btnPressed]}
              onPress={() => handleSharePdf(item)}
              disabled={downloadingId === item.id}
            >
              {downloadingId === item.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Central Invoice Directory"
        subtitle="Audited Tax Invoices & Multi-Channel Dispatch"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Settings"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </Pressable>
        }
      />

      <View style={styles.contentWrapper}>
        {/* Search & Filter Bar */}
        <View style={styles.filterSection}>
          <Input
            placeholder="Search invoice number, shop, or officer..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textTertiary} />}
            rightIcon={
              search ? (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                </Pressable>
              ) : undefined
            }
          />

          <View style={styles.filterPills}>
            {(['ALL', 'PAID', 'PENDING'] as PaymentFilter[]).map((tab) => (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${tab}`}
                style={[styles.pill, paymentFilter === tab && styles.pillActive]}
                onPress={() => setPaymentFilter(tab)}
              >
                <Text style={[styles.pillText, paymentFilter === tab && styles.pillTextActive]}>
                  {tab === 'ALL' ? 'All Invoices' : tab === 'PAID' ? 'Paid' : 'Pending Payment'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={BrandColors.pink.dark} />
          </View>
        ) : (
          <FlatList
            data={filteredInvoices}
            keyExtractor={(item) => item.id}
            renderItem={renderInvoiceItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={56} color={Colors.light.textTertiary} />
                <Text style={styles.emptyTitle}>No Invoices Found</Text>
                <Text style={styles.emptySubtitle}>
                  {search || paymentFilter !== 'ALL'
                    ? 'No invoices match your filter criteria.'
                    : 'Generated customer tax invoices will appear here.'}
                </Text>
              </View>
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
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  filterSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  filterPills: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  pillActive: {
    backgroundColor: BrandColors.pink.dark,
  },
  pillText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  invoiceCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.light.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Elevation.low,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  invoiceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceNumber: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  dateText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  detailsBlock: {
    marginVertical: Spacing.xs,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginLeft: 6,
    width: 68,
  },
  detailValue: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  amountLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  amountValue: {
    ...Typography.h3,
    color: BrandColors.pink.dark,
    fontWeight: '800',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: BrandColors.pink.tint,
    gap: 4,
  },
  pdfBtnText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.pink.primary,
    gap: 4,
  },
  shareBtnText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.75,
  },
  emptyContainer: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.light.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
});
