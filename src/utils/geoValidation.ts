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

