import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CustomerItem } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { BorderRadius, BrandColors, Colors, Spacing, Typography } from '@/constants/theme';

interface CustomerCardProps {
  item: CustomerItem;
  onboardedDate: string;
  onPress: () => void;
}

export function CustomerCard({ item, onboardedDate, onPress }: CustomerCardProps) {
  const hasPhoto = Boolean(item.photoUrl || (item as any).photoPath);
  const photoReason = (item as any).noPhotoReason || (item as any).photoSkipReason;
  const hasGps = item.latitude != null && item.longitude != null;
  const contactName = item.contactName || item.ownerName || 'Owner';
  const areaText = [item.village, item.district, item.state].filter(Boolean).join(', ') || 'Area not set';
  const categoryName = item.category?.name || 'Retail';

  const handleCall = () => {
    if (!item.phone) return;
    Linking.openURL(`tel:${item.phone}`).catch(() => {});
  };

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`Store ${item.shopName}, Owner ${contactName}, Category ${categoryName}`}
      accessibilityHint="Tap to view and edit store details"
    >
      {/* Top Row: Shop Name + Active Status + Chevron */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, minWidth: 0, marginRight: Spacing.sm }}>
          <Text style={styles.shopName} numberOfLines={2}>
            {item.shopName}
          </Text>
        </View>
        <View style={styles.topRight}>
          <Badge
            label={item.active ? 'Active' : 'Inactive'}
            variant={item.active ? 'ACTIVE' : 'INACTIVE'}
            size="sm"
          />
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </View>
      </View>

      {/* Contact & Category Row */}
      <View style={styles.contactRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.contactText} numberOfLines={1}>
            {contactName}
          </Text>
          {item.phone ? (
            <Pressable
              onPress={handleCall}
              style={styles.phoneBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Call ${item.phone}`}
            >
              <Ionicons name="call-outline" size={12} color={BrandColors.pink.dark} />
              <Text style={styles.phoneText} numberOfLines={1}>
                {item.phone}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText} numberOfLines={1}>
            {categoryName}
          </Text>
        </View>
      </View>

      {/* Location & Date */}
      <View style={styles.metaRow}>
        <View style={[styles.metaItem, { flex: 1, minWidth: 0 }]}>
          <Ionicons name="location-outline" size={13} color="#64748B" />
          <Text style={styles.metaText} numberOfLines={1}>
            {areaText}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color="#64748B" />
          <Text style={styles.metaText} numberOfLines={1}>
            {onboardedDate}
          </Text>
        </View>
      </View>

      {/* GPS & Photo Status Badges */}
      <View style={styles.badgeRow}>
        {hasPhoto ? (
          <View style={styles.verifiedPhotoBadge}>
            <Ionicons name="camera-outline" size={12} color={BrandColors.green.primary} />
            <Text style={styles.verifiedPhotoText}>Photo Verified</Text>
          </View>
        ) : (
          <View style={styles.exemptPhotoBadge}>
            <Ionicons name="alert-circle-outline" size={12} color="#D97706" />
            <Text style={styles.exemptPhotoText} numberOfLines={1}>
              Exempt: {photoReason || 'No Photo'}
            </Text>
          </View>
        )}

        {hasGps ? (
          <View style={styles.gpsBadge}>
            <Ionicons name="navigate-outline" size={12} color="#0284C7" />
            <Text style={styles.gpsText}>
              GPS Ready
            </Text>
          </View>
        ) : (
          <View style={styles.noGpsBadge}>
            <Ionicons name="location-outline" size={12} color="#94A3B8" />
            <Text style={styles.noGpsText}>No GPS</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shopName: {
    ...Typography.subtitle,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contactText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.pink.dark,
  },
  categoryPill: {
    maxWidth: '45%',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  verifiedPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  verifiedPhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: BrandColors.green.primary,
  },
  exemptPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    maxWidth: '72%',
  },
  exemptPhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    flexShrink: 1,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  gpsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  noGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  noGpsText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
});
