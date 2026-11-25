import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildShiftWaypoints,
  calculateLegDistanceKm,
  calculateWaypointRouteKm,
} from '../utils/distanceUtils.ts';

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

  it('collapses indoor stationary jitter (<25m) to 0 km', () => {
    const km = calculateWaypointRouteKm([
      { lat: 19.18621, lng: 73.03997 },
      { lat: 19.18626, lng: 73.04004 },
    ]);
    assert.equal(km, 0);
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
