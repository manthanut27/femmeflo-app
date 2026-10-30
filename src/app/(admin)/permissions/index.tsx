import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminApi } from '@/api/admin';
import type { PublicUser } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
import {
  MANAGER_PERMISSIONS,
  PERMISSION_METADATA,
  hasPermission,
  syncPermissionAliases,
} from '@/utils/permissions';

export default function AdminPermissionsScreen() {
  const router = useRouter();

  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [scopeMode, setScopeMode] = useState<'specific' | 'overall'>('specific');
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [overallPermissions, setOverallPermissions] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedManager = managers.find((m) => m.id === selectedManagerId);

  const loadData = useCallback(async () => {
    try {
      const [permRes, mgrRes] = await Promise.all([
        adminApi.listPermissions().catch(() => ({ permissions: Array.from(MANAGER_PERMISSIONS) })),
        adminApi.listManagers({ pageSize: 100 }).catch(() => ({ items: [] })),
      ]);

      const mgrList = mgrRes.items || (mgrRes as any).managers || [];
      setManagers(mgrList);

      if (mgrList.length > 0) {
        const currentMgr = selectedManagerId
          ? mgrList.find((m: PublicUser) => m.id === selectedManagerId) || mgrList[0]
          : mgrList[0];

        setSelectedManagerId(currentMgr.id);
        const mgrPerms = MANAGER_PERMISSIONS.filter((p) => hasPermission(currentMgr, p));
        setActivePermissions(mgrPerms);
        setOverallPermissions(mgrPerms);
      }
    } catch (err: any) {
      console.warn('Failed to load permissions matrix', err);
      Alert.alert('Error', err?.message || 'Failed to load permissions data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedManagerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSelectManager = (mgr: PublicUser) => {
    setSelectedManagerId(mgr.id);
    const mgrPerms = MANAGER_PERMISSIONS.filter((p) => hasPermission(mgr, p));
    setActivePermissions(mgrPerms);
  };

  const handleTogglePermission = (permissionKey: string) => {
    if (scopeMode === 'specific') {
      setActivePermissions((prev) =>
        prev.includes(permissionKey)
          ? prev.filter((p) => p !== permissionKey)
          : [...prev, permissionKey]
      );
    } else {
      setOverallPermissions((prev) =>
        prev.includes(permissionKey)
          ? prev.filter((p) => p !== permissionKey)
          : [...prev, permissionKey]
      );
    }
  };

  const handleSavePermissions = () => {
    const isOverall = scopeMode === 'overall';
    const rawList = isOverall ? overallPermissions : activePermissions;
    const finalPermissions = syncPermissionAliases(rawList);

    const targetTitle = isOverall
      ? `all ${managers.length} Territory Managers`
      : `Manager "${selectedManager?.name || 'Selected'}"`;

    Alert.alert(
      'Confirm Security Permission Changes',
      `Apply updated operational permissions to ${targetTitle}?\n\nGranted privileges:\n${
        rawList.length > 0
          ? rawList.map((p) => `• ${PERMISSION_METADATA[p]?.label || p}`).join('\n')
          : '• None (All restricted)'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Permissions',
          onPress: async () => {
            setSaving(true);
            try {
              if (isOverall) {
                const res = await adminApi.updateOverallPermissions(finalPermissions);
                Alert.alert(
                  'Success',
                  `Security privileges broadcast across all ${res.count || managers.length} managers successfully.`
                );
              } else {
                await adminApi.updateManagerPermissions(selectedManagerId, finalPermissions);
                Alert.alert(
                  'Success',
                  `Security privileges updated for ${selectedManager?.name || 'Manager'}.`
                );
              }
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to update manager permissions.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Manager Permissions"
        subtitle="Role privileges and operational access control matrix"
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
          {/* Scope Mode Selector */}
          <Card style={styles.scopeCard}>
            <Text style={styles.scopeCardTitle}>Authorization Scope</Text>
            <View style={styles.scopeToggleRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, scopeMode === 'specific' && styles.scopeBtnActive]}
                onPress={() => setScopeMode('specific')}
                accessibilityRole="button"
                accessibilityLabel="Individual Manager Scope"
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={scopeMode === 'specific' ? '#FFFFFF' : Colors.light.textSecondary}
                />
                <Text style={[styles.scopeBtnText, scopeMode === 'specific' && styles.scopeBtnTextActive]}>
                  Individual Manager
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.scopeBtn, scopeMode === 'overall' && styles.scopeBtnActive]}
                onPress={() => setScopeMode('overall')}
                accessibilityRole="button"
                accessibilityLabel="All Managers Scope"
              >
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={scopeMode === 'overall' ? '#FFFFFF' : Colors.light.textSecondary}
                />
                <Text style={[styles.scopeBtnText, scopeMode === 'overall' && styles.scopeBtnTextActive]}>
                  Global (All Managers)
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Individual Manager Selection */}
          {scopeMode === 'specific' ? (
            <View style={styles.managerSection}>
              <Text style={styles.sectionHeading}>Select Territory Manager</Text>
              {loading ? (
                <CardSkeleton />
              ) : managers.length === 0 ? (
                <Text style={styles.emptyText}>No Territory Managers registered yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managerListRow}>
                  {managers.map((m) => {
                    const isSelected = m.id === selectedManagerId;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.managerChip, isSelected && styles.managerChipActive]}
                        onPress={() => handleSelectManager(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${m.name}`}
                      >
                        <Text style={[styles.managerChipName, isSelected && styles.managerChipNameActive]}>
                          {m.name}
                        </Text>
                        <Text style={[styles.managerChipTerritory, isSelected && styles.managerChipTerritoryActive]}>
                          {[m.district, m.state].filter(Boolean).join(', ') || 'Territory'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            <Card style={styles.overallNoticeCard}>
              <Ionicons name="information-circle-outline" size={20} color={BrandColors.pink.dark} />
              <Text style={styles.overallNoticeText}>
                Changes saved in Global mode will be updated across all {managers.length} Territory Managers simultaneously.
              </Text>
            </Card>
          )}

          {/* Permissions Matrix */}
          <Text style={styles.sectionHeading}>
            {scopeMode === 'specific'
              ? `Privileges for ${selectedManager?.name || 'Selected Manager'}`
              : 'Global Standard Privileges'}
          </Text>

          <Card style={styles.matrixCard}>
            {MANAGER_PERMISSIONS.map((permKey, idx) => {
              const meta = PERMISSION_METADATA[permKey];
              const isEnabled =
                scopeMode === 'specific'
                  ? activePermissions.includes(permKey)
                  : overallPermissions.includes(permKey);

              return (
                <View
                  key={permKey}
                  style={[
                    styles.permRow,
                    idx < MANAGER_PERMISSIONS.length - 1 && styles.permRowBorder,
                  ]}
                >
                  <View style={{ flex: 1, marginRight: Spacing.md }}>
                    <Text style={styles.permLabel}>{meta?.label || permKey}</Text>
                    <Text style={styles.permDesc}>{meta?.description || ''}</Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => handleTogglePermission(permKey)}
                    trackColor={{ false: '#CBD5E1', true: BrandColors.pink.tint }}
                    thumbColor={isEnabled ? BrandColors.pink.dark : '#F8FAFC'}
                  />
                </View>
              );
            })}
          </Card>

          <View style={styles.saveBtnBox}>
            <Button
              title={saving ? 'Applying...' : 'Save Security Privileges'}
              variant="admin"
              size="lg"
              onPress={handleSavePermissions}
              loading={saving}
              icon={<Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />}
            />
          </View>
        </View>
      </ScrollView>
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
  scopeCard: {
    padding: Spacing.md,
  },
  scopeCardTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
  },
  scopeToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: 4,
    gap: 4,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  scopeBtnActive: {
    backgroundColor: BrandColors.pink.primary,
  },
  scopeBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  scopeBtnTextActive: {
    color: '#FFFFFF',
  },
  managerSection: {
    gap: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
  },
  managerListRow: {
    flexDirection: 'row',
    marginVertical: Spacing.xs,
  },
  managerChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: Spacing.sm,
  },
  managerChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  managerChipName: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  managerChipNameActive: {
    color: '#FFFFFF',
  },
  managerChipTerritory: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  managerChipTerritoryActive: {
    color: '#94A3B8',
  },
  overallNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFF1F2',
    borderColor: BrandColors.pink.subtle,
  },
  overallNoticeText: {
    ...Typography.caption,
    color: Colors.light.text,
    flex: 1,
    fontWeight: '600',
  },
  matrixCard: {
    padding: Spacing.md,
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  permRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  permLabel: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.light.text,
  },
  permDesc: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  saveBtnBox: {
    marginTop: Spacing.sm,
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    fontStyle: 'italic',
  },
});
