import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Location from 'expo-location';
import { geoApi } from '../api/geo.ts';
import {
  scoreConfidence,
  acquireGpsCoordinates,
  getCurrentLocationWithAddress,
  type LocationResult,
  type GpsState,
} from '../utils/locationUtils.ts';

describe('Location Fetching Accuracy & Quality Assurance Suite', () => {
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
        result.reasons.some((r) => r.includes('no accuracy estimate')),
        `Expected missing accuracy warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates a stale location reading (> 120s limit) as low confidence with staleness warning', () => {
      const result = scoreConfidence({
        accuracy: 10,
        ageMs: 185000, // ~3 minutes old
        inIndia: true,
      });

      assert.equal(result.confidence, 'low');
      assert.ok(
        result.reasons.some((r) => r.includes('Stale location reading')),
        `Expected stale warning, got: ${JSON.stringify(result.reasons)}`
      );
    });

    it('rates an aged reading (between 30s and 120s) as medium confidence', () => {
      const result = scoreConfidence({
        accuracy: 15,
        ageMs: 45000, // 45s old
        inIndia: true,
        locationType: 'ROOFTOP',
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
      assert.ok(result.reasons.some((r) => r.includes('outside Indian territory bounds')));
    });

    it('rates approximate geocoded location as low confidence', () => {
      const result = scoreConfidence({
        accuracy: 20,
        ageMs: 2000,
        inIndia: true,
        locationType: 'APPROXIMATE',
      });

      assert.equal(result.confidence, 'low');
      assert.ok(result.reasons.some((r) => r.includes('resolution is approximate')));
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
  // 2. GPS ACQUISITION (acquireGpsCoordinates)
  // =========================================================================
  describe('2. GPS Acquisition Pipeline & Defensive Invariants', () => {
    it('acquires good GPS fix and preserves raw sensor accuracy and timestamp', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;

      const now = Date.now();
      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 8.5,
          altitude: 10,
          altitudeAccuracy: 5,
          heading: 0,
          speed: 0,
        },
        timestamp: now,
      })) as any;

      try {
        const gps = await acquireGpsCoordinates({
          highAccuracyTimeoutMs: 1000,
          fallbackTimeoutMs: 500,
          accuracyThresholdMeters: 50,
        });

        assert.equal(gps.status, 'acquired');
        assert.equal(gps.latitude, 19.1864);
        assert.equal(gps.longitude, 73.0409);
        assert.equal(gps.accuracy, 8.5); // Exact device accuracy, never fabricated
        assert.equal(gps.confidence, 'high');
        assert.equal(gps.source, 'device');
        assert.equal(gps.isEmulatorFallback, false);
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
      }
    });

    it('identifies poor accuracy (> threshold) and marks confidence as low without failing the operation', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 120, // Above 50m threshold
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })) as any;

      try {
        const gps = await acquireGpsCoordinates({
          accuracyThresholdMeters: 50,
        });

        assert.equal(gps.status, 'acquired');
        assert.equal(gps.confidence, 'low');
        assert.ok(gps.warnings && gps.warnings.some((w) => w.includes('exceeds acceptable threshold')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
      }
    });

    it('preserves authentic device coordinates outside India bounds without silently mutating them', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 37.421998, // Mountain View, CA
          longitude: -122.084,
          accuracy: 15,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })) as any;

      try {
        // By default, allowDevEmulatorSubstitution is false -> real device coordinates are preserved!
        const gps = await acquireGpsCoordinates();

        assert.equal(gps.status, 'acquired');
        assert.equal(gps.latitude, 37.421998, 'Must preserve authentic device latitude');
        assert.equal(gps.longitude, -122.084, 'Must preserve authentic device longitude');
        assert.equal(gps.confidence, 'low');
        assert.equal(gps.isEmulatorFallback, true);
        assert.ok(gps.warnings && gps.warnings.some((w) => w.includes('outside Indian territory bounds')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
      }
    });

    it('rejects stale cached lastKnown position (> maxAgeMs limit) and enters timeout state', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;
      const origGetLast = Location.getLastKnownPositionAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      // High and fallback timeouts will expire
      Location.getCurrentPositionAsync = (async () => {
        await new Promise((r) => setTimeout(r, 200));
        return null;
      }) as any;

      // Last known is 10 minutes old (600,000ms)
      Location.getLastKnownPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 20,
        },
        timestamp: Date.now() - 600000,
      })) as any;

      try {
        const gps = await acquireGpsCoordinates({
          highAccuracyTimeoutMs: 50,
          fallbackTimeoutMs: 50,
          maxAgeMs: 120000, // 2 minutes max
        });

        assert.equal(gps.status, 'timeout');
        assert.equal(gps.latitude, null);
        assert.equal(gps.confidence, 'low');
        assert.ok(gps.warnings && gps.warnings.some((w) => w.includes('timed out')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
        Location.getLastKnownPositionAsync = origGetLast;
      }
    });

    it('gracefully handles location permission denied with low confidence and clear warning', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'denied' })) as any;

      try {
        const gps = await acquireGpsCoordinates();

        assert.equal(gps.status, 'denied');
        assert.equal(gps.latitude, null);
        assert.equal(gps.longitude, null);
        assert.equal(gps.confidence, 'low');
        assert.ok(gps.errorMessage && gps.errorMessage.includes('denied'));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
      }
    });
  });

  // =========================================================================
  // 3. REVERSE GEOCODING PIPELINE (getCurrentLocationWithAddress)
  // =========================================================================
  describe('3. Reverse Geocoding Pipeline, Sourcing & Fallbacks', () => {
    it('resolves address via backend Google Maps API with source "backend" and no mixed fields', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;
      const origRevBackend = geoApi.reverseGeocode;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 10,
        },
        timestamp: Date.now(),
      })) as any;

      geoApi.reverseGeocode = async (lat, lng) => ({
        latitude: lat,
        longitude: lng,
        formattedAddress: '7, Station Road, Diva East, Thane, Maharashtra 400612',
        street: 'Station Road',
        state: 'Maharashtra',
        district: 'Thane',
        sublocality: 'Diva East',
        pincode: '400612',
        locationType: 'ROOFTOP',
      });

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'backend');
        assert.equal(result.confidence, 'high');
        assert.equal(result.street, 'Station Road');
        assert.equal(result.state, 'Maharashtra');
        assert.equal(result.district, 'Thane');
        assert.equal(result.village, 'Diva East');
        assert.equal(result.pincode, '400612');
        assert.equal(result.address, '7, Station Road, Diva East, Thane, Maharashtra 400612');
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
        geoApi.reverseGeocode = origRevBackend;
      }
    });

    it('falls back to native geocoder when backend fails and marks source as "native"', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;
      const origRevBackend = geoApi.reverseGeocode;
      const origRevNative = Location.reverseGeocodeAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 15,
        },
        timestamp: Date.now(),
      })) as any;

      // Backend fails
      geoApi.reverseGeocode = async () => null;

      // Native fallback succeeds
      Location.reverseGeocodeAsync = (async () => [
        {
          name: 'Balaji Store',
          street: 'Main Bazaar Road',
          district: 'Thane',
          subregion: 'Thane District',
          city: 'Diva',
          region: 'Maharashtra',
          postalCode: '400612',
          country: 'India',
        },
      ]) as any;

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'native');
        assert.equal(result.street, 'Main Bazaar Road');
        assert.equal(result.state, 'Maharashtra');
        assert.equal(result.pincode, '400612');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('native device offline fallback')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
        geoApi.reverseGeocode = origRevBackend;
        Location.reverseGeocodeAsync = origRevNative;
      }
    });

    it('falls back to native geocoder when backend returns ZERO_RESULTS', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;
      const origRevBackend = geoApi.reverseGeocode;
      const origRevNative = Location.reverseGeocodeAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 15,
        },
        timestamp: Date.now(),
      })) as any;

      // Backend returns null (ZERO_RESULTS)
      geoApi.reverseGeocode = async () => null;

      Location.reverseGeocodeAsync = (async () => [
        {
          name: 'Village Point',
          street: 'Village Road',
          district: 'Thane',
          subregion: 'Thane District',
          city: 'Thane',
          region: 'Maharashtra',
          postalCode: '400612',
          country: 'India',
        },
      ]) as any;

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'native');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('ZERO_RESULTS')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
        geoApi.reverseGeocode = origRevBackend;
        Location.reverseGeocodeAsync = origRevNative;
      }
    });

    it('preserves raw coordinates with source "device" when both backend and native geocoders fail', async () => {
      const origReqPerm = Location.requestForegroundPermissionsAsync;
      const origGetCurr = Location.getCurrentPositionAsync;
      const origRevBackend = geoApi.reverseGeocode;
      const origRevNative = Location.reverseGeocodeAsync;

      Location.requestForegroundPermissionsAsync = (async () => ({ status: 'granted' })) as any;
      Location.getCurrentPositionAsync = (async () => ({
        coords: {
          latitude: 19.1864,
          longitude: 73.0409,
          accuracy: 10,
        },
        timestamp: Date.now(),
      })) as any;

      geoApi.reverseGeocode = async () => {
        throw new Error('Network timeout');
      };
      Location.reverseGeocodeAsync = (async () => []) as any;

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'device');
        assert.equal(result.latitude, 19.1864);
        assert.equal(result.longitude, 73.0409);
        assert.equal(result.confidence, 'low');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('No reverse geocoding source available')));
      } finally {
        Location.requestForegroundPermissionsAsync = origReqPerm;
        Location.getCurrentPositionAsync = origGetCurr;
        geoApi.reverseGeocode = origRevBackend;
        Location.reverseGeocodeAsync = origRevNative;
      }
    });
  });
});
