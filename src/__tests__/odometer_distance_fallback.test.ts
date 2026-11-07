import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  computeShiftTravelDistance,
  formatTravelDistance,
  getShiftTravelDistanceKm,
} from '../utils/distanceUtils.ts';

describe('Shift Travel Distance & Odometer Fallback Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('prioritizes GPS tracked distance when GPS coordinates system is active and reports valid distance', () => {
    const shift = {
      totalDistanceKm: 42.6,
      startOdometerKm: 345,
      endOdometerKm: 500, // 155 km meter reading
    };

    const res = computeShiftTravelDistance(shift);
    assert.strictEqual(res.distanceKm, 42.6);
    assert.strictEqual(res.formatted, '42.6 km');
    assert.strictEqual(res.source, 'gps');
    assert.strictEqual(res.sourceLabel, 'GPS Tracked');
  });

  it('correctly uses meter fallback when GPS tracking is missing or offline (user example: start = 345, end = 500 => 155 km)', () => {
    // Exactly matches user scenario: start = 345 km, end = 500 km
    const shift = {
      startOdometerKm: 345,
      endOdometerKm: 500,
    };

    const res = computeShiftTravelDistance(shift);
    assert.strictEqual(res.distanceKm, 155);
    assert.strictEqual(res.formatted, '155 km');
    assert.strictEqual(res.source, 'odometer');
    assert.strictEqual(res.sourceLabel, 'Odometer Meter');
    assert.strictEqual(formatTravelDistance(shift), '155 km');
    assert.strictEqual(getShiftTravelDistanceKm(shift), 155);
  });

  it('correctly uses meter fallback when GPS is 0, null, empty string, or undefined', () => {
    // GPS returned 0 (e.g. no coordinates computed or network disconnected)
    const shiftZeroGps = {
      totalDistanceKm: 0,
      startOdometerKm: 345,
      endOdometerKm: 500,
    };
    const resZero = computeShiftTravelDistance(shiftZeroGps);
    assert.strictEqual(resZero.distanceKm, 155);
    assert.strictEqual(resZero.source, 'odometer');

    // GPS returned null
    const shiftNullGps = {
      totalDistanceKm: null,
      startOdometerKm: 120,
      endOdometerKm: 185.5,
    };
    const resNull = computeShiftTravelDistance(shiftNullGps);
    assert.strictEqual(resNull.distanceKm, 65.5);
    assert.strictEqual(resNull.formatted, '65.5 km');
    assert.strictEqual(resNull.source, 'odometer');
  });

  it('supports string numeric readings and alternate property names (startOdometer/endOdometer)', () => {
    const shiftWithStrings = {
      startOdometer: '1000',
      endOdometer: '1120.4',
    };

    const res = computeShiftTravelDistance(shiftWithStrings);
    assert.strictEqual(res.distanceKm, 120.4);
    assert.strictEqual(res.formatted, '120.4 km');
    assert.strictEqual(res.source, 'odometer');
  });

  it('supports fallback parameter for local/pending closing odometer before server sync', () => {
    // When shift object is null or does not yet have end odometer
    const shift = {
      startOdometerKm: 345,
    };

    const res = computeShiftTravelDistance(shift, {
      startKm: 345,
      endKm: 500,
    });
    assert.strictEqual(res.distanceKm, 155);
    assert.strictEqual(res.formatted, '155 km');
    assert.strictEqual(res.source, 'odometer');
  });

  it('safely handles non-positive meter deltas without negative values', () => {
    const shiftNegative = {
      startOdometerKm: 500,
      endOdometerKm: 345, // typo in meter
    };

    const res = computeShiftTravelDistance(shiftNegative);
    assert.strictEqual(res.distanceKm, 0);
    assert.strictEqual(res.formatted, '0 km');
    assert.strictEqual(res.source, 'none');
  });

  it('verifies integration in (seller)/shift/index.tsx', () => {
    const code = readFile('src/app/(seller)/shift/index.tsx');
    assert.match(code, /computeShiftTravelDistance/, 'Shift index must import and use computeShiftTravelDistance');
    assert.match(code, /via meter fallback/, 'Shift completion alert must note meter fallback when applicable');
    assert.match(code, /Calculated Travel:/, 'Shift end modal must show live calculated meter travel preview');
  });

  it('verifies integration in (seller)/index.tsx', () => {
    const code = readFile('src/app/(seller)/index.tsx');
    assert.match(code, /computeShiftTravelDistance/, 'Seller dashboard must import and use computeShiftTravelDistance');
    assert.match(code, /Calculated Travel:/, 'Seller dashboard modal must show calculated travel preview');
  });

  it('verifies integration in (seller)/profile/shifts.tsx', () => {
    const code = readFile('src/app/(seller)/profile/shifts.tsx');
    assert.match(code, /computeShiftTravelDistance/, 'Seller shift history must use computeShiftTravelDistance');
  });

  it('verifies integration in (manager)/shifts/index.tsx', () => {
    const code = readFile('src/app/(manager)/shifts/index.tsx');
    assert.match(code, /computeShiftTravelDistance/, 'Manager shifts audit must use computeShiftTravelDistance');
  });

  it('verifies integration in (admin)/shifts/index.tsx', () => {
    const code = readFile('src/app/(admin)/shifts/index.tsx');
    assert.match(code, /computeShiftTravelDistance/, 'Admin shifts audit must use computeShiftTravelDistance');
  });
});
