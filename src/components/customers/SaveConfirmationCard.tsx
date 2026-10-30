import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CustomerItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDateIST, formatTimeIST } from '@/utils/dateUtils';
import { BorderRadius, BrandColors, Colors, Elevation, Spacing, Typography } from '@/constants/theme';

export interface SaveConfirmationProps {
  count: number;
  customers: Array<CustomerItem | { shopName: string; contactName?: string; phone: string; village?: string; district?: string }>;
  serverCreatedAt?: string;
  hasPhoto?: boolean;
  photoReason?: string;
  hasGps?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  onReset: () => void;
  onDone: () => void;
  title?: string;
}

export function SaveConfirmationCard({
  count,
  customers,
  serverCreatedAt,
  hasPhoto = false,
  photoReason,
  hasGps = false,
  latitude,
  longitude,
  onReset,
  onDone,
  title = 'Customer Registration Successful',
}: SaveConfirmationProps) {
  const timestamp = serverCreatedAt ? new Date(serverCreatedAt) : new Date();
  const dateStr = formatDateIST(timestamp, 'medium');
  const timeStr = formatTimeIST(timestamp, true);

  return (
    <Card style={styles.card}>
      {/* Success Banner */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={32} color={BrandColors.green.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.countSubtitle}>
          {count === 1 ? '1 Retail Customer Registered' : `${count} Customers Registered in Batch`}
        </Text>
      </View>

      {/* Authoritative IST Audit Stamp */}
      <View style={styles.auditSection}>
        <View style={styles.auditRow}>
          <View style={styles.auditCol}>
            <Text style={styles.auditLabel}>SAVED DATE (IST)</Text>
            <Text style={styles.auditValue}>{dateStr}</Text>
          </View>
          <View style={styles.auditCol}>
            <Text style={styles.auditLabel}>AUTHORITATIVE TIME (IST)</Text>
            <Text style={styles.auditValue}>{timeStr}</Text>
          </View>
        </View>

        {/* Verification Status Rows */}
        <View style={styles.verificationRow}>
          <Ionicons
            name={hasPhoto ? 'image' : 'document-text-outline'}
            size={16}
            color={hasPhoto ? BrandColors.green.primary : '#D97706'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.verificationText}>
            {hasPhoto
              ? 'Storefront Photo Captured & Uploaded (Verified)'
              : `Photo Exempted: ${photoReason || 'Bulk Field Onboarding'}`}
          </Text>
        </View>

        <View style={styles.verificationRow}>
          <Ionicons
            name={hasGps ? 'location' : 'location-outline'}
            size={16}
            color={hasGps ? BrandColors.green.primary : '#64748B'}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.verificationText}>
            {hasGps && latitude && longitude
              ? `GPS Coordinates Verified: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`
              : 'Location Recorded via Postal / Beat Territory'}
          </Text>
        </View>
      </View>

      {/* Registered Outlets List */}
      <Text style={styles.listHeading}>Registered Outlets ({customers.length})</Text>
      <View style={styles.customersList}>
        {customers.slice(0, 5).map((cust, idx) => {
          const contactPerson = 'contactName' in cust ? cust.contactName : ('ownerName' in cust ? (cust as any).ownerName : '');
          return (
            <View key={idx} style={styles.customerRow}>
              <View style={styles.customerBullet}>
                <Text style={styles.bulletText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {cust.shopName}
                </Text>
                <Text style={styles.contactDetails}>
                  {contactPerson ? `${contactPerson} • ` : ''}
                  {cust.phone}
                  {cust.village || cust.district ? ` • ${[cust.village, cust.district].filter(Boolean).join(', ')}` : ''}
                </Text>
              </View>
            </View>
          );
        })}

        {customers.length > 5 && (
          <Text style={styles.moreText}>
            + {customers.length - 5} more customers registered in this batch
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Onboard Another Customer"
          variant="secondary"
          onPress={onReset}
          style={styles.actionBtn}
        />
        <Button
          title="Done & View Directory"
          variant="primary"
          onPress={onDone}
          style={styles.actionBtn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Elevation.low,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.h2.fontSize,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  countSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '600',
    color: BrandColors.green.dark,
    marginTop: 2,
  },
  auditSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  auditCol: {
    flex: 1,
  },
  auditLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  auditValue: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verificationText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  listHeading: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  customersList: {
    marginBottom: Spacing.md,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  customerBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bulletText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  shopName: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: '#1E293B',
  },
  contactDetails: {
    fontSize: Typography.caption.fontSize,
    color: '#64748B',
  },
  moreText: {
    fontSize: Typography.caption.fontSize,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});

