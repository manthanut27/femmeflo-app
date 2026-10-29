import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { adminApi, PendingApprovalItem } from '@/api/admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
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

export default function AdminApprovalsScreen() {
  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await adminApi.listApprovals({ pageSize: 50 });
      setApprovals(res.items);
    } catch (err) {
      console.warn('Failed to load approvals', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadApprovals();
  }, [loadApprovals]);

  function handleApprove(sale: PendingApprovalItem) {
    Alert.alert(
      'Approve Below-Minimum Sale?',
      `Order #${sale.id.slice(0, 8)} for ${sale.customer?.shopName || 'Retail Customer'} will be confirmed. Stock will be deducted and final invoice generated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Approval',
          onPress: async () => {
            setActionId(sale.id);
            try {
              await adminApi.approveSale(sale.id);
              Alert.alert('Sale Approved', 'The sale has been confirmed.');
              loadApprovals();
            } catch (err: any) {
              Alert.alert('Approval Error', err.message || 'Unable to approve sale.');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  }

  function handleReject(sale: PendingApprovalItem) {
    Alert.alert(
      'Reject Special Price Request?',
      `Order #${sale.id.slice(0, 8)} will be marked REJECTED. No stock will be deducted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Sale',
          style: 'destructive',
          onPress: async () => {
            setActionId(sale.id);
            try {
              await adminApi.rejectSale(sale.id, 'Price below threshold rejected by Super Admin');
              Alert.alert('Sale Rejected', 'The order has been rejected without stock deduction.');
              loadApprovals();
            } catch (err: any) {
              Alert.alert('Rejection Error', err.message || 'Unable to reject sale.');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  }

  const formatRupees = (paise: number) => {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderItem = ({ item }: { item: PendingApprovalItem }) => {
    const isProcessing = actionId === item.id;
    const effectivePricePerPktPaise =
      item.packetCount > 0 ? Math.round(item.totalAmountPaise / item.packetCount) : 0;

    return (
      <Card
        style={styles.card}
        accessibilityRole="summary"
        accessibilityLabel={`Pending approval for ${item.customer?.shopName || 'Retail Customer'}, ${formatRupees(item.totalAmountPaise)} for ${item.packetCount} packets`}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.customerName}>{item.customer?.shopName || 'Retail Customer'}</Text>
            <View style={styles.officerRow}>
              <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.sellerName}>Field Officer: {item.seller?.name || 'Seller'}</Text>
            </View>
          </View>
          <Badge label="APPROVAL REQUIRED" variant="warning" />
        </View>

        {/* Price Threshold Comparison Banner */}
        <View style={styles.thresholdNotice}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.light.warning} />
          <Text style={styles.thresholdText}>
            Priced at {formatRupees(effectivePricePerPktPaise)}/pkt (Below ₹25.00 min threshold)
          </Text>
        </View>

        <View style={styles.priceBreakdown}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Total Order</Text>
            <Text style={styles.orderVal}>{formatRupees(item.totalAmountPaise)}</Text>
          </View>

          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Quantity</Text>
            <Text style={styles.orderVal}>{item.packetCount} pkts</Text>
          </View>

          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Payment Mode</Text>
            <View style={{ marginTop: 2 }}>
              <Badge label={item.paymentMode} variant={item.paymentMode as any} size="sm" showDot={false} />
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Reject"
            variant="outline"
            size="sm"
            onPress={() => handleReject(item)}
            disabled={isProcessing}
            icon={<Ionicons name="close-circle-outline" size={16} color={BrandColors.pink.primary} />}
            style={styles.rejectBtn}
          />
          <Button
            title={isProcessing ? 'Authorizing...' : 'Approve Sale'}
            variant="secondary"
            size="sm"
            onPress={() => handleApprove(item)}
            loading={isProcessing}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />}
            style={styles.approveBtn}
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Price Approvals"
        subtitle={`${approvals.length} requests awaiting authorization`}
        showBack
      />

      <View style={styles.innerContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : approvals.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="All Requests Reviewed"
            description="There are currently no below-minimum price sales awaiting approval."
          />
        ) : (
          <FlatList
            data={approvals}
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  customerName: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  officerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sellerName: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
  },
  thresholdNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.warningBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginVertical: Spacing.xs,
  },
  thresholdText: {
    ...Typography.caption,
    color: Colors.light.warningText,
    fontWeight: '600',
  },
  priceBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderVal: {
    ...Typography.bodyMedium,
    color: Colors.light.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  rejectBtn: {
    minWidth: 100,
  },
  approveBtn: {
    minWidth: 130,
  },
});
