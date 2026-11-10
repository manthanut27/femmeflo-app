import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  DropdownTrigger,
  SearchableDropdownModal,
  type DropdownOption,
} from '@/components/ui/SearchableDropdownModal';
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
  sanitizeBackendPermissions,
  syncPermissionAliases,
} from '@/utils/permissions';

export default function AdminPermissionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();

  const handleBack = useCallback(() => {
    try {
      (navigation as any).navigate('actions/index');
    } catch {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(admin)/actions' as any);
      }
    }
  }, [navigation, router]);

  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const [managers, setManagers] = useState<PublicUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [scopeMode, setScopeMode] = useState<'specific' | 'overall'>('specific');
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [overallPermissions, setOverallPermissions] = useState<string[]>([]);
  const [managerPickerVisible, setManagerPickerVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedManager = managers.find((m) => m.id === selectedManagerId);

  const managerOptions: DropdownOption[] = useMemo(() => {
    return managers.map((m) => {
      const territory = [m.district, m.state].filter(Boolean).join(', ') || m.address || 'Territory';
      const contact = m.phone ? ` • +91 ${m.phone}` : '';
      return {
        id: m.id,
        title: m.name || 'Unnamed Manager',
        subtitle: `${territory}${contact}`,
        badge: m.active ? 'ACTIVE' : 'INACTIVE',
        badgeVariant: (m.active ? 'ACTIVE' : 'INACTIVE') as any,
        icon: 'person-circle-outline',
      };
    });
  }, [managers]);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
    const finalPermissions = sanitizeBackendPermissions(rawList);

    const targetTitle = isOverall
      ? `all ${managers.length} Territory Managers`
      : `Manager "${selectedManager?.name || 'Selected'}"`;

    Alert.alert(
      'Save Permissions?',
      `Save these permissions for ${targetTitle}?\n\nPermissions:\n${
        rawList.length > 0
          ? rawList.map((p) => `• ${PERMISSION_METADATA[p]?.label || p}`).join('\n')
          : '• None (All turned off)'
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
                  'Permissions Saved',
                  `Permissions saved for all ${res.count || managers.length} managers.`
                );
              } else {
                await adminApi.updateManagerPermissions(selectedManagerId, finalPermissions);
                Alert.alert(
                  'Permissions Saved',
                  `Permissions saved for ${selectedManager?.name || 'Manager'}.`
                );
              }
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to save manager permissions.');
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
            accessibilityLabel="Back to administrative actions"
            onPress={handleBack}
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
                <DropdownTrigger
                  label="Territory Manager"
                  required
                  value={selectedManager?.name}
                  subtitle={
                    selectedManager
                      ? `${[selectedManager.district, selectedManager.state].filter(Boolean).join(', ') || 'Territory'}${selectedManager.phone ? ` • +91 ${selectedManager.phone}` : ''}`
                      : 'Search and select manager...'
                  }
                  badge={selectedManager ? (selectedManager.active ? 'ACTIVE' : 'INACTIVE') : undefined}
                  icon="person"
                  placeholder="Search and select territory manager..."
                  onPress={() => setManagerPickerVisible(true)}
                />
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

      {/* Searchable Manager Dropdown Modal */}
      <SearchableDropdownModal
        visible={managerPickerVisible}
        title="Select Territory Manager"
        searchPlaceholder="Search manager by name, phone, district..."
        options={managerOptions}
        selectedId={selectedManagerId}
        onSelect={(opt) => {
          const mgr = managers.find((m) => m.id === opt.id);
          if (mgr) {
            handleSelectManager(mgr);
          }
          setManagerPickerVisible(false);
        }}
        onClose={() => setManagerPickerVisible(false)}
        emptyMessage="No territory managers found"
      />
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
    gap: Spacing.sm,
  },
  sectionHeading: {
    ...Typography.subtitle,
    fontWeight: '700',
    color: Colors.light.text,
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
