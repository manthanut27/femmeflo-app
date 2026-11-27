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

export type LocationConfidence = 'high' | 'medium' | 'low';
export type LocationSource = 'device' | 'backend' | 'native';

export interface ScoreConfidenceParams {
  accuracy: number | null;
  ageMs?: number | null;
  inIndia?: boolean;
  locationType?: string | null;
  accuracyThresholdMeters?: number;
}

/**
 * Pure function to evaluate location fix confidence based on satellite/network accuracy,
 * age of the fix, territorial validity, and reverse-geocoding precision.
 */
export function scoreConfidence(params: ScoreConfidenceParams): {
  confidence: LocationConfidence;
  reasons: string[];
} {
  const reasons: string[] = [];
  const threshold = params.accuracyThresholdMeters ?? 50;

  // 1. Regional boundary evaluation
  if (params.inIndia === false) {
    reasons.push('Coordinates fall outside Indian territory bounds [6.5°-37.5° N, 68.0°-97.5° E]');
  }

  // 2. Reading staleness evaluation
  if (params.ageMs != null) {
    if (params.ageMs > 120000) {
      reasons.push(`Stale location reading: ${Math.round(params.ageMs / 1000)}s old (exceeds 120s limit)`);
    } else if (params.ageMs > 30000) {
      reasons.push(`Aged location reading: ${Math.round(params.ageMs / 1000)}s old`);
    }
  }

  // 3. Sensor accuracy evaluation (never fabricated)
  if (params.accuracy == null) {
    reasons.push('Device reported no accuracy estimate');
  } else if (params.accuracy > threshold) {
    reasons.push(`Accuracy estimate ${Math.round(params.accuracy)}m exceeds acceptable threshold of ${threshold}m`);
  }

  // 4. Geocoder resolution evaluation
  if (params.locationType) {
    const locType = params.locationType.toUpperCase();
    if (locType === 'APPROXIMATE') {
      reasons.push('Geocoded location resolution is approximate');
    } else if (locType === 'GEOMETRIC_CENTER' || locType === 'RANGE_INTERPOLATED') {
      reasons.push(`Geocoded location is ${locType.toLowerCase().replace('_', ' ')}`);
    }
  }

  // Tier 1: Low Confidence criteria
  if (
    params.inIndia === false ||
    (params.ageMs != null && params.ageMs > 120000) ||
    params.accuracy == null ||
    (params.accuracy != null && params.accuracy > threshold) ||
    (params.locationType && params.locationType.toUpperCase() === 'APPROXIMATE')
  ) {
    return { confidence: 'low', reasons };
  }

  // Tier 2: Medium Confidence criteria
  if (
    (params.ageMs != null && params.ageMs > 30000) ||
    (params.accuracy != null && params.accuracy > 25) ||
    (params.locationType && ['GEOMETRIC_CENTER', 'RANGE_INTERPOLATED'].includes(params.locationType.toUpperCase()))
  ) {
    return { confidence: 'medium', reasons };
  }

  // Tier 3: High Confidence criteria
  return { confidence: 'high', reasons };
}

export interface ManualAddressQueryInput {
  shopNumber?: string | null;
  streetName?: string | null;
  landmark?: string | null;
  address?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
}

/**
 * Composes deduplicated address components into a full backend `address` string
 * including street and optional landmark without sending disallowed strict keys.
 */
export function buildFullShopAddress(input: {
  address?: string | null;
  streetName?: string | null;
  landmark?: string | null;
}): string {
  const parts: string[] = [];
  const pushUnique = (val?: string | null) => {
    const trimmed = val?.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (parts.some((p) => p.toLowerCase().includes(lower) || lower.includes(p.toLowerCase()))) {
      if (trimmed.length > (parts[0]?.length || 0)) {
        parts[0] = trimmed;
      }
      return;
    }
    parts.push(trimmed);
  };

  pushUnique(input.address);
  pushUnique(input.streetName);
  if (input.landmark?.trim()) {
    const lm = input.landmark.trim();
    const lmLabel = /^near\b/i.test(lm) ? lm : `Near ${lm}`;
    if (!parts.some((p) => p.toLowerCase().includes(lm.toLowerCase()))) {
      parts.push(lmLabel);
    }
  }
  return parts.join(', ');
}
