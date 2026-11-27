import type { Shift, ShiftSummary } from '../api/types.ts';
import { formatDateIST, getISTDateKey, getISTDateParts } from './dateUtils.ts';
import {
  computeShiftTimingSummary,
  computeShiftTravelDistance,
  formatDurationHuman,
} from './distanceUtils.ts';

export type ShiftFilterPreset =
  | 'today'
  | 'week'
  | 'month'
  | '3months'
  | '6months'
  | 'all'
  | 'custom_date';

export type ShiftStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

export interface ShiftFilterState {
  preset: ShiftFilterPreset;
  customDateKey?: string; // YYYY-MM-DD in IST
  status?: ShiftStatusFilter;
}

export interface ShiftDateRangeResult {
  from?: string;
  to?: string;
  fromDateKey?: string;
  toDateKey?: string;
  label: string;
}

export interface AttendanceKpiMetrics {
  totalShifts: number;
  activeShifts: number;
  completedShifts: number;
  shopsVisited: number;
  salesDoneVisits: number;
  totalDistanceKm: number;
  totalDistanceLabel: string;
  totalDurationSeconds: number;
  totalTimeLabel: string;
}

export const SHIFT_FILTER_PRESETS: Array<{ id: Exclude<ShiftFilterPreset, 'custom_date'>; label: string; shortLabel: string }> = [
  { id: 'today', label: 'Today', shortLabel: 'Today' },
  { id: 'week', label: 'Week', shortLabel: 'Last 7 Days' },
  { id: 'month', label: 'Month', shortLabel: 'Last 1 Month' },
  { id: '3months', label: '3 Months', shortLabel: 'Last 3 Months' },
  { id: '6months', label: '6 Months', shortLabel: 'Last 6 Months' },
  { id: 'all', label: 'All Time', shortLabel: 'All Time' },
];

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function subtractMonthsFromDateKey(
  year: number,
  month1Based: number,
  day: number,
  monthsBack: number
): string {
  const totalMonths = year * 12 + (month1Based - 1) - monthsBack;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(day, maxDay);
  return formatDateKey(targetYear, targetMonth, clampedDay);
}

export function subtractDaysFromDateKey(
  year: number,
  month1Based: number,
  day: number,
  daysBack: number
): string {
  const utc = new Date(Date.UTC(year, month1Based - 1, day - daysBack));
  return formatDateKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

/**
 * Converts an IST YYYY-MM-DD key into exact UTC ISO timestamps for start/end of day in Asia/Kolkata.
 */
export function istDateKeyToIsoBounds(dateKey: string): { startIso: string; endIso: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const start = new Date(`${dateKey}T00:00:00.000+05:30`);
  const end = new Date(`${dateKey}T23:59:59.999+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

/**
 * Resolves exact IST date range boundaries (`from` / `to` UTC ISO strings) and human label.
 */
export function getShiftFilterDateRange(
  filter: Pick<ShiftFilterState, 'preset' | 'customDateKey'>,
  referenceDate: Date = new Date()
): ShiftDateRangeResult {
  const parts = getISTDateParts(referenceDate);
  const todayKey = formatDateKey(parts.year, parts.month, parts.day);

  if (filter.preset === 'custom_date' && filter.customDateKey) {
    const bounds = istDateKeyToIsoBounds(filter.customDateKey);
    if (bounds) {
      return {
        from: bounds.startIso,
        to: bounds.endIso,
        fromDateKey: filter.customDateKey,
        toDateKey: filter.customDateKey,
        label:
          filter.customDateKey === todayKey
            ? `Today (${formatDateIST(bounds.startIso, 'medium')})`
            : formatDateIST(bounds.startIso, 'medium'),
      };
    }
  }

  if (filter.preset === 'all') {
    return { label: 'All Time' };
  }

  let fromKey = todayKey;
  let label = 'Today';

  if (filter.preset === 'week') {
    fromKey = subtractDaysFromDateKey(parts.year, parts.month, parts.day, 6);
    label = 'This Week';
  } else if (filter.preset === 'month') {
    fromKey = subtractMonthsFromDateKey(parts.year, parts.month, parts.day, 1);
    label = 'Last 1 Month';
  } else if (filter.preset === '3months') {
    fromKey = subtractMonthsFromDateKey(parts.year, parts.month, parts.day, 3);
    label = 'Last 3 Months';
  } else if (filter.preset === '6months') {
    fromKey = subtractMonthsFromDateKey(parts.year, parts.month, parts.day, 6);
    label = 'Last 6 Months';
  }

  const fromBounds = istDateKeyToIsoBounds(fromKey);
  const toBounds = istDateKeyToIsoBounds(todayKey);

  return {
    from: fromBounds?.startIso,
    to: toBounds?.endIso,
    fromDateKey: fromKey,
    toDateKey: todayKey,
    label,
  };
}

/**
 * Client-side filter helper matching the exact same IST date bounds & status filter.
 */
export function filterShiftsByState(
  shifts: Shift[],
  filter: ShiftFilterState,
  referenceDate: Date = new Date()
): Shift[] {
  const { from, to } = getShiftFilterDateRange(filter, referenceDate);
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : null;
  const status = filter.status && filter.status !== 'ALL' ? filter.status : null;

  return shifts.filter((s) => {
    const rawStatus = s.status === 'OPEN' ? 'ACTIVE' : s.status;
    if (status && rawStatus !== status) {
      return false;
    }
    if (fromMs !== null || toMs !== null) {
      const startStr = s.startTime || s.startedAt;
      if (!startStr) return false;
      const startMs = new Date(startStr).getTime();
      if (Number.isNaN(startMs)) return false;
      if (fromMs !== null && startMs < fromMs) return false;
      if (toMs !== null && startMs > toMs) return false;
    }
    return true;
  });
}

/**
 * Merges active live shift into filtered history list if its startTime falls within the active filter
 * and it isn't already included in `historyShifts`.
 */
export function mergeLiveShiftIntoFilteredList(
  historyShifts: Shift[],
  currentShift: Shift | null,
  filter: ShiftFilterState,
  referenceDate: Date = new Date()
): Shift[] {
  if (!currentShift || !currentShift.startTime) {
    return filterShiftsByState(historyShifts, filter, referenceDate);
  }
  const hasCurrent = historyShifts.some((s) => s.id === currentShift.id);
  const combined = hasCurrent
    ? historyShifts.map((s) => (s.id === currentShift.id ? currentShift : s))
    : [currentShift, ...historyShifts];

  return filterShiftsByState(combined, filter, referenceDate);
}

/**
 * Computes consistent duration in seconds for any shift (backend `timing`, timestamps, or `durationMins`).
 */
export function getShiftDurationSeconds(shift: Shift, nowMs: number = Date.now()): number {
  if (shift.timing?.totalSeconds != null && Number.isFinite(Number(shift.timing.totalSeconds))) {
    return Math.max(0, Math.round(Number(shift.timing.totalSeconds)));
  }
  const timingSummary = computeShiftTimingSummary(shift);
  if (timingSummary.totalSeconds > 0) {
    return timingSummary.totalSeconds;
  }
  if (shift.durationMins != null && Number.isFinite(Number(shift.durationMins))) {
    return Math.max(0, Math.round(Number(shift.durationMins) * 60));
  }
  if (shift.startTime && (shift.status === 'ACTIVE' || shift.status === 'OPEN')) {
    const startMs = new Date(shift.startTime).getTime();
    if (!Number.isNaN(startMs)) {
      return Math.max(0, Math.round((nowMs - startMs) / 1000));
    }
  }
  return 0;
}

/**
 * Computes attendance & duty KPIs (Shops Visited, Total KM, Total Time, Shifts/Completed)
 * across the active filter window.
 */
export function computeAttendanceKpiMetrics(
  shifts: Shift[],
  serverSummary?: ShiftSummary | null,
  preferLocalShifts = false,
  nowMs: number = Date.now()
): AttendanceKpiMetrics {
  const canUseServerSummary =
    Boolean(serverSummary) &&
    !preferLocalShifts &&
    (serverSummary!.totalShifts > shifts.length);

  if (canUseServerSummary && serverSummary) {
    const dist = Math.round((Number(serverSummary.totalDistanceKm || 0)) * 10) / 10;
    const secs = Math.max(0, Math.round(serverSummary.totalDurationSeconds || 0));
    return {
      totalShifts: serverSummary.totalShifts,
      activeShifts: serverSummary.activeShifts,
      completedShifts: serverSummary.completedShifts,
      shopsVisited: serverSummary.totalVisits,
      salesDoneVisits: shifts.reduce(
        (sum, s) =>
          sum +
          (s.visits || []).filter((v) => Boolean(v.saleDone || v.saleId || v.orderPlaced)).length,
        0
      ),
      totalDistanceKm: dist,
      totalDistanceLabel: `${dist} km`,
      totalDurationSeconds: secs,
      totalTimeLabel: secs > 0 ? formatDurationHuman(secs) : '0m',
    };
  }

  let activeShifts = 0;
  let completedShifts = 0;
  let shopsVisited = 0;
  let salesDoneVisits = 0;
  let totalKm = 0;
  let totalDurationSeconds = 0;

  for (const s of shifts) {
    const isActive = s.status === 'ACTIVE' || s.status === 'OPEN';
    if (isActive) activeShifts += 1;
    else if (s.status === 'COMPLETED' || Boolean(s.endTime)) completedShifts += 1;

    const visits = Array.isArray(s.visits) ? s.visits : [];
    const visitCount = visits.length > 0 ? visits.length : Number(s.timing?.visitCount ?? 0);
    shopsVisited += visitCount;
    salesDoneVisits += visits.filter((v) => Boolean(v.saleDone || v.saleId || v.orderPlaced)).length;

    const timing = computeShiftTimingSummary(s);
    const travel = computeShiftTravelDistance(s);
    const shiftKm = timing.distanceKm > 0 ? timing.distanceKm : travel.distanceKm;
    totalKm += shiftKm;

    totalDurationSeconds += getShiftDurationSeconds(s, nowMs);
  }

  const roundedKm = Math.round(totalKm * 10) / 10;

  return {
    totalShifts: shifts.length,
    activeShifts,
    completedShifts,
    shopsVisited,
    salesDoneVisits,
    totalDistanceKm: roundedKm,
    totalDistanceLabel: `${roundedKm} km`,
    totalDurationSeconds,
    totalTimeLabel: totalDurationSeconds > 0 ? formatDurationHuman(totalDurationSeconds) : '0m',
  };
}

export interface CalendarCell {
  dateKey: string | null;
  dayNumber: number | null;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Generates leading nulls + day cells for a 7-column month calendar grid anchored to IST.
 */
export function buildCalendarMonthCells(
  year: number,
  month1Based: number,
  referenceDate: Date = new Date()
): CalendarCell[] {
  const daysInMonth = getDaysInMonth(year, month1Based);
  const firstWeekday = new Date(Date.UTC(year, month1Based - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
  const todayKey = getISTDateKey(referenceDate);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ dateKey: null, dayNumber: null, isToday: false, isFuture: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatDateKey(year, month1Based, d);
    cells.push({
      dateKey: key,
      dayNumber: d,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, dayNumber: null, isToday: false, isFuture: false });
  }
  return cells;
}
