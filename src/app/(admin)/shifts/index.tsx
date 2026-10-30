import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { Shift, ShiftStatus, ShiftVisit } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
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

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'Active now';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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

export default function AdminShiftsScreen() {
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ShiftStatus | 'ALL'>('ALL');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('today');
  const [search, setSearch] = useState('');

  // Selected Shift for Details Modal
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      const now = new Date();
      let from: string | undefined;
      let to: string | undefined = now.toISOString();

      if (datePreset === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        from = startOfDay.toISOString();
      } else if (datePreset === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        from = d.toISOString();
      } else if (datePreset === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        from = d.toISOString();
      }

      const res = await adminApi.listShifts({
        page: 1,
        pageSize: 100,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        from,
        to,
      });

      setShifts(res.items || []);
    } catch (err: any) {
      console.warn('Failed to load shifts', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, datePreset]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShifts();
  }, [fetchShifts]);

  const filteredShifts = useMemo(() => {
    if (!search.trim()) return shifts;
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      const sellerName = (s.seller?.name || '').toLowerCase();
      const phone = (s.seller?.phone || '').toLowerCase();
      const territory = (s.territory || '').toLowerCase();
      return sellerName.includes(q) || phone.includes(q) || territory.includes(q);
    });
  }, [shifts, search]);

  const renderShiftItem = ({ item }: { item: Shift }) => {
    const isOpen = item.status === 'OPEN' || item.status === 'ACTIVE';
    const sellerName = item.seller?.name || 'Field Officer';
    const visitsCount = item.visits?.length ?? 0;
    const duration = formatMinutes(item.durationMins);
    const startKm = item.startOdometer;
    const endKm = item.endOdometer;
    const distanceKm =
      startKm != null && endKm != null && endKm >= startKm
        ? `${(endKm - startKm).toFixed(1)} km`
        : null;

    return (
      <Card style={styles.shiftCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.sellerName}>{sellerName}</Text>
            <Text style={styles.shiftMeta}>
              {item.seller?.phone ? `${item.seller.phone} • ` : ''}
              Started: {formatISTDateTime(item.startTime || item.startedAt)}
            </Text>
          </View>
          <Badge
            label={isOpen ? 'ON DUTY' : 'COMPLETED'}
            variant={isOpen ? 'ACTIVE' : 'info'}
            size="sm"
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{duration}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="storefront-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Store Visits</Text>
            <Text style={styles.statValue}>{visitsCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons name="speedometer-outline" size={14} color="#64748B" />
            <Text style={styles.statLabel}>Odometer</Text>
            <Text style={styles.statValue}>{distanceKm ? distanceKm : startKm ? `${startKm} km` : '—'}</Text>
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          {item.endTime || item.endedAt ? (
            <Text style={styles.endedText}>
              Ended: {formatISTDateTime(item.endTime || item.endedAt)}
            </Text>
          ) : (
            <Text style={[styles.endedText, { color: BrandColors.green.primary, fontWeight: '700' }]}>
              Currently in the field
            </Text>
          )}

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setSelectedShift(item)}
            accessibilityRole="button"
            accessibilityLabel={`View GPS visits for ${sellerName}`}
          >
            <Ionicons name="map-outline" size={14} color="#0F172A" />
            <Text style={styles.detailsBtnText}>GPS Audit ({visitsCount})</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="National Shift Audit"
        subtitle="Real-time attendance, odometer logs and GPS visit trails"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={() => router.back()}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
          </Pressable>
        }
      />

      <View style={styles.filterSection}>
        <View style={styles.searchInner}>
          <Input
            placeholder="Search officer, phone or territory..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search" size={18} color={Colors.light.textMuted} />}
          />
        </View>

        {/* Date presets */}
        <View style={styles.presetTabsRow}>
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.presetTab, datePreset === p.id && styles.presetTabActive]}
              onPress={() => setDatePreset(p.id)}
            >
              <Text style={[styles.presetTabText, datePreset === p.id && styles.presetTabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status filter */}
        <View style={styles.statusTabsRow}>
          {(['ALL', 'OPEN', 'COMPLETED'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusTab, statusFilter === s && styles.statusTabActive]}
              onPress={() => setStatusFilter(s as any)}
            >
              <Text style={[styles.statusTabText, statusFilter === s && styles.statusTabTextActive]}>
                {s === 'OPEN' ? 'ON DUTY' : s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingPadding}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : filteredShifts.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No Shifts Found"
          description={
            search
              ? 'No shift records match your search criteria.'
              : 'No shifts recorded for the selected period.'
          }
        />
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={(item) => item.id}
          renderItem={renderShiftItem}
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

      {/* GPS Visits Audit Modal */}
      <Modal visible={selectedShift !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Shift GPS Audit Trail</Text>
                <Text style={styles.modalSub}>
                  {selectedShift?.seller?.name || 'Field Officer'} •{' '}
                  {formatISTDateTime(selectedShift?.startTime || selectedShift?.startedAt)}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedShift(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Odometer Card */}
              <Card style={styles.modalAuditCard}>
                <Text style={styles.auditCardTitle}>Odometer Verification</Text>
                <View style={styles.odometerGrid}>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>Start Reading</Text>
                    <Text style={styles.odometerVal}>{selectedShift?.startOdometer ?? '—'} km</Text>
                  </View>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>End Reading</Text>
                    <Text style={styles.odometerVal}>{selectedShift?.endOdometer ?? '—'} km</Text>
                  </View>
                  <View style={styles.odometerCol}>
                    <Text style={styles.odometerLabel}>Net Travel</Text>
                    <Text style={[styles.odometerVal, { color: BrandColors.pink.dark }]}>
                      {selectedShift?.startOdometer != null &&
                      selectedShift?.endOdometer != null &&
                      selectedShift.endOdometer >= selectedShift.startOdometer
                        ? `${(selectedShift.endOdometer - selectedShift.startOdometer).toFixed(1)} km`
                        : '—'}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Visits List */}
              <Text style={styles.visitsSectionHeading}>
                Store Visits ({selectedShift?.visits?.length || 0})
              </Text>
              {selectedShift?.visits && selectedShift.visits.length > 0 ? (
                selectedShift.visits.map((v: ShiftVisit, idx: number) => (
                  <View key={v.id || idx} style={styles.visitItem}>
                    <View style={styles.visitIndexBadge}>
                      <Text style={styles.visitIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitShopName}>
                        {v.customer?.shopName || (v as any).shopName || 'Retail Customer'}
                      </Text>
                      <Text style={styles.visitTime}>
                        {formatISTDateTime(v.checkInTime || (v as any).createdAt)}
                      </Text>

                      {v.visitReason ? (
                        <View style={styles.visitReasonBadge}>
                          <Text style={styles.visitReasonText}>{v.visitReason}</Text>
                        </View>
                      ) : null}

                      {v.feedback ? (
                        <View style={styles.visitFeedbackBox}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color="#64748B" />
                          <Text style={styles.visitFeedbackText}>{v.feedback}</Text>
                        </View>
                      ) : null}

                      {v.latitude && v.longitude ? (
                        <View style={styles.visitGpsRow}>
                          <Ionicons name="location-outline" size={12} color="#0284C7" />
                          <Text style={styles.visitGpsText}>
                            GPS: {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                            {v.accuracy ? ` (±${Math.round(v.accuracy)}m)` : ''}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.visitGpsMuted}>No GPS coordinates recorded</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyVisitsText}>No store visits recorded for this shift.</Text>
              )}
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
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  searchInner: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  presetTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 6,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  presetTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  presetTabActive: {
    backgroundColor: '#0F172A',
  },
  presetTabText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  presetTabTextActive: {
    color: '#FFFFFF',
  },
  statusTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    gap: 6,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  statusTab: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  statusTabActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  statusTabText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  statusTabTextActive: {
    color: '#FFFFFF',
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
  shiftCard: {
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sellerName: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  shiftMeta: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statValue: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  endedText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
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
    maxHeight: '90%',
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
  modalAuditCard: {
    padding: Spacing.sm,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  auditCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  odometerGrid: {
    flexDirection: 'row',
  },
  odometerCol: {
    flex: 1,
    alignItems: 'center',
  },
  odometerLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  odometerVal: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  visitsSectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  visitItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  visitIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  visitIndexText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitShopName: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  visitTime: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  visitReasonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: BorderRadius.xs,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  visitReasonText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  visitFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: '#FAF8F5',
    padding: 6,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  visitFeedbackText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.text,
    flex: 1,
  },
  visitGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  visitGpsText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  visitGpsMuted: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyVisitsText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
  },
});
