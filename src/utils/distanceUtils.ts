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

const GPS_STATIONARY_DEADBAND_KM = 0.06; // 60m indoor/stationary GPS drift threshold (matches backend)
const ROAD_WINDING_MULTIPLIER = 1.25;

/**
 * Formats an integer second count into clean, unambiguous human-readable text
 * (e.g. "45s", "1m 08s", "1h 12m"), avoiding decimal-minute confusion like "1.14 min".
 */
export function formatDurationHuman(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  if (secs < 60) {
    return `${secs}s`;
  }
  if (secs < 3600) {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return remSecs > 0 ? `${mins}m ${String(remSecs).padStart(2, '0')}s` : `${mins}m`;
  }
  const hours = Math.floor(secs / 3600);
  const remMins = Math.floor((secs % 3600) / 60);
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

/**
 * Returns exact stay duration in seconds for a shop visit using timestamps when available.
 */
export function getVisitDurationSeconds(visit?: {
  checkInTime?: string | null;
  checkOutTime?: string | null;
  durationMins?: number | string | null;
} | null): number {
  if (!visit) return 0;
  if (visit.checkInTime && visit.checkOutTime) {
    const inMs = new Date(visit.checkInTime).getTime();
    const outMs = new Date(visit.checkOutTime).getTime();
    if (!Number.isNaN(inMs) && !Number.isNaN(outMs) && outMs >= inMs) {
      return Math.max(1, Math.round((outMs - inMs) / 1000));
    }
  }
  if (visit.durationMins != null && visit.durationMins !== '') {
    const mins = Number(visit.durationMins);
    if (Number.isFinite(mins) && mins > 0) {
      return Math.round(mins * 60);
    }
  }
  return 0;
}

export interface ShiftTimingSummary {
  totalSeconds: number;
  atShopsSeconds: number;
  travelSeconds: number;
  distanceKm: number;
  formattedTotal: string;
  formattedAtShops: string;
  formattedTravel: string;
  formattedDistance: string;
}

/**
 * Computes consistent shift timing (Total, At Shops, Travel) and live/closed distance
 * in integer seconds so values sum accurately without floating-point artifacts.
 */
export function computeShiftTimingSummary(shift?: {
  startTime?: string | null;
  endTime?: string | null;
  totalDistanceKm?: number | string | null;
  startOdometerKm?: number | string | null;
  endOdometerKm?: number | string | null;
  startOdometer?: number | string | null;
  endOdometer?: number | string | null;
  startLatitude?: number | string | null;
  startLongitude?: number | string | null;
  endLatitude?: number | string | null;
  endLongitude?: number | string | null;
  visits?: Array<{
    checkInTime?: string | null;
    checkOutTime?: string | null;
    durationMins?: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    customer?: {
      latitude?: number | string | null;
      longitude?: number | string | null;
      [key: string]: any;
    } | null;
    [key: string]: any;
  }> | null;
  [key: string]: any;
} | null): ShiftTimingSummary {
  if (!shift || !shift.startTime) {
    return {
      totalSeconds: 0,
      atShopsSeconds: 0,
      travelSeconds: 0,
      distanceKm: 0,
      formattedTotal: '0s',
      formattedAtShops: '0s',
      formattedTravel: '0s',
      formattedDistance: '0 km',
    };
  }

  const startMs = new Date(shift.startTime).getTime();
  const endMs = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  const totalSeconds =
    !Number.isNaN(startMs) && !Number.isNaN(endMs) ? Math.max(0, Math.round((endMs - startMs) / 1000)) : 0;

  const visits = Array.isArray(shift.visits) ? shift.visits : [];
  const rawShopSeconds = visits.reduce((sum, v) => {
    if (v.checkOutTime || v.durationMins != null) {
      return sum + getVisitDurationSeconds(v);
    }
    if (!shift.endTime && v.checkInTime) {
      const checkInMs = new Date(v.checkInTime).getTime();
      if (!Number.isNaN(checkInMs)) {
        return sum + Math.max(0, Math.round((Date.now() - checkInMs) / 1000));
      }
    }
    return sum;
  }, 0);

  const atShopsSeconds = Math.min(totalSeconds, rawShopSeconds);
  const storedOrOdom = computeShiftTravelDistance(shift);
  const waypointKm =
    storedOrOdom.distanceKm > 0
      ? storedOrOdom.distanceKm
      : !shift.endTime
      ? calculateWaypointRouteKm(buildShiftWaypoints({ ...shift, visits }))
      : 0;
  const distanceKm = Math.round(waypointKm * 10) / 10;

  const travelSeconds =
    distanceKm === 0 && visits.length === 0 ? 0 : Math.max(0, totalSeconds - atShopsSeconds);

  return {
    totalSeconds,
    atShopsSeconds,
    travelSeconds,
    distanceKm,
    formattedTotal: totalSeconds > 0 ? formatDurationHuman(totalSeconds) : 'Active',
    formattedAtShops: formatDurationHuman(atShopsSeconds),
    formattedTravel: formatDurationHuman(travelSeconds),
    formattedDistance: `${distanceKm} km`,
  };
}

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
 * Estimates road distance in km for a single route leg, returning 0 inside the 60m stationary band.
 */
export function calculateLegDistanceKm(a: RouteCoordinate, b: RouteCoordinate): number {
  const straight = calculateHaversineKm(a, b);
  if (straight < GPS_STATIONARY_DEADBAND_KM) return 0;
  return Math.round(straight * ROAD_WINDING_MULTIPLIER * 10) / 10;
}

/**
 * Computes estimated road distance across ordered shift waypoints
 * (start -> store visits -> current/end), ignoring stationary jitter under 60m.
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
