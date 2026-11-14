import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  AppPermissionType,
  checkAllPermissions,
  openAppSettings,
  PermissionCheckResult,
  requestPermission,
} from '../utils/appPermissions';

export function useAppPermissions() {
  const [permissions, setPermissions] = useState<Record<AppPermissionType, PermissionCheckResult> | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingType, setRequestingType] = useState<AppPermissionType | null>(null);

  const refreshPermissions = useCallback(async () => {
    try {
      const results = await checkAllPermissions();
      setPermissions(results);
    } catch (err) {
      console.warn('[useAppPermissions] Failed to check permissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  // Re-check when app returns to foreground from Android Settings
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshPermissions();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [refreshPermissions]);

  // Re-check on screen focus
  useFocusEffect(
    useCallback(() => {
      refreshPermissions();
    }, [refreshPermissions])
  );

  const handleRequestPermission = useCallback(
    async (type: AppPermissionType): Promise<PermissionCheckResult> => {
      setRequestingType(type);
      try {
        const res = await requestPermission(type);
        setPermissions((prev) => (prev ? { ...prev, [type]: res } : null));
        return res;
      } finally {
        setRequestingType(null);
      }
    },
    []
  );

  return {
    permissions,
    loading,
    requestingType,
    refreshPermissions,
    requestPermission: handleRequestPermission,
    openAppSettings,
  };
}
