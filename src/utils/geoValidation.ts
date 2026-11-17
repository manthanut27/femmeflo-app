/**
 * Territory boundary definitions and coordinate validation for India.
 * The Render backend enforces Indian territory bounds: [Lat: 6.5°-37.5°, Lng: 68°-97.5°].
 */

export const INDIA_BOUNDS = {
  minLat: 6.5,
  maxLat: 37.5,
  minLng: 68.0,
  maxLng: 97.5,
};

export const DEFAULT_INDIA_COORDINATES = {
  latitude: 19.2183,
  longitude: 72.9781,
};

/**
 * Checks whether the given coordinates fall within the official boundary of India.
 */
export function isWithinIndiaBounds(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null) return false;
  const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat);
  const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return false;
  return (
    numLat >= INDIA_BOUNDS.minLat &&
    numLat <= INDIA_BOUNDS.maxLat &&
    numLng >= INDIA_BOUNDS.minLng &&
    numLng <= INDIA_BOUNDS.maxLng
  );
}

/**
 * Ensures that coordinates submitted to the backend or displayed in the UI lie within valid Indian territory.
 * If coordinates are undefined, non-numeric, or outside Indian bounds (e.g., Mountain View, CA in Android Emulator:
 * 37.4219983, -122.084), it returns a safe Indian territory coordinate fallback (default: Thane/Mumbai 19.2183, 72.9781).
 */
export function sanitizeIndiaCoordinates(
  lat?: unknown,
  lng?: unknown,
  fallback: { latitude: number; longitude: number } = DEFAULT_INDIA_COORDINATES
): { latitude: number; longitude: number; isFallback?: boolean } {
  if (lat != null && lng != null) {
    const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat);
    const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng);
    if (!isNaN(numLat) && !isNaN(numLng) && isWithinIndiaBounds(numLat, numLng)) {
      return { latitude: numLat, longitude: numLng, isFallback: false };
    }
  }
  return {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    isFallback: true,
  };
}

/**
 * Validates coordinate ranges (latitude: -90 to 90, longitude: -180 to 180).
 * Optionally checks if coordinates lie strictly within the Indian territory (lat: 6.5-37.5, lng: 68.0-97.5).
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
    if (!isWithinIndiaBounds(lat, lng)) {
      return { valid: false, error: 'Coordinates must be within the territory of India.' };
    }
  }

  return { valid: true };
}
