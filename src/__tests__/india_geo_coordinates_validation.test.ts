import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  isWithinIndiaBounds,
  sanitizeIndiaCoordinates,
  validateCoordinates,
  INDIA_BOUNDS,
  DEFAULT_INDIA_COORDINATES,
} from '../utils/geoValidation.ts';

describe('India Territory Geo-Coordinates Validation & Clean Layout Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string): string => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  // =========================================================================
  // 1. INDIA GEO-FENCING & BOUNDARY RECOGNITION
  // =========================================================================
  describe('1. India Geo-Fencing & Boundary Recognition', () => {
    it('verifies INDIA_BOUNDS constants match strict Render backend enforcement [6.5°-37.5° N, 68.0°-97.5° E]', () => {
      assert.equal(INDIA_BOUNDS.minLat, 6.5, 'Minimum latitude for India bounds must be 6.5');
      assert.equal(INDIA_BOUNDS.maxLat, 37.5, 'Maximum latitude for India bounds must be 37.5');
      assert.equal(INDIA_BOUNDS.minLng, 68.0, 'Minimum longitude for India bounds must be 68.0');
      assert.equal(INDIA_BOUNDS.maxLng, 97.5, 'Maximum longitude for India bounds must be 97.5');
      assert.equal(DEFAULT_INDIA_COORDINATES.latitude, 19.2183, 'Default latitude must be Thane/Mumbai (19.2183)');
      assert.equal(DEFAULT_INDIA_COORDINATES.longitude, 72.9781, 'Default longitude must be Thane/Mumbai (72.9781)');
    });

    it('identifies key Indian cities and locations as strictly within India bounds', () => {
      const validPoints = [
        { name: 'Thane / Mumbai', lat: 19.2183, lng: 72.9781 },
        { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
        { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
        { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
        { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
        { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
        { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
        { name: 'Srinagar, Kashmir', lat: 34.0837, lng: 74.7973 },
        { name: 'Guwahati, Assam', lat: 26.1445, lng: 91.7362 },
        { name: 'Kochi, Kerala', lat: 9.9312, lng: 76.2673 },
        { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
        { name: 'Indore, MP', lat: 22.7196, lng: 75.8577 },
        { name: 'Port Blair, Andaman', lat: 11.6234, lng: 92.7265 },
      ];

      for (const pt of validPoints) {
        assert.equal(
          isWithinIndiaBounds(pt.lat, pt.lng),
          true,
          `Expected ${pt.name} (${pt.lat}, ${pt.lng}) to be recognized within India territory bounds`
        );
      }
    });

    it('verifies exact boundary limits (corners and edges) are inclusive for Indian territory', () => {
      // Four corners of the bounding box
      assert.equal(isWithinIndiaBounds(6.5, 68.0), true, 'South-West boundary corner (6.5, 68.0) must be true');
      assert.equal(isWithinIndiaBounds(6.5, 97.5), true, 'South-East boundary corner (6.5, 97.5) must be true');
      assert.equal(isWithinIndiaBounds(37.5, 68.0), true, 'North-West boundary corner (37.5, 68.0) must be true');
      assert.equal(isWithinIndiaBounds(37.5, 97.5), true, 'North-East boundary corner (37.5, 97.5) must be true');

      // Mid-points along the boundary borders
      assert.equal(isWithinIndiaBounds(6.5, 80.0), true, 'Southern boundary edge (6.5, 80.0) must be true');
      assert.equal(isWithinIndiaBounds(37.5, 80.0), true, 'Northern boundary edge (37.5, 80.0) must be true');
      assert.equal(isWithinIndiaBounds(20.0, 68.0), true, 'Western boundary edge (20.0, 68.0) must be true');
      assert.equal(isWithinIndiaBounds(20.0, 97.5), true, 'Eastern boundary edge (20.0, 97.5) must be true');
    });

    it('correctly handles numeric strings for latitude and longitude', () => {
      assert.equal(isWithinIndiaBounds('19.2183', '72.9781'), true, 'String representation of Mumbai must be true');
      assert.equal(isWithinIndiaBounds('28.6139', '77.2090'), true, 'String representation of Delhi must be true');
      assert.equal(isWithinIndiaBounds('37.4219983', '-122.084'), false, 'String representation of Mountain View must be false');
    });

    it('catches out-of-bounds coordinates including Android Emulator defaults and international cities', () => {
      const outOfBoundsPoints = [
        { name: 'Android Emulator default Mountain View, CA', lat: 37.4219983, lng: -122.084 },
        { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
        { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
        { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
        { name: 'Sydney, Australia (Southern hemisphere)', lat: -33.8688, lng: 151.2093 },
        { name: 'Null Island (0, 0)', lat: 0, lng: 0 },
        { name: 'North Pole', lat: 90.0, lng: 0 },
        { name: 'South Pole', lat: -90.0, lng: 0 },
        { name: 'Negative Longitude test', lat: 20.0, lng: -75.0 },
        { name: 'Southern hemisphere latitude test', lat: -15.0, lng: 75.0 },
        // Precision test just beyond bounds
        { name: 'Just below southern limit', lat: 6.49999, lng: 75.0 },
        { name: 'Just above northern limit', lat: 37.50001, lng: 75.0 },
        { name: 'Just west of western limit', lat: 20.0, lng: 67.99999 },
        { name: 'Just east of eastern limit', lat: 20.0, lng: 97.50001 },
      ];

      for (const pt of outOfBoundsPoints) {
        assert.equal(
          isWithinIndiaBounds(pt.lat, pt.lng),
          false,
          `Expected ${pt.name} (${pt.lat}, ${pt.lng}) to be flagged as OUTSIDE India territory bounds`
        );
      }
    });

    it('rejects invalid, null, undefined, or non-numeric inputs gracefully', () => {
      assert.equal(isWithinIndiaBounds(null, null), false);
      assert.equal(isWithinIndiaBounds(undefined, undefined), false);
      assert.equal(isWithinIndiaBounds(NaN, 72.9781), false);
      assert.equal(isWithinIndiaBounds(19.2183, NaN), false);
      assert.equal(isWithinIndiaBounds('invalid', 'coordinates'), false);
      assert.equal(isWithinIndiaBounds('', ''), false);
    });
  });

  // =========================================================================
  // 2. COORDINATE SANITIZATION & EMULATOR INTERCEPTION
  // =========================================================================
  describe('2. Coordinate Sanitization & Emulator Interception', () => {
    it('preserves authentic Indian territory GPS coordinates unchanged with isFallback: false', () => {
      const authenticCoords = [
        { lat: 19.2183, lng: 72.9781 },
        { lat: 12.9716, lng: 77.5946 },
        { lat: 28.6139, lng: 77.2090 },
        { lat: 22.5726, lng: 88.3639 },
      ];

      for (const coord of authenticCoords) {
        const sanitized = sanitizeIndiaCoordinates(coord.lat, coord.lng);
        assert.equal(sanitized.latitude, coord.lat, 'Latitude should remain unchanged');
        assert.equal(sanitized.longitude, coord.lng, 'Longitude should remain unchanged');
        assert.equal(sanitized.isFallback, false, 'isFallback must be false for genuine Indian coordinates');
      }
    });

    it('replaces Android emulator coordinates (37.4219983, -122.084) with safe Indian territory default (19.2183, 72.9781)', () => {
      const emulatorLat = 37.4219983;
      const emulatorLng = -122.084;

      const sanitized = sanitizeIndiaCoordinates(emulatorLat, emulatorLng);
      assert.equal(sanitized.latitude, 19.2183, 'Sanitized latitude must be safe Indian territory default (19.2183)');
      assert.equal(sanitized.longitude, 72.9781, 'Sanitized longitude must be safe Indian territory default (72.9781)');
      assert.equal(sanitized.isFallback, true, 'isFallback must be flagged true for intercepted emulator coordinates');
      assert.equal(isWithinIndiaBounds(sanitized.latitude, sanitized.longitude), true);
    });

    it('replaces overseas / foreign coordinates (e.g. London, Tokyo) with safe Indian defaults', () => {
      const londonSanitized = sanitizeIndiaCoordinates(51.5074, -0.1278);
      assert.equal(londonSanitized.latitude, 19.2183);
      assert.equal(londonSanitized.longitude, 72.9781);
      assert.equal(londonSanitized.isFallback, true);

      const tokyoSanitized = sanitizeIndiaCoordinates(35.6762, 139.6503);
      assert.equal(tokyoSanitized.latitude, 19.2183);
      assert.equal(tokyoSanitized.longitude, 72.9781);
      assert.equal(tokyoSanitized.isFallback, true);
    });

    it('replaces null, undefined, and NaN coordinates with safe Indian defaults', () => {
      const nullSanitized = sanitizeIndiaCoordinates(null, null);
      assert.equal(nullSanitized.latitude, 19.2183);
      assert.equal(nullSanitized.longitude, 72.9781);
      assert.equal(nullSanitized.isFallback, true);

      const undefinedSanitized = sanitizeIndiaCoordinates(undefined, undefined);
      assert.equal(undefinedSanitized.latitude, 19.2183);
      assert.equal(undefinedSanitized.longitude, 72.9781);
      assert.equal(undefinedSanitized.isFallback, true);

      const nanSanitized = sanitizeIndiaCoordinates('invalid', 'data');
      assert.equal(nanSanitized.latitude, 19.2183);
      assert.equal(nanSanitized.longitude, 72.9781);
      assert.equal(nanSanitized.isFallback, true);
    });

    it('respects a custom fallback coordinate when provided', () => {
      const customFallback = { latitude: 22.7196, longitude: 75.8577 }; // Indore, MP
      const result = sanitizeIndiaCoordinates(37.4219983, -122.084, customFallback);
      assert.equal(result.latitude, 22.7196);
      assert.equal(result.longitude, 75.8577);
      assert.equal(result.isFallback, true);
    });

    it('verifies validateCoordinates works accurately with requireIndiaBounds = true', () => {
      // Valid Indian coordinates
      const validRes = validateCoordinates(19.2183, 72.9781, true);
      assert.equal(validRes.valid, true);
      assert.equal(validRes.error, undefined);

      // Overseas coordinates
      const overseasRes = validateCoordinates(37.4219983, -122.084, true);
      assert.equal(overseasRes.valid, false);
      assert.equal(overseasRes.error, 'Coordinates must be within the territory of India.');

      // Out of global range latitude
      const outOfRangeLat = validateCoordinates(95.0, 72.0, true);
      assert.equal(outOfRangeLat.valid, false);
      assert.equal(outOfRangeLat.error, 'Latitude must be between -90 and +90 degrees.');

      // Out of global range longitude
      const outOfRangeLng = validateCoordinates(20.0, 195.0, true);
      assert.equal(outOfRangeLng.valid, false);
      assert.equal(outOfRangeLng.error, 'Longitude must be between -180 and +180 degrees.');
    });
  });

  // =========================================================================
  // 3. API LAYER DEFENSIVE COORDINATE SANITIZATION
  // =========================================================================
  describe('3. API Layer Defensive Coordinate Sanitization', () => {
    it('verifies static source code contracts in api files require sanitizeIndiaCoordinates before request dispatch', () => {
      const sellerCode = readFile('src/api/seller.ts');
      const managerCode = readFile('src/api/manager.ts');
      const adminCode = readFile('src/api/admin.ts');

      for (const [name, code] of [
        ['seller.ts', sellerCode],
        ['manager.ts', managerCode],
        ['admin.ts', adminCode],
      ] as const) {
        // Must import sanitizeIndiaCoordinates
        assert.match(
          code,
          /import\s*\{[\s\S]*?sanitizeIndiaCoordinates[\s\S]*?\}\s*from\s*['"]\.\.\/utils\/geoValidation['"]/,
          `${name} must import sanitizeIndiaCoordinates from ../utils/geoValidation`
        );

        // createCustomer must invoke sanitizeIndiaCoordinates
        assert.match(
          code,
          /async\s+createCustomer\([\s\S]*?const\s+coords\s*=\s*sanitizeIndiaCoordinates\s*\(\s*payload\.latitude\s*,\s*payload\.longitude\s*\)/,
          `${name} createCustomer must call sanitizeIndiaCoordinates before dispatching request`
        );

        // updateCustomer must invoke sanitizeIndiaCoordinates
        assert.match(
          code,
          /async\s+updateCustomer\([\s\S]*?sanitizeIndiaCoordinates\(/,
          `${name} updateCustomer must sanitize coordinates if provided`
        );
      }
    });

    it('verifies API payload builders guarantee coordinates are within Indian bounds', () => {
      // Replicate the exact sanitization applied in sellerApi, managerApi, and adminApi createCustomer
      function buildCustomerPayload(input: { latitude?: any; longitude?: any; [k: string]: any }) {
        const coords = sanitizeIndiaCoordinates(input.latitude, input.longitude);
        return {
          ...input,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
      }

      // 1. Android Emulator GPS (37.4219983, -122.084)
      const emulatorPayload = buildCustomerPayload({
        shopName: 'Test Shop',
        latitude: 37.4219983,
        longitude: -122.084,
      });
      assert.equal(isWithinIndiaBounds(emulatorPayload.latitude, emulatorPayload.longitude), true);
      assert.equal(emulatorPayload.latitude, 19.2183);
      assert.equal(emulatorPayload.longitude, 72.9781);

      // 2. London GPS (51.5074, -0.1278)
      const londonPayload = buildCustomerPayload({
        shopName: 'Test Shop London',
        latitude: 51.5074,
        longitude: -0.1278,
      });
      assert.equal(isWithinIndiaBounds(londonPayload.latitude, londonPayload.longitude), true);
      assert.equal(londonPayload.latitude, 19.2183);
      assert.equal(londonPayload.longitude, 72.9781);

      // 3. Genuine Indian GPS (28.6139, 77.2090)
      const delhiPayload = buildCustomerPayload({
        shopName: 'Test Shop Delhi',
        latitude: 28.6139,
        longitude: 77.2090,
      });
      assert.equal(isWithinIndiaBounds(delhiPayload.latitude, delhiPayload.longitude), true);
      assert.equal(delhiPayload.latitude, 28.6139);
      assert.equal(delhiPayload.longitude, 77.2090);

      // 4. Undefined / null GPS
      const emptyPayload = buildCustomerPayload({
        shopName: 'Test Shop Empty GPS',
        latitude: undefined,
        longitude: undefined,
      });
      assert.equal(isWithinIndiaBounds(emptyPayload.latitude, emptyPayload.longitude), true);
      assert.equal(emptyPayload.latitude, 19.2183);
      assert.equal(emptyPayload.longitude, 72.9781);
    });

    it('verifies bulk customer creation in sellerApi and adminApi sanitizes coordinates', () => {
      const sellerCode = readFile('src/api/seller.ts');
      const adminCode = readFile('src/api/admin.ts');

      for (const [name, code] of [
        ['seller.ts', sellerCode],
        ['admin.ts', adminCode],
      ] as const) {
        assert.match(
          code,
          /createBulkCustomers[\s\S]*?sanitizeIndiaCoordinates/,
          `${name} createBulkCustomers must sanitize customer coordinates`
        );
      }
    });
  });

  // =========================================================================
  // 4. CLEAN LAYOUT ARCHITECTURE (NO EXTRANEOUS ROUTE WARNINGS)
  // =========================================================================
  describe('4. Clean Layout Route Architecture (Zero Extraneous Route Warnings)', () => {
    it('verifies customer and sales layouts do not contain extraneous Stack.Screen name="[id]" declarations', () => {
      const layoutFiles = [
        { path: 'src/app/(manager)/customers/_layout.tsx', name: 'Manager Customers Layout' },
        { path: 'src/app/(admin)/customers/_layout.tsx', name: 'Admin Customers Layout' },
        { path: 'src/app/(seller)/customers/_layout.tsx', name: 'Seller Customers Layout' },
        { path: 'src/app/(seller)/sales/_layout.tsx', name: 'Seller Sales Layout' },
      ];

      for (const layout of layoutFiles) {
        const code = readFile(layout.path);

        // Verify layout uses Stack navigation
        assert.match(
          code,
          /<Stack/,
          `${layout.name} must configure Stack navigator`
        );

        // Verify screenOptions sets headerShown: false
        assert.match(
          code,
          /headerShown:\s*false/,
          `${layout.name} must configure headerShown: false in screenOptions`
        );

        // Verify smooth slide_from_right transition animation
        assert.match(
          code,
          /animation:\s*['"]slide_from_right['"]/,
          `${layout.name} must configure slide_from_right animation`
        );

        // CRITICAL: Ensure NO extraneous <Stack.Screen name="[id]" /> which triggers:
        // "WARN [Layout children]: Too many screens defined. Route '[id]' is extraneous."
        assert.doesNotMatch(
          code,
          /<Stack\.Screen[\s\S]*?name=["']\[id\]["']/,
          `${layout.name} must NOT contain extraneous <Stack.Screen name="[id]"> declaration`
        );
      }
    });

    it('verifies dynamic [id].tsx route screen files exist on the filesystem for file-based Expo routing', () => {
      const dynamicRouteFiles = [
        'src/app/(manager)/customers/[id].tsx',
        'src/app/(admin)/customers/[id].tsx',
        'src/app/(seller)/customers/[id].tsx',
      ];

      for (const file of dynamicRouteFiles) {
        const fullPath = path.join(rootDir, file);
        assert.ok(
          fs.existsSync(fullPath),
          `Dynamic route screen file must exist for Expo Router file-based routing: ${file}`
        );

        const code = fs.readFileSync(fullPath, 'utf-8');
        assert.match(
          code,
          /export\s+default\s+function/,
          `Dynamic route screen ${file} must export a default component`
        );
      }
    });

    it('verifies all registered screens in customer and sales layouts have actual corresponding files in the directory', () => {
      const directoryChecks = [
        {
          layoutPath: 'src/app/(manager)/customers/_layout.tsx',
          dirPath: 'src/app/(manager)/customers',
          expectedScreens: ['index', 'new', 'bulk'],
        },
        {
          layoutPath: 'src/app/(admin)/customers/_layout.tsx',
          dirPath: 'src/app/(admin)/customers',
          expectedScreens: ['index', 'new', 'bulk'],
        },
        {
          layoutPath: 'src/app/(seller)/customers/_layout.tsx',
          dirPath: 'src/app/(seller)/customers',
          expectedScreens: ['index', 'new', 'bulk'],
        },
        {
          layoutPath: 'src/app/(seller)/sales/_layout.tsx',
          dirPath: 'src/app/(seller)/sales',
          expectedScreens: ['index', 'new', 'pending'],
        },
      ];

      for (const item of directoryChecks) {
        const layoutCode = readFile(item.layoutPath);
        for (const screen of item.expectedScreens) {
          assert.match(
            layoutCode,
            new RegExp(`<Stack\\.Screen[\\s\\S]*?name=["']${screen}["']`),
            `${item.layoutPath} should declare Stack.Screen name="${screen}"`
          );

          const screenFile = path.join(rootDir, item.dirPath, `${screen}.tsx`);
          assert.ok(
            fs.existsSync(screenFile),
            `Corresponding file for declared route "${screen}" must exist at ${screenFile}`
          );
        }
      }
    });
  });

  // =========================================================================
  // 5. LOCATION UTILITY & ONBOARDING UI EMULATOR INTERCEPTION
  // =========================================================================
  describe('5. Location Utils & UI Customer Onboarding Integration', () => {
    it('verifies locationUtils.ts re-exports isWithinIndiaBounds and sanitizeIndiaCoordinates', () => {
      const code = readFile('src/utils/locationUtils.ts');

      assert.match(
        code,
        /export\s*\{[\s\S]*?isWithinIndiaBounds[\s\S]*?sanitizeIndiaCoordinates[\s\S]*?\}/,
        'locationUtils.ts must re-export isWithinIndiaBounds and sanitizeIndiaCoordinates'
      );
    });

    it('verifies locationUtils.ts contains processAcquiredCoords to intercept emulator GPS acquisition', () => {
      const code = readFile('src/utils/locationUtils.ts');

      assert.match(
        code,
        /function\s+processAcquiredCoords\(/,
        'locationUtils.ts must define processAcquiredCoords'
      );

      assert.match(
        code,
        /if\s*\(!isWithinIndiaBounds\(coords\.latitude,\s*coords\.longitude\)\)\s*\{/,
        'processAcquiredCoords must check !isWithinIndiaBounds(coords.latitude, coords.longitude)'
      );

      assert.match(
        code,
        /isEmulatorFallback:\s*true/,
        'processAcquiredCoords must flag isEmulatorFallback: true when out-of-bounds coords are acquired'
      );
    });

    it('verifies seller, manager, and admin new.tsx customer onboarding forms sanitize coordinates on submit and GPS acquisition', () => {
      const screens = [
        { path: 'src/app/(seller)/customers/new.tsx', name: 'Seller Customer Onboarding' },
        { path: 'src/app/(manager)/customers/new.tsx', name: 'Manager Customer Onboarding' },
        { path: 'src/app/(admin)/customers/new.tsx', name: 'Admin Customer Onboarding' },
      ];

      for (const screen of screens) {
        const code = readFile(screen.path);

        // Must import sanitizeIndiaCoordinates
        assert.match(
          code,
          /sanitizeIndiaCoordinates/,
          `${screen.name} must import sanitizeIndiaCoordinates`
        );

        // Must defensively sanitize coordinates in handleSubmit
        assert.match(
          code,
          /const\s+coords\s*=\s*sanitizeIndiaCoordinates\(latitude,\s*longitude\);/,
          `${screen.name} must sanitize coordinates with sanitizeIndiaCoordinates(latitude, longitude) before calling createCustomer`
        );

        // Must detect emulator fallback or out-of-bounds in startGps
        assert.match(
          code,
          /isWithinIndiaBounds|isEmulatorFallback/,
          `${screen.name} must handle emulator detection in GPS acquisition`
        );

        // Must display user feedback for emulator fallback
        assert.match(
          code,
          /Emulator \/ overseas location detected; using default Indian territory coordinates/,
          `${screen.name} must inform user when emulator / overseas location is intercepted`
        );
      }
    });
  });
});
