import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isMockMode, tokenStorage } from '@/api/client';
import { sellerApi } from '@/api/seller';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { LoadingState } from '@/components/ui/LoadingState';
import { PdfPreviewModal } from '@/components/common/PdfPreviewModal';
import { RemittanceActionModal } from '@/components/sales/RemittanceActionModal';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { formatDateTimeIST } from '@/utils/dateUtils';

function normalizeSale(raw: any): SaleItem {
  if (!raw || typeof raw !== 'object') return raw;
  const totalAmountPaise = raw.totalAmountPaise ?? raw.totalPaise ?? raw.amountPaise ?? 0;
  const packetCount = raw.packetCount ?? raw.quantity ?? 0;

  const rawItems = Array.isArray(raw.items) && raw.items.length > 0
    ? raw.items
    : Array.isArray(raw.lineItems) && raw.lineItems.length > 0
      ? raw.lineItems
      : [];

  const items = rawItems.map((it: any, index: number) => {
    const qty = it.quantity ?? (rawItems.length === 1 ? packetCount : 1);
    const unitPrice = it.unitPricePaise ?? (qty > 0 ? Math.round((it.totalPricePaise ?? totalAmountPaise) / qty) : 0);
    const totalPrice = it.totalPricePaise ?? (qty * unitPrice);
    const name = it.productName || it.product?.name || (it.product?.sku ? `SKU: ${it.product.sku}` : 'FemmeFlo Sanitary Napkins');

    return {
      id: it.id || `item_${index}`,
      productId: it.productId || it.product?.id || 'prod',
      productName: name,
      quantity: qty,
      unitPricePaise: unitPrice,
      totalPricePaise: totalPrice,
    };
  });

  return {
    ...raw,
    totalAmountPaise,
    totalPaise: raw.totalPaise ?? totalAmountPaise,
    packetCount: packetCount || items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
    quantity: raw.quantity ?? packetCount,
    items: items.length > 0 ? items : [
      {
        id: '1',
        productId: 'prod_default',
        productName: 'FemmeFlo Sanitary Napkins',
        quantity: packetCount || 1,
        unitPricePaise: packetCount > 0 ? Math.round(totalAmountPaise / packetCount) : totalAmountPaise,
        totalPricePaise: totalAmountPaise,
      },
    ],
    lineItems: items,
  };
}

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sale, setSale] = useState<SaleItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Company Payment Remittance Modal State
  const [remittanceModalVisible, setRemittanceModalVisible] = useState(false);
  const [isSendingRemittance, setIsSendingRemittance] = useState(false);

  // Payment Collection State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [collectMode, setCollectMode] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // Invoice Download / In-App Preview State
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    filename: string;
    title: string;
  } | null>(null);

  // Customer Feedback Voice Modal State
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [editFeedbackText, setEditFeedbackText] = useState('');
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false);

  // Price Reapproval Modal State
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editPriceNotes, setEditPriceNotes] = useState('');
  const [isSubmittingReapproval, setIsSubmittingReapproval] = useState(false);

  const loadSale = useCallback(async () => {
    if (!id) return;
    try {
      const res = await sellerApi.getSale(id);
      const rawSale = res.sale || (res as any)?.data?.sale || (res as any)?.data || res;
      setSale(normalizeSale(rawSale));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load sale details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  useRealtimeSync(['SALE_STATUS_UPDATE', 'APPROVAL_UPDATE'], (evt) => {
    if (!evt?.entityId || evt.entityId === id) {
      loadSale();
    }
  });

  async function handleCollectPayment() {
    if (isCollecting || !id) return;
    setIsCollecting(true);
    try {
      const res = await sellerApi.collectPayment(id, {
        paymentMode: collectMode,
        mode: collectMode,
        paymentReference: paymentRef.trim() || undefined,
      });

      const updatedSale = (res as any)?.sale || (res as any)?.data?.sale || (res as any)?.data || res;
      const normalized = normalizeSale(updatedSale);
      setSale(normalized);
      setPaymentModalVisible(false);
      Alert.alert(
        'Payment Recorded',
        `Payment of ${formatRupees(normalized.totalAmountPaise)} confirmed via ${collectMode}. Order marked as paid.`
      );
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Unable to update payment status.');
    } finally {
      setIsCollecting(false);
    }
  }

  async function handleMarkPaymentSent({ remark, dateStr }: { remark?: string; dateStr: string }) {
    if (isSendingRemittance || !id) return;
    setIsSendingRemittance(true);
    try {
      const res = await sellerApi.markPaymentSent(id, {
        remark,
        sentAt: dateStr,
      });
      const updatedSale = (res as any)?.sale || (res as any)?.data?.sale || (res as any)?.data || res;
      setSale(normalizeSale(updatedSale));
      setRemittanceModalVisible(false);
      DeviceEventEmitter.emit('SALES_SYNC', { saleId: id, action: 'PAYMENT_SENT' });
      Alert.alert(
        'Sent to Company Recorded',
        `FemmeFlo Super Admin has been notified that payment for ${sale?.customer?.shopName || 'this order'} was sent.`
      );
    } catch (err: any) {
      Alert.alert('Remittance Error', err.message || 'Could not record payment sent.');
    } finally {
      setIsSendingRemittance(false);
    }
  }

  async function handleUpdateFeedback() {
    if (isUpdatingFeedback || !id) return;
    setIsUpdatingFeedback(true);
    try {
      const res = await sellerApi.updateSale(id, {
        customerFeedback: editFeedbackText.trim() || undefined,
      });

      setSale(res.sale);
      setFeedbackModalVisible(false);
      Alert.alert('Feedback Updated', 'Visit observation and voice feedback saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to update customer feedback.');
    } finally {
      setIsUpdatingFeedback(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!sale) return;

    if (sale.status !== 'CONFIRMED' && sale.status !== 'COMPLETED' && sale.status !== 'APPROVED') {
      Alert.alert(
        'Invoice Unavailable',
        'Tax invoices are issued exclusively for confirmed sales. Pending sales require Super Admin approval.'
      );
      return;
    }

    if (isDownloadingInvoice) return;
    setIsDownloadingInvoice(true);
    try {
      if (Platform.OS === 'web') {
        if (isMockMode()) {
          const textContent = `FEMMEFLO DISTRIBUTION - TAX INVOICE\n==============================================\nInvoice Number : ${sale.saleNumber || sale.id}\nDate           : ${new Date(sale.createdAt).toLocaleDateString()}\nStatus         : ${sale.status}\nCustomer Shop  : ${sale.customer?.shopName || 'Retail Customer'}\nOwner Name     : ${sale.customer?.ownerName || '-'}\nAddress        : ${sale.customer?.address || '-'}\nPayment Mode   : ${sale.paymentMode}\n\nITEMS:\n${(sale.items || []).map((it) => `- ${it.productName}: ${it.quantity} pkts @ ₹${(it.unitPricePaise / 100).toFixed(2)} = ₹${((it.totalPricePaise || 0) / 100).toFixed(2)}`).join('\n')}\n\nTOTAL AMOUNT   : ₹${((sale.totalAmountPaise || 0) / 100).toFixed(2)}\n==============================================\nGenerated in FemmeFlo Standalone Test Mode.`;
          const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `Invoice_${sale.saleNumber || sale.id.slice(0, 8)}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          return;
        }

        const targetInvoiceId = sale.invoice?.id || sale.id;
        const url = sellerApi.getInvoicePdfUrl(targetInvoiceId, true);
        const token = await tokenStorage.getToken();
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status} while downloading invoice PDF.`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeNum = String(sale.saleNumber || sale.id.slice(0, 8)).replace(/[^a-zA-Z0-9._-]/g, '_');
        link.href = blobUrl;
        link.download = `Invoice_${safeNum}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      if (isMockMode()) {
        const filename = `Invoice_${sale.saleNumber || sale.id.slice(0, 8)}.txt`;
        const dir = FileSystem.documentDirectory || '';
        const fileUri = `${dir}${filename}`;
        const textContent = `FEMMEFLO DISTRIBUTION - TAX INVOICE
==============================================
Invoice Number : ${sale.saleNumber || sale.id}
Date           : ${new Date(sale.createdAt).toLocaleDateString()}
Status         : ${sale.status}
Customer Shop  : ${sale.customer?.shopName || 'Retail Customer'}
Owner Name     : ${sale.customer?.ownerName || '-'}
Address        : ${sale.customer?.address || '-'}
Payment Mode   : ${sale.paymentMode}

ITEMS:
${(sale.items || []).map((it) => `- ${it.productName}: ${it.quantity} pkts @ ₹${(it.unitPricePaise / 100).toFixed(2)} = ₹${((it.totalPricePaise || 0) / 100).toFixed(2)}`).join('\n')}

TOTAL AMOUNT   : ₹${((sale.totalAmountPaise || 0) / 100).toFixed(2)}
==============================================
Generated in FemmeFlo Standalone Test Mode.`;

        await FileSystem.writeAsStringAsync(fileUri, textContent);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: `Tax Invoice ${sale.saleNumber || ''}`,
          });
        } else {
          Alert.alert('Invoice Saved', `Invoice saved to ${fileUri}`);
        }
        return;
      }

      const targetInvoiceId = sale.invoice?.id || sale.id;
      const safeNum = String(sale.saleNumber || sale.id.slice(0, 8)).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `Invoice_${safeNum}.pdf`;
      setPdfPreview({
        url: sellerApi.getInvoicePdfUrl(targetInvoiceId, false),
        filename,
        title: `Tax Invoice ${sale.saleNumber ? `#${sale.saleNumber}` : ''}`.trim(),
      });
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download invoice PDF.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  }

  const handleOpenPriceModal = () => {
    if (!sale) return;
    const qty = sale.packetCount || sale.quantity || 1;
    const currentPricePaise =
      sale.unitPricePaise ||
      (sale.items?.[0]?.unitPricePaise
        ? sale.items[0].unitPricePaise
        : qty > 0
          ? Math.round(sale.totalAmountPaise / qty)
          : 2500);
    setEditUnitPrice(((currentPricePaise || 2500) / 100).toFixed(2));
    setEditQuantity(String(qty));
    setEditPriceNotes('');
    setPriceModalVisible(true);
  };

  const handleResubmitPrice = async () => {
    if (!sale || !id || isSubmittingReapproval) return;
    const priceNum = parseFloat(editUnitPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than ₹0.00');
      return;
    }

    const newUnitPricePaise = Math.round(priceNum * 100);
    const qtyNum = parseInt(editQuantity, 10);
    const finalQty = (!isNaN(qtyNum) && qtyNum > 0) ? qtyNum : (sale.packetCount || sale.quantity || 1);
    const newTotalPaise = finalQty * newUnitPricePaise;

    setIsSubmittingReapproval(true);
    try {
      const res = await sellerApi.updateSale(id, {
        unitPricePaise: newUnitPricePaise,
        quantity: finalQty,
        customerFeedback: editPriceNotes.trim()
          ? `[Price Revised: ₹${priceNum.toFixed(2)}] ${editPriceNotes.trim()}`
          : sale.customerFeedback || undefined,
      });

      const updatedSale = normalizeSale({
        ...sale,
        ...(res.sale || {}),
        quantity: finalQty,
        packetCount: finalQty,
        unitPricePaise: newUnitPricePaise,
        totalAmountPaise: newTotalPaise,
        totalPaise: newTotalPaise,
        status: (res.sale && res.sale.status) ? res.sale.status : (newUnitPricePaise >= 2500 ? 'CONFIRMED' : 'PENDING_APPROVAL'),
        rejectionReason: null,
      });

      setSale(updatedSale);
      setPriceModalVisible(false);

      DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { saleId: sale.id, action: 'RESUBMIT' });

      const isNowConfirmed = updatedSale.status === 'CONFIRMED' || updatedSale.status === 'APPROVED';
      Alert.alert(
        isNowConfirmed ? 'Price Updated & Confirmed' : 'Price Request Updated',
        isNowConfirmed
          ? `Order #${sale.id.slice(0, 8)} unit price updated to ₹${priceNum.toFixed(2)}/pkt (Total: ₹${(newTotalPaise / 100).toFixed(2)}). Meets base price (₹25.00), sale is now CONFIRMED!`
          : `Order #${sale.id.slice(0, 8)} unit price updated to ₹${priceNum.toFixed(2)}/pkt (Total: ₹${(newTotalPaise / 100).toFixed(2)}). Updated request sent to office for approval.`
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update price and resubmit for approval.');
    } finally {
      setIsSubmittingReapproval(false);
    }
  };

  const formatRupees = (paise?: number | null) => {
    return `₹${(((paise ?? 0)) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (loading) {
    return <LoadingState message="Loading order details & tax invoice..." />;
  }

  if (!sale) {
    return (
      <View style={styles.container}>
        <Header title="Sale Order" showBack />
        <View style={styles.centerContainer}>
          <EmptyState
            icon="receipt-outline"
            title="Sale Record Not Found"
            description="The requested order could not be located in your history."
            actionTitle="Back to Sales List"
            onAction={() => router.replace('/(seller)/sales' as any)}
          />
        </View>
      </View>
    );
  }

  const isCompleted = sale.status === 'COMPLETED';
  const isConfirmed = sale.status === 'CONFIRMED' || isCompleted || sale.status === 'APPROVED';
  const isPendingApproval = sale.status === 'PENDING' || sale.status === 'PENDING_APPROVAL';
  const isRejected = sale.status === 'REJECTED';
  const isPendingPayment = sale.paymentMode === 'PENDING';
  const canSendToCompany = sale.status === 'CONFIRMED' && !isPendingPayment;

  return (
    <View style={styles.container}>
      <Header
        title={sale.invoice?.number || sale.saleNumber || `Order #${sale.id.slice(0, 8)}`}
        subtitle="Sales Order Details & Tax Invoice"
        showBack
      />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 180, 220) }]}>
        <View style={styles.contentWrapper}>
          {/* Status Card */}
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.totalAmountLabel}>Total Order Value</Text>
                <Text style={styles.totalAmountValue}>{formatRupees(sale.totalAmountPaise)}</Text>
              </View>
              <Badge label={sale.status} variant={sale.status} size="md" />
            </View>

            {isPendingApproval ? (
              <View style={styles.amberNotice} accessibilityRole="alert">
                <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.amberNoticeText}>
                    Pending Super Admin Approval. Stock is reserved and invoice will be issued once approved.
                  </Text>
                  <Button
                    title="Edit Low Price Request"
                    variant="outline"
                    size="sm"
                    onPress={handleOpenPriceModal}
                    icon={<Ionicons name="create-outline" size={14} color="#D97706" />}
                    style={{ marginTop: 8, alignSelf: 'flex-start', borderColor: '#D97706' }}
                  />
                </View>
              </View>
            ) : isRejected ? (
              <View style={styles.redNotice} accessibilityRole="alert">
                <Ionicons name="close-circle-outline" size={18} color="#B4234D" style={{ marginRight: 6 }} />
                <Text style={styles.redNoticeText}>
                  This sale was rejected by Super Admin. No stock was deducted.
                  {sale.rejectionReason ? ` Reason: ${sale.rejectionReason}` : ''}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Order Date</Text>
              <Text style={styles.metaVal}>
                {new Date(sale.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Retail Customer</Text>
              <Text style={[styles.metaVal, { fontWeight: '700' }]}>
                {sale.customer?.shopName || 'Retail Store'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge label={sale.paymentMode} variant={sale.paymentMode} />
                {sale.paymentReference ? (
                  <Text style={styles.refText}>({sale.paymentReference})</Text>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Pending Approval / Rejected Sale: Edit Price Action Card */}
          {isRejected || isPendingApproval ? (
            <Card variant="outlined" style={styles.reapprovalCard}>
              <View style={styles.reapprovalHeader}>
                <View style={styles.reapprovalIconBox}>
                  <Ionicons name="pricetag" size={20} color={BrandColors.pink.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reapprovalTitle}>
                    {isPendingApproval ? 'Edit Low Price Request' : 'Revise Price for Reapproval'}
                  </Text>
                  <Text style={styles.reapprovalDesc}>
                    {isPendingApproval
                      ? 'Update unit price, quantity, or note before office approval. Changing price to base price (₹25.00+) auto-confirms this sale.'
                      : 'Update price and send this order back to office for approval.'}
                  </Text>
                </View>
              </View>
              <Button
                title={isPendingApproval ? 'Edit Price & Update' : 'Edit Price & Resubmit'}
                variant="primary"
                size="md"
                onPress={handleOpenPriceModal}
                icon={<Ionicons name="create-outline" size={18} color="#FFFFFF" />}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>
          ) : null}

          {/* Collect Outstanding Payment Action */}
          {isPendingPayment && !isRejected ? (
            <Card variant="outlined" style={styles.paymentActionCard}>
              <View style={styles.paymentActionHeader}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.paymentActionTitle}>Payment Outstanding</Text>
                  <Text style={styles.paymentActionDesc}>
                    {isPendingApproval
                      ? 'Order is waiting for office approval. Payment can be collected once approved.'
                      : 'Customer has not paid for this order yet. Collect cash or verify UPI payment.'}
                  </Text>
                </View>
                <Button
                  title="Collect Payment"
                  variant="primary"
                  size="sm"
                  disabled={isPendingApproval}
                  onPress={() => setPaymentModalVisible(true)}
                  icon={<Ionicons name="cash-outline" size={16} color="#FFFFFF" />}
                />
              </View>
            </Card>
          ) : null}

          {/* Company Payment Remittance / Completion Status */}
          {isCompleted ? (
            <Card
              variant="outlined"
              style={{
                borderColor: '#5EEAD4',
                backgroundColor: '#F0FDFA',
                marginBottom: Spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Ionicons name="checkmark-done-circle" size={22} color="#0F766E" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F766E' }}>
                    Amount Received in FemmeFlo Account • Completed
                  </Text>
                  {sale.paymentReceivedAt ? (
                    <Text style={{ fontSize: 12.5, color: '#115E59', marginTop: 4 }}>
                      Received on {formatDateTimeIST(sale.paymentReceivedAt)}
                    </Text>
                  ) : null}
                  {sale.paymentReceivedRemark ? (
                    <Text style={{ fontSize: 12.5, color: '#134E4A', marginTop: 3, fontStyle: 'italic' }}>
                      Admin Remark: "{sale.paymentReceivedRemark}"
                    </Text>
                  ) : null}
                  {sale.paymentSentAt ? (
                    <Text style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                      Sent by you on {formatDateTimeIST(sale.paymentSentAt)}
                      {sale.paymentSentRemark ? ` ("${sale.paymentSentRemark}")` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : canSendToCompany ? (
            <Card
              variant="outlined"
              style={{
                borderColor: sale.paymentSentAt ? '#BFDBFE' : '#FBCFE8',
                backgroundColor: sale.paymentSentAt ? '#EFF6FF' : '#FFF1F2',
                marginBottom: Spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Ionicons
                  name={sale.paymentSentAt ? 'send' : 'wallet-outline'}
                  size={20}
                  color={sale.paymentSentAt ? '#1D4ED8' : BrandColors.pink.dark}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '700',
                      color: sale.paymentSentAt ? '#1E40AF' : '#9F1239',
                    }}
                  >
                    {sale.paymentSentAt
                      ? 'Sent to FemmeFlo — Awaiting Admin Confirmation'
                      : `Send Collected ${sale.paymentMode} Payment to FemmeFlo`}
                  </Text>
                  {sale.paymentSentAt ? (
                    <Text style={{ fontSize: 12.5, color: '#1E3A8A', marginTop: 4 }}>
                      Marked sent on {formatDateTimeIST(sale.paymentSentAt)}
                      {sale.paymentSentRemark ? ` — "${sale.paymentSentRemark}"` : ''}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12.5, color: '#881337', marginTop: 3, lineHeight: 18 }}>
                      Add a remark & date when you hand over or transfer this sale&apos;s amount to FemmeFlo account.
                    </Text>
                  )}
                  <Button
                    title={sale.paymentSentAt ? 'Update Sent Note & Date' : 'Mark Payment Sent to Company'}
                    variant={sale.paymentSentAt ? 'outline' : 'primary'}
                    size="sm"
                    onPress={() => setRemittanceModalVisible(true)}
                    icon={<Ionicons name="send-outline" size={15} color={sale.paymentSentAt ? BrandColors.pink.primary : '#FFFFFF'} />}
                    style={{ marginTop: Spacing.sm, alignSelf: 'flex-start' }}
                  />
                </View>
              </View>
            </Card>
          ) : null}

          {/* Order Line Items */}
          <Text style={styles.sectionHeading}>Items Ordered</Text>
          <Card style={styles.card}>
            {(sale.items && sale.items.length > 0 ? sale.items : [
              {
                id: '1',
                productId: 'p1',
                productName: 'FemmeFlo Sanitary Napkins (Standard)',
                quantity: sale.packetCount,
                unitPricePaise: Math.round(sale.totalAmountPaise / (sale.packetCount || 1)),
                totalPricePaise: sale.totalAmountPaise,
              },
            ]).map((item: any, idx: number) => (
              <View key={item.id || idx} style={styles.itemRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.itemName}>
                    {item.productName || 'Feminine Hygiene Sanitary Packets'}
                  </Text>
                  <Text style={styles.itemQtyPrice}>
                    {item.quantity} pkts × {formatRupees(item.unitPricePaise)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatRupees(item.totalPricePaise || item.quantity * item.unitPricePaise)}
                </Text>
              </View>
            ))}
          </Card>

          {/* Customer Feedback & Spoken Observations */}
          <View style={styles.feedbackSectionHeader}>
            <Text style={styles.sectionHeading}>Customer Visit Feedback</Text>
            <Button
              title={sale.customerFeedback ? 'Edit Feedback' : 'Add Voice Feedback'}
              variant="ghost"
              size="sm"
              icon={<Ionicons name="mic-outline" size={15} color={BrandColors.pink.primary} />}
              onPress={() => {
                setEditFeedbackText(sale.customerFeedback || '');
                setFeedbackModalVisible(true);
              }}
            />
          </View>
          <Card style={styles.card}>
            {sale.customerFeedback ? (
              <View style={styles.feedbackContentBox}>
                <Ionicons name="chatbubbles-outline" size={20} color={BrandColors.pink.primary} style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedbackText}>"{sale.customerFeedback}"</Text>
                  <Text style={styles.feedbackTag}>Translated Hindi/Hinglish Observation</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyFeedbackBox}>
                <Text style={styles.emptyFeedbackText}>
                  No feedback recorded yet. Tap "Add Voice Feedback" to speak retailer feedback in Hindi or Hinglish.
                </Text>
              </View>
            )}
          </Card>

          {/* Tax Invoice In-App Preview & Share */}
          <Button
            title={isDownloadingInvoice ? 'Opening Tax Invoice...' : 'View & Share Tax Invoice (PDF)'}
            variant="outline"
            size="lg"
            onPress={handleDownloadInvoice}
            disabled={!isConfirmed || isDownloadingInvoice}
            loading={isDownloadingInvoice}
            icon={<Ionicons name="document-text-outline" size={20} color={BrandColors.pink.primary} />}
            style={{ marginBottom: Spacing.md }}
          />

          {!isConfirmed ? (
            <Text style={styles.invoiceNotice}>
              * Final tax invoice is generated once the sale is confirmed by Super Admin.
            </Text>
          ) : null}
        </View>
      </ScrollView>

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
          <Pressable style={styles.backdropDismiss} onPress={() => setPaymentModalVisible(false)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Collect Outstanding Payment</Text>
              <Pressable
                onPress={() => setPaymentModalVisible(false)}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Total Amount: {formatRupees(sale.totalAmountPaise)}
            </Text>

            <SegmentedTabs
              tabs={[
                { label: 'Cash Payment', value: 'CASH', icon: 'cash-outline' },
                { label: 'Bank / UPI', value: 'BANK', icon: 'card-outline' },
              ]}
              selectedTab={collectMode}
              onSelect={(val) => val && setCollectMode(val as 'CASH' | 'BANK')}
              activeColor={BrandColors.pink.primary}
              accessibilityLabel="Select payment collection mode"
              style={{ marginBottom: Spacing.md }}
            />

            {collectMode === 'BANK' ? (
              <Input
                label="Bank Reference / UPI Transaction ID"
                value={paymentRef}
                onChangeText={setPaymentRef}
                containerStyle={{ marginTop: Spacing.sm }}
                leftIcon={<Ionicons name="barcode-outline" size={18} color="#94A3B8" />}
              />
            ) : null}

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setPaymentModalVisible(false)}
                disabled={isCollecting}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={isCollecting ? 'Recording...' : 'Mark as Paid'}
                variant="primary"
                onPress={handleCollectPayment}
                loading={isCollecting}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Voice Feedback Edit Modal */}
      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setFeedbackModalVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Retailer Voice Feedback</Text>
                <Pressable
                  onPress={() => setFeedbackModalVisible(false)}
                  hitSlop={HitSlop.md}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color="#64748B" />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Speak naturally in Hindi or Hinglish. Observations are translated to professional English and attached to this order.
              </Text>

              <VoiceFeedbackTranslator
                value={editFeedbackText}
                onChange={setEditFeedbackText}
                label="Observation Notes"
                sublabel="Tap mic to speak — review and accept before saving"
                />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="md"
                  onPress={() => setFeedbackModalVisible(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={isUpdatingFeedback ? 'Saving...' : 'Save Feedback'}
                  variant="primary"
                  size="md"
                  onPress={handleUpdateFeedback}
                  loading={isUpdatingFeedback}
                  disabled={isUpdatingFeedback}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Price for Reapproval Modal */}
      <Modal
        visible={priceModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setPriceModalVisible(false)} />
          <View style={[styles.modalContent, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {isPendingApproval ? 'Edit Low Price Request' : 'Edit Price for Reapproval'}
                </Text>
                <Pressable
                  onPress={() => setPriceModalVisible(false)}
                  hitSlop={HitSlop.md}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color="#64748B" />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                {isPendingApproval
                  ? 'Update unit price or quantity before Super Admin approval'
                  : 'Change price and send back to office for approval'}
              </Text>

              {/* Previous Rejection Alert Box */}
              {sale.rejectionReason ? (
                <View style={styles.rejectionContextBox}>
                  <Ionicons name="alert-circle" size={18} color="#B4234D" style={{ marginRight: 8, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rejectionContextTitle}>Rejection Reason</Text>
                    <Text style={styles.rejectionContextText}>{sale.rejectionReason}</Text>
                  </View>
                </View>
              ) : null}

              {/* Pricing Context Cards */}
              <View style={styles.priceSummaryBox}>
                <View style={styles.priceSummaryItem}>
                  <Text style={styles.priceSummaryLabel}>Order Qty</Text>
                  <Text style={styles.priceSummaryValue}>{sale.packetCount || sale.quantity || 1} pkts</Text>
                </View>
                <View style={styles.priceSummaryDivider} />
                <View style={styles.priceSummaryItem}>
                  <Text style={styles.priceSummaryLabel}>Current Price</Text>
                  <Text style={styles.priceSummaryValue}>
                    ₹{(((sale.unitPricePaise || Math.round(sale.totalAmountPaise / (sale.packetCount || 1))) || 0) / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.priceSummaryDivider} />
                <View style={styles.priceSummaryItem}>
                  <Text style={styles.priceSummaryLabel}>Base Floor</Text>
                  <Text style={[styles.priceSummaryValue, { color: BrandColors.pink.primary }]}>₹25.00</Text>
                </View>
              </View>

              {/* Revised Unit Price Input */}
              <Input
                label="Unit Price (₹ per packet)"
                placeholder="e.g. 25.00"
                value={editUnitPrice}
                onChangeText={setEditUnitPrice}
                keyboardType="decimal-pad"
                leftIcon={<Text style={{ fontSize: 16, fontWeight: '700', color: BrandColors.pink.primary }}>₹</Text>}
                containerStyle={{ marginTop: Spacing.sm }}
              />

              {/* Order Quantity Input */}
              <Input
                label="Order Quantity (Packets)"
                placeholder="e.g. 100"
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="number-pad"
                containerStyle={{ marginTop: Spacing.xs }}
                leftIcon={<Ionicons name="cube-outline" size={18} color="#94A3B8" />}
              />

              {/* Live Calculation Preview */}
              {(() => {
                const p = parseFloat(editUnitPrice);
                const q = parseInt(editQuantity, 10);
                const validP = !isNaN(p) && p > 0;
                const validQ = !isNaN(q) && q > 0 ? q : (sale.packetCount || sale.quantity || 1);
                const total = validP ? p * validQ : 0;
                const isAutoConfirm = validP && p >= 25;
                return (
                  <View style={styles.calculationPreview}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.calcLabel}>Revised Total Value ({validQ} pkts):</Text>
                      <Text style={styles.calcValue}>₹{total.toFixed(2)}</Text>
                    </View>
                    {isAutoConfirm ? (
                      <Text style={{ fontSize: 12, color: BrandColors.green.primary, fontWeight: '600', marginTop: 4 }}>
                        ✓ Meets base price (₹25.00). Will be automatically confirmed immediately!
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '500', marginTop: 4 }}>
                        ⚠ Price below base price (₹25.00). Will update approval request to Super Admin.
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* Reapproval Notes / Justification */}
              <Input
                label="Note for Office (Optional)"
                placeholder="e.g. Customer agreed to rate change"
                value={editPriceNotes}
                onChangeText={setEditPriceNotes}
                containerStyle={{ marginTop: Spacing.xs }}
                leftIcon={<Ionicons name="document-text-outline" size={18} color="#94A3B8" />}
              />

              <View style={styles.modalButtonsRow}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setPriceModalVisible(false)}
                  disabled={isSubmittingReapproval}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={isSubmittingReapproval ? 'Saving...' : isPendingApproval ? 'Update Request' : 'Send for Approval'}
                  variant="primary"
                  onPress={handleResubmitPrice}
                  loading={isSubmittingReapproval}
                  disabled={!editUnitPrice || isNaN(parseFloat(editUnitPrice)) || parseFloat(editUnitPrice) <= 0 || isSubmittingReapproval}
                  style={{ flex: 1.6 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <RemittanceActionModal
        visible={remittanceModalVisible}
        mode="SELLER_SEND"
        title="Send Payment to FemmeFlo"
        subtitle={`Order for ${sale.customer?.shopName || 'Retail Store'} (${sale.paymentMode})`}
        totalAmountPaise={sale.totalAmountPaise || 0}
        packetCount={sale.packetCount || sale.quantity || 0}
        paymentModeLabel={sale.paymentMode}
        initialRemark={sale.paymentSentRemark || ''}
        loading={isSendingRemittance}
        onClose={() => setRemittanceModalVisible(false)}
        onSubmit={handleMarkPaymentSent}
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
    backgroundColor: '#FAF8F5',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
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
    color: '#64748B',
    marginTop: Spacing.lg,
  },
  statusCard: {
    marginBottom: Spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  totalAmountLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  totalAmountValue: {
    ...Typography.display,
    fontSize: 26,
    color: BrandColors.pink.primary,
  },
  amberNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.warningBg,
    borderWidth: 1,
    borderColor: Colors.light.warningBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  amberNoticeText: {
    ...Typography.caption,
    color: Colors.light.warning,
    fontWeight: '500',
    flex: 1,
  },
  redNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.dangerBg,
    borderWidth: 1,
    borderColor: Colors.light.dangerBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  redNoticeText: {
    ...Typography.caption,
    color: Colors.light.danger,
    fontWeight: '500',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.borderSubtle,
    marginVertical: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  metaLabel: {
    ...Typography.bodySmall,
    color: Colors.light.textSecondary,
    marginRight: Spacing.sm,
  },
  metaVal: {
    ...Typography.bodySmall,
    color: Colors.light.heading,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
  refText: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  paymentActionCard: {
    backgroundColor: BrandColors.pink.subtle,
    borderColor: BrandColors.pink.tint,
    marginBottom: Spacing.md,
  },
  paymentActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentActionTitle: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
  },
  paymentActionDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.overline,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  itemName: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
  },
  itemQtyPrice: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  itemTotal: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.heading,
  },
  invoiceNotice: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.light.heading,
  },
  modalSubtitle: {
    ...Typography.bodyMedium,
    color: BrandColors.pink.primary,
    marginBottom: Spacing.lg,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  feedbackSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  feedbackContentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  feedbackText: {
    ...Typography.bodyMedium,
    color: '#0F172A',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  feedbackTag: {
    ...Typography.caption,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  emptyFeedbackBox: {
    paddingVertical: 6,
  },
  emptyFeedbackText: {
    ...Typography.bodySmall,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  reapprovalCard: {
    backgroundColor: '#FFF5F8',
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reapprovalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reapprovalIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  reapprovalTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#9F1239',
  },
  reapprovalDesc: {
    ...Typography.bodySmall,
    color: '#881337',
    marginTop: 2,
    lineHeight: 18,
  },
  reapprovalHintText: {
    ...Typography.bodySmall,
    color: '#9F1239',
    marginTop: 4,
    fontWeight: '600',
  },
  rejectionContextBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  rejectionContextTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#9F1239',
    textTransform: 'uppercase',
  },
  rejectionContextText: {
    ...Typography.bodySmall,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 18,
  },
  priceSummaryBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  priceSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  priceSummaryLabel: {
    ...Typography.caption,
    color: '#64748B',
  },
  priceSummaryValue: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  priceSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  calculationPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  calcLabel: {
    ...Typography.bodySmall,
    color: '#166534',
    fontWeight: '600',
  },
  calcValue: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#15803D',
  },
});
