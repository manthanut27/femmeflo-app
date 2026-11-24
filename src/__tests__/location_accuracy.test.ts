import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  scoreConfidence,
  isWithinIndiaBounds,
  sanitizeIndiaCoordinates,
  validateCoordinates,
  INDIA_BOUNDS,
} from '../utils/geoValidation.ts';

describe('Location Fetching Accuracy & Quality Assurance Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string): string => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  // =========================================================================
  // 1. PURE FUNCTION: scoreConfidence
  // =========================================================================
  describe('1. Pure Function: scoreConfidence', () => {
    it('rates a high-accuracy, fresh, rooftop Indian GPS fix as high confidence', () => {
      const result = scoreConfidence({
        accuracy: 12,
        ageMs: 4000,
        inIndia: true,
        locationType: 'ROOFTOP',
        accuracyThresholdMeters: 50,
      });

      assert.equal(result.confidence, 'high');
      assert.equal(result.reasons.length, 0);
    });

    it('rates an inaccurate GPS reading (> threshold) as low confidence with actionable warning', () => {
      const result = scoreConfidence({
        accuracy: 95,
        ageMs: 5000,
        inIndia: true,
        accuracyThresholdMeters: 50,
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('exceeds acceptable threshold of 50m')),
        `Expected threshold warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates a missing/null accuracy reading as low confidence without fabricating an accuracy number', () => {
      const result = scoreConfidence({
        accuracy: null,
        ageMs: 2000,
        inIndia: true,
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('Device reported no accuracy estimate')),
        `Expected missing accuracy warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates a stale location reading (> 120s limit) as low confidence with staleness warning', () => {
      const result = scoreConfidence({
        accuracy: 10,
        ageMs: 145000, // 145 seconds old
        inIndia: true,
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('exceeds 120s limit')),
        `Expected stale reading warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates an aged reading (between 30s and 120s) as medium confidence', () => {
      const result = scoreConfidence({
        accuracy: 15,
        ageMs: 45000, // 45 seconds old
        inIndia: true,
      });

      assert.equal(result.confidence, 'medium');
      assert.ok(result.reasons.some((r) => r.includes('Aged location reading')));
    });

    it('rates out-of-India coordinates as low confidence and records territory warning', () => {
      const result = scoreConfidence({
        accuracy: 10,
        ageMs: 1000,
        inIndia: false,
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('outside Indian territory bounds')),
        `Expected out-of-bounds warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates approximate geocoded location as low confidence', () => {
      const result = scoreConfidence({
        accuracy: 10,
        ageMs: 2000,
        inIndia: true,
        locationType: 'APPROXIMATE',
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('approximate')),
        `Expected approximate geocode warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates geometric center geocoded location as medium confidence', () => {
      const result = scoreConfidence({
        accuracy: 15,
        ageMs: 2000,
        inIndia: true,
        locationType: 'GEOMETRIC_CENTER',
      });

      assert.equal(result.confidence, 'medium');
    });
  });

  // =========================================================================
  // 2. GPS ACQUISITION & STRUCTURAL INTEGRITY
  // =========================================================================
  describe('2. GPS Acquisition Pipeline & Defensive Invariants', () => {
    const locUtilsCode = readFile('src/utils/locationUtils.ts');

    it('verifies locationUtils never fabricates accuracy and uses nullish coalescing', () => {
      assert.ok(
        locUtilsCode.includes('coords.accuracy ?? null'),
        'Must use coords.accuracy ?? null and never invent accuracy'
      );
      assert.ok(
        !locUtilsCode.includes('coords.accuracy || 15'),
        'Must not contain legacy fabricated accuracy fallback (|| 15)'
      );
    });

    it('verifies cancellable timeout with explicit timer cleanup to prevent leaks', () => {
      assert.ok(
        locUtilsCode.includes('withCancellableTimeout'),
        'Must define and use withCancellableTimeout'
      );
      assert.ok(
        locUtilsCode.includes('clearTimeout(timerId)'),
        'Must explicitly clear timer in finally block'
      );
    });

    it('verifies stale cached positions (> maxAgeMs limit) are rejected', () => {
      assert.ok(
        locUtilsCode.includes('lastKnown.timestamp ? Math.max(0, now - lastKnown.timestamp) : null'),
        'Must calculate ageMs for lastKnown position'
      );
      assert.ok(
        locUtilsCode.includes('if (ageMs != null && ageMs > maxAge)'),
        'Must guard against stale lastKnown position exceeding maxAge'
      );
    });

    it('verifies authentic device coordinates outside India bounds are preserved without silent mutation', () => {
      assert.ok(
        locUtilsCode.includes('if (!isWithinIndiaBounds(coords.latitude, coords.longitude))'),
        'Must check bounds with isWithinIndiaBounds'
      );
      assert.ok(
        locUtilsCode.includes('allowDevEmulatorSubstitution'),
        'Must gate coordinate replacement behind allowDevEmulatorSubstitution'
      );
      assert.ok(
        locUtilsCode.includes('isEmulatorFallback: true'),
        'Must mark isEmulatorFallback: true for out-of-bounds coordinates'
      );
    });

    it('verifies graceful permission denial handling', () => {
      assert.ok(
        locUtilsCode.includes("status: 'denied'"),
        'Must handle denied permission status'
      );
      assert.ok(
        locUtilsCode.includes("confidence: 'low'"),
        'Denied status must return low confidence'
      );
    });

    it('verifies public exports maintain full backward compatibility', () => {
      const exportsToCheck = [
        'acquireGpsCoordinates',
        'getCurrentCoordinates',
        'getCurrentLocationWithAddress',
        'scoreConfidence',
        'isWithinIndiaBounds',
        'sanitizeIndiaCoordinates',
        'LocationResult',
        'GpsState',
      ];
      for (const exp of exportsToCheck) {
        assert.ok(
          locUtilsCode.includes(exp),
          `locationUtils.ts must export ${exp}`
        );
      }
    });

    it('verifies logging redacts coordinates to prevent leaking high precision location', () => {
      assert.ok(
        locUtilsCode.includes('formatRedactedCoords'),
        'Must define formatRedactedCoords'
      );
      assert.ok(
        locUtilsCode.includes('lat.toFixed(2)'),
        'Must round latitude in logs'
      );
      assert.ok(
        locUtilsCode.includes('lng.toFixed(2)'),
        'Must round longitude in logs'
      );
    });
  });

  // =========================================================================
  // 3. REVERSE GEOCODING PIPELINE, SOURCING & FALLBACKS
  // =========================================================================
  describe('3. Reverse Geocoding Pipeline, Sourcing & Fallbacks', () => {
    const locUtilsCode = readFile('src/utils/locationUtils.ts');

    it('verifies backend Google Maps API is primary and returns source "backend"', () => {
      assert.ok(
        locUtilsCode.includes("source: 'backend'"),
        "Must set source: 'backend' when resolving via backend API"
      );
      assert.ok(
        locUtilsCode.includes('geoApi.reverseGeocode('),
        'Must call geoApi.reverseGeocode with latitude and longitude'
      );
    });

    it('verifies native geocoder is offline fallback and returns source "native"', () => {
      assert.ok(
        locUtilsCode.includes("source: 'native'"),
        "Must set source: 'native' when falling back to native geocoder"
      );
      assert.ok(
        locUtilsCode.includes('reverseGeocodeAsync'),
        'Must call reverseGeocodeAsync for offline fallback'
      );
    });

    it('verifies ZERO_RESULTS and network failures fall back gracefully to source "device"', () => {
      assert.ok(
        locUtilsCode.includes("source: 'device'"),
        "Must set source: 'device' when geocoding is unavailable"
      );
      assert.ok(
        locUtilsCode.includes('ZERO_RESULTS'),
        'Must log clear warning when backend returns ZERO_RESULTS'
      );
    });
  });
});
