import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { SaleItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { AttendanceFilterButton } from '@/components/common/AttendanceFilterModal';
import type { DateRangeFilterSelection } from '@/components/common/DateRangeFilterModal';
import { PdfPreviewModal } from '@/components/common/PdfPreviewModal';
import {
  AdminSalesFilterModal,
  formatPaymentModeLabel,
  type AdminSalesPaymentFilter,
  type AdminSalesStatusFilter,
} from '@/components/sales/AdminSalesFilterModal';
import { SalesOrderCard } from '@/components/sales/SalesOrderCard';
import { RemittanceActionModal } from '@/components/sales/RemittanceActionModal';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { getISTDateKey } from '@/utils/dateUtils';
import { getSellerReportDateRange } from '@/utils/reportFilterUtils';
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
  const { width } = useWindowDimensions();
  const isMultiColumn = width >= 768;
  const isCompactWidth = width < 360;
  const handleBack = useDashboardBackHandler('/(admin)');

  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminSalesStatusFilter>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<AdminSalesPaymentFilter>('ALL');
  const [dateSelection, setDateSelection] = useState<DateRangeFilterSelection>({ preset: 'all' });
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Selection & Company Payment Receipt state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [remittanceTargets, setRemittanceTargets] = useState<SaleItem[]>([]);
  const [isCompletingRemittance, setIsCompletingRemittance] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Selected Sale for Detailed Modal
  const [selectedSale, setSelectedSale] = useState<SaleItem | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string; title: string } | null>(null);

  const fetchSales = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await adminApi.listSales({
        page: 1,
        pageSize: 100,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentMode: paymentFilter !== 'ALL' ? paymentFilter : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      const fetched = res?.items || res?.sales || [];
      setSales(fetched);
      const validSet = new Set(
        fetched
          .filter((s) => s.status === 'CONFIRMED' && (s.paymentMode === 'CASH' || s.paymentMode === 'BANK'))
          .map((s) => s.id)
      );
      setSelectedSaleIds((prev) => prev.filter((id) => validSet.has(id)));
    } catch (err: any) {
      console.warn('Failed to load sales list', err);
      setLoadError('Unable to load sales records. Please try again.');
      setSales([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, paymentFilter, debouncedSearch]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useRealtimeSync(['SALE_STATUS_UPDATE', 'APPROVAL_UPDATE', 'INVENTORY_UPDATE'], fetchSales);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSales();
  }, [fetchSales]);

  const readyToCompleteSales = useMemo(
    () =>
      sales.filter(
        (s) => s.status === 'CONFIRMED' && (s.paymentMode === 'CASH' || s.paymentMode === 'BANK')
      ),
    [sales]
  );

  const selectedSalesList = useMemo(
    () => sales.filter((s) => selectedSaleIds.includes(s.id)),
    [sales, selectedSaleIds]
  );

  const selectedTotalPaise = useMemo(
    () => selectedSalesList.reduce((acc, s) => acc + Number(s.totalAmountPaise || s.totalPaise || 0), 0),
    [selectedSalesList]
  );

  const toggleSelectSale = useCallback((sale: SaleItem) => {
    setSelectedSaleIds((prev) =>
      prev.includes(sale.id) ? prev.filter((id) => id !== sale.id) : [...prev, sale.id]
    );
  }, []);

  const handleSelectAllReady = useCallback(() => {
    const ids = readyToCompleteSales.map((s) => s.id);
    if (ids.length === 0) return;
    setSelectionMode(true);
    setSelectedSaleIds((prev) => (prev.length === ids.length ? [] : ids));
  }, [readyToCompleteSales]);

  const handleSubmitReceivePayment = useCallback(
    async ({ remark, dateStr }: { remark?: string; dateStr: string }) => {
      if (remittanceTargets.length === 0 || isCompletingRemittance) return;
      setIsCompletingRemittance(true);
      try {
        if (remittanceTargets.length === 1) {
          const target = remittanceTargets[0]!;
          await adminApi.receiveSalePayment(target.id, {
            remark,
            receivedAt: dateStr,
          });
        } else {
          await adminApi.bulkCompleteSales({
            saleIds: remittanceTargets.map((s) => s.id),
            remark,
            receivedAt: dateStr,
          });
        }

        const count = remittanceTargets.length;
        setRemittanceTargets([]);
        setSelectedSaleIds([]);
        setSelectionMode(false);
        setSelectedSale(null);
        await fetchSales();
        Alert.alert(
          'Payment Received & Completed',
          `${count} ${count === 1 ? 'sale' : 'sales'} marked received in FemmeFlo account and moved to COMPLETED.`
        );
      } catch (err: any) {
        Alert.alert('Completion Error', err?.message || 'Could not mark sale payment as received.');
      } finally {
        setIsCompletingRemittance(false);
      }
    },
    [remittanceTargets, isCompletingRemittance, fetchSales]
  );

  const handleOpenInvoice = (sale: SaleItem) => {
    const invoiceId = sale.invoice?.id || sale.id;
    const url = adminApi.getInvoicePdfUrl(invoiceId);
    const filename = `Invoice_${sale.invoice?.number || sale.saleNumber || invoiceId.slice(0, 8)}.pdf`;
    setPdfPreview({
      url,
      filename,
      title: sale.customer?.shopName ? `Invoice - ${sale.customer.shopName}` : 'Tax Invoice',
    });
  };

  const activeDateRange = useMemo(
    () => getSellerReportDateRange(dateSelection),
    [dateSelection]
  );

  const displayedSales = useMemo(() => {
    if (!activeDateRange.fromDateKey && !activeDateRange.toDateKey) {
      return sales;
    }
    return sales.filter((s) => {
      const key = getISTDateKey(s.createdAt || (s as any).requestedAt);
      if (activeDateRange.fromDateKey && key < activeDateRange.fromDateKey) return false;
      if (activeDateRange.toDateKey && key > activeDateRange.toDateKey) return false;
      return true;
    });
  }, [sales, activeDateRange.fromDateKey, activeDateRange.toDateKey]);

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    dateSelection.preset !== 'all' ||
    search.trim().length > 0;

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDateSelection({ preset: 'all' });
  };

  const renderSaleItem = ({ item }: { item: SaleItem }) => (
    <View style={isMultiColumn ? styles.gridItemWrap : undefined}>
      <SalesOrderCard
        item={item}
        formattedDate={formatISTDateTime(item.createdAt || (item as any).requestedAt)}
        onViewDetails={setSelectedSale}
        onOpenInvoice={handleOpenInvoice}
        onReceivePayment={(sale) => setRemittanceTargets([sale])}
        selectable={selectionMode}
        selected={selectedSaleIds.includes(item.id)}
        onToggleSelect={toggleSelectSale}
        isCompactWidth={isCompactWidth}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Sales Record"
        subtitle="Orders & Tax Invoices"
        showBack
        onBack={handleBack}
      />

      <View style={styles.filterSection}>
        <View style={styles.searchFilterRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Search order ID, shop or seller..."
              value={search}
              onChangeText={setSearch}
              containerStyle={{ marginBottom: 0 }}
              leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
              rightIcon={
                search.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setSearch('');
                      setDebouncedSearch('');
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.light.textTertiary} />
                  </Pressable>
                ) : undefined
              }
            />
          </View>
          <AttendanceFilterButton
            onPress={() => setFilterModalVisible(true)}
            hasActiveFilter={statusFilter !== 'ALL' || paymentFilter !== 'ALL' || dateSelection.preset !== 'all'}
            accentColor={BrandColors.pink.dark}
            accessibilityLabel="Open sales status, date and payment mode filter"
          />
        </View>

        {/* Active Filter Summary */}
        {hasActiveFilters ? (
          <View style={styles.activeSummaryBar}>
            <Text style={styles.activeSummaryText} numberOfLines={1}>
              {displayedSales.length} {displayedSales.length === 1 ? 'result' : 'results'}
              {dateSelection.preset !== 'all' ? ` · ${activeDateRange.label}` : ''}
              {statusFilter !== 'ALL'
                ? ` · ${
                    statusFilter === 'CONFIRMED'
                      ? 'Confirmed'
                      : statusFilter === 'PENDING_APPROVAL'
                      ? 'Pending'
                      : 'Received'
                  }`
                : ''}
              {paymentFilter !== 'ALL' ? ` · ${formatPaymentModeLabel(paymentFilter)}` : ''}
            </Text>
            <TouchableOpacity onPress={clearAllFilters} hitSlop={8} accessibilityRole="button">
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Bulk Selection Toolbar */}
        {readyToCompleteSales.length > 0 ? (
          <View style={styles.activeSummaryBar}>
            <TouchableOpacity
              onPress={() => {
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedSaleIds([]);
                } else {
                  setSelectionMode(true);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: selectionMode ? '#0F766E' : '#F1F5F9',
              }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={selectionMode ? 'checkbox' : 'checkbox-outline'}
                size={15}
                color={selectionMode ? '#FFFFFF' : '#334155'}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: selectionMode ? '#FFFFFF' : '#334155' }}>
                {selectionMode ? 'Cancel Select' : 'Select for Bulk Complete'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectAllReady}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F766E' }}>
                {selectedSaleIds.length === readyToCompleteSales.length && readyToCompleteSales.length > 0
                  ? 'Deselect All'
                  : `Select All Ready (${readyToCompleteSales.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingPadding}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : loadError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could Not Load Sales"
          description={loadError}
          actionTitle="Retry"
          onAction={() => {
            setLoading(true);
            fetchSales();
          }}
        />
      ) : displayedSales.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="No Sales Found"
          description={
            hasActiveFilters
              ? 'No sales records match your current search or filters.'
              : 'No transactions recorded yet.'
          }
          actionTitle={hasActiveFilters ? 'Clear Filters' : undefined}
          onAction={hasActiveFilters ? clearAllFilters : undefined}
        />
      ) : (
        <FlatList
          key={isMultiColumn ? 'grid-2' : 'list-1'}
          numColumns={isMultiColumn ? 2 : 1}
          columnWrapperStyle={isMultiColumn ? styles.columnWrapper : undefined}
          data={displayedSales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleItem}
          contentContainerStyle={[
            styles.listContent,
            selectionMode && selectedSaleIds.length > 0 && { paddingBottom: 110 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.pink.dark]}
            />
          }
        />
      )}

      {/* Sticky Bulk Complete Action Bar */}
      {selectionMode && selectedSaleIds.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: Spacing.md,
            right: Spacing.md,
            bottom: Spacing.md,
            backgroundColor: '#0F172A',
            borderRadius: 16,
            paddingHorizontal: Spacing.md,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...Elevation.medium,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>
              {selectedSaleIds.length} {selectedSaleIds.length === 1 ? 'sale' : 'sales'} selected
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF' }}>
              ₹{(selectedTotalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <Button
            title="Amount Received & Complete"
            variant="admin"
            size="sm"
            icon={<Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />}
            onPress={() => setRemittanceTargets(selectedSalesList)}
          />
        </View>
      ) : null}

      {/* Sale Detail Modal */}
      <Modal
        visible={selectedSale !== null}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setSelectedSale(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Order Breakdown</Text>
                <Text style={styles.modalSub}>
                  {selectedSale?.invoice?.number ? `${selectedSale.invoice.number} • ` : ''}
                  {formatISTDateTime(selectedSale?.createdAt)}
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
                  <Text style={styles.metaVal}>{formatPaymentModeLabel(selectedSale?.paymentMode)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Order Status:</Text>
                  <Text style={[styles.metaVal, { fontWeight: '700' }]}>{selectedSale?.status}</Text>
                </View>
              </Card>

              {/* Company Remittance Details */}
              {selectedSale?.paymentSentAt || selectedSale?.paymentReceivedAt ? (
                <Card
                  style={{
                    padding: Spacing.sm,
                    backgroundColor: selectedSale.status === 'COMPLETED' ? '#F0FDFA' : '#EFF6FF',
                    borderWidth: 1,
                    borderColor: selectedSale.status === 'COMPLETED' ? '#99F6E4' : '#BFDBFE',
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: selectedSale.status === 'COMPLETED' ? '#0F766E' : '#1E40AF',
                    }}
                  >
                    {selectedSale.status === 'COMPLETED'
                      ? 'Company Account Remittance — COMPLETED'
                      : 'Seller Payment Sent to Company'}
                  </Text>
                  {selectedSale.paymentSentAt ? (
                    <Text style={{ fontSize: 12, color: '#334155' }}>
                      Sent on {formatISTDateTime(selectedSale.paymentSentAt)}
                      {selectedSale.paymentSentRemark ? ` — "${selectedSale.paymentSentRemark}"` : ''}
                    </Text>
                  ) : null}
                  {selectedSale.paymentReceivedAt ? (
                    <Text style={{ fontSize: 12, color: '#0F766E', fontWeight: '600' }}>
                      Received on {formatISTDateTime(selectedSale.paymentReceivedAt)}
                      {selectedSale.paymentReceivedRemark ? ` — "${selectedSale.paymentReceivedRemark}"` : ''}
                    </Text>
                  ) : null}
                </Card>
              ) : null}

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

              {/* Actions */}
              {selectedSale?.status === 'COMPLETED' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: BorderRadius.md,
                    backgroundColor: BrandColors.green.primary,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                    Received
                  </Text>
                </View>
              ) : selectedSale?.status === 'CONFIRMED' &&
                (selectedSale.paymentMode === 'CASH' || selectedSale.paymentMode === 'BANK') ? (
                <TouchableOpacity
                  onPress={() => setRemittanceTargets([selectedSale])}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Receive payment and mark sale completed"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: BorderRadius.md,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: BrandColors.green.primary,
                  }}
                >
                  <Ionicons name="wallet-outline" size={18} color={BrandColors.green.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: BrandColors.green.primary }}>
                    Receive
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.modalBtnRow}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setSelectedSale(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                {selectedSale?.id &&
                (selectedSale.status === 'CONFIRMED' || selectedSale.status === 'COMPLETED') ? (
                  <Button
                    title="Open Tax Invoice"
                    variant="admin"
                    icon={<Ionicons name="document-text-outline" size={18} color="#FFFFFF" />}
                    onPress={() => {
                      const target = selectedSale;
                      setSelectedSale(null);
                      if (target) handleOpenInvoice(target);
                    }}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RemittanceActionModal
        visible={remittanceTargets.length > 0}
        mode="ADMIN_RECEIVE"
        title={
          remittanceTargets.length > 1
            ? `Complete ${remittanceTargets.length} Sales`
            : 'Confirm Amount Received'
        }
        subtitle={
          remittanceTargets.length > 1
            ? 'Mark selected sales as received in FemmeFlo account and COMPLETED'
            : `Order for ${remittanceTargets[0]?.customer?.shopName || 'Retail Store'} (${remittanceTargets[0]?.seller?.name || 'Seller'})`
        }
        selectedCount={remittanceTargets.length}
        totalAmountPaise={remittanceTargets.reduce(
          (sum, s) => sum + Number(s.totalAmountPaise || s.totalPaise || 0),
          0
        )}
        packetCount={remittanceTargets.reduce((sum, s) => sum + (s.packetCount || s.quantity || 0), 0)}
        paymentModeLabel={remittanceTargets.length === 1 ? remittanceTargets[0]?.paymentMode : undefined}
        sellerSentAt={remittanceTargets.length === 1 ? remittanceTargets[0]?.paymentSentAt : undefined}
        sellerSentRemark={
          remittanceTargets.length === 1 ? remittanceTargets[0]?.paymentSentRemark : undefined
        }
        loading={isCompletingRemittance}
        onClose={() => setRemittanceTargets([])}
        onSubmit={handleSubmitReceivePayment}
      />

      <AdminSalesFilterModal
        visible={filterModalVisible}
        statusFilter={statusFilter}
        paymentFilter={paymentFilter}
        dateSelection={dateSelection}
        onApply={({
          statusFilter: nextStatus,
          paymentFilter: nextPayment,
          dateSelection: nextDate,
        }) => {
          setStatusFilter(nextStatus);
          setPaymentFilter(nextPayment);
          if (nextDate) setDateSelection(nextDate);
        }}
        onClose={() => setFilterModalVisible(false)}
      />

      <PdfPreviewModal
        visible={pdfPreview !== null}
        pdfUrl={pdfPreview?.url || null}
        filename={pdfPreview?.filename}
        title={pdfPreview?.title}
        onClose={() => setPdfPreview(null)}
      />
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
    gap: 8,
    paddingVertical: Spacing.sm,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  activeSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  activeSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  columnWrapper: {
    gap: Spacing.md,
  },
  gridItemWrap: {
    flex: 1,
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
