import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

export type PanelDashboardRoute = '/(admin)' | '/(manager)' | '/(seller)';

/**
 * Resolves the canonical panel Dashboard/Home route for a given user role.
 */
export function getRoleDashboardRoute(role?: string | null): PanelDashboardRoute {
  if (role === 'SUPER_ADMIN') return '/(admin)';
  if (role === 'MANAGER') return '/(manager)';
  return '/(seller)';
}

/**
 * Provides a direct-to-dashboard back handler for panel sub-pages and registers
 * a focus-scoped Android hardware back listener so sibling tab/sidebar history
 * never traps users on previous pages.
 */
export function useDashboardBackHandler(
  targetRoute: string = '/(admin)',
  enabled: boolean = true
) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.replace(targetRoute as any);
  }, [router, targetRoute]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [enabled, handleBack])
  );

  return handleBack;
}
