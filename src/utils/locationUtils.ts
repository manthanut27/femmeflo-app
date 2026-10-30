import * as Location from 'expo-location';
import { geoApi } from '@/api/geo';
import type { ReverseGeocodeResult } from '@/api/types';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  pincode?: string | null;
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
  errorMessage?: string | null;
}

/**
 * Validates coordinate ranges (latitude: -90 to 90, longitude: -180 to 180).
 * Optionally checks if coordinates lie generally within the Indian subcontinent (lat: 6-38, lng: 68-98).
 */
export function validateCoordinates(
  latitude: unknown,
  longitude: unknown,
  requireIndiaBounds = false
): { valid: boolean; error?: string } {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : Number(latitude);
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : Number(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Coordinates must be valid numbers.' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and +90 degrees.' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude must be between -180 and +180 degrees.' };
  }

  if (requireIndiaBounds) {
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      return { valid: false, error: 'Coordinates must be within the territory of India.' };
    }
  }

  return { valid: true };
}

/**
 * Robust GPS acquisition strategy:
 * 1. Checks and requests foreground location permissions.
 * 2. Attempts High Accuracy position with a timeout (default 6000ms).
 * 3. If High Accuracy times out or fails, falls back to Balanced Accuracy (default 4000ms).
 * 4. If that fails, falls back to the device's last known position.
 * Non-blocking: returns a structured GpsState without halting execution.
 */
export async function acquireGpsCoordinates(options?: {
  highAccuracyTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  onStatusChange?: (status: GpsAcquisitionStatus) => void;
}): Promise<GpsState> {
  const highTimeout = options?.highAccuracyTimeoutMs ?? 6000;
  const fallbackTimeout = options?.fallbackTimeoutMs ?? 4000;

  const notify = (status: GpsAcquisitionStatus) => {
    options?.onStatusChange?.(status);
  };

  try {
    notify('requesting_permission');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      notify('denied');
      return {
        status: 'denied',
        latitude: null,
        longitude: null,
        accuracy: null,
        errorMessage: 'Location permission was denied. You may enter location details manually.',
      };
    }

    // Step 2: High-accuracy attempt
    notify('acquiring_high');
    const highPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const highTimeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), highTimeout)
    );

    const highResult = await Promise.race([highPromise, highTimeoutPromise]);
    if (highResult && highResult.coords) {
      notify('acquired');
      return {
        status: 'acquired',
        latitude: highResult.coords.latitude,
        longitude: highResult.coords.longitude,
        accuracy: highResult.coords.accuracy,
      };
    }

    // Step 3: Balanced accuracy fallback
    notify('acquiring_fallback');
    const fallbackPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const fallbackTimeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), fallbackTimeout)
    );

    const fallbackResult = await Promise.race([fallbackPromise, fallbackTimeoutPromise]);
    if (fallbackResult && fallbackResult.coords) {
      notify('acquired');
      return {
        status: 'acquired',
        latitude: fallbackResult.coords.latitude,
        longitude: fallbackResult.coords.longitude,
        accuracy: fallbackResult.coords.accuracy,
      };
    }

    // Step 4: Last known location fallback
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown && lastKnown.coords) {
      notify('acquired');
      return {
        status: 'acquired',
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy,
      };
    }

    notify('timeout');
    return {
      status: 'timeout',
      latitude: null,
      longitude: null,
      accuracy: null,
      errorMessage: 'High accuracy GPS timed out. Manual location entry enabled.',
    };
  } catch (err: any) {
    console.warn('[locationUtils] GPS acquisition error', err);
    notify('unavailable');
    return {
      status: 'unavailable',
      latitude: null,
      longitude: null,
      accuracy: null,
      errorMessage: err?.message || 'GPS services are currently unavailable.',
    };
  }
}

/**
 * Backward-compatible helper for basic coordinates retrieval.
 */
export async function getCurrentCoordinates(
  timeoutMs = 10000
): Promise<{ latitude: number; longitude: number; accuracy: number | null } | null> {
  const res = await acquireGpsCoordinates({
    highAccuracyTimeoutMs: Math.round(timeoutMs * 0.6),
    fallbackTimeoutMs: Math.round(timeoutMs * 0.4),
  });
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
 * Retrieves GPS coordinates and attempts reverse geocoding via the backend geo API or native reverse geocode.
 */
export async function getCurrentLocationWithAddress(): Promise<LocationResult | null> {
  const coords = await getCurrentCoordinates();
  if (!coords) return null;

  const result: LocationResult = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
  };

  try {
    const geoData: ReverseGeocodeResult | null = await geoApi.reverseGeocode(
      coords.latitude,
      coords.longitude
    );
    if (geoData) {
      result.address = geoData.formattedAddress;
      result.state = geoData.state;
      result.district = geoData.district;
      result.village = geoData.sublocality;
      result.pincode = geoData.pincode;
      return result;
    }
  } catch {
    // Proceed to native fallback
  }

  try {
    const nativeAddresses = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
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

      result.address = addressParts.join(', ');
      result.state = addr.region || null;
      result.district = addr.subregion || addr.city || null;
      result.village = addr.district || addr.subregion || null;
      result.pincode = addr.postalCode || null;
    }
  } catch (err) {
    console.warn('[locationUtils] Native reverse geocode fallback failed', err);
  }

  return result;
}
