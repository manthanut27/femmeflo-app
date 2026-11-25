import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SaleItem } from '@/api/types';
import { isSaleResubmitted } from '@/api/admin';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { BorderRadius, BrandColors, Colors, Spacing, Typography } from '@/constants/theme';

interface SalesOrderCardProps {
  item: SaleItem;
  formattedDate: string;
  onViewDetails: (sale: SaleItem) => void;
  onOpenInvoice: (sale: SaleItem) => void;
  isCompactWidth?: boolean;
}

export function SalesOrderCard({
  item,
  formattedDate,
  onViewDetails,
  onOpenInvoice,
  isCompactWidth = false,
}: SalesOrderCardProps) {
  const [copied, setCopied] = useState(false);

  const totalPaise = Number(item.totalAmountPaise || item.totalPaise || 0);
  const totalRupees = (totalPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const packetCount = item.packetCount || item.quantity || 0;
  const customerName = item.customer?.shopName || 'Retail Customer';
  const sellerName = item.seller?.name || 'Field Officer';
  const isResubmitted = isSaleResubmitted(item);
  const displayOrderId = item.saleNumber || `#${item.id.slice(0, 8).toUpperCase()}`;
  const canDownloadInvoice = item.status === 'CONFIRMED' || item.status === 'APPROVED';

  const handleCopyId = async () => {
    const valueToCopy = item.saleNumber || item.id;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(valueToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <Card style={styles.card}>
      {/* Header: Shop Name + Status & Payment Badges */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {customerName}
          </Text>
          <Pressable
            onPress={handleCopyId}
            style={styles.orderIdRow}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Copy order ID ${valueOrFallback(item.saleNumber, item.id)}`}
          >
            <Text style={styles.orderIdText} numberOfLines={1}>
              {displayOrderId}
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={13}
              color={copied ? BrandColors.green.primary : Colors.light.textTertiary}
            />
            {copied ? <Text style={styles.copiedText}>Copied</Text> : null}
          </Pressable>
        </View>

        <View style={styles.badgesCol}>
          {isResubmitted ? (
            <Badge label="RESUBMITTED" variant="purple" size="sm" />
          ) : (
            <Badge
              label={item.status === 'PENDING_APPROVAL' ? 'PENDING' : item.status}
              variant={item.status as BadgeVariant}
              size="sm"
            />
          )}
          <Badge label={item.paymentMode} variant={item.paymentMode as BadgeVariant} size="sm" />
        </View>
      </View>

      {/* Order Meta: Seller & Date */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {sellerName}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={Colors.light.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formattedDate}
          </Text>
        </View>
      </View>

      {/* Order Summary: Packets & Order Total */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Packets</Text>
          <Text style={styles.summaryValue}>{packetCount.toLocaleString('en-IN')} pkts</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={[styles.summaryCol, { alignItems: 'flex-end' }]}>
          <Text style={styles.summaryLabel}>Order Total</Text>
          <Text style={styles.summaryTotal}>₹{totalRupees}</Text>
        </View>
      </View>

      {/* Customer Remarks (only when present) */}
      {item.customerFeedback ? (
        <View style={styles.remarksBox}>
          <Ionicons name="chatbox-outline" size={13} color="#64748B" style={{ marginTop: 2 }} />
          <Text style={styles.remarksText} numberOfLines={2}>
            "{item.customerFeedback}"
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={[styles.actionsRow, isCompactWidth && styles.actionsRowStacked]}>
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => onViewDetails(item)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`View order details for ${customerName}`}
        >
          <Ionicons name="receipt-outline" size={16} color="#0F172A" />
          <Text style={styles.detailsBtnText}>Order Details</Text>
        </TouchableOpacity>

        {canDownloadInvoice ? (
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => onOpenInvoice(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Open invoice PDF for ${customerName}`}
          >
            <Ionicons name="document-text-outline" size={16} color={BrandColors.pink.dark} />
            <Text style={styles.pdfBtnText}>Invoice PDF</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

function valueOrFallback(a?: string | null, b?: string) {
  return a || b || '';
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopName: {
    ...Typography.subtitle,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.green.primary,
  },
  badgesCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryCol: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: BrandColors.pink.dark,
    marginTop: 2,
  },
  remarksBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  remarksText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  actionsRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  detailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  pdfBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
});
