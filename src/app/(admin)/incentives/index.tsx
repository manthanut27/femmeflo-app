import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type {
  AdminIncentiveListResponse,
  BusinessSettings,
  IncentiveSummaryItem,
  TargetPeriodType,
  UserIncentiveDetails,
} from '@/api/types';
import { TargetProgressStrip } from '@/components/incentives/TargetProgressStrip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatCard } from '@/components/ui/StatCard';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  MaxContentWidth,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useDashboardBackHandler } from '@/hooks/useDashboardBackHandler';

export default function AdminIncentivesScreen() {
  const handleBack = useDashboardBackHandler('/(admin)');

  const [data, setData] = useState<AdminIncentiveListResponse | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SELLER' | 'MANAGER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL');

  // Modals
  const [globalRuleModal, setGlobalRuleModal] = useState(false);
  const [newGlobalRate, setNewGlobalRate] = useState('1.00');
  const [applyGlobalToUnpaid, setApplyGlobalToUnpaid] = useState(true);
  const [savingGlobalRule, setSavingGlobalRule] = useState(false);

  const [rateModalUser, setRateModalUser] = useState<IncentiveSummaryItem | null>(null);
  const [customRateInput, setCustomRateInput] = useState('');
  const [customRateReason, setCustomRateReason] = useState('');
  const [applyUserRateToUnpaid, setApplyUserRateToUnpaid] = useState(true);
  const [savingUserRate, setSavingUserRate] = useState(false);

  const [adjModalUser, setAdjModalUser] = useState<IncentiveSummaryItem | null>(null);
  const [adjType, setAdjType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  const [payModalUser, setPayModalUser] = useState<IncentiveSummaryItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'BANK' | 'CASH' | 'UPI'>('BANK');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Details Modal
  const [detailsModalUser, setDetailsModalUser] = useState<IncentiveSummaryItem | null>(null);
  const [detailsData, setDetailsData] = useState<UserIncentiveDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Target Modal
  const [targetModalUser, setTargetModalUser] = useState<IncentiveSummaryItem | null>(null);
  const [targetPeriodInput, setTargetPeriodInput] = useState<TargetPeriodType>('MONTHLY');
  const [targetPacketsInput, setTargetPacketsInput] = useState('');
  const [targetBonusRupeesInput, setTargetBonusRupeesInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [incRes, setRes] = await Promise.all([
        adminApi.getIncentives({
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: search.trim() || undefined,
        }).catch((err) => {
          console.warn('Failed to fetch incentives', err);
          return null;
        }),
        adminApi.getIncentiveSettings().catch(() => null),
      ]);

      if (incRes) {
        setData(incRes);
      }
      if (setRes?.settings) {
        setSettings(setRes.settings);
        const resolvedDefaultPaise = setRes.settings.incentiveRatePaise ?? 100;
        setNewGlobalRate((resolvedDefaultPaise / 100).toFixed(2));
      }
    } catch (err: any) {
      console.warn('Failed loading incentive data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const allEmployees = useMemo(() => {
    if (!data) return [];
    let list: IncentiveSummaryItem[] = [];
    const seen = new Set<string>();
    const addUnique = (items?: IncentiveSummaryItem[]) => {
      for (const emp of items || []) {
        const key = emp.sellerId || emp.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push(emp);
      }
    };

    if (roleFilter === 'ALL' || roleFilter === 'SELLER') {
      addUnique(data.sellers);
    }
    if (roleFilter === 'ALL' || roleFilter === 'MANAGER') {
      addUnique(data.managers);
    }
    if (list.length === 0 && (data.items || data.users)) {
      addUnique(data.items || data.users);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((emp) => {
        const name = (emp.sellerName || (emp as any).name || '').toLowerCase();
        const phone = (emp.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    }

    return list;
  }, [data, roleFilter, search]);

  // Global Rule Save
  const handleSaveGlobalRule = () => {
    const rateNum = parseFloat(newGlobalRate);
    if (isNaN(rateNum) || rateNum < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid rate greater than or equal to 0.');
      return;
    }

    Alert.alert(
      'Confirm Rule Update',
      `Set the national default seller incentive rate to ₹${rateNum.toFixed(2)} per packet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Save',
          onPress: async () => {
            setSavingGlobalRule(true);
            try {
              const ratePaise = Math.round(rateNum * 100);
              const res = await adminApi.updateIncentiveSettings({
                incentiveRatePaise: ratePaise,
                applyToUnpaid: applyGlobalToUnpaid,
              });
              const extraMsg = res?.recalculatedCount
                ? ` Updated ${res.recalculatedCount} unpaid sale(s).`
                : '';
              Alert.alert('Success', `Default incentive rate updated to ₹${rateNum.toFixed(2)}/pkt.${extraMsg}`);
              setGlobalRuleModal(false);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to update global rule.');
            } finally {
              setSavingGlobalRule(false);
            }
          },
        },
      ]
    );
  };

  // User Rate Save
  const handleSaveUserRate = () => {
    if (!rateModalUser) return;
    const rateNum = parseFloat(customRateInput);
    if (isNaN(rateNum) || rateNum < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid custom rate per packet.');
      return;
    }

    const userName = rateModalUser.sellerName || (rateModalUser as any).name || 'Employee';
    const userId = rateModalUser.sellerId || rateModalUser.id;

    Alert.alert(
      'Confirm Rate Override',
      `Set custom rate of ₹${rateNum.toFixed(2)}/pkt for ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Override',
          onPress: async () => {
            setSavingUserRate(true);
            try {
              const ratePaise = Math.round(rateNum * 100);
              await adminApi.updateUserRate(userId, {
                ratePaise,
                effectiveDate: new Date().toISOString(),
                reason: customRateReason.trim() || undefined,
                applyToUnpaid: applyUserRateToUnpaid,
              });
              Alert.alert('Success', `Rate for ${userName} updated to ₹${rateNum.toFixed(2)}/pkt.`);
              setRateModalUser(null);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to update employee rate.');
            } finally {
              setSavingUserRate(false);
            }
          },
        },
      ]
    );
  };

  // Manual Adjustment Save
  const handleSaveAdjustment = () => {
    if (!adjModalUser) return;
    const amountNum = parseFloat(adjAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a positive adjustment amount in ₹.');
      return;
    }
    if (!adjReason.trim()) {
      Alert.alert('Required', 'Please enter a justification reason for this manual adjustment.');
      return;
    }

    const userName = adjModalUser.sellerName || (adjModalUser as any).name || 'Employee';
    const userId = adjModalUser.sellerId || adjModalUser.id;
    const typeLabel = adjType === 'ADD' ? 'addition (+₹)' : 'deduction (-₹)';

    Alert.alert(
      'Confirm Financial Adjustment',
      `Record an incentive ${typeLabel}${amountNum.toFixed(2)} for ${userName}?\n\nReason: "${adjReason.trim()}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Commit Adjustment',
          style: adjType === 'DEDUCT' ? 'destructive' : 'default',
          onPress: async () => {
            setSavingAdj(true);
            try {
              const amountPaise = Math.round(amountNum * 100);
              await adminApi.createAdjustment(userId, {
                type: adjType,
                amountPaise,
                reason: adjReason.trim(),
                adjustmentDate: new Date().toISOString(),
              });
              Alert.alert(
                'Success',
                `Incentive adjustment of ${adjType === 'ADD' ? '+' : '-'}₹${amountNum.toFixed(2)} recorded for ${userName}.`
              );
              setAdjModalUser(null);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to record adjustment.');
            } finally {
              setSavingAdj(false);
            }
          },
        },
      ]
    );
  };

  // Payout Save
  const handleSavePayout = () => {
    if (!payModalUser) return;
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a positive payout amount in ₹.');
      return;
    }

    const outstandingRupees = (payModalUser.outstandingPaise || (payModalUser as any).netPayablePaise || 0) / 100;
    if (amountNum > outstandingRupees && outstandingRupees > 0) {
      Alert.alert('Exceeds Balance', `Payout cannot exceed outstanding balance of ₹${outstandingRupees.toFixed(2)}.`);
      return;
    }

    const userName = payModalUser.sellerName || (payModalUser as any).name || 'Employee';
    const userId = payModalUser.sellerId || payModalUser.id;

    Alert.alert(
      'Confirm Payout Execution',
      `Record a payout of ₹${amountNum.toFixed(2)} to ${userName} via ${payMethod}?${
        payRef.trim() ? `\nRef: ${payRef.trim()}` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record Payout',
          onPress: async () => {
            setSavingPay(true);
            try {
              const amountPaise = Math.round(amountNum * 100);
              await adminApi.createPayout(userId, {
                amountPaise,
                paymentMethod: payMethod,
                referenceId: payRef.trim() || undefined,
                remarks: payRemarks.trim() || undefined,
                paymentDate: new Date().toISOString(),
                requestKey: `pay_${userId}_${Date.now()}`,
              });
              Alert.alert('Success', `Payout of ₹${amountNum.toFixed(2)} recorded for ${userName}.`);
              setPayModalUser(null);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to record payout.');
            } finally {
              setSavingPay(false);
            }
          },
        },
      ]
    );
  };

  const openTargetModal = (emp: IncentiveSummaryItem) => {
    setTargetModalUser(emp);
    const period = emp.targetProgress?.period || emp.salesTargetPeriod || 'MONTHLY';
    const pkts = emp.targetProgress?.targetPackets ?? emp.salesTargetPackets;
    const bonusPaise = emp.targetProgress?.bonusPaise ?? emp.targetBonusPaise ?? 0;
    setTargetPeriodInput(period);
    setTargetPacketsInput(pkts != null && pkts > 0 ? String(pkts) : '');
    setTargetBonusRupeesInput(bonusPaise > 0 ? String(Number((bonusPaise / 100).toFixed(2))) : '');
  };

  const handleSaveTarget = async (clearTarget = false) => {
    if (!targetModalUser) return;
    const userId = targetModalUser.sellerId || targetModalUser.id;
    let packets: number | null = null;
    let bonusPaise: number | null = null;

    if (!clearTarget) {
      const parsedPackets = parseInt(targetPacketsInput.trim(), 10);
      if (!Number.isFinite(parsedPackets) || parsedPackets <= 0) {
        Alert.alert('Invalid Target', 'Please enter a positive number of target packets.');
        return;
      }
      packets = parsedPackets;

      if (targetBonusRupeesInput.trim().length > 0) {
        const parsedBonus = parseFloat(targetBonusRupeesInput.trim());
        if (!Number.isFinite(parsedBonus) || parsedBonus < 0) {
          Alert.alert('Invalid Bonus', 'Bonus amount must be 0 or greater.');
          return;
        }
        bonusPaise = parsedBonus > 0 ? Math.round(parsedBonus * 100) : null;
      }
    }

    setSavingTarget(true);
    try {
      await adminApi.updateUserTarget(userId, {
        salesTargetPackets: packets,
        salesTargetPeriod: targetPeriodInput,
        targetBonusPaise: bonusPaise,
      });
      setTargetModalUser(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update sales target.');
    } finally {
      setSavingTarget(false);
    }
  };

  // View Details
  const handleViewDetails = async (emp: IncentiveSummaryItem) => {
    setDetailsModalUser(emp);
    setLoadingDetails(true);
    setDetailsData(null);
    try {
      const userId = emp.sellerId || emp.id;
      const details = await adminApi.getUserIncentiveDetails(userId);
      setDetailsData(details);
    } catch (err: any) {
      console.warn('Failed to fetch user incentive details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const summary = data?.summary;

  const renderEmployeeCard = ({ item }: { item: IncentiveSummaryItem }) => {
    const name = item.sellerName || (item as any).name || 'Employee';
    const defaultRatePaise = settings?.incentiveRatePaise ?? 100;
    const rateRupees =
      item.ratePerPacketRupees ??
      ((item.effectiveRatePaise ?? item.incentiveRatePaise ?? defaultRatePaise) / 100);
    const totalEarnedPaise =
      item.adjustedEntitlementPaise ??
      item.earnedPaise ??
      item.totalEarnedPaise ??
      (item as any).totalIncentivePaise ??
      (item as any).salesIncentivePaise ??
      0;
    const totalPaidPaise = item.totalPaidPaise ?? (item as any).paidPaise ?? 0;
    const outstandingPaise = item.outstandingPaise ?? item.netPayablePaise ?? 0;
    const earnedRupees = (totalEarnedPaise / 100).toFixed(2);
    const paidRupees = (totalPaidPaise / 100).toFixed(2);
    const outstandingRupees = (outstandingPaise / 100).toFixed(2);
    const role = (item as any).role || (item.id.includes('mgr') ? 'MANAGER' : 'SELLER');
    const isPaid = outstandingPaise <= 0;

    return (
      <Card style={styles.empCard}>
        <View style={styles.empHeaderRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.empName}>{name}</Text>
            <Text style={styles.empMeta}>
              Rate: ₹{rateRupees.toFixed(2)}/pkt • {item.phone || 'Field Force'}
            </Text>
          </View>
          <Badge
            label={isPaid ? 'FULLY PAID' : 'OUTSTANDING'}
            variant={isPaid ? 'ACTIVE' : 'warning'}
            size="sm"
          />
        </View>

        <TargetProgressStrip
          targetProgress={item.targetProgress}
          ratePerPacketPaise={item.effectiveRatePaise ?? item.incentiveRatePaise ?? defaultRatePaise}
          mode="compact"
          showWhenUnset
          onAssignPress={() => openTargetModal(item)}
          assignButtonLabel="Set Target"
        />

        <View style={styles.empMetricsRow}>
          <View style={styles.empMetricCol}>
            <Text style={styles.empMetricLabel}>Earned</Text>
            <Text style={styles.empMetricValue}>₹{earnedRupees}</Text>
          </View>
          <View style={styles.empMetricCol}>
            <Text style={styles.empMetricLabel}>Paid</Text>
            <Text style={[styles.empMetricValue, { color: BrandColors.green.primary }]}>₹{paidRupees}</Text>
          </View>
          <View style={styles.empMetricCol}>
            <Text style={styles.empMetricLabel}>Pending</Text>
            <Text style={[styles.empMetricValue, { color: BrandColors.pink.dark }]}>₹{outstandingRupees}</Text>
          </View>
        </View>

        <View style={styles.empActionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleViewDetails(item)}
            accessibilityRole="button"
            accessibilityLabel={`View ${name} incentive ledger`}
          >
            <Ionicons name="eye-outline" size={14} color="#0F172A" />
            <Text style={styles.actionBtnText}>Ledger</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setRateModalUser(item);
              setCustomRateInput(rateRupees.toFixed(2));
              setCustomRateReason('');
              setApplyUserRateToUnpaid(totalPaidPaise === 0);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Override rate for ${name}`}
          >
            <Ionicons name="pricetag-outline" size={14} color="#0F172A" />
            <Text style={styles.actionBtnText}>Rate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openTargetModal(item)}
            accessibilityRole="button"
            accessibilityLabel={`Set sales target for ${name}`}
          >
            <Ionicons name="flag-outline" size={14} color={BrandColors.pink.primary} />
            <Text style={styles.actionBtnText}>Target</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setAdjModalUser(item);
              setAdjType('ADD');
              setAdjAmount('');
              setAdjReason('');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Manual adjustment for ${name}`}
          >
            <Ionicons name="swap-vertical-outline" size={14} color="#0F172A" />
            <Text style={styles.actionBtnText}>Adjust</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => {
              setPayModalUser(item);
              setPayAmount(outstandingRupees);
              setPayMethod('BANK');
              setPayRef('');
              setPayRemarks('');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Record payout for ${name}`}
          >
            <Ionicons name="card-outline" size={14} color="#FFFFFF" />
            <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Pay</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Incentives & Payouts"
        subtitle="National sales commissions, rate overrides and disbursements"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to administrative actions"
            onPress={handleBack}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configure global rule"
            style={styles.headerRuleBtn}
            onPress={() => setGlobalRuleModal(true)}
          >
            <Ionicons name="options-outline" size={20} color="#FFFFFF" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.dark]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Default Rate Banner */}
          <Card style={styles.globalRuleBanner}>
            <View style={styles.bannerRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.bannerTitle}>Default Commission Rule</Text>
                <Text style={styles.bannerDesc}>
                  Field sellers receive{' '}
                  <Text style={{ fontWeight: '700', color: BrandColors.pink.dark }}>
                    ₹{((settings?.incentiveRatePaise ?? 100) / 100).toFixed(2)}
                  </Text>{' '}
                  per packet sold.
                  {summary && (summary.targetsAssignedCount ?? 0) > 0
                    ? ` • Targets met: ${summary.targetsAchievedCount ?? 0}/${summary.targetsAssignedCount}`
                    : ''}
                </Text>
              </View>
              <Button
                title="Configure"
                size="sm"
                variant="outline-admin"
                onPress={() => {
                  setApplyGlobalToUnpaid((summary?.totalPaidPaise ?? 0) === 0);
                  setGlobalRuleModal(true);
                }}
              />
            </View>
          </Card>

          {/* National Summary Metrics */}
          {summary ? (
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <View style={styles.metricCardWrapper}>
                  <StatCard
                    title="Total Earned"
                    value={`₹${((summary.totalEarnedPaise || 0) / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    subtitle="Gross commissions"
                    icon="trophy-outline"
                    iconColor={BrandColors.pink.primary}
                    iconBg={BrandColors.pink.subtle}
                  />
                </View>
                <View style={styles.metricCardWrapper}>
                  <StatCard
                    title="Total Disbursed"
                    value={`₹${((summary.totalPaidPaise || 0) / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    subtitle="Completed payouts"
                    icon="checkmark-circle-outline"
                    iconColor={BrandColors.green.primary}
                    iconBg={BrandColors.green.subtle}
                    accentColor={BrandColors.green.primary}
                  />
                </View>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricCardWrapper}>
                  <StatCard
                    title="Pending Payable"
                    value={`₹${((summary.totalPendingPaise || 0) / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    subtitle={`${summary.pendingEmployeesCount || 0} employees unpaid`}
                    icon="hourglass-outline"
                    iconColor={Colors.light.warning}
                    iconBg={Colors.light.warningBg}
                    accentColor={Colors.light.warning}
                  />
                </View>
                <View style={styles.metricCardWrapper}>
                  <StatCard
                    title="Adjustments"
                    value={`+₹${(((summary.totalAdditionsPaise || 0) - (summary.totalDeductionsPaise || 0)) / 100).toFixed(2)}`}
                    subtitle="Net manual corrections"
                    icon="swap-vertical-outline"
                    iconColor="#0284C7"
                    iconBg="#F0F9FF"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {/* Search & Filters */}
          <View style={styles.filterSection}>
            <Input
              placeholder="Search employee by name or phone..."
              value={search}
              onChangeText={setSearch}
              leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
            />

            <View style={styles.roleTabsRow}>
              {(['ALL', 'SELLER', 'MANAGER'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleTab, roleFilter === r && styles.roleTabActive]}
                  onPress={() => setRoleFilter(r)}
                >
                  <Text style={[styles.roleTabText, roleFilter === r && styles.roleTabTextActive]}>
                    {r}S
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Employee List */}
          <Text style={styles.sectionHeading}>Team Incentive Ledgers</Text>
          {loading ? (
            <View style={{ gap: Spacing.md }}>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : allEmployees.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="No Records Found"
              description="No incentive ledgers match your filter."
            />
          ) : (
            <View style={{ gap: Spacing.md }}>
              {allEmployees.map((emp) => (
                <View key={emp.sellerId || emp.id}>
                  {renderEmployeeCard({ item: emp })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Global Rule Modal */}
      <Modal
        visible={globalRuleModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setGlobalRuleModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setGlobalRuleModal(false)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Default Incentive Rate</Text>
              <Pressable onPress={() => setGlobalRuleModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSub}>
                This rule determines default commission calculated for every packet sold across the organization.
              </Text>
              <Text style={styles.inputLabel}>Rate Per Packet (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={newGlobalRate}
                onChangeText={setNewGlobalRate}
                keyboardType="numeric"
                placeholder="1.00"
              />
              <Pressable
                style={styles.toggleCheckRow}
                onPress={() => setApplyGlobalToUnpaid((prev) => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: applyGlobalToUnpaid }}
              >
                <Ionicons
                  name={applyGlobalToUnpaid ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={applyGlobalToUnpaid ? BrandColors.pink.dark : Colors.light.textSecondary}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.toggleCheckLabel}>Recalculate existing unpaid sales</Text>
                  <Text style={styles.toggleCheckHint}>
                    Updates past confirmed sales for employees with ₹0 paid so far (before payouts).
                  </Text>
                </View>
              </Pressable>
              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setGlobalRuleModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={savingGlobalRule ? 'Saving...' : 'Update Default Rule'}
                  variant="admin"
                  onPress={handleSaveGlobalRule}
                  loading={savingGlobalRule}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Rate Modal */}
      <Modal
        visible={rateModalUser !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setRateModalUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setRateModalUser(null)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Override Employee Rate</Text>
              <Pressable onPress={() => setRateModalUser(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSub}>
                Override incentive rate for{' '}
                <Text style={{ fontWeight: '700' }}>
                  {rateModalUser?.sellerName || (rateModalUser as any)?.name}
                </Text>.
              </Text>
              <Text style={styles.inputLabel}>Custom Rate Per Packet (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={customRateInput}
                onChangeText={setCustomRateInput}
                keyboardType="numeric"
                placeholder="e.g. 2.00"
              />
              <Text style={styles.inputLabel}>Justification / Reason</Text>
              <TextInput
                style={styles.modalInput}
                value={customRateReason}
                onChangeText={setCustomRateReason}
                placeholder="e.g. Rural area promotion incentive"
              />
              <Pressable
                style={styles.toggleCheckRow}
                onPress={() => setApplyUserRateToUnpaid((prev) => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: applyUserRateToUnpaid }}
              >
                <Ionicons
                  name={applyUserRateToUnpaid ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={applyUserRateToUnpaid ? BrandColors.pink.dark : Colors.light.textSecondary}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.toggleCheckLabel}>Apply new rate to existing unpaid sales</Text>
                  <Text style={styles.toggleCheckHint}>
                    Applies to all confirmed sales if no payouts have been recorded yet.
                  </Text>
                </View>
              </Pressable>
              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setRateModalUser(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={savingUserRate ? 'Saving...' : 'Apply Override'}
                  variant="admin"
                  onPress={handleSaveUserRate}
                  loading={savingUserRate}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual Adjustment Modal */}
      <Modal
        visible={adjModalUser !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setAdjModalUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setAdjModalUser(null)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Incentive Adjustment</Text>
              <Pressable onPress={() => setAdjModalUser(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSub}>
                Apply manual addition or deduction for{' '}
                <Text style={{ fontWeight: '700' }}>
                  {adjModalUser?.sellerName || (adjModalUser as any)?.name}
                </Text>.
              </Text>

              <View style={styles.typeToggleRow}>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, adjType === 'ADD' && styles.typeToggleBtnAdd]}
                  onPress={() => setAdjType('ADD')}
                >
                  <Text style={[styles.typeToggleText, adjType === 'ADD' && styles.typeToggleTextActive]}>
                    + Addition
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeToggleBtn, adjType === 'DEDUCT' && styles.typeToggleBtnDeduct]}
                  onPress={() => setAdjType('DEDUCT')}
                >
                  <Text style={[styles.typeToggleText, adjType === 'DEDUCT' && styles.typeToggleTextActive]}>
                    - Deduction
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Adjustment Amount (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={adjAmount}
                onChangeText={setAdjAmount}
                keyboardType="numeric"
                placeholder="e.g. 500.00"
              />

              <Text style={styles.inputLabel}>Audit Justification *</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 60 }]}
                value={adjReason}
                onChangeText={setAdjReason}
                multiline
                placeholder="Reason for financial correction..."
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setAdjModalUser(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={savingAdj ? 'Recording...' : 'Commit Adjustment'}
                  variant="admin"
                  onPress={handleSaveAdjustment}
                  loading={savingAdj}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Record Payout Modal */}
      <Modal
        visible={payModalUser !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPayModalUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setPayModalUser(null)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Incentive Payout</Text>
              <Pressable onPress={() => setPayModalUser(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSub}>
                Disburse commissions to{' '}
                <Text style={{ fontWeight: '700' }}>
                  {payModalUser?.sellerName || (payModalUser as any)?.name}
                </Text>.
              </Text>

              <Text style={styles.inputLabel}>Payout Amount (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder="0.00"
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.methodRow}>
                {(['BANK', 'UPI', 'CASH'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodBtn, payMethod === m && styles.methodBtnActive]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Transaction / Reference ID</Text>
              <TextInput
                style={styles.modalInput}
                value={payRef}
                onChangeText={setPayRef}
                placeholder="e.g. UTR1298471203"
              />

              <Text style={styles.inputLabel}>Remarks</Text>
              <TextInput
                style={styles.modalInput}
                value={payRemarks}
                onChangeText={setPayRemarks}
                placeholder="e.g. Monthly settlement October 2026"
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setPayModalUser(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={savingPay ? 'Recording...' : 'Disburse Payout'}
                  variant="admin"
                  onPress={handleSavePayout}
                  loading={savingPay}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ledger Details Modal */}
      <Modal
        visible={detailsModalUser !== null}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setDetailsModalUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Incentive Ledger</Text>
              <Pressable onPress={() => setDetailsModalUser(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {loadingDetails ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={BrandColors.pink.dark} />
                  <Text style={{ marginTop: 8, color: Colors.light.textSecondary }}>Loading ledger...</Text>
                </View>
              ) : detailsData ? (
                <View style={{ gap: Spacing.md }}>
                  <View style={styles.ledgerUserBox}>
                    <Text style={styles.ledgerUserName}>{detailsData.user.name}</Text>
                    <Text style={styles.ledgerUserMeta}>
                      {detailsData.user.phone || 'No phone'} • Effective Rate: ₹
                      {detailsData.user.effectiveRateRupees?.toFixed(2)}/pkt
                    </Text>
                  </View>

                  <View style={styles.ledgerSummaryGrid}>
                    <View style={styles.ledgerSummaryCol}>
                      <Text style={styles.ledgerSummaryLabel}>Lifetime Earned</Text>
                      <Text style={styles.ledgerSummaryVal}>
                        ₹{(((detailsData.summary?.adjustedEntitlementPaise ?? detailsData.summary?.earnedPaise ?? detailsData.summary?.salesIncentivePaise ?? detailsData.summary?.totalEarnedPaise) || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.ledgerSummaryCol}>
                      <Text style={styles.ledgerSummaryLabel}>Lifetime Paid</Text>
                      <Text style={[styles.ledgerSummaryVal, { color: BrandColors.green.primary }]}>
                        ₹{(((detailsData.summary?.totalPaidPaise ?? detailsData.summary?.paidPaise) || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.ledgerSummaryCol}>
                      <Text style={styles.ledgerSummaryLabel}>Outstanding</Text>
                      <Text style={[styles.ledgerSummaryVal, { color: BrandColors.pink.dark }]}>
                        ₹{((detailsData.summary?.outstandingPaise || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <TargetProgressStrip
                    targetProgress={detailsData.targetProgress}
                    ratePerPacketPaise={detailsData.user.effectiveRatePaise}
                    mode="detailed"
                    showWhenUnset
                    onAssignPress={
                      detailsModalUser
                        ? () => {
                            const emp = detailsModalUser;
                            setDetailsModalUser(null);
                            openTargetModal(emp);
                          }
                        : undefined
                    }
                    assignButtonLabel={detailsData.targetProgress?.hasTarget ? 'Edit Target' : 'Set Target'}
                  />

                  {/* Confirmed Sales Contributing to Ledger */}
                  <Text style={styles.ledgerSectionTitle}>
                    Confirmed Sales ({detailsData.summary?.confirmedPackets ?? 0} pkts)
                  </Text>
                  {detailsData.sales && detailsData.sales.length > 0 ? (
                    detailsData.sales.slice(0, 10).map((s: any) => {
                      const effPaise = s.incentiveAmountPaise ?? ((s.quantity || 0) * (s.incentiveRatePaise ?? detailsData.user.effectiveRatePaise ?? 100));
                      return (
                        <View key={s.id} style={styles.ledgerRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ledgerRowTitle}>
                              {s.customer?.shopName || s.invoiceNumber || 'Confirmed Sale'}
                            </Text>
                            <Text style={styles.ledgerRowSub}>
                              {s.quantity} pkts • {new Date(s.confirmedAt || s.createdAt).toLocaleDateString('en-IN')}
                            </Text>
                          </View>
                          <Text style={[styles.ledgerRowVal, { color: BrandColors.pink.dark }]}>
                            ₹{(effPaise / 100).toFixed(2)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyLedgerText}>No confirmed sales recorded yet.</Text>
                  )}

                  {/* Adjustments */}
                  <Text style={styles.ledgerSectionTitle}>Recent Manual Adjustments</Text>
                  {detailsData.adjustments && detailsData.adjustments.length > 0 ? (
                    detailsData.adjustments.map((a: any) => (
                      <View key={a.id} style={styles.ledgerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ledgerRowTitle}>{a.reason || 'Adjustment'}</Text>
                          <Text style={styles.ledgerRowSub}>
                            {new Date(a.adjustmentDate || a.createdAt).toLocaleDateString('en-IN')}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.ledgerRowVal,
                            { color: a.type === 'ADD' ? BrandColors.green.primary : Colors.light.error },
                          ]}
                        >
                          {a.type === 'ADD' ? '+' : '-'}₹{((a.amountPaise || 0) / 100).toFixed(2)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyLedgerText}>No manual adjustments recorded.</Text>
                  )}

                  {/* Payouts */}
                  <Text style={styles.ledgerSectionTitle}>Disbursement History</Text>
                  {detailsData.payouts && detailsData.payouts.length > 0 ? (
                    detailsData.payouts.map((p: any) => (
                      <View key={p.id} style={styles.ledgerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ledgerRowTitle}>
                            {p.paymentMethod || 'BANK'} {p.referenceId ? `• ${p.referenceId}` : ''}
                          </Text>
                          <Text style={styles.ledgerRowSub}>
                            {new Date(p.paymentDate || p.createdAt).toLocaleDateString('en-IN')}
                          </Text>
                        </View>
                        <Text style={[styles.ledgerRowVal, { color: BrandColors.green.primary }]}>
                          ₹{((p.amountPaise || 0) / 100).toFixed(2)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyLedgerText}>No payouts recorded yet.</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyLedgerText}>No ledger details available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 6: Set Sales Target */}
      <Modal
        visible={targetModalUser !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTargetModalUser(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropDismiss} onPress={() => setTargetModalUser(null)} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Sales Target</Text>
              <Pressable onPress={() => setTargetModalUser(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {targetModalUser ? (
                <>
                  <Text style={styles.modalSub}>
                    Target for{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {targetModalUser.sellerName || (targetModalUser as any).name}
                    </Text>{' '}
                    ({targetModalUser.targetProgress?.completedPackets ?? 0} pkts completed this{' '}
                    {targetPeriodInput === 'DAILY' ? 'day' : 'month'})
                  </Text>

                  <Text style={styles.targetFieldLabel}>Target Period</Text>
                  <View style={styles.targetPeriodRow}>
                    {(['MONTHLY', 'DAILY'] as const).map((periodOpt) => {
                      const active = targetPeriodInput === periodOpt;
                      return (
                        <Pressable
                          key={periodOpt}
                          onPress={() => setTargetPeriodInput(periodOpt)}
                          style={[
                            styles.targetPeriodBtn,
                            active && styles.targetPeriodBtnActive,
                          ]}
                        >
                          <Ionicons
                            name={periodOpt === 'MONTHLY' ? 'calendar-outline' : 'today-outline'}
                            size={15}
                            color={active ? BrandColors.pink.dark : Colors.light.textSecondary}
                          />
                          <Text
                            style={[
                              styles.targetPeriodText,
                              active && styles.targetPeriodTextActive,
                            ]}
                          >
                            {periodOpt === 'MONTHLY' ? 'Monthly Target' : 'Daily Target'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.targetFieldLabel}>Quick Presets (Packets)</Text>
                  <View style={styles.targetPresetRow}>
                    {(targetPeriodInput === 'DAILY' ? [10, 20, 30, 50] : [100, 250, 500, 1000]).map(
                      (preset) => {
                        const selected = targetPacketsInput.trim() === String(preset);
                        return (
                          <Pressable
                            key={preset}
                            onPress={() => setTargetPacketsInput(String(preset))}
                            style={[
                              styles.targetPresetChip,
                              selected && styles.targetPresetChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.targetPresetText,
                                selected && styles.targetPresetTextActive,
                              ]}
                            >
                              {preset} pkts
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>

                  <Input
                    label={`Target Packets (${targetPeriodInput === 'DAILY' ? 'Per Day' : 'Per Month'}) *`}
                    keyboardType="number-pad"
                    value={targetPacketsInput}
                    onChangeText={setTargetPacketsInput}
                    placeholder={targetPeriodInput === 'DAILY' ? 'e.g. 25' : 'e.g. 250'}
                  />

                  <Input
                    label="Completion Bonus (₹ Optional)"
                    keyboardType="decimal-pad"
                    value={targetBonusRupeesInput}
                    onChangeText={setTargetBonusRupeesInput}
                    placeholder="e.g. 500 (unlocked at 100% completion)"
                  />

                  {(() => {
                    const pkts = parseInt(targetPacketsInput.trim(), 10);
                    const ratePaise =
                      targetModalUser.effectiveRatePaise ??
                      targetModalUser.incentiveRatePaise ??
                      settings?.incentiveRatePaise ??
                      100;
                    const bonusRs = parseFloat(targetBonusRupeesInput.trim());
                    const validPkts = Number.isFinite(pkts) && pkts > 0 ? pkts : 0;
                    const validBonusRs = Number.isFinite(bonusRs) && bonusRs > 0 ? bonusRs : 0;
                    const commissionRs = (validPkts * ratePaise) / 100;
                    const totalRs = commissionRs + validBonusRs;

                    return validPkts > 0 ? (
                      <View style={styles.targetPreviewBox}>
                        <Text style={styles.targetPreviewTitle}>Employee Earnings on Completion</Text>
                        <Text style={styles.targetPreviewText}>
                          {validPkts} pkts × ₹{(ratePaise / 100).toFixed(2)} = ₹{commissionRs.toFixed(2)}{' '}
                          commission
                          {validBonusRs > 0 ? ` + ₹${validBonusRs.toFixed(2)} bonus` : ''} ={' '}
                          <Text style={{ fontWeight: '800', color: BrandColors.green.primary }}>
                            ₹{totalRs.toFixed(2)}
                          </Text>
                        </Text>
                      </View>
                    ) : null;
                  })()}

                  <Button
                    title={savingTarget ? 'Saving...' : 'Save Sales Target'}
                    variant="admin"
                    onPress={() => handleSaveTarget(false)}
                    disabled={savingTarget}
                    style={{ marginTop: Spacing.sm }}
                  />

                  {(targetModalUser.targetProgress?.hasTarget ||
                    (targetModalUser.salesTargetPackets ?? 0) > 0) && (
                    <Pressable
                      onPress={() => handleSaveTarget(true)}
                      disabled={savingTarget}
                      style={styles.clearTargetBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.light.danger} />
                      <Text style={styles.clearTargetText}>Remove Target</Text>
                    </Pressable>
                  )}
                </>
              ) : null}
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
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  headerRuleBtn: {
    backgroundColor: BrandColors.pink.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  globalRuleBanner: {
    padding: Spacing.md,
    backgroundColor: '#FFF1F2',
    borderColor: BrandColors.pink.subtle,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  metricsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  metricCardWrapper: {
    flex: 1,
  },
  filterSection: {
    gap: Spacing.sm,
  },
  roleTabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: 4,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  roleTabActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  roleTabText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  roleTabTextActive: {
    color: '#FFFFFF',
  },
  sectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: Spacing.xs,
  },
  empCard: {
    padding: Spacing.md,
  },
  empHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  empName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  empMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  empMetricsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  empMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  empMetricLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  empMetricValue: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  empActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  actionBtn: {
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
  actionBtnPrimary: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.primary,
  },
  actionBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  modalSub: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  typeToggleBtnAdd: {
    borderColor: BrandColors.green.primary,
    backgroundColor: BrandColors.green.subtle,
  },
  typeToggleBtnDeduct: {
    borderColor: Colors.light.error,
    backgroundColor: Colors.light.errorBg,
  },
  typeToggleText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  typeToggleTextActive: {
    color: '#0F172A',
  },
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  methodBtnActive: {
    borderColor: BrandColors.pink.primary,
    backgroundColor: '#FFF1F2',
  },
  methodText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  methodTextActive: {
    color: BrandColors.pink.dark,
  },
  // Ledger
  ledgerUserBox: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
  },
  ledgerUserName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  ledgerUserMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  ledgerSummaryGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  ledgerSummaryCol: {
    flex: 1,
    padding: Spacing.sm,
    backgroundColor: '#FAF8F5',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ledgerSummaryLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  ledgerSummaryVal: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    color: Colors.light.text,
  },
  ledgerSectionTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: Spacing.sm,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  ledgerRowTitle: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.light.text,
  },
  ledgerRowSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
  },
  ledgerRowVal: {
    ...Typography.caption,
    fontWeight: '700',
  },
  emptyLedgerText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
  },
  toggleCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: Spacing.md,
  },
  toggleCheckLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
  },
  toggleCheckHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  targetFieldLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    marginTop: 4,
  },
  targetPeriodRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  targetPeriodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  targetPeriodBtnActive: {
    borderColor: BrandColors.pink.primary,
    backgroundColor: '#FFF1F2',
  },
  targetPeriodText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  targetPeriodTextActive: {
    color: BrandColors.pink.dark,
  },
  targetPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  targetPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  targetPresetChipActive: {
    borderColor: BrandColors.pink.primary,
    backgroundColor: '#FFF1F2',
  },
  targetPresetText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  targetPresetTextActive: {
    color: BrandColors.pink.dark,
  },
  targetPreviewBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.green.surface,
    borderWidth: 1,
    borderColor: BrandColors.green.border,
    marginBottom: Spacing.sm,
  },
  targetPreviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.green.dark,
    marginBottom: 2,
  },
  targetPreviewText: {
    ...Typography.caption,
    color: Colors.light.text,
  },
  clearTargetBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.dangerBorder,
    backgroundColor: Colors.light.dangerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clearTargetText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.danger,
  },
});

