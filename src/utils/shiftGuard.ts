import { Alert } from 'react-native';
import { sellerApi } from '@/api/seller';
import type { Shift } from '@/api/types';
import { draftStorage } from '@/utils/draftStorage';

export interface ShiftStatusResult {
  hasActiveShift: boolean;
  shift: Shift | null;
}

/**
 * Checks whether the current user has an active duty shift.
 * Fallbacks to offline draft storage if network is slow or unreachable.
 */
export async function checkHasActiveShift(userId?: string): Promise<ShiftStatusResult> {
  try {
    let activeShift: Shift | null = null;

    try {
      const res = await sellerApi.getCurrentShift();
      activeShift = (res as any)?.shift ?? (res as any)?.data?.shift ?? (res as any)?.data ?? null;
    } catch {
      // Offline fallback: check local cached shift
    }

    if (!activeShift && userId) {
      activeShift = await draftStorage.getActiveShift(userId).catch(() => null);
    }

    // Merge startOdometerKm from local draft if server returned null
    if (activeShift && userId && activeShift.startOdometerKm == null) {
      const cached = await draftStorage.getActiveShift(userId).catch(() => null);
      if (cached?.startOdometerKm != null) {
        activeShift = {
          ...activeShift,
          startOdometerKm: cached.startOdometerKm,
        };
      }
    }

    const isActive = Boolean(
      activeShift &&
        typeof activeShift === 'object' &&
        (activeShift as any).startTime &&
        !(activeShift as any).endTime
    );

    return {
      hasActiveShift: isActive,
      shift: isActive ? activeShift : null,
    };
  } catch {
    return {
      hasActiveShift: false,
      shift: null,
    };
  }
}

/**
 * Guards an action by prompting the user if no duty shift is active.
 * Returns true if shift is active, false if blocked.
 */
export async function requireActiveShift(
  userId: string | undefined,
  actionName = 'perform this action',
  onStartShift?: () => void
): Promise<boolean> {
  const status = await checkHasActiveShift(userId);
  if (status.hasActiveShift) {
    return true;
  }

  Alert.alert(
    'Duty Shift Required',
    `Please start your daily shift before you ${actionName}.`,
    [
      {
        text: 'Start Shift Now',
        onPress: () => {
          if (onStartShift) {
            onStartShift();
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );

  return false;
}

