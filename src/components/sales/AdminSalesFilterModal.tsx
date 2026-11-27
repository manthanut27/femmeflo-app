import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PaymentMode } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { BrandColors, Colors, HitSlop, Radius, Spacing, Typography } from '@/constants/theme';

export type AdminSalesStatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING_APPROVAL' | 'COMPLETED';
export type AdminSalesPaymentFilter = PaymentMode | 'ALL';

export const ADMIN_SALES_STATUS_OPTIONS: Array<{
  value: AdminSalesStatusFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'ALL', label: 'All Sales', icon: 'layers-outline' },
  { value: 'CONFIRMED', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { value: 'PENDING_APPROVAL', label: 'Pending', icon: 'time-outline' },
  { value: 'COMPLETED', label: 'Received', icon: 'checkmark-done-circle-outline' },
];

export const ADMIN_SALES_PAYMENT_OPTIONS: Array<{
  value: AdminSalesPaymentFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'ALL', label: 'All Modes', icon: 'wallet-outline' },
  { value: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { value: 'BANK', label: 'UPI / Bank', icon: 'qr-code-outline' },
  { value: 'PENDING', label: 'Pay Later', icon: 'time-outline' },
];

export function formatPaymentModeLabel(mode?: string | null): string {
  if (mode === 'CASH') return 'Cash';
  if (mode === 'BANK') return 'UPI / Bank';
  if (mode === 'PENDING') return 'Pay Later';
  return mode || '—';
}

export interface AdminSalesFilterModalProps {
  visible: boolean;
  statusFilter: AdminSalesStatusFilter;
  paymentFilter: AdminSalesPaymentFilter;
  onApply: (next: {
    statusFilter: AdminSalesStatusFilter;
    paymentFilter: AdminSalesPaymentFilter;
  }) => void;
  onClose: () => void;
}

export function AdminSalesFilterModal({
  visible,
  statusFilter,
  paymentFilter,
  onApply,
  onClose,
}: AdminSalesFilterModalProps) {
  const insets = useSafeAreaInsets();
  const [draftStatus, setDraftStatus] = useState<AdminSalesStatusFilter>(statusFilter);
  const [draftPayment, setDraftPayment] = useState<AdminSalesPaymentFilter>(paymentFilter);

  useEffect(() => {
    if (visible) {
      setDraftStatus(statusFilter);
      setDraftPayment(paymentFilter);
    }
  }, [visible, statusFilter, paymentFilter]);

  const handleReset = () => {
    setDraftStatus('ALL');
    setDraftPayment('ALL');
  };

  const handleApply = () => {
    onApply({ statusFilter: draftStatus, paymentFilter: draftPayment });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Filter Sales</Text>
              <Text style={styles.subtitle}>Select order state &amp; payment mode</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={HitSlop.md}
              accessibilityRole="button"
              accessibilityLabel="Close sales filter"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={Colors.light.textPrimary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.sectionLabel}>Sale Status</Text>
            <View style={styles.chipGrid}>
              {ADMIN_SALES_STATUS_OPTIONS.map((opt) => {
                const active = draftStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.75}
                    onPress={() => setDraftStatus(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.optionChip,
                      active && {
                        backgroundColor:
                          opt.value === 'COMPLETED' ? BrandColors.green.primary : BrandColors.pink.dark,
                        borderColor:
                          opt.value === 'COMPLETED' ? BrandColors.green.primary : BrandColors.pink.dark,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#FFFFFF' : Colors.light.textSecondary}
                    />
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Payment Mode</Text>
            <View style={styles.chipGrid}>
              {ADMIN_SALES_PAYMENT_OPTIONS.map((opt) => {
                const active = draftPayment === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.75}
                    onPress={() => setDraftPayment(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.optionChip,
                      active && {
                        backgroundColor: BrandColors.green.primary,
                        borderColor: BrandColors.green.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={active ? '#FFFFFF' : Colors.light.textSecondary}
                    />
                    <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Reset" variant="outline" onPress={handleReset} style={{ flex: 1 }} />
            <Button title="Apply Filter" variant="admin" onPress={handleApply} style={{ flex: 1.6 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
