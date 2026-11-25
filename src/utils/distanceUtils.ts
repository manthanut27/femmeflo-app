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

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

const GPS_STATIONARY_DEADBAND_KM = 0.025; // 25m stationary jitter threshold (matches backend)
const ROAD_WINDING_MULTIPLIER = 1.25;

/**
 * Calculates Haversine great-circle distance in km between two GPS points.
 */
export function calculateHaversineKm(a: RouteCoordinate, b: RouteCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Estimates road distance in km for a single route leg, returning 0 inside the 25m stationary band.
 */
export function calculateLegDistanceKm(a: RouteCoordinate, b: RouteCoordinate): number {
  const straight = calculateHaversineKm(a, b);
  if (straight < GPS_STATIONARY_DEADBAND_KM) return 0;
  return Math.round(straight * ROAD_WINDING_MULTIPLIER * 10) / 10;
}

/**
 * Computes estimated road distance across ordered shift waypoints
 * (start -> store visits -> current/end), ignoring stationary jitter under 25m.
 */
export function calculateWaypointRouteKm(waypoints: RouteCoordinate[]): number {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return 0;
  let total = 0;
  let lastAnchored = waypoints[0];
  for (let i = 1; i < waypoints.length; i++) {
    const straight = calculateHaversineKm(lastAnchored, waypoints[i]);
    if (straight >= GPS_STATIONARY_DEADBAND_KM) {
      total += straight * ROAD_WINDING_MULTIPLIER;
      lastAnchored = waypoints[i];
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * Extracts valid numeric GPS waypoints from a shift (start -> chronological visits -> end/current).
 */
export function buildShiftWaypoints(
  shift?: {
    startLatitude?: number | string | null;
    startLongitude?: number | string | null;
    endLatitude?: number | string | null;
    endLongitude?: number | string | null;
    visits?: Array<{
      latitude?: number | string | null;
      longitude?: number | string | null;
      customer?: {
        latitude?: number | string | null;
        longitude?: number | string | null;
        [key: string]: any;
      } | null;
      [key: string]: any;
    }>;
    [key: string]: any;
  } | null,
  currentCoords?: { latitude: number; longitude: number } | null
): RouteCoordinate[] {
  const waypoints: RouteCoordinate[] = [];
  if (!shift) return waypoints;

  const sLat = Number(shift.startLatitude);
  const sLng = Number(shift.startLongitude);
  if (Number.isFinite(sLat) && Number.isFinite(sLng) && sLat !== 0 && sLng !== 0) {
    waypoints.push({ lat: sLat, lng: sLng });
  }

  for (const v of shift.visits || []) {
    const rawLat = v.latitude ?? v.customer?.latitude;
    const rawLng = v.longitude ?? v.customer?.longitude;
    const vLat = Number(rawLat);
    const vLng = Number(rawLng);
    if (rawLat != null && rawLng != null && Number.isFinite(vLat) && Number.isFinite(vLng) && vLat !== 0 && vLng !== 0) {
      waypoints.push({ lat: vLat, lng: vLng });
    }
  }

  if (currentCoords && Number.isFinite(currentCoords.latitude) && Number.isFinite(currentCoords.longitude)) {
    waypoints.push({ lat: currentCoords.latitude, lng: currentCoords.longitude });
  } else {
    const eLat = Number(shift.endLatitude);
    const eLng = Number(shift.endLongitude);
    if (Number.isFinite(eLat) && Number.isFinite(eLng) && eLat !== 0 && eLng !== 0) {
      waypoints.push({ lat: eLat, lng: eLng });
    }
  }

  return waypoints;
}
