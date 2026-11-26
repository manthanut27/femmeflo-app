import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildShiftWaypoints,
  calculateLegDistanceKm,
  calculateWaypointRouteKm,
  computeShiftTimingSummary,
  formatDurationHuman,
  getVisitDurationSeconds,
} from '../utils/distanceUtils.ts';
import { validateCapturedFaceFrame } from '../utils/faceFrameValidation.ts';
import { buildCustomerUpdateBody, normalizeCustomerItem } from '../utils/customerSanitizer.ts';

describe('Shift Check-in/out, GPS Accuracy & Route Distance Suite', () => {
  const rootDir = process.cwd();
  const readSource = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf-8');

  it('builds chronological route waypoints across Start -> Store A -> Store B -> End and computes >1km total', () => {
    const start = { lat: 19.18621, lng: 73.03997 };
    const shopA = { lat: 19.19121, lng: 73.04297 }; // ~640m straight
    const shopB = { lat: 19.19500, lng: 73.04450 }; // ~450m from A
    const end = { lat: 19.18621, lng: 73.03997 }; // back home

    const waypoints = buildShiftWaypoints(
      {
        startLatitude: start.lat,
        startLongitude: start.lng,
        endLatitude: end.lat,
        endLongitude: end.lng,
        visits: [
          { latitude: shopA.lat, longitude: shopA.lng },
          { latitude: shopB.lat, longitude: shopB.lng },
        ],
      }
    );

    assert.equal(waypoints.length, 4);
    const totalKm = calculateWaypointRouteKm(waypoints);
    assert.ok(totalKm >= 2.0, `Expected full round-trip route >= 2.0 km, got ${totalKm}`);

    const legStartToA = calculateLegDistanceKm(start, shopA);
    assert.ok(legStartToA >= 0.7 && legStartToA <= 1.2, `Expected 0.7-1.2 km leg, got ${legStartToA}`);
  });

  it('collapses indoor stationary jitter (<60m) to 0 km', () => {
    const km = calculateWaypointRouteKm([
      { lat: 19.18621, lng: 73.03997 },
      { lat: 19.18637, lng: 73.03996 },
      { lat: 19.18655, lng: 73.04015 },
    ]);
    assert.equal(km, 0);
  });

  it('computes unambiguous integer-second timeline durations without float noise (e.g. 0.8600000000000001)', () => {
    assert.equal(formatDurationHuman(68), '1m 08s');
    assert.equal(formatDurationHuman(112), '1m 52s');
    assert.equal(formatDurationHuman(45), '45s');

    const visitSecs = getVisitDurationSeconds({
      checkInTime: '2026-11-26T04:53:00.000Z',
      checkOutTime: '2026-11-26T04:54:08.000Z',
      durationMins: 1.14,
    });
    assert.equal(visitSecs, 68);

    const summary = computeShiftTimingSummary({
      startTime: '2026-11-26T04:52:00.000Z',
      endTime: '2026-11-26T04:55:00.000Z',
      startLatitude: 19.18621,
      startLongitude: 73.03997,
      endLatitude: 19.19121,
      endLongitude: 73.04297,
      totalDistanceKm: 0.7,
      visits: [
        {
          checkInTime: '2026-11-26T04:53:00.000Z',
          checkOutTime: '2026-11-26T04:54:08.000Z',
          durationMins: 1.14,
          latitude: 19.19121,
          longitude: 73.04297,
        },
      ],
    });
    assert.equal(summary.totalSeconds, 180);
    assert.equal(summary.atShopsSeconds, 68);
    assert.equal(summary.travelSeconds, 112);
    assert.equal(summary.formattedAtShops, '1m 08s');
    assert.equal(summary.formattedTravel, '1m 52s');
    assert.ok(!summary.formattedTravel.includes('0.86000000'));
  });

  it('rejects pitch-black night mode and blank frames in validateCapturedFaceFrame', () => {
    // Covered / night-mode dark Web frame
    const darkWeb = validateCapturedFaceFrame({
      width: 640,
      height: 480,
      avgLuma: 14,
      lumaStdDev: 4,
    });
    assert.equal(darkWeb.valid, false);
    assert.match(darkWeb.reason || '', /dark/i);

    // Uniform blank gray/black Native JPEG (~3000 bytes on 1080p)
    const darkNative = validateCapturedFaceFrame({
      width: 1280,
      height: 960,
      base64Length: 6000,
    });
    assert.equal(darkNative.valid, false);

    // Illuminated real selfie JPEG (~120 KB on 640x480)
    const validSelfie = validateCapturedFaceFrame({
      width: 640,
      height: 480,
      base64Length: 160000,
      avgLuma: 118,
      lumaStdDev: 42,
    });
    assert.equal(validSelfie.valid, true);
  });

  it('attendance screen coordinates saved shop pins, quick-add shop, stock availability, editable qty, and low-price approval', () => {
    const attendanceCode = readSource('src/app/(seller)/attendance/index.tsx');
    assert.ok(attendanceCode.includes('getCustomerSavedCoords'), 'Must reuse selected shop saved coordinates');
    assert.ok(attendanceCode.includes('openQuickAddShopModal'), 'Must provide inline Add New Shop flow');
    assert.ok(attendanceCode.includes('<CustomerOnboardingForm'), 'Check-in Add New Shop must reuse full CustomerOnboardingForm');
    assert.ok(attendanceCode.includes('uploadCustomerPhoto'), 'Check-in Add New Shop must support photo upload');
    assert.ok(attendanceCode.includes('sellerApi.getInventory()'), 'Must fetch product stock availability for checkout');
    assert.ok(attendanceCode.includes('saleQuantityStr'), 'Must support typing quantity in addition to +/- steppers');
    assert.ok(attendanceCode.includes('isBelowMinPrice'), 'Must warn & apply low-price Admin approval notice');

    const onboardingFormCode = readSource('src/components/customers/CustomerOnboardingForm.tsx');
    assert.ok(onboardingFormCode.includes('Use Current Location'), 'Onboarding form must label Use Current Location clearly');
    assert.ok(onboardingFormCode.includes('Full Shop Address'), 'Onboarding form must show editable Full Shop Address');
  });

  it('customer update sanitizer maps ownerName to contactName and drops unrecognized keys', () => {
    const body = buildCustomerUpdateBody({
      shopName: '  Guru krupa store  ',
      ownerName: '  Suresh Patil  ',
      phone: '9876543210',
      email: '   ',
      address: '  Main Bazar  ',
      pincode: '400612',
      state: 'Maharashtra',
      district: 'Thane',
      village: '',
      photoUrl: 'file:///local/tmp.jpg',
      active: true,
    });

    assert.equal(body.shopName, 'Guru krupa store');
    assert.equal(body.contactName, 'Suresh Patil');
    assert.equal(body.phone, '+919876543210');
    assert.equal('ownerName' in body, false, 'Must never send ownerName to strict backend updateCustomerSchema');
    assert.equal('email' in body, false, 'Blank optional email must be omitted');
    assert.equal('village' in body, false, 'Blank optional village must be omitted');
    assert.equal('photoUrl' in body, false, 'Local file:// URIs must not be sent as JSON photoUrl');

    const normalized = normalizeCustomerItem({
      id: 'c1',
      shopName: 'Guru krupa store',
      ownerName: '',
      contactName: 'Suresh Patil',
      phone: '+919876543210',
      state: 'Maharashtra',
      district: 'Thane',
      village: 'Diva',
      categoryId: 'cat1',
      sellerId: 'sel1',
      active: true,
      createdAt: '',
      photoPath: 'https://cdn.example.com/shop.jpg',
    } as any);
    assert.equal(normalized.ownerName, 'Suresh Patil');
    assert.equal(normalized.photoUrl, 'https://cdn.example.com/shop.jpg');
  });

  it('sellerApi.checkIn omits forbidden shiftId from HTTP payload and uses no-cache on shift reads', () => {
    const sellerCode = readSource('src/api/seller.ts');
    const checkInSlice = sellerCode.slice(
      sellerCode.indexOf('async checkIn('),
      sellerCode.indexOf('async checkOut(')
    );
    assert.ok(!checkInSlice.includes('body.shiftId ='), 'checkIn must never send body.shiftId to strict Zod backend');
    assert.ok(
      sellerCode.includes("apiRequest<{ shift: Shift | null }>('seller/shifts/current'") &&
        sellerCode.includes("cachePolicy: 'no-cache'"),
      'getCurrentShift must bypass stale HTTP cache'
    );
  });

  it('client mutations await cache tag invalidation before resolving', () => {
    const clientCode = readSource('src/api/client.ts');
    assert.ok(
      clientCode.includes('await cacheManager.invalidateByTags(tagsToInvalidate)'),
      'Mutation handler must await invalidateByTags'
    );
  });

  it('attendance screen removes hardcoded 19.1864 / 22.7196 coordinate fallbacks and applies bottom inset padding to modals', () => {
    const attendanceCode = readSource('src/app/(seller)/attendance/index.tsx');
    assert.ok(!attendanceCode.includes('19.1864'), 'Must not contain hardcoded 19.1864 fallback');
    assert.ok(!attendanceCode.includes('22.7196'), 'Must not contain hardcoded 22.7196 fallback');
    assert.ok(
      attendanceCode.includes('paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl)'),
      'Modals must add insets.bottom padding above Android 3-button nav bar'
    );
  });

  it('seller home dashboard removes hardcoded 22.7196 coordinate fallbacks and applies bottom inset padding to modals', () => {
    const homeCode = readSource('src/app/(seller)/index.tsx');
    assert.ok(!homeCode.includes('22.7196'), 'Seller home must not contain hardcoded 22.7196 fallback');
    assert.ok(
      homeCode.includes('paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl)'),
      'Seller home modals must clear Android system navigation bar'
    );
  });
});
