import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { SaleItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { VoiceFeedbackTranslator } from '@/components/common/VoiceFeedbackTranslator';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { BrandColors, Colors, HitSlop, MaxContentWidth, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sale, setSale] = useState<SaleItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment Collection State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [collectMode, setCollectMode] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  // Invoice Download State
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // Customer Feedback Voice Modal State
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [editFeedbackText, setEditFeedbackText] = useState('');
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false);

  const loadSale = useCallback(async () => {
    if (!id) return;
    try {
      const res = await sellerApi.getSale(id);
      setSale(res.sale);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load sale details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  async function handleCollectPayment() {
    if (isCollecting) return;
    setIsCollecting(true);
    try {
      const res = await sellerApi.collectPayment(id!, {
        paymentMode: collectMode,
        paymentReference: paymentRef.trim() || undefined,
      });

      setSale(res.sale);
      setPaymentModalVisible(false);
      Alert.alert('Payment Recorded', `Payment of ${formatRupees(res.sale.totalAmountPaise)} confirmed via ${collectMode}.`);
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Unable to update payment status.');
    } finally {
      setIsCollecting(false);
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

    if (sale.status !== 'CONFIRMED' && sale.status !== 'APPROVED') {
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

        const url = sellerApi.getInvoicePdfUrl(sale.id, true);
        const token = await tokenStorage.getToken();
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error('Server returned an error while downloading invoice PDF.');
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Invoice_${sale.saleNumber || sale.id.slice(0, 8)}.pdf`;
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

      const url = sellerApi.getInvoicePdfUrl(sale.id, true);
      const filename = `Invoice_${sale.saleNumber || sale.id.slice(0, 8)}.pdf`;
      const dir = FileSystem.documentDirectory || '';
      const fileUri = `${dir}${filename}`;
      const token = await tokenStorage.getToken();

      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Tax Invoice ${sale.saleNumber || ''}`,
          });
        } else {
          Alert.alert('Invoice Downloaded', `Saved to ${downloadResult.uri}`);
        }
      } else {
        throw new Error('Server returned non-200 while downloading invoice PDF.');
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download invoice PDF.');
    } finally {
      setIsDownloadingInvoice(false);
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

  const isConfirmed = sale.status === 'CONFIRMED' || sale.status === 'APPROVED';
  const isPendingApproval = sale.status === 'PENDING';
  const isRejected = sale.status === 'REJECTED';
  const isPendingPayment = sale.paymentMode === 'PENDING';

  return (
    <View style={styles.container}>
      <Header
        title={sale.saleNumber || `Order #${sale.id.slice(0, 8)}`}
        subtitle="Sales Order Details & Tax Invoice"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <Text style={styles.amberNoticeText}>
                  Pending Super Admin Approval. Stock is reserved and invoice will be issued once approved.
                </Text>
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

          {/* Collect Outstanding Payment Action */}
          {isPendingPayment && !isRejected ? (
            <Card variant="outlined" style={styles.paymentActionCard}>
              <View style={styles.paymentActionHeader}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.paymentActionTitle}>Payment Outstanding</Text>
                  <Text style={styles.paymentActionDesc}>
                    Customer has not paid for this order yet.
                  </Text>
                </View>
                <Button
                  title="Collect Payment"
                  variant="primary"
                  size="sm"
                  onPress={() => setPaymentModalVisible(true)}
                  icon={<Ionicons name="cash-outline" size={16} color="#FFFFFF" />}
                />
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

          {/* Tax Invoice Download & Share */}
          <Button
            title={isDownloadingInvoice ? 'Downloading Tax Invoice...' : 'Download & Share Tax Invoice (PDF)'}
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
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
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
                placeholder="e.g. UPI/1234567890"
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
        </View>
      </Modal>

      {/* Voice Feedback Edit Modal */}
      <Modal visible={feedbackModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
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
                placeholder="e.g. Dukaan par stock khatam tha, agle hafte 20 packets ka order chahiye..."
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
        </View>
      </Modal>
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
});
