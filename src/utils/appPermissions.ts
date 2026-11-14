// Safe platform & native module resolution without triggering Flow parse error in Node test runner
let Platform: { OS: 'android' | 'ios' | 'web' | 'node' | string; Version?: number | string } = {
  OS: 'android',
  Version: 34,
};
let PermissionsAndroid: any = null;
let Linking: any = null;
let AsyncStorage: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rn = require('react-native');
  if (rn) {
    if (rn.Platform) Platform = rn.Platform;
    if (rn.PermissionsAndroid) PermissionsAndroid = rn.PermissionsAndroid;
    if (rn.Linking) Linking = rn.Linking;
  }
} catch {
  Platform = { OS: 'node', Version: 34 };
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storageMod = require('@react-native-async-storage/async-storage');
  AsyncStorage = storageMod?.default ?? storageMod;
} catch {
  AsyncStorage = null;
}

// In-memory fallback for test environments if AsyncStorage is unavailable
const memoryStorage = new Map<string, string>();

async function getStorageItem(key: string): Promise<string | null> {
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    try {
      return await AsyncStorage.getItem(key);
    } catch {}
  }
  return memoryStorage.get(key) ?? null;
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
    try {
      await AsyncStorage.setItem(key, value);
      return;
    } catch {}
  }
  memoryStorage.set(key, value);
}

export type AppPermissionType =
  | 'camera'
  | 'microphone'
  | 'notifications'
  | 'photos'
  | 'location'
  | 'storage';

export type PermissionStatusState =
  | 'not_requested'
  | 'granted'
  | 'denied'
  | 'permanently_denied'
  | 'limited';

export interface PermissionCheckResult {
  type: AppPermissionType;
  status: PermissionStatusState;
  canAskAgain: boolean;
  granted: boolean;
  limited?: boolean;
  details?: string;
}

export interface PermissionMetadata {
  type: AppPermissionType;
  name: string;
  shortDesc: string;
  fullDesc: string;
  whyNeeded: string;
  iconName: string;
  featuresUsedIn: string[];
  androidPermission?: string;
  required: boolean;
}

export const APP_PERMISSIONS_METADATA: Record<AppPermissionType, PermissionMetadata> = {
  camera: {
    type: 'camera',
    name: 'Camera',
    shortDesc: 'Take photos using your device camera.',
    fullDesc:
      'Allow FemmeFlo to take shop verification photos and selfie checks during shift punch-in.',
    whyNeeded:
      'Needed for shift punch-in verification and taking photos of new customer shops on the field.',
    iconName: 'camera-outline',
    featuresUsedIn: [
      'Shift Punch-in Verification',
      'New Customer Shop Onboarding',
      'Stock Damage Proof',
    ],
    androidPermission: 'android.permission.CAMERA',
    required: true,
  },
  microphone: {
    type: 'microphone',
    name: 'Microphone',
    shortDesc: 'Record audio when using supported features.',
    fullDesc:
      'Allow FemmeFlo to record your voice when providing customer feedback or spoken notes in Hindi, Hinglish, or English.',
    whyNeeded:
      'Needed to translate spoken customer feedback into written reports without typing.',
    iconName: 'mic-outline',
    featuresUsedIn: [
      'Voice Feedback Translation (Hindi/Hinglish)',
      'Shift Notes & Summaries',
      'Customer Visit Notes',
    ],
    androidPermission: 'android.permission.RECORD_AUDIO',
    required: false,
  },
  notifications: {
    type: 'notifications',
    name: 'Notifications',
    shortDesc: 'Receive important updates and alerts.',
    fullDesc:
      'Allow FemmeFlo to send push alerts when sales are booked, stock is moved, or shifts are started.',
    whyNeeded:
      'Keeps you updated in real-time when new orders arrive, price approvals are decided, or shifts start.',
    iconName: 'notifications-outline',
    featuresUsedIn: [
      'Sales Order Alerts',
      'Price Floor Approvals',
      'Stock Movement Updates',
      'Shift & Beat Reminders',
    ],
    androidPermission: 'android.permission.POST_NOTIFICATIONS',
    required: false,
  },
  photos: {
    type: 'photos',
    name: 'Photos & Media',
    shortDesc: 'Select photos and files from your device.',
    fullDesc:
      'Allow FemmeFlo to select photos and payment receipts from your device gallery using the secure Android Photo Picker.',
    whyNeeded:
      'Needed to attach existing storefront pictures, payment proof, or invoice receipts.',
    iconName: 'images-outline',
    featuresUsedIn: [
      'Payment Slip Uploads',
      'Customer Storefront Photos',
      'Invoice Document Attachment',
    ],
    androidPermission: 'android.permission.READ_MEDIA_IMAGES',
    required: true,
  },
  location: {
    type: 'location',
    name: 'Location (GPS)',
    shortDesc: 'Record shop visit and shift punch-in coordinates.',
    fullDesc:
      'Allow FemmeFlo to record accurate GPS coordinates for store onboarding and beat distance calculations.',
    whyNeeded:
      'Needed to verify that customer visits and shift punch-ins are conducted on the field.',
    iconName: 'location-outline',
    featuresUsedIn: [
      'Shift Punch-in & Punch-out GPS',
      'Customer Shop Geo-tagging',
      'Beat Distance & Odometer Audit',
    ],
    androidPermission: 'android.permission.ACCESS_FINE_LOCATION',
    required: true,
  },
  storage: {
    type: 'storage',
    name: 'Device Storage',
    shortDesc: 'Save receipts and store offline records safely.',
    fullDesc:
      'FemmeFlo uses Android Scoped Storage to save offline orders, draft shifts, and invoices in private app memory without scanning personal files.',
    whyNeeded:
      'Enables offline working when internet connectivity in rural villages is weak.',
    iconName: 'folder-outline',
    featuresUsedIn: [
      'Offline Sales Drafts & Queues',
      'Local Shift Logs & Cache',
      'PDF & Receipt Offline Storage',
    ],
    required: true,
  },
};

const PERM_STORAGE_PREFIX = '@femmeflo:perm_requested_';

/**
 * Checks if a permission was previously requested from the user.
 */
async function wasRequestedBefore(type: AppPermissionType): Promise<boolean> {
  const val = await getStorageItem(`${PERM_STORAGE_PREFIX}${type}`);
  return val === 'true';
}

/**
 * Marks that a permission was requested at least once.
 */
async function setRequestedBefore(type: AppPermissionType): Promise<void> {
  await setStorageItem(`${PERM_STORAGE_PREFIX}${type}`, 'true');
}

/**
 * Check the current status of an individual permission.
 */
export async function checkPermission(type: AppPermissionType): Promise<PermissionCheckResult> {
  // Device Storage is modern Android Scoped Storage (always securely available without broad device access)
  if (type === 'storage') {
    return {
      type: 'storage',
      status: 'granted',
      canAskAgain: false,
      granted: true,
      details: 'Protected Android Scoped Storage',
    };
  }

  // Node.js test environment or non-native mock fallback
  if (Platform.OS !== 'android') {
    if (Platform.OS === 'web') {
      return checkWebPermission(type);
    }
    const wasReq = await wasRequestedBefore(type);
    return {
      type,
      status: wasReq ? 'granted' : 'not_requested',
      canAskAgain: true,
      granted: wasReq,
    };
  }

  // Native Android Platform Check
  try {
    const wasReq = await wasRequestedBefore(type);
    if (!PermissionsAndroid) {
      return { type, status: wasReq ? 'granted' : 'not_requested', canAskAgain: true, granted: wasReq };
    }

    switch (type) {
      case 'camera': {
        const hasCamera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (hasCamera) {
          return { type: 'camera', status: 'granted', canAskAgain: true, granted: true };
        }
        return {
          type: 'camera',
          status: wasReq ? 'denied' : 'not_requested',
          canAskAgain: true,
          granted: false,
        };
      }

      case 'microphone': {
        const hasMic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (hasMic) {
          return { type: 'microphone', status: 'granted', canAskAgain: true, granted: true };
        }
        return {
          type: 'microphone',
          status: wasReq ? 'denied' : 'not_requested',
          canAskAgain: true,
          granted: false,
        };
      }

      case 'notifications': {
        // Android 13+ (API 33+) requires POST_NOTIFICATIONS
        const androidVersion =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(String(Platform.Version || 33), 10);

        if (androidVersion >= 33) {
          const permName = PermissionsAndroid.PERMISSIONS?.POST_NOTIFICATIONS;
          if (permName) {
            const hasNotif = await PermissionsAndroid.check(permName);
            if (hasNotif) {
              return { type: 'notifications', status: 'granted', canAskAgain: true, granted: true };
            }
          }
        } else {
          // On Android 12 and below, notifications are enabled by default on install
          const storedPref = await getStorageItem('@femmeflo:mobile_notifications_enabled');
          const enabled = storedPref !== 'false';
          return {
            type: 'notifications',
            status: enabled ? 'granted' : 'denied',
            canAskAgain: true,
            granted: enabled,
          };
        }

        return {
          type: 'notifications',
          status: wasReq ? 'denied' : 'not_requested',
          canAskAgain: true,
          granted: false,
        };
      }

      case 'photos': {
        const androidVersion =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(String(Platform.Version || 33), 10);

        if (androidVersion >= 33) {
          const permName = PermissionsAndroid.PERMISSIONS?.READ_MEDIA_IMAGES;
          if (permName) {
            const hasMedia = await PermissionsAndroid.check(permName);
            if (hasMedia) {
              return { type: 'photos', status: 'granted', canAskAgain: true, granted: true };
            }
          }
        } else {
          const hasStorage = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS?.READ_EXTERNAL_STORAGE
          );
          if (hasStorage) {
            return { type: 'photos', status: 'granted', canAskAgain: true, granted: true };
          }
        }

        if (androidVersion >= 34) {
          const partialPerm = PermissionsAndroid.PERMISSIONS?.READ_MEDIA_VISUAL_USER_SELECTED;
          if (partialPerm) {
            const hasPartial = await PermissionsAndroid.check(partialPerm);
            if (hasPartial) {
              return {
                type: 'photos',
                status: 'limited',
                canAskAgain: true,
                granted: true,
                limited: true,
                details: 'Selected photos access',
              };
            }
          }
        }

        return {
          type: 'photos',
          status: wasReq ? 'denied' : 'not_requested',
          canAskAgain: true,
          granted: false,
        };
      }

      case 'location': {
        const hasFine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS?.ACCESS_FINE_LOCATION
        );
        if (hasFine) {
          return { type: 'location', status: 'granted', canAskAgain: true, granted: true };
        }

        const hasCoarse = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS?.ACCESS_COARSE_LOCATION
        );
        if (hasCoarse) {
          return {
            type: 'location',
            status: 'limited',
            canAskAgain: true,
            granted: true,
            limited: true,
            details: 'Approximate location only',
          };
        }

        return {
          type: 'location',
          status: wasReq ? 'denied' : 'not_requested',
          canAskAgain: true,
          granted: false,
        };
      }
    }
  } catch (err) {
    console.warn(`[appPermissions] Failed to check status for ${type}:`, err);
  }

  return {
    type,
    status: 'not_requested',
    canAskAgain: true,
    granted: false,
  };
}

/**
 * Check permission in Web browser environment.
 */
async function checkWebPermission(type: AppPermissionType): Promise<PermissionCheckResult> {
  const wasReq = await wasRequestedBefore(type);

  if (type === 'notifications') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return { type: 'notifications', status: 'granted', canAskAgain: true, granted: true };
      }
      if (Notification.permission === 'denied') {
        return {
          type: 'notifications',
          status: 'permanently_denied',
          canAskAgain: false,
          granted: false,
        };
      }
    }
    return {
      type: 'notifications',
      status: wasReq ? 'denied' : 'not_requested',
      canAskAgain: true,
      granted: false,
    };
  }

  return {
    type,
    status: wasReq ? 'granted' : 'not_requested',
    canAskAgain: true,
    granted: wasReq,
  };
}

/**
 * Request an individual permission from the user.
 */
export async function requestPermission(type: AppPermissionType): Promise<PermissionCheckResult> {
  if (type === 'storage') {
    return {
      type: 'storage',
      status: 'granted',
      canAskAgain: false,
      granted: true,
      details: 'Protected Android Scoped Storage',
    };
  }

  await setRequestedBefore(type);

  // Web Browser Request
  if (Platform.OS === 'web') {
    if (type === 'notifications' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          await setStorageItem('@femmeflo:mobile_notifications_enabled', 'true');
          return { type: 'notifications', status: 'granted', canAskAgain: true, granted: true };
        }
        return {
          type: 'notifications',
          status: 'denied',
          canAskAgain: false,
          granted: false,
        };
      } catch {
        return { type: 'notifications', status: 'denied', canAskAgain: false, granted: false };
      }
    }

    return { type, status: 'granted', canAskAgain: true, granted: true };
  }

  // Non-Android fallback (e.g. Node tests)
  if (Platform.OS !== 'android' || !PermissionsAndroid) {
    return { type, status: 'granted', canAskAgain: true, granted: true };
  }

  // Native Android Permission Request
  try {
    const androidVersion =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version || 33), 10);

    let permissionToRequest: string | null = null;
    let rationaleConfig = {
      title: `${APP_PERMISSIONS_METADATA[type].name} Permission`,
      message: APP_PERMISSIONS_METADATA[type].whyNeeded,
      buttonPositive: 'Allow',
      buttonNegative: 'Not Now',
      buttonNeutral: 'Ask Later',
    };

    switch (type) {
      case 'camera':
        permissionToRequest = PermissionsAndroid.PERMISSIONS?.CAMERA;
        break;

      case 'microphone':
        permissionToRequest = PermissionsAndroid.PERMISSIONS?.RECORD_AUDIO;
        break;

      case 'notifications':
        if (androidVersion >= 33) {
          permissionToRequest = PermissionsAndroid.PERMISSIONS?.POST_NOTIFICATIONS;
        } else {
          await setStorageItem('@femmeflo:mobile_notifications_enabled', 'true');
          return { type: 'notifications', status: 'granted', canAskAgain: true, granted: true };
        }
        break;

      case 'photos':
        if (androidVersion >= 33) {
          permissionToRequest = PermissionsAndroid.PERMISSIONS?.READ_MEDIA_IMAGES;
        } else {
          permissionToRequest = PermissionsAndroid.PERMISSIONS?.READ_EXTERNAL_STORAGE;
        }
        break;

      case 'location':
        permissionToRequest = PermissionsAndroid.PERMISSIONS?.ACCESS_FINE_LOCATION;
        break;
    }

    if (!permissionToRequest) {
      return { type, status: 'granted', canAskAgain: true, granted: true };
    }

    const res = await PermissionsAndroid.request(permissionToRequest, rationaleConfig);

    if (res === PermissionsAndroid.RESULTS?.GRANTED) {
      if (type === 'notifications') {
        await setStorageItem('@femmeflo:mobile_notifications_enabled', 'true');
      }
      return { type, status: 'granted', canAskAgain: true, granted: true };
    }

    if (res === PermissionsAndroid.RESULTS?.NEVER_ASK_AGAIN) {
      return {
        type,
        status: 'permanently_denied',
        canAskAgain: false,
        granted: false,
      };
    }

    return {
      type,
      status: 'denied',
      canAskAgain: true,
      granted: false,
    };
  } catch (err) {
    console.warn(`[appPermissions] Request failed for ${type}:`, err);
    return {
      type,
      status: 'denied',
      canAskAgain: true,
      granted: false,
    };
  }
}

/**
 * Check all 6 permissions in parallel.
 */
export async function checkAllPermissions(): Promise<Record<AppPermissionType, PermissionCheckResult>> {
  const types: AppPermissionType[] = [
    'camera',
    'microphone',
    'notifications',
    'photos',
    'location',
    'storage',
  ];

  const results = await Promise.all(types.map((t) => checkPermission(t)));

  const map = {} as Record<AppPermissionType, PermissionCheckResult>;
  for (const r of results) {
    map[r.type] = r;
  }
  return map;
}

/**
 * Open the application's page in the device's System Settings.
 */
export async function openAppSettings(): Promise<void> {
  try {
    if (Linking && typeof Linking.openSettings === 'function') {
      await Linking.openSettings();
    }
  } catch (err) {
    console.warn('[appPermissions] Failed to open app settings:', err);
  }
}
