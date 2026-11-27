import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { BrandColors, Colors, Radius, Spacing, Typography } from '@/constants/theme';
import {
  MANAGER_PERMISSIONS,
  PERMISSION_METADATA,
  type ManagerPermissionKey,
} from '@/utils/permissions';

export interface ManagerPermissionsMatrixCardProps {
  selectedPermissions: string[];
  onTogglePermission: (permKey: ManagerPermissionKey) => void;
  onChangePermissions?: (nextPermissions: ManagerPermissionKey[]) => void;
  accentVariant?: 'pink' | 'green';
  showSelectAllBar?: boolean;
}

/**
 * Shared 7-permission toggle matrix matching Permission Manager so manager creation
 * and manager editing expose the exact same operational permission set.
 */
export function ManagerPermissionsMatrixCard({
  selectedPermissions,
  onTogglePermission,
  onChangePermissions,
  accentVariant = 'pink',
  showSelectAllBar = false,
}: ManagerPermissionsMatrixCardProps) {
  const trackTrueColor = accentVariant === 'green' ? BrandColors.green.tint : BrandColors.pink.tint;
  const thumbTrueColor = accentVariant === 'green' ? BrandColors.green.primary : BrandColors.pink.dark;
  const actionTextColor = accentVariant === 'green' ? BrandColors.green.primary : BrandColors.pink.dark;

  const enabledCount = MANAGER_PERMISSIONS.filter((key) => selectedPermissions.includes(key)).length;
  const allSelected = enabledCount === MANAGER_PERMISSIONS.length;

  return (
    <Card style={styles.matrixCard}>
      {showSelectAllBar ? (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {enabledCount} of {MANAGER_PERMISSIONS.length} permissions enabled
          </Text>
          {onChangePermissions ? (
            <TouchableOpacity
              onPress={() =>
                onChangePermissions(allSelected ? [] : Array.from(MANAGER_PERMISSIONS))
              }
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={allSelected ? 'Clear all manager permissions' : 'Select all manager permissions'}
            >
              <Text style={[styles.selectAllText, { color: actionTextColor }]}>
                {allSelected ? 'Clear All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {MANAGER_PERMISSIONS.map((permKey, idx) => {
        const meta = PERMISSION_METADATA[permKey];
        const isEnabled = selectedPermissions.includes(permKey);

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
              {meta?.description ? (
                <Text style={styles.permDesc}>{meta.description}</Text>
              ) : null}
            </View>
            <Switch
              value={isEnabled}
              onValueChange={() => onTogglePermission(permKey)}
              trackColor={{ false: '#CBD5E1', true: trackTrueColor }}
              thumbColor={isEnabled ? thumbTrueColor : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel={meta?.label || permKey}
              accessibilityState={{ checked: isEnabled }}
            />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  matrixCard: {
    padding: Spacing.md,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderSubtle,
  },
  summaryText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  selectAllText: {
    ...Typography.caption,
    fontWeight: '800',
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
});
