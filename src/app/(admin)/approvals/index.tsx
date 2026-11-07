import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  DeviceEventEmitter,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi, PendingApprovalItem } from '@/api/admin';
import { Badge } from '@/components/ui/Badge';
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
import { useAuth } from '@/context/AuthContext';

export default function AdminApprovalsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const handleBack = useCallback(() => {
    if (params?.from === 'actions') {
      try {
        (navigation as any).navigate('actions/index');
        return;
      } catch {
        // fallback
      }
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      try {
        (navigation as any).navigate('actions/index');
      } catch {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [params, navigation, router]);

  useEffect(() => {
    if (params?.from === 'actions') {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [params?.from, handleBack]);

  const { isOffline } = useAuth();
  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [minPricePaise, setMinPricePaise] = useState<number>(2500);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'RESUBMITTED' | 'FIRST_TIME'>('ALL');

  const loadApprovals = useCallback(async () => {
    try {
      const [res, settings] = await Promise.all([
        adminApi.listApprovals({ pageSize: 50 }),
        adminApi.getBusinessSettings().catch(() => null),
      ]);
      setApprovals(res.items);
      if (settings?.minimumSalePricePaise) {
        setMinPricePaise(settings.minimumSalePricePaise);
      }
    } catch (err) {
      console.warn('Failed to load approvals', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApprovals();
    }, [loadApprovals])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED', () => {
      loadApprovals();
    });
    return () => {
      sub.remove();
    };
  }, [loadApprovals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadApprovals();
  }, [loadApprovals]);

  function handleApprove(sale: PendingApprovalItem) {
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Price approvals require an active backend server connection. Please reconnect to the internet to authorize below-minimum orders.'
      );
      return;
    }
    Alert.alert(
      'Approve Below-Minimum Sale?',
      `Order #${sale.id.slice(0, 8)} for ${sale.customer?.shopName || 'Retail Customer'} will be confirmed. Stock will be deducted and final invoice generated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Approval',
          onPress: async () => {
            if (actionId) return;
            setActionId(sale.id);
            try {
              await adminApi.approveSale(sale.id);
              // Notify executive overview and actions hub to refresh counters immediately
              DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { saleId: sale.id, action: 'APPROVE' });
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
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Rejecting special price orders requires an active backend server connection. Please reconnect to the internet to perform this action.'
      );
      return;
    }
    Alert.alert(
      'Reject Special Price Request?',
      `Order #${sale.id.slice(0, 8)} will be marked REJECTED. No stock will be deducted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Sale',
          style: 'destructive',
          onPress: async () => {
            if (actionId) return;
            setActionId(sale.id);
            try {
              await adminApi.rejectSale(sale.id, 'Price below threshold rejected by Super Admin');
              // Notify executive overview and actions hub to refresh counters immediately
              DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', { saleId: sale.id, action: 'REJECT' });
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
    const totalPaise = Number(item.totalPaise ?? item.totalAmountPaise ?? 0);
    const quantity = Number(item.quantity ?? item.packetCount ?? 0);
    const unitPricePaise = Number(
      item.unitPricePaise ??
        (quantity > 0 ? Math.round(totalPaise / quantity) : 0)
    );
    const minThresholdPaise = item.minimumPricePaise ?? minPricePaise ?? 2500;
    const orderNumber =
      item.saleNumber ||
      (item.id && typeof item.id === 'string'
        ? `#${item.id.slice(0, 8).toUpperCase()}`
        : 'ORDER');

    const lineItems =
      Array.isArray(item.lineItems) && item.lineItems.length > 0
        ? item.lineItems
        : Array.isArray(item.items) && item.items.length > 0
        ? item.items
        : null;

    return (
      <Card
        style={styles.card}
        accessibilityRole="summary"
        accessibilityLabel={`Pending approval for ${item.customer?.shopName || 'Retail Customer'}, order ${orderNumber}, ${formatRupees(totalPaise)} for ${quantity} packets`}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <View style={styles.orderNumberRow}>
              <Ionicons name="receipt-outline" size={13} color={BrandColors.pink.dark} />
              <Text style={styles.orderNumberText}>{orderNumber}</Text>
            </View>
            <Text style={styles.customerName}>{item.customer?.shopName || 'Retail Customer'}</Text>
            {item.customer?.contactName || item.customer?.phone ? (
              <Text style={styles.customerContact}>
                {[item.customer?.contactName, item.customer?.phone].filter(Boolean).join(' • ')}
              </Text>
            ) : null}
            <View style={styles.officerRow}>
              <Ionicons name="person-outline" size={13} color={Colors.light.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.sellerName}>Field Officer: {item.seller?.name || 'Seller'}</Text>
            </View>
          </View>
          {item.isResubmitted ? (
            <Badge label="RESUBMITTED FOR APPROVAL" variant="purple" />
          ) : (
            <Badge label="APPROVAL REQUIRED" variant="warning" />
          )}
        </View>

        {/* Resubmission Banner if Revised */}
        {item.isResubmitted ? (
          <View style={styles.resubmittedNotice}>
            <Ionicons name="refresh-circle" size={16} color="#7C3AED" />
            <Text style={styles.resubmittedNoticeText}>
              Price revised after rejection • Resubmitted for Super Admin re-approval
            </Text>
          </View>
        ) : null}

        {/* Price Threshold Comparison Banner */}
        <View style={styles.thresholdNotice}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.light.warning} />
          <Text style={styles.thresholdText}>
            Priced at {formatRupees(unitPricePaise)}/pkt (Below {formatRupees(minThresholdPaise)} min threshold)
          </Text>
        </View>

        {/* Products in this Order */}
        <View style={styles.productsSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="cube-outline" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.sectionTitle}>PRODUCTS IN ORDER</Text>
          </View>

          {lineItems && lineItems.length > 0 ? (
            lineItems.map((line, idx) => {
              const pName = line.product?.name || line.productName || 'FemmeFlo Sanitary Napkins';
              const pSku = line.product?.sku || (line.productId ? line.productId.slice(0, 8).toUpperCase() : null);
              const pQty = Number(line.quantity || 0);
              const pPrice = Number(line.unitPricePaise || unitPricePaise || 0);
              const pTotal = Number(line.totalPaise || line.totalPricePaise || pQty * pPrice);

              return (
                <View key={line.id || `line_${idx}`} style={styles.productRow}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={styles.productName}>{pName}</Text>
                    <View style={styles.skuRow}>
                      {pSku ? (
                        <View style={styles.skuBadge}>
                          <Text style={styles.skuText}>{pSku}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.productQtyPrice}>
                        {pQty} pkts × {formatRupees(pPrice)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productTotalText}>{formatRupees(pTotal)}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.productRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.productName}>FemmeFlo Sanitary Napkins</Text>
                <Text style={styles.productQtyPrice}>
                  {quantity} pkts × {formatRupees(unitPricePaise)}
                </Text>
              </View>
              <Text style={styles.productTotalText}>{formatRupees(totalPaise)}</Text>
            </View>
          )}
        </View>

        {/* Customer Feedback / Remarks Note */}
        {item.customerFeedback ? (
          <View style={styles.feedbackBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={BrandColors.pink.dark} />
            <Text style={styles.feedbackText}>"{item.customerFeedback}"</Text>
          </View>
        ) : null}

        {/* Order Summary KPIs Row */}
        <View style={styles.priceBreakdown}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Total Value</Text>
            <Text style={[styles.orderVal, { color: BrandColors.pink.dark }]}>{formatRupees(totalPaise)}</Text>
          </View>

          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Quantity</Text>
            <Text style={styles.orderVal}>{quantity} pkts</Text>
          </View>

          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Payment Mode</Text>
            <View style={{ marginTop: 2 }}>
              <Badge label={item.paymentMode || 'PENDING'} variant={(item.paymentMode as any) || 'PENDING'} size="sm" showDot={false} />
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Reject"
            variant="danger"
            size="sm"
            onPress={() => handleReject(item)}
            disabled={isProcessing}
            icon={<Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />}
            style={styles.rejectBtn}
          />
          <Button
            title={isProcessing ? 'Authorizing...' : 'Approve Sale'}
            variant="admin"
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

  const totalFlaggedPaise = approvals.reduce((sum, a) => sum + Number(a.totalPaise ?? a.totalAmountPaise ?? 0), 0);
  const totalFlaggedPackets = approvals.reduce((sum, a) => sum + Number(a.quantity ?? a.packetCount ?? 0), 0);
  const resubmittedCount = approvals.filter((a) => a.isResubmitted).length;
  const firstTimeCount = approvals.filter((a) => !a.isResubmitted).length;

  const filteredApprovals = useMemo(() => {
    let list = [...approvals];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((item) => {
        const orderNum = (item.saleNumber || item.id || '').toLowerCase();
        const cust = (item.customer?.shopName || '').toLowerCase();
        const seller = (item.seller?.name || '').toLowerCase();
        return orderNum.includes(q) || cust.includes(q) || seller.includes(q);
      });
    }
    if (activeTab === 'RESUBMITTED') {
      list = list.filter((i) => i.isResubmitted);
    } else if (activeTab === 'FIRST_TIME') {
      list = list.filter((i) => !i.isResubmitted);
    }
    return list;
  }, [approvals, search, activeTab]);

  return (
    <View style={styles.container}>
      <Header
        title="Price Approvals"
        subtitle={`${approvals.length} requests awaiting authorization`}
        showBack
        onBack={handleBack}
      />

      <View style={styles.innerContainer}>
        {approvals.length > 0 ? (
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Pending</Text>
              <Text style={styles.kpiValue}>{approvals.length} Orders</Text>
              <Text style={styles.kpiSubValue}>({totalFlaggedPackets} pkts)</Text>
            </View>
            {resubmittedCount > 0 ? (
              <View style={[styles.kpiCard, { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}>
                <Text style={[styles.kpiLabel, { color: '#6D28D9' }]}>Resubmitted</Text>
                <Text style={[styles.kpiValue, { color: '#6D28D9' }]}>{resubmittedCount} Orders</Text>
                <Text style={[styles.kpiSubValue, { color: '#7C3AED' }]}>For Re-Approval</Text>
              </View>
            ) : null}
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Value</Text>
              <Text style={styles.kpiValue}>{formatRupees(totalFlaggedPaise)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Policy Floor</Text>
              <Text style={[styles.kpiValue, { color: Colors.light.warning }]}>
                ₹{(minPricePaise / 100).toFixed(2)}/pkt
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tab Filters for All, Resubmitted, and First-Time */}
        {approvals.length > 0 ? (
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'ALL' && styles.tabBtnActive]}
              onPress={() => setActiveTab('ALL')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'ALL' && styles.tabBtnTextActive]}>
                All ({approvals.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'RESUBMITTED' && styles.tabBtnActivePurple]}
              onPress={() => setActiveTab('RESUBMITTED')}
            >
              <Ionicons
                name="refresh-circle"
                size={14}
                color={activeTab === 'RESUBMITTED' ? '#FFFFFF' : '#7C3AED'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.tabBtnText, activeTab === 'RESUBMITTED' && styles.tabBtnTextActiveWhite]}>
                Resubmitted for Approval ({resubmittedCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'FIRST_TIME' && styles.tabBtnActive]}
              onPress={() => setActiveTab('FIRST_TIME')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'FIRST_TIME' && styles.tabBtnTextActive]}>
                First-Time ({firstTimeCount})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Quick Search Bar */}
        {approvals.length > 0 ? (
          <View style={styles.searchContainer}>
            <Input
              placeholder="Search order ID, shop, or field officer..."
              value={search}
              onChangeText={setSearch}
              leftIcon={<Ionicons name="search" size={16} color={Colors.light.textMuted} />}
            />
          </View>
        ) : null}

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
            iconColor={BrandColors.pink.dark}
            iconBgColor={BrandColors.pink.subtle}
            iconBorderColor={BrandColors.pink.tint}
          />
        ) : filteredApprovals.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={activeTab === 'RESUBMITTED' ? 'No Resubmitted Requests' : 'No Matching Requests'}
            description={
              activeTab === 'RESUBMITTED'
                ? 'There are currently no rejected sales resubmitted for approval.'
                : 'No orders match your search criteria.'
            }
            iconColor={activeTab === 'RESUBMITTED' ? '#7C3AED' : BrandColors.pink.dark}
            iconBgColor={activeTab === 'RESUBMITTED' ? '#F5F3FF' : BrandColors.pink.subtle}
            iconBorderColor={activeTab === 'RESUBMITTED' ? '#DDD6FE' : BrandColors.pink.tint}
          />
        ) : (
          <FlatList
            data={filteredApprovals}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              <TouchableOpacity
                style={styles.confirmedNoticeCard}
                onPress={() => router.push('/(admin)/sales' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="information-circle-outline" size={20} color="#15803D" />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.confirmedNoticeTitle}>Looking for auto-approved orders?</Text>
                  <Text style={styles.confirmedNoticeSub}>
                    Orders revised to ≥ ₹{(minPricePaise / 100).toFixed(2)}/pkt meet the policy floor and are automatically confirmed without needing admin approval. Tap to view the Sales Directory.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#15803D" />
              </TouchableOpacity>
            }
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
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  kpiLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    ...Typography.bodyMedium,
    color: Colors.light.heading,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiSubValue: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    marginTop: 1,
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
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  orderNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.dark,
    letterSpacing: 0.5,
  },
  customerName: {
    ...Typography.h3,
    color: Colors.light.textPrimary,
  },
  customerContact: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
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
  productsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  productName: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  skuBadge: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  skuText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  productQtyPrice: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  productTotalText: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.pink.subtle,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.xs,
  },
  feedbackText: {
    ...Typography.caption,
    fontStyle: 'italic',
    color: Colors.light.textPrimary,
    flex: 1,
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
    flexWrap: 'wrap',
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
  resubmittedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  resubmittedNoticeText: {
    ...Typography.caption,
    color: '#6D28D9',
    fontWeight: '700',
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: BrandColors.pink.dark,
    borderColor: BrandColors.pink.dark,
  },
  tabBtnActivePurple: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tabBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  tabBtnTextActiveWhite: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  confirmedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  confirmedNoticeTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#15803D',
  },
  confirmedNoticeSub: {
    ...Typography.caption,
    fontSize: 10,
    color: '#166534',
    marginTop: 2,
  },
});
