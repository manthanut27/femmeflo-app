/**
 * Distance Calculation & Fallback Utility
 * 
 * Business Logic:
 * 1. GPS coordinates (latitude/longitude) is the primary tracking system for beat routes,
 *    store visits, and travel audits.
 * 2. When GPS tracking is active and computes a valid travel distance (> 0 km), that GPS
 *    distance takes precedence.
 * 3. In the event of network disconnection, GPS timeout, hardware unresponsiveness, or when
 *    the backend/GPS system does not compute distance (totalDistanceKm is null, 0, or missing),
 *    the odometer meter readings (closing odometer - start odometer) MUST be used as the
 *    reliable physical fallback to measure how much the seller traveled.
 *    Example: Start meter = 345 km, End meter = 500 km => Distance traveled = 155 km.
 */

export interface ShiftDistanceInput {
  totalDistanceKm?: number | string | null;
  startOdometerKm?: number | string | null;
  endOdometerKm?: number | string | null;
  startOdometer?: number | string | null;
  endOdometer?: number | string | null;
  [key: string]: any;
}

export type DistanceMeasurementSource = 'gps' | 'odometer' | 'none';

export interface ShiftTravelDistanceResult {
  /** Distance in kilometers as a clean numeric value (rounded to 1 decimal place) */
  distanceKm: number;
  /** Human-friendly formatted string (e.g., "155 km" or "42.5 km") */
  formatted: string;
  /** Primary source of measurement */
  source: DistanceMeasurementSource;
  /** Human-readable explanation of how distance was measured */
  sourceLabel: string;
}

export interface FallbackOdometerReadings {
  startKm?: number | string | null;
  endKm?: number | string | null;
}

/**
 * Computes shift travel distance prioritizing GPS lat/long tracking with odometer meter fallback.
 */
export function computeShiftTravelDistance(
  shift?: ShiftDistanceInput | null,
  fallback?: FallbackOdometerReadings
): ShiftTravelDistanceResult {
  // 1. Primary System: GPS tracking
  const rawGpsDistance = shift?.totalDistanceKm;
  if (rawGpsDistance != null && rawGpsDistance !== '') {
    const parsedGps = Number(rawGpsDistance);
    if (!isNaN(parsedGps) && parsedGps > 0) {
      const distanceKm = Math.round(parsedGps * 10) / 10;
      return {
        distanceKm,
        formatted: `${distanceKm} km`,
        source: 'gps',
        sourceLabel: 'GPS Tracked',
      };
    }
  }

  // 2. Secondary/Fallback System: Vehicle Odometer Meter Readings
  const rawStart =
    shift?.startOdometerKm ??
    shift?.startOdometer ??
    fallback?.startKm;
  const rawEnd =
    shift?.endOdometerKm ??
    shift?.endOdometer ??
    fallback?.endKm;

  if (rawStart != null && rawStart !== '' && rawEnd != null && rawEnd !== '') {
    const startVal = Number(rawStart);
    const endVal = Number(rawEnd);

    if (!isNaN(startVal) && !isNaN(endVal)) {
      const delta = Math.max(0, endVal - startVal);
      const roundedDelta = Math.round(delta * 10) / 10;
      if (roundedDelta > 0) {
        return {
          distanceKm: roundedDelta,
          formatted: `${roundedDelta} km`,
          source: 'odometer',
          sourceLabel: 'Odometer Meter',
        };
      }
    }
  }

  // 3. Fallback when both yield 0 or are unavailable
  return {
    distanceKm: 0,
    formatted: '0 km',
    source: rawGpsDistance === 0 ? 'gps' : 'none',
    sourceLabel: rawGpsDistance === 0 ? 'GPS Stationary (0 km)' : 'Not Recorded',
  };
}

/**
 * Helper to get just the formatted string representation (e.g. "155 km").
 */
export function formatTravelDistance(
  shift?: ShiftDistanceInput | null,
  fallback?: FallbackOdometerReadings
): string {
  return computeShiftTravelDistance(shift, fallback).formatted;
}

/**
 * Helper to get the numeric distance in kilometers.
 */
export function getShiftTravelDistanceKm(
  shift?: ShiftDistanceInput | null,
  fallback?: FallbackOdometerReadings
): number {
  return computeShiftTravelDistance(shift, fallback).distanceKm;
}
