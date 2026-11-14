import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_PERMISSIONS_METADATA,
  checkAllPermissions,
  checkPermission,
  openAppSettings,
  requestPermission,
} from '../utils/appPermissions.ts';
import type { AppPermissionType } from '../utils/appPermissions.ts';

describe('FemmeFlo Android App Permission Management Suite', () => {
  it('verifies all 6 core app permissions are defined with rich village-friendly metadata', () => {
    const requiredTypes: AppPermissionType[] = [
      'camera',
      'microphone',
      'notifications',
      'photos',
      'location',
      'storage',
    ];

    for (const type of requiredTypes) {
      const meta = APP_PERMISSIONS_METADATA[type];
      assert.ok(meta, `Permission metadata for ${type} must exist`);
      assert.strictEqual(meta.type, type);
      assert.ok(meta.name && meta.name.length > 0, `${type} must have a clear display name`);
      assert.ok(meta.shortDesc && meta.shortDesc.length > 0, `${type} must have shortDesc`);
      assert.ok(meta.fullDesc && meta.fullDesc.length > 0, `${type} must have fullDesc`);
      assert.ok(meta.whyNeeded && meta.whyNeeded.length > 0, `${type} must explain whyNeeded`);
      assert.ok(meta.iconName && meta.iconName.length > 0, `${type} must define iconName`);
      assert.ok(
        Array.isArray(meta.featuresUsedIn) && meta.featuresUsedIn.length > 0,
        `${type} must list features used in`
      );
    }
  });

  it('verifies Camera permission metadata explains shift selfie & shop verification', () => {
    const camera = APP_PERMISSIONS_METADATA.camera;
    assert.strictEqual(camera.name, 'Camera');
    assert.strictEqual(camera.androidPermission, 'android.permission.CAMERA');
    assert.strictEqual(camera.required, true);
    assert.ok(
      camera.whyNeeded.includes('punch-in') || camera.whyNeeded.includes('shops'),
      'Camera must explain on-ground punch-in and shop verification'
    );
  });

  it('verifies Microphone permission metadata explains Hindi/Hinglish voice feedback', () => {
    const mic = APP_PERMISSIONS_METADATA.microphone;
    assert.strictEqual(mic.name, 'Microphone');
    assert.strictEqual(mic.androidPermission, 'android.permission.RECORD_AUDIO');
    assert.strictEqual(mic.required, false);
    assert.ok(
      mic.featuresUsedIn.some((f) => f.includes('Voice') || f.includes('Hindi')),
      'Microphone must mention voice feedback / translation'
    );
  });

  it('verifies Notification permission metadata supports real-time alerts', () => {
    const notif = APP_PERMISSIONS_METADATA.notifications;
    assert.strictEqual(notif.name, 'Notifications');
    assert.strictEqual(notif.androidPermission, 'android.permission.POST_NOTIFICATIONS');
    assert.ok(
      notif.featuresUsedIn.some((f) => f.includes('Alerts') || f.includes('Orders')),
      'Notifications must mention sales or approval alerts'
    );
  });

  it('verifies Photos permission metadata handles Android Photo Picker & payment receipts', () => {
    const photos = APP_PERMISSIONS_METADATA.photos;
    assert.strictEqual(photos.name, 'Photos & Media');
    assert.strictEqual(photos.androidPermission, 'android.permission.READ_MEDIA_IMAGES');
    assert.ok(
      photos.whyNeeded.includes('receipts') || photos.whyNeeded.includes('storefront'),
      'Photos must mention receipts or storefront pictures'
    );
  });

  it('verifies Location permission metadata covers GPS for punch-in & shop geocoding', () => {
    const loc = APP_PERMISSIONS_METADATA.location;
    assert.strictEqual(loc.name, 'Location (GPS)');
    assert.strictEqual(loc.androidPermission, 'android.permission.ACCESS_FINE_LOCATION');
    assert.strictEqual(loc.required, true);
    assert.ok(
      loc.featuresUsedIn.some((f) => f.includes('Punch-in') || f.includes('Geo-tagging')),
      'Location must mention punch-in or geo-tagging'
    );
  });

  it('verifies Device Storage uses modern Scoped Storage without broad file access', async () => {
    const storageResult = await checkPermission('storage');
    assert.strictEqual(storageResult.type, 'storage');
    assert.strictEqual(storageResult.status, 'granted');
    assert.strictEqual(storageResult.granted, true);
    assert.strictEqual(storageResult.canAskAgain, false);
    assert.ok(storageResult.details?.includes('Scoped Storage'));
  });

  it('verifies checkAllPermissions returns complete map of all 6 permissions', async () => {
    const all = await checkAllPermissions();
    const keys = Object.keys(all);
    assert.strictEqual(keys.length, 6);
    assert.ok(all.camera);
    assert.ok(all.microphone);
    assert.ok(all.notifications);
    assert.ok(all.photos);
    assert.ok(all.location);
    assert.ok(all.storage);

    // Each permission must conform to PermissionCheckResult contract
    for (const key of keys as AppPermissionType[]) {
      const res = all[key];
      assert.strictEqual(res.type, key);
      assert.ok(
        ['not_requested', 'granted', 'denied', 'permanently_denied', 'limited'].includes(res.status),
        `Status ${res.status} must be valid`
      );
      assert.strictEqual(typeof res.granted, 'boolean');
      assert.strictEqual(typeof res.canAskAgain, 'boolean');
    }
  });

  it('verifies requestPermission completes safely and updates state', async () => {
    const res = await requestPermission('camera');
    assert.strictEqual(res.type, 'camera');
    assert.ok(typeof res.granted === 'boolean');
  });

  it('verifies openAppSettings executes without throwing an unhandled rejection', async () => {
    await assert.doesNotReject(async () => {
      await openAppSettings();
    });
  });

  it('verifies app.json contains all required Android permissions for Android 13+ & 14+', () => {
    const appJsonPath = path.resolve(process.cwd(), 'app.json');
    const content = fs.readFileSync(appJsonPath, 'utf-8');
    const appJson = JSON.parse(content);
    const permissions: string[] = appJson?.expo?.android?.permissions || [];

    assert.ok(
      permissions.includes('android.permission.ACCESS_FINE_LOCATION'),
      'Must declare ACCESS_FINE_LOCATION'
    );
    assert.ok(
      permissions.includes('android.permission.ACCESS_COARSE_LOCATION'),
      'Must declare ACCESS_COARSE_LOCATION'
    );
    assert.ok(
      permissions.includes('android.permission.CAMERA'),
      'Must declare CAMERA'
    );
    assert.ok(
      permissions.includes('android.permission.RECORD_AUDIO'),
      'Must declare RECORD_AUDIO'
    );
    assert.ok(
      permissions.includes('android.permission.POST_NOTIFICATIONS'),
      'Must declare POST_NOTIFICATIONS for Android 13+'
    );
    assert.ok(
      permissions.includes('android.permission.READ_MEDIA_IMAGES'),
      'Must declare READ_MEDIA_IMAGES for Android 13+ photo picker'
    );
  });

  it('verifies App Permissions screen has rationale dialog and settings button', () => {
    const screenPath = path.resolve(process.cwd(), 'src/app/(shared)/permissions.tsx');
    const content = fs.readFileSync(screenPath, 'utf-8');

    assert.ok(content.includes('App Permissions'), 'Must display App Permissions title');
    assert.ok(
      content.includes('Open App Settings'),
      'Must provide Open App Settings button'
    );
    assert.ok(
      content.includes('selectedRationalePerm'),
      'Must have rationale dialog state before requesting Android dialog'
    );
    assert.ok(
      content.includes('Your Privacy is Protected'),
      'Must display privacy information guarantee'
    );
    assert.ok(
      content.includes('summaryTitle'),
      'Must render status summary bar'
    );
  });

  it('verifies routing configuration links App Permissions for Admin, Manager, and Seller', () => {
    // 1. Shared Layout
    const sharedLayout = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(shared)/_layout.tsx'),
      'utf-8'
    );
    assert.ok(sharedLayout.includes('name="permissions"'), 'Shared layout must register permissions route');

    // 2. Admin Settings
    const adminSettings = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(admin)/settings/index.tsx'),
      'utf-8'
    );
    assert.ok(
      adminSettings.includes('/(shared)/permissions'),
      'Admin settings must link to /(shared)/permissions'
    );

    // 3. Manager Profile
    const managerProfile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(manager)/profile/index.tsx'),
      'utf-8'
    );
    assert.ok(
      managerProfile.includes('/(shared)/permissions'),
      'Manager profile must link to /(shared)/permissions'
    );

    // 4. Seller Profile
    const sellerProfile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/(seller)/profile/index.tsx'),
      'utf-8'
    );
    assert.ok(
      sellerProfile.includes('/(shared)/permissions'),
      'Seller profile must link to /(shared)/permissions'
    );

    // 5. Role-specific alias files exist
    assert.ok(
      fs.existsSync(path.resolve(process.cwd(), 'src/app/(admin)/settings/permissions.tsx')),
      'Admin settings permissions alias must exist'
    );
    assert.ok(
      fs.existsSync(path.resolve(process.cwd(), 'src/app/(manager)/profile/permissions.tsx')),
      'Manager profile permissions alias must exist'
    );
    assert.ok(
      fs.existsSync(path.resolve(process.cwd(), 'src/app/(seller)/profile/permissions.tsx')),
      'Seller profile permissions alias must exist'
    );
  });
});
