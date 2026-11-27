import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  BorderRadius,
  BrandColors,
  Colors,
  HitSlop,
  Spacing,
  Typography,
} from '@/constants/theme';
import { formatCurrencyINR, getISTDateKey } from '@/utils/dateUtils';

export interface RemittanceActionModalProps {
  visible: boolean;
  mode: 'SELLER_SEND' | 'ADMIN_RECEIVE';
  title: string;
  subtitle: string;
  totalAmountPaise: number;
  packetCount?: number;
  selectedCount?: number;
  paymentModeLabel?: string;
  sellerSentAt?: string | null;
  sellerSentRemark?: string | null;
  initialRemark?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: { remark?: string; dateStr: string }) => void;
}

function getISTYesterdayKey(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return getISTDateKey(d);
}

export function RemittanceActionModal({
  visible,
  mode,
  title,
  subtitle,
  totalAmountPaise,
  packetCount,
  selectedCount = 1,
  paymentModeLabel,
  sellerSentAt,
  sellerSentRemark,
  initialRemark = '',
  loading = false,
  onClose,
  onSubmit,
}: RemittanceActionModalProps) {
  const insets = useSafeAreaInsets();
  const [todayKey, setTodayKey] = useState(() => getISTDateKey(new Date()));
  const [yesterdayKey, setYesterdayKey] = useState(() => getISTYesterdayKey());

  const [remark, setRemark] = useState(initialRemark);
  const [dateStr, setDateStr] = useState(todayKey);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const currentToday = getISTDateKey(new Date());
      setTodayKey(currentToday);
      setYesterdayKey(getISTYesterdayKey());
      setRemark(initialRemark || '');
      setDateStr(currentToday);
      setDateError(null);
    }
  }, [visible, initialRemark]);

  const handleConfirm = () => {
    const trimmedDate = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setDateError('Enter date in YYYY-MM-DD format (e.g. ' + todayKey + ')');
      return;
    }
    setDateError(null);
    onSubmit({
      remark: remark.trim() || undefined,
      dateStr: trimmedDate,
    });
  };

  const isReceive = mode === 'ADMIN_RECEIVE';
  const accentColor = isReceive ? '#0F766E' : BrandColors.pink.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              <Pressable
                onPress={loading ? undefined : onClose}
                hitSlop={HitSlop.md}
                accessibilityRole="button"
                accessibilityLabel="Close remittance dialog"
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            {/* Summary KPI box */}
            <View style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>
                  {selectedCount > 1 ? `${selectedCount} SELECTED SALES` : paymentModeLabel ? `${paymentModeLabel} SALE AMOUNT` : 'ORDER AMOUNT'}
                </Text>
                <Text style={[styles.summaryAmount, { color: accentColor }]}>
                  {formatCurrencyINR(totalAmountPaise)}
                </Text>
              </View>
              {packetCount !== undefined ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.summaryLabel}>PACKETS</Text>
                  <Text style={styles.summaryPackets}>{packetCount.toLocaleString('en-IN')} pkts</Text>
                </View>
              ) : null}
            </View>

            {/* Show seller sent details to Super Admin when present */}
            {isReceive && sellerSentAt ? (
              <View style={styles.sellerNoteCard}>
                <View style={styles.sellerNoteHeader}>
                  <Ionicons name="send" size={14} color="#1D4ED8" />
                  <Text style={styles.sellerNoteTitle}>
                    Seller marked sent on {new Date(sellerSentAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {sellerSentRemark ? (
                  <Text style={styles.sellerNoteBody}>Remark: "{sellerSentRemark}"</Text>
                ) : null}
              </View>
            ) : null}

            {/* Date selection (Today / Yesterday / YYYY-MM-DD) */}
            <Text style={styles.fieldLabel}>
              {isReceive ? 'Payment Received Date' : 'Payment Sent Date'}
            </Text>
            <View style={styles.quickDateRow}>
              <TouchableOpacity
                style={[styles.dateChip, dateStr === todayKey && { backgroundColor: accentColor, borderColor: accentColor }]}
                onPress={() => {
                  setDateStr(todayKey);
                  setDateError(null);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.dateChipText, dateStr === todayKey && { color: '#FFFFFF' }]}>
                  Today ({todayKey})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateChip, dateStr === yesterdayKey && { backgroundColor: accentColor, borderColor: accentColor }]}
                onPress={() => {
                  setDateStr(yesterdayKey);
                  setDateError(null);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.dateChipText, dateStr === yesterdayKey && { color: '#FFFFFF' }]}>
                  Yesterday
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Or Custom Date (YYYY-MM-DD)"
              value={dateStr}
              onChangeText={(txt) => {
                setDateStr(txt);
                if (dateError) setDateError(null);
              }}
              placeholder={todayKey}
              error={dateError || undefined}
              leftIcon={<Ionicons name="calendar-outline" size={18} color="#64748B" />}
              containerStyle={{ marginBottom: Spacing.md }}
            />

            <Input
              label={
                isReceive
                  ? 'Company Receipt Remark (Optional)'
                  : 'Remittance Remark (Recommended for Cash)'
              }
              value={remark}
              onChangeText={setRemark}
              placeholder={
                isReceive
                  ? 'e.g. Received in FemmeFlo SBI / HQ Cash counter'
                  : 'e.g. Cash handed to office / Deposited / UPI ref'
              }
              multiline
              numberOfLines={2}
              leftIcon={<Ionicons name="chatbox-ellipses-outline" size={18} color="#64748B" />}
              containerStyle={{ marginBottom: Spacing.lg }}
            />

            <View style={styles.actionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  loading
                    ? 'Saving...'
                    : isReceive
                    ? selectedCount > 1
                      ? `Complete (${selectedCount})`
                      : 'Confirm Received & Complete'
                    : 'Mark Sent to FemmeFlo'
                }
                variant={isReceive ? 'admin' : 'primary'}
                onPress={handleConfirm}
                loading={loading}
                disabled={loading}
                style={{ flex: 1.6 }}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryPackets: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  sellerNoteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sellerNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
  },
  sellerNoteBody: {
    fontSize: 12,
    color: '#1E3A8A',
    fontStyle: 'italic',
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
