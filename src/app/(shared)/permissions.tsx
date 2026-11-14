import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import {
  BrandColors,
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAppPermissions } from '@/hooks/useAppPermissions';
import {
  APP_PERMISSIONS_METADATA,
  AppPermissionType,
  openAppSettings,
  PermissionCheckResult,
} from '@/utils/appPermissions';

const PERMISSION_ORDER: AppPermissionType[] = [
  'camera',
  'microphone',
  'notifications',
  'photos',
  'location',
  'storage',
];

export default function AppPermissionsScreen() {
  const {
    permissions,
    loading,
    requestingType,
    refreshPermissions,
    requestPermission,
  } = useAppPermissions();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedRationalePerm, setSelectedRationalePerm] = useState<AppPermissionType | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPermissions();
    setRefreshing(false);
  }, [refreshPermissions]);

  const summary = useMemo(() => {
    if (!permissions) {
      return { total: PERMISSION_ORDER.length, granted: 0, percentage: 0 };
    }
    const granted = PERMISSION_ORDER.filter(
      (type) => permissions[type]?.granted || permissions[type]?.status === 'granted'
    ).length;
    return {
      total: PERMISSION_ORDER.length,
      granted,
      percentage: Math.round((granted / PERMISSION_ORDER.length) * 100),
    };
  }, [permissions]);

  async function handleAllowPress(type: AppPermissionType) {
    const current = permissions?.[type];

    // If permanently denied, prompt directly to open Android Settings
    if (current?.status === 'permanently_denied' || current?.canAskAgain === false) {
      Alert.alert(
        'Permission Blocked in Android Settings',
        `Access to ${APP_PERMISSIONS_METADATA[type].name} was previously denied. Please enable it in Android App Settings to use this feature.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            style: 'default',
            onPress: () => openAppSettings(),
          },
        ]
      );
      return;
    }

    // Open Rationale Dialog first before triggering Android system dialog
    setSelectedRationalePerm(type);
  }

  async function handleConfirmRationaleRequest() {
    if (!selectedRationalePerm) return;
    const type = selectedRationalePerm;
    setSelectedRationalePerm(null);

    const result = await requestPermission(type);

    if (result.granted) {
      // Permission granted successfully
    } else if (result.status === 'permanently_denied' || !result.canAskAgain) {
      Alert.alert(
        'Permission Required',
        `To use ${APP_PERMISSIONS_METADATA[type].name}, please allow access in your Android device settings.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Open App Settings',
            onPress: () => openAppSettings(),
          },
        ]
      );
    } else {
      Alert.alert(
        'Permission Denied',
        `Without ${APP_PERMISSIONS_METADATA[type].name} access, related features in the application will remain limited. You can enable it anytime from this screen.`
      );
    }
  }

  function getStatusVisuals(type: AppPermissionType, permResult?: PermissionCheckResult) {
    const status = permResult?.status || 'not_requested';

    switch (status) {
      case 'granted':
        return {
          label: 'Allowed',
          badgeVariant: 'success' as const,
          bgColor: '#ECFDF5',
          borderColor: '#A7F3D0',
          textColor: '#059669',
          iconName: 'checkmark-circle' as const,
        };
      case 'limited':
        return {
          label: 'Limited Access',
          badgeVariant: 'warning' as const,
          bgColor: '#FFFBEB',
          borderColor: '#FDE68A',
          textColor: '#D97706',
          iconName: 'alert-circle' as const,
        };
      case 'permanently_denied':
        return {
          label: 'Blocked in Settings',
          badgeVariant: 'danger' as const,
          bgColor: '#FEF2F2',
          borderColor: '#FECACA',
          textColor: '#DC2626',
          iconName: 'settings-outline' as const,
        };
      case 'denied':
        return {
          label: 'Not Allowed',
          badgeVariant: 'neutral' as const,
          bgColor: '#F8FAFC',
          borderColor: '#E2E8F0',
          textColor: '#64748B',
          iconName: 'close-circle' as const,
        };
      case 'not_requested':
      default:
        return {
          label: 'Not Enabled',
          badgeVariant: 'neutral' as const,
          bgColor: '#F8FAFC',
          borderColor: '#E2E8F0',
          textColor: '#64748B',
          iconName: 'help-circle-outline' as const,
        };
    }
  }

  function getPermissionIconColors(type: AppPermissionType) {
    switch (type) {
      case 'camera':
        return { color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' };
      case 'microphone':
        return { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' };
      case 'notifications':
        return { color: BrandColors.pink.primary, bg: '#FFF1F2', border: '#FECDD3' };
      case 'photos':
        return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
      case 'location':
        return { color: BrandColors.green.primary, bg: '#ECFDF5', border: '#A7F3D0' };
      case 'storage':
        return { color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' };
    }
  }

  return (
    <View style={styles.container}>
      <Header
        title="App Permissions"
        subtitle="Manage the permissions needed for this application."
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BrandColors.pink.primary]}
          />
        }
      >
        <View style={styles.contentWrapper}>
          {/* Summary Status Banner */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryInfo}>
                <View style={styles.summaryTitleRow}>
                  <View style={styles.shieldBadge}>
                    <Ionicons name="shield-checkmark" size={18} color={BrandColors.pink.primary} />
                  </View>
                  <Text style={styles.summaryTitle}>Permissions Status</Text>
                </View>
                <Text style={styles.summarySubtitle}>
                  {summary.granted === summary.total
                    ? 'All permissions are enabled. FemmeFlo is ready for full on-field duty.'
                    : `${summary.granted} of ${summary.total} permissions enabled.`}
                </Text>
              </View>
              <Badge
                label={`${summary.granted}/${summary.total} ACTIVE`}
                variant={summary.granted === summary.total ? 'success' : 'info'}
              />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${summary.percentage}%`,
                    backgroundColor:
                      summary.granted === summary.total
                        ? BrandColors.green.primary
                        : BrandColors.pink.primary,
                  },
                ]}
              />
            </View>
          </Card>

          {/* Cards for each Permission */}
          {loading ? (
            <View style={{ gap: Spacing.sm }}>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            PERMISSION_ORDER.map((type) => {
              const meta = APP_PERMISSIONS_METADATA[type];
              const permResult = permissions?.[type];
              const visuals = getStatusVisuals(type, permResult);
              const iconColors = getPermissionIconColors(type);
              const isGranted = permResult?.granted || permResult?.status === 'granted';
              const isPermanentlyDenied =
                permResult?.status === 'permanently_denied' || permResult?.canAskAgain === false;
              const isRequesting = requestingType === type;

              return (
                <Card key={type} style={styles.permissionCard}>
                  {/* Top Row: Icon, Title & Status Badge */}
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: iconColors.bg,
                          borderColor: iconColors.border,
                        },
                      ]}
                    >
                      <Ionicons name={meta.iconName as any} size={22} color={iconColors.color} />
                    </View>

                    <View style={styles.titleColumn}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.cardTitle}>{meta.name}</Text>
                        {meta.required && (
                          <View style={styles.requiredTag}>
                            <Text style={styles.requiredTagText}>ESSENTIAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardDesc}>{meta.shortDesc}</Text>
                    </View>

                    <Badge label={visuals.label} variant={visuals.badgeVariant} size="sm" />
                  </View>

                  {/* Why App Needs It */}
                  <View style={styles.explanationBox}>
                    <Ionicons
                      name="information-circle-outline"
                      size={15}
                      color="#64748B"
                      style={{ marginRight: 6, marginTop: 1 }}
                    />
                    <Text style={styles.explanationText}>{meta.whyNeeded}</Text>
                  </View>

                  {/* Feature Tags */}
                  <View style={styles.tagsContainer}>
                    {meta.featuresUsedIn.map((feat, idx) => (
                      <View key={idx} style={styles.featurePill}>
                        <Text style={styles.featurePillText}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.actionRow}>
                    {type === 'storage' ? (
                      <View style={styles.storageGrantedRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={BrandColors.green.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.storageGrantedText}>
                          Protected Scoped Storage Active (No Personal File Access Needed)
                        </Text>
                      </View>
                    ) : isGranted ? (
                      <View style={styles.grantedStatusRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={BrandColors.green.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.grantedText}>Permission Active</Text>
                        <TouchableOpacity
                          style={styles.settingsLinkBtn}
                          onPress={openAppSettings}
                          accessibilityRole="button"
                          accessibilityLabel={`Change ${meta.name} in Android settings`}
                        >
                          <Text style={styles.settingsLinkText}>Change in Settings</Text>
                          <Ionicons
                            name="chevron-forward"
                            size={13}
                            color={BrandColors.pink.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : isPermanentlyDenied ? (
                      <Button
                        title="Open App Settings"
                        onPress={openAppSettings}
                        variant="outline"
                        size="sm"
                        style={styles.actionButton}
                        icon={
                          <Ionicons
                            name="settings-outline"
                            size={16}
                            color={BrandColors.pink.primary}
                          />
                        }
                      />
                    ) : (
                      <Button
                        title={isRequesting ? 'Requesting...' : `Allow ${meta.name}`}
                        onPress={() => handleAllowPress(type)}
                        variant="primary"
                        size="sm"
                        loading={isRequesting}
                        style={styles.actionButton}
                        icon={<Ionicons name="shield-outline" size={16} color="#FFFFFF" />}
                      />
                    )}
                  </View>
                </Card>
              );
            })
          )}

          {/* Bottom Controls: Open Android App Settings */}
          <Card style={styles.bottomSettingsCard}>
            <View style={styles.bottomCardHeader}>
              <View style={styles.settingsIconBox}>
                <Ionicons name="settings-sharp" size={22} color={BrandColors.pink.primary} />
              </View>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <Text style={styles.bottomCardTitle}>Android System Settings</Text>
                <Text style={styles.bottomCardDesc}>
                  You can manage Camera, Microphone, Notifications, Location, and Photos anytime in
                  your phone's system settings.
                </Text>
              </View>
            </View>

            <Button
              title="Open App Settings"
              onPress={openAppSettings}
              variant="outline"
              size="md"
              style={styles.openSettingsBigBtn}
              icon={<Ionicons name="open-outline" size={18} color={BrandColors.pink.primary} />}
            />
          </Card>

          {/* Privacy Information Banner */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#059669"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.privacyTitle}>Your Privacy is Protected</Text>
            </View>
            <Text style={styles.privacyDesc}>
              FemmeFlo only requests device permissions when necessary to record on-field sales,
              verify duty shifts, and onboard retail shops. We never access your device data without
              your consent. You can turn off any permission at any time.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Rationale Modal Dialog */}
      <Modal
        visible={Boolean(selectedRationalePerm)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedRationalePerm(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedRationalePerm(null)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {selectedRationalePerm && (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={[
                      styles.modalIconCircle,
                      {
                        backgroundColor:
                          getPermissionIconColors(selectedRationalePerm).bg,
                        borderColor:
                          getPermissionIconColors(selectedRationalePerm).border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={APP_PERMISSIONS_METADATA[selectedRationalePerm].iconName as any}
                      size={26}
                      color={getPermissionIconColors(selectedRationalePerm).color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      Allow {APP_PERMISSIONS_METADATA[selectedRationalePerm].name}?
                    </Text>
                    <Text style={styles.modalSubtitle}>Permission Rationale</Text>
                  </View>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalMainText}>
                    {APP_PERMISSIONS_METADATA[selectedRationalePerm].fullDesc}
                  </Text>

                  <View style={styles.modalWhyBox}>
                    <Text style={styles.modalWhyTitle}>Why it is needed:</Text>
                    <Text style={styles.modalWhyText}>
                      {APP_PERMISSIONS_METADATA[selectedRationalePerm].whyNeeded}
                    </Text>
                  </View>

                  <Text style={styles.modalFeaturesTitle}>Used for:</Text>
                  {APP_PERMISSIONS_METADATA[selectedRationalePerm].featuresUsedIn.map(
                    (feat, i) => (
                      <View key={i} style={styles.modalFeatureBulletRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={BrandColors.green.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.modalFeatureBulletText}>{feat}</Text>
                      </View>
                    )
                  )}
                </View>

                <View style={styles.modalFooterRow}>
                  <Button
                    title="Not Now"
                    variant="ghost"
                    size="md"
                    onPress={() => setSelectedRationalePerm(null)}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    title="Continue & Allow"
                    variant="primary"
                    size="md"
                    onPress={handleConfirmRationaleRequest}
                    style={{ flex: 1.5 }}
                    icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />}
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.md,
  },
  summaryCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  summaryInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  shieldBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  summaryTitle: {
    ...Typography.subtitle,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySubtitle: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  permissionCard: {
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  titleColumn: {
    flex: 1,
    paddingRight: Spacing.xs,
  },
  cardTitle: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  requiredTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.xs,
  },
  requiredTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B91C1C',
    letterSpacing: 0.5,
  },
  cardDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  explanationText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  featurePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    minWidth: 140,
    marginLeft: 'auto',
  },
  grantedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  grantedText: {
    fontSize: 13,
    fontWeight: '700',
    color: BrandColors.green.primary,
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.pink.subtle,
  },
  settingsLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.pink.primary,
    marginRight: 2,
  },
  storageGrantedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storageGrantedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    flex: 1,
  },
  bottomSettingsCard: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    ...Shadows.sm,
  },
  bottomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  settingsIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.pink.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bottomCardTitle: {
    ...Typography.bodyMedium,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  bottomCardDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  openSettingsBigBtn: {
    width: '100%',
  },
  privacyCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  privacyDesc: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 18,
  },
  // Modal Rationale Dialog styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  modalTitle: {
    ...Typography.subtitle,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.light.textTertiary,
  },
  modalBody: {
    marginBottom: Spacing.lg,
  },
  modalMainText: {
    ...Typography.body,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  modalWhyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalWhyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  modalWhyText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  modalFeaturesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFeatureBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalFeatureBulletText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
