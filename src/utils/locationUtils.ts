import * as Location from 'expo-location';
import { geoApi } from '@/api/geo';
import type { ReverseGeocodeResult } from '@/api/types';
import {
  validateCoordinates,
  isWithinIndiaBounds,
  sanitizeIndiaCoordinates,
  DEFAULT_INDIA_COORDINATES,
  scoreConfidence,
  type LocationConfidence,
  type LocationSource,
  type ScoreConfidenceParams,
} from './geoValidation';

export {
  validateCoordinates,
  isWithinIndiaBounds,
  sanitizeIndiaCoordinates,
  DEFAULT_INDIA_COORDINATES,
  scoreConfidence,
  type LocationConfidence,
  type LocationSource,
  type ScoreConfidenceParams,
};

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  confidence?: LocationConfidence;
  source?: LocationSource;
  warnings?: string[];
  timestamp?: number | null;
  ageMs?: number | null;
  address?: string | null;
  street?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  pincode?: string | null;
  isEmulatorFallback?: boolean;
}

export type GpsAcquisitionStatus =
  | 'idle'
  | 'requesting_permission'
  | 'acquiring_high'
  | 'acquiring_fallback'
  | 'acquired'
  | 'denied'
  | 'timeout'
  | 'unavailable';

export interface GpsState {
  status: GpsAcquisitionStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  confidence?: LocationConfidence;
  source?: LocationSource;
  warnings?: string[];
  timestamp?: number | null;
  ageMs?: number | null;
  errorMessage?: string | null;
  isEmulatorFallback?: boolean;
}

export interface AcquireGpsOptions {
  highAccuracyTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  accuracyThresholdMeters?: number;
  maxAgeMs?: number;
  allowDevEmulatorSubstitution?: boolean;
  onStatusChange?: (status: GpsAcquisitionStatus) => void;
}

/**
 * Format coordinates with rounding to prevent leaking high-precision location in remote logs.
 */
function formatRedactedCoords(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return '[unavailable]';
  return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
}

/**
 * Executes a promise with an explicitly cleared timer to prevent event loop leaks.
 */
function withCancellableTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timerId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  return Promise.race([
    promise.then((res) => {
      if (timerId) clearTimeout(timerId);
      return res;
    }),
    timeoutPromise,
  ]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
}

let customLocationProvider: any = null;

/**
 * Configure or override the underlying location provider (useful for unit testing and test harness isolation).
 */
export function setLocationProvider(provider: any) {
  customLocationProvider = provider;
}

function getLocationProvider() {
  return customLocationProvider || Location;
}

function processAcquiredCoords(
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  },
  allowDevEmulatorSubstitution = false,
  ageMs: number | null = null,
  timestamp: number | null = null,
  accuracyThreshold = 50
): GpsState {
  const inIndia = isWithinIndiaBounds(coords.latitude, coords.longitude);
  const accuracy = coords.accuracy ?? null; // Never fabricate a number
  const warnings: string[] = [];

  const { confidence, reasons } = scoreConfidence({
    accuracy,
    ageMs,
    inIndia,
    accuracyThresholdMeters: accuracyThreshold,
  });
  warnings.push(...reasons);

  if (!isWithinIndiaBounds(coords.latitude, coords.longitude)) {
    console.warn(
      `[locationUtils] Acquired coordinates (${formatRedactedCoords(
        coords.latitude,
        coords.longitude
      )}) fall outside Indian territory bounds [6.5°-37.5° N, 68.0°-97.5° E].`
    );

    // Only apply substitution when explicitly enabled by developer option; otherwise preserve authentic device coordinates
    if (allowDevEmulatorSubstitution) {
      const sanitized = sanitizeIndiaCoordinates(coords.latitude, coords.longitude);
      return {
        status: 'acquired',
        latitude: sanitized.latitude,
        longitude: sanitized.longitude,
        accuracy,
        confidence,
        source: 'device',
        warnings: [...warnings, 'Coordinates replaced with default territory coordinates via developer emulator mode.'],
        timestamp,
        ageMs,
        isEmulatorFallback: true,
      };
    }

    return {
      status: 'acquired',
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy,
      confidence,
      source: 'device',
      warnings,
      timestamp,
      ageMs,
      isEmulatorFallback: true,
    };
  }

  return {
    status: 'acquired',
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy,
    confidence,
    source: 'device',
    warnings: warnings.length > 0 ? warnings : undefined,
    timestamp,
    ageMs,
    isEmulatorFallback: false,
  };
}

/**
 * Robust GPS acquisition strategy:
 * 1. Checks and requests foreground location permissions.
 * 2. Attempts Highest Accuracy satellite position with a cancellable timeout (default 6000ms).
 * 3. Falls back to High Accuracy position with a cancellable timeout (default 4000ms).
 * 4. Falls back to cached position only if within maxAgeMs (default 120s), rejecting stale entries.
 * 5. Evaluates accuracy against threshold (default 50m) and scores confidence without inventing values.
 */
export async function acquireGpsCoordinates(options?: AcquireGpsOptions): Promise<GpsState> {
  const highTimeout = options?.highAccuracyTimeoutMs ?? 6000;
  const fallbackTimeout = options?.fallbackTimeoutMs ?? 4000;
  const maxAge = options?.maxAgeMs ?? 120000;
  const threshold = options?.accuracyThresholdMeters ?? 50;

  const notify = (status: GpsAcquisitionStatus) => {
    options?.onStatusChange?.(status);
  };

  try {
    notify('requesting_permission');
    const locModule = getLocationProvider();
    const { status } = await locModule.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      notify('denied');
      return {
        status: 'denied',
        latitude: null,
        longitude: null,
        accuracy: null,
        confidence: 'low',
        warnings: ['Location permission was denied by user.'],
        errorMessage: 'Location permission was denied. You may enter location details manually.',
      };
    }

    // Step 2: Highest-accuracy GPS satellite attempt with cancellable timer
    notify('acquiring_high');
    const highAccuracy = locModule.Accuracy?.Highest ?? Location.Accuracy.Highest;
    const highPromise = locModule.getCurrentPositionAsync({
      accuracy: highAccuracy,
    });
    const highResult = await withCancellableTimeout<Location.LocationObject | null>(
      highPromise,
      highTimeout,
      null
    );

    if (highResult && highResult.coords) {
      notify('acquired');
      const now = Date.now();
      const ageMs = highResult.timestamp ? Math.max(0, now - highResult.timestamp) : 0;
      return processAcquiredCoords(
        highResult.coords,
        options?.allowDevEmulatorSubstitution,
        ageMs,
        highResult.timestamp,
        threshold
      );
    }

    // Step 3: High-accuracy fused fallback with cancellable timer
    notify('acquiring_fallback');
    const fallbackAccuracy = locModule.Accuracy?.High ?? Location.Accuracy.High;
    const fallbackPromise = locModule.getCurrentPositionAsync({
      accuracy: fallbackAccuracy,
    });
    const fallbackResult = await withCancellableTimeout<Location.LocationObject | null>(
      fallbackPromise,
      fallbackTimeout,
      null
    );

    if (fallbackResult && fallbackResult.coords) {
      notify('acquired');
      const now = Date.now();
      const ageMs = fallbackResult.timestamp ? Math.max(0, now - fallbackResult.timestamp) : 0;
      return processAcquiredCoords(
        fallbackResult.coords,
        options?.allowDevEmulatorSubstitution,
        ageMs,
        fallbackResult.timestamp,
        threshold
      );
    }

    // Step 4: Last known location fallback with staleness check
    const lastKnown = await locModule.getLastKnownPositionAsync().catch(() => null);
    if (lastKnown && lastKnown.coords) {
      const now = Date.now();
      const ageMs = lastKnown.timestamp ? Math.max(0, now - lastKnown.timestamp) : null;
      if (ageMs != null && ageMs > maxAge) {
        console.warn(`[locationUtils] Last known position rejected as stale (${Math.round(ageMs / 1000)}s old)`);
      } else {
        notify('acquired');
        return processAcquiredCoords(
          lastKnown.coords,
          options?.allowDevEmulatorSubstitution,
          ageMs,
          lastKnown.timestamp,
          threshold
        );
      }
    }

    notify('timeout');
    return {
      status: 'timeout',
      latitude: null,
      longitude: null,
      accuracy: null,
      confidence: 'low',
      warnings: ['GPS signal acquisition timed out.'],
      errorMessage: 'High accuracy GPS timed out. Manual location entry enabled.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'GPS services are currently unavailable.';
    console.warn('[locationUtils] GPS acquisition error:', errorMsg);
    notify('unavailable');
    return {
      status: 'unavailable',
      latitude: null,
      longitude: null,
      accuracy: null,
      confidence: 'low',
      warnings: [errorMsg],
      errorMessage: errorMsg,
    };
  }
}

/**
 * Backward-compatible helper for basic coordinates retrieval.
 */
export async function getCurrentCoordinates(
  timeoutOrOptions?: number | AcquireGpsOptions
): Promise<{ latitude: number; longitude: number; accuracy: number | null } | null> {
  const options: AcquireGpsOptions =
    typeof timeoutOrOptions === 'number'
      ? {
          highAccuracyTimeoutMs: Math.round(timeoutOrOptions * 0.6),
          fallbackTimeoutMs: Math.round(timeoutOrOptions * 0.4),
        }
      : timeoutOrOptions || {};

  const res = await acquireGpsCoordinates(options);
  if (res.status === 'acquired' && res.latitude !== null && res.longitude !== null) {
    return {
      latitude: res.latitude,
      longitude: res.longitude,
      accuracy: res.accuracy,
    };
  }
  return null;
}

/**
 * Retrieves GPS coordinates and resolves addresses strictly from the backend Google Maps API,
 * falling back to the native device reverse geocoder only as an offline backup.
 */
export async function getCurrentLocationWithAddress(
  options?: AcquireGpsOptions
): Promise<LocationResult | null> {
  const gps = await acquireGpsCoordinates(options);
  if (gps.status !== 'acquired' || gps.latitude === null || gps.longitude === null) {
    return null;
  }

  const { latitude, longitude, accuracy, timestamp, ageMs } = gps;
  const inIndia = isWithinIndiaBounds(latitude, longitude);
  const warnings: string[] = gps.warnings ? [...gps.warnings] : [];

  const baseResult: LocationResult = {
    latitude,
    longitude,
    accuracy,
    confidence: gps.confidence || 'medium',
    source: 'device',
    warnings,
    timestamp,
    ageMs,
    isEmulatorFallback: gps.isEmulatorFallback,
  };

  // 1. Backend Google Maps Geocoding Resolution (Primary Source)
  if (inIndia) {
    try {
      const geoData: ReverseGeocodeResult | null = await geoApi.reverseGeocode(
        latitude,
        longitude
      );

      if (geoData && geoData.formattedAddress) {
        const { confidence: geocodeConfidence, reasons: geocodeReasons } = scoreConfidence({
          accuracy,
          ageMs,
          inIndia: true,
          locationType: geoData.locationType,
          accuracyThresholdMeters: options?.accuracyThresholdMeters ?? 50,
        });

        // Set address fields cleanly without mixing sources
        return {
          ...baseResult,
          source: 'backend',
          confidence: geocodeConfidence,
          warnings: [...warnings, ...geocodeReasons],
          address: geoData.formattedAddress,
          street: geoData.street || geoData.formattedAddress.split(',')[0]?.trim() || null,
          state: geoData.state || null,
          district: geoData.district || null,
          village: geoData.sublocality || null,
          pincode: geoData.pincode || null,
        };
      } else {
        warnings.push('Backend geocoder returned no address matches (ZERO_RESULTS).');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend geocoder request failed';
      warnings.push(`Backend geocoding failed: ${msg}`);
    }
  } else {
    warnings.push('Coordinates outside territory bounds [6.5°-37.5° N, 68°-97.5° E]; skipped backend geocoding.');
  }

  // 2. Native Device Geocoder (Offline Fallback Only)
  try {
    const locModule = getLocationProvider();
    const nativeAddresses = await locModule.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (nativeAddresses && nativeAddresses.length > 0) {
      const addr = nativeAddresses[0];
      const addressParts = [
        addr.name,
        addr.street,
        addr.subregion || addr.district,
        addr.city,
        addr.region,
        addr.postalCode,
      ].filter(Boolean);

      const { confidence: nativeConfidence, reasons: nativeReasons } = scoreConfidence({
        accuracy,
        ageMs,
        inIndia,
        locationType: 'APPROXIMATE',
        accuracyThresholdMeters: options?.accuracyThresholdMeters ?? 50,
      });

      return {
        ...baseResult,
        source: 'native',
        confidence: nativeConfidence,
        warnings: [...warnings, ...nativeReasons, 'Address resolved via native device offline fallback.'],
        address: addressParts.join(', '),
        street: addr.street || addr.name || null,
        state: addr.region || null,
        district: addr.subregion || addr.city || null,
        village: addr.district || addr.subregion || null,
        pincode: addr.postalCode || null,
      };
    } else {
      warnings.push('Native device reverse geocode returned no results.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Native reverse geocode failed';
    warnings.push(`Native reverse geocode fallback failed: ${msg}`);
  }

  // 3. Fallback to Device GPS Coordinates with raw un-geocoded state
  return {
    ...baseResult,
    source: 'device',
    confidence: 'low',
    warnings: [...warnings, 'No reverse geocoding source available.'],
  };
}
