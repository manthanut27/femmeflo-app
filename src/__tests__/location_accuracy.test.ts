import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { geoApi } from '../api/geo.ts';
import {
  scoreConfidence,
  acquireGpsCoordinates,
  getCurrentLocationWithAddress,
  setLocationProvider,
  type LocationResult,
  type GpsState,
} from '../utils/locationUtils.ts';

const mockAccuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

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
  // 2. GPS ACQUISITION (acquireGpsCoordinates)
  // =========================================================================
  describe('2. GPS Acquisition Pipeline & Defensive Invariants', () => {
    it('acquires good GPS fix and preserves raw sensor accuracy and timestamp', async () => {
      const now = Date.now();
      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
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
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

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
        setLocationProvider(null);
      }
    });

    it('identifies poor accuracy (> threshold) and marks confidence as low without failing the operation', async () => {
      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
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
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

      try {
        const gps = await acquireGpsCoordinates({
          accuracyThresholdMeters: 50,
        });

        assert.equal(gps.status, 'acquired');
        assert.equal(gps.confidence, 'low');
        assert.ok(gps.warnings && gps.warnings.some((w) => w.includes('exceeds acceptable threshold')));
      } finally {
        setLocationProvider(null);
      }
    });

    it('preserves authentic device coordinates outside India bounds without silently mutating them', async () => {
      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
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
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

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
        setLocationProvider(null);
      }
    });

    it('rejects stale cached lastKnown position (> maxAgeMs limit) and enters timeout state', async () => {
      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        // High and fallback timeouts will expire
        getCurrentPositionAsync: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return null;
        },
        // Last known is 10 minutes old (600,000ms)
        getLastKnownPositionAsync: async () => ({
          coords: {
            latitude: 19.1864,
            longitude: 73.0409,
            accuracy: 20,
          },
          timestamp: Date.now() - 600000,
        }),
        reverseGeocodeAsync: async () => [],
      });

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
        setLocationProvider(null);
      }
    });

    it('gracefully handles location permission denied with low confidence and clear warning', async () => {
      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'denied', granted: false }),
        getCurrentPositionAsync: async () => null,
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

      try {
        const gps = await acquireGpsCoordinates();

        assert.equal(gps.status, 'denied');
        assert.equal(gps.latitude, null);
        assert.equal(gps.longitude, null);
        assert.equal(gps.confidence, 'low');
        assert.ok(gps.errorMessage && gps.errorMessage.includes('denied'));
      } finally {
        setLocationProvider(null);
      }
    });
  });

  // =========================================================================
  // 3. REVERSE GEOCODING PIPELINE (getCurrentLocationWithAddress)
  // =========================================================================
  describe('3. Reverse Geocoding Pipeline, Sourcing & Fallbacks', () => {
    it('resolves address via backend Google Maps API with source "backend" and no mixed fields', async () => {
      const origRevBackend = geoApi.reverseGeocode;

      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
          coords: {
            latitude: 19.1864,
            longitude: 73.0409,
            accuracy: 10,
          },
          timestamp: Date.now(),
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

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
        setLocationProvider(null);
        geoApi.reverseGeocode = origRevBackend;
      }
    });

    it('falls back to native geocoder when backend fails and marks source as "native"', async () => {
      const origRevBackend = geoApi.reverseGeocode;

      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
          coords: {
            latitude: 19.1864,
            longitude: 73.0409,
            accuracy: 15,
          },
          timestamp: Date.now(),
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [
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
        ],
      });

      // Backend fails
      geoApi.reverseGeocode = async () => null;

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'native');
        assert.equal(result.street, 'Main Bazaar Road');
        assert.equal(result.state, 'Maharashtra');
        assert.equal(result.pincode, '400612');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('native device offline fallback')));
      } finally {
        setLocationProvider(null);
        geoApi.reverseGeocode = origRevBackend;
      }
    });

    it('falls back to native geocoder when backend returns ZERO_RESULTS', async () => {
      const origRevBackend = geoApi.reverseGeocode;

      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
          coords: {
            latitude: 19.1864,
            longitude: 73.0409,
            accuracy: 15,
          },
          timestamp: Date.now(),
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [
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
        ],
      });

      // Backend returns null (ZERO_RESULTS)
      geoApi.reverseGeocode = async () => null;

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'native');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('ZERO_RESULTS')));
      } finally {
        setLocationProvider(null);
        geoApi.reverseGeocode = origRevBackend;
      }
    });

    it('preserves raw coordinates with source "device" when both backend and native geocoders fail', async () => {
      const origRevBackend = geoApi.reverseGeocode;

      setLocationProvider({
        Accuracy: mockAccuracy,
        requestForegroundPermissionsAsync: async () => ({ status: 'granted', granted: true }),
        getCurrentPositionAsync: async () => ({
          coords: {
            latitude: 19.1864,
            longitude: 73.0409,
            accuracy: 10,
          },
          timestamp: Date.now(),
        }),
        getLastKnownPositionAsync: async () => null,
        reverseGeocodeAsync: async () => [],
      });

      geoApi.reverseGeocode = async () => {
        throw new Error('Network timeout');
      };

      try {
        const result = await getCurrentLocationWithAddress();

        assert.ok(result);
        assert.equal(result.source, 'device');
        assert.equal(result.latitude, 19.1864);
        assert.equal(result.longitude, 73.0409);
        assert.equal(result.confidence, 'low');
        assert.ok(result.warnings && result.warnings.some((w) => w.includes('No reverse geocoding source available')));
      } finally {
        setLocationProvider(null);
        geoApi.reverseGeocode = origRevBackend;
      }
    });
  });
});
