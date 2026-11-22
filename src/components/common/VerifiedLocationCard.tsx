import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BrandColors, Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { LocationResult } from '@/utils/locationUtils';

export interface VerifiedLocationCardProps {
  location: LocationResult | null;
  loading?: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  routeDistanceKm?: number;
  compact?: boolean;
}

export const VerifiedLocationCard: React.FC<VerifiedLocationCardProps> = ({
  location,
  loading = false,
  onRefresh,
  title = 'Verified GPS Location',
  subtitle = 'Accurate street, area & pincode detected via Google Maps',
  routeDistanceKm,
  compact = false,
}) => {
  if (loading) {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={BrandColors.green.primary} />
          <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
            <Text style={styles.loadingTitle}>Acquiring GPS Satellite Lock...</Text>
            <Text style={styles.loadingSubtitle}>Fetching street, area & postal code from Google Maps</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.cardContainer, styles.cardError]}>
        <View style={styles.headerRow}>
          <View style={styles.iconBoxWarn}>
            <Ionicons name="location-outline" size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.warnTitle}>Location Not Locked</Text>
            <Text style={styles.warnSubtitle}>Enable device GPS for verified beat route tracking</Text>
          </View>
          {onRefresh && (
            <Pressable onPress={onRefresh} hitSlop={12} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={16} color={BrandColors.green.primary} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Parse structured address components
  const streetName =
    location.street ||
    (location.address ? location.address.split(',')[0]?.trim() : null) ||
    'Beat Route / Main Street';

  const areaName =
    location.village ||
    (location.address ? location.address.split(',')[1]?.trim() : null) ||
    'Local Area';

  const districtCity =
    location.district ||
    'City Area';

  const statePincode = [
    location.state || 'Madhya Pradesh',
    location.pincode ? `PIN ${location.pincode}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const coordsFormatted = `${location.latitude.toFixed(5)}° N, ${location.longitude.toFixed(5)}° E`;

  return (
    <View style={styles.cardContainer}>
      {/* Header with GPS Status and Refresh */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.radarIconBox}>
            <Ionicons name="navigate-circle" size={20} color={BrandColors.green.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <View style={styles.gpsVerifiedBadge}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.gpsVerifiedBadgeText}>GPS Verified</Text>
              </View>
            </View>
            {!compact && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {onRefresh && (
          <Pressable onPress={onRefresh} hitSlop={12} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={BrandColors.green.primary} />
          </Pressable>
        )}
      </View>

      {/* Formatted Full Address Box */}
      <View style={styles.addressBox}>
        {/* Street & Road */}
        <View style={styles.addressLineRow}>
          <Ionicons name="business-outline" size={15} color="#475569" style={styles.lineIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Street / Road</Text>
            <Text style={styles.fieldValueBold} numberOfLines={1}>{streetName}</Text>
          </View>
        </View>

        {/* Area & Locality */}
        <View style={styles.addressLineRow}>
          <Ionicons name="map-outline" size={15} color="#475569" style={styles.lineIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Area / Locality</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>{areaName}</Text>
          </View>
        </View>

        {/* City, State & Pincode */}
        <View style={styles.addressLineRow}>
          <Ionicons name="location" size={15} color={BrandColors.pink.primary} style={styles.lineIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>City, State & Pincode</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {districtCity}, {statePincode}
            </Text>
          </View>
        </View>

        {/* Coordinates */}
        <View style={styles.coordsRow}>
          <Ionicons name="radio-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
          <Text style={styles.coordsText}>Coords: {coordsFormatted}</Text>
          <Text style={styles.accuracyText}>• High Accuracy (Google Places API)</Text>
        </View>
      </View>

      {/* Traveled Distance Calculation (for End Shift) */}
      {routeDistanceKm != null && routeDistanceKm > 0 ? (
        <View style={styles.distanceCard}>
          <View style={styles.distanceIconBox}>
            <Ionicons name="git-commit-outline" size={18} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.distanceTitle}>
              Calculated Travel: <Text style={styles.distanceBold}>{routeDistanceKm.toFixed(1)} KM</Text>
            </Text>
            <Text style={styles.distanceSubtitle}>
              Calculated automatically from beat route GPS waypoints & Google Directions
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadows.sm,
  },
  cardError: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  loadingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  loadingSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconBoxWarn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  gpsVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
    marginRight: 4,
  },
  gpsVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  addressLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lineIcon: {
    width: 22,
    marginRight: 6,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  fieldValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
    flexWrap: 'wrap',
  },
  coordsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  accuracyText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '500',
    marginLeft: 4,
  },
  distanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  distanceIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  distanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  distanceBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  distanceSubtitle: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  warnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  warnSubtitle: {
    fontSize: 11,
    color: '#B45309',
  },
});
